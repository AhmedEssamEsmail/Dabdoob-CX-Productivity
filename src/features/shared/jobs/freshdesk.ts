/**
 * Freshdesk ticket sync — verbatim port of
 * ../Command_Center_V2_deprecated/FreshdeskSync.js.
 *
 * Seams: PropertiesService -> the `config` table (cursor/running-marker keys)
 * and the FRESHDESK_API_KEY environment variable; UrlFetchApp -> fetch;
 * CacheService -> the in-process cache; dqUpsert_('tickets') -> Postgres
 * upsert on ticket_id. `freshdesk_domain` stays a config setting (DQ_SETTINGS).
 *
 * Without FRESHDESK_API_KEY the sync records a skipped run and never
 * fabricates ticket rows.
 */

import { db, appendRow, cacheGet, cachePut } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { described } from '@/features/shared/lib/errors'

// FD_TICKET_HEADERS is in QueueCore.js (the Queue app's TL metrics read it too).
export const FD_STATUS_NAMES: Record<number, string> = {
  2: 'Open', 3: 'Pending', 4: 'Resolved', 5: 'Closed', 6: 'Waiting on Customer', 7: 'Pending on CX',
  8: 'Pending on Ops', 9: 'No Response From customer', 10: 'Pending on 3PL',
}
export const FD_SOURCE_NAMES: Record<number, string> = {
  1: 'Email', 2: 'Portal', 3: 'Phone', 7: 'Chat', 9: 'Feedback Widget', 10: 'Outbound Email',
}
// PropertiesService keys -> config table keys.
const FD_FULL_CURSOR_PROP = 'v2_fd_full_cursor'
const FD_INC_CURSOR_PROP = 'v2_fd_inc_cursor'
const FD_RUNNING_PROP = 'v2_fd_sync_running'
const FD_PAGE_CAP = 300
const FD_PER_PAGE = 100

export function fdApiKey_(): string {
  const key = String(process.env.FRESHDESK_API_KEY || '')
  if (!key) {
    throw new Error('FRESHDESK_API_KEY is not set. Add it to the environment before running the sync.')
  }
  return key
}

export function hasFreshdeskKey(): boolean {
  return !!String(process.env.FRESHDESK_API_KEY || '').trim()
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms))
}

/** fdGet_ verbatim: GET a Freshdesk API path; retries 429 up to 3 times. */
export async function fdGet_(path: string): Promise<unknown> {
  const domain = String((await getConfig('freshdesk_domain', 'dabdoobapp.freshdesk.com')) || 'dabdoobapp.freshdesk.com')
  const url = 'https://' + domain + path
  const auth = 'Basic ' + Buffer.from(fdApiKey_() + ':X').toString('base64')
  for (let attempt = 0; attempt < 4; attempt++) {
    const res = await fetch(url, { method: 'get', headers: { Authorization: auth }, cache: 'no-store' })
    const code = res.status
    if (code === 200) return res.json()
    if (code === 429 && attempt < 3) {
      const wait = Number(res.headers.get('Retry-After') || res.headers.get('retry-after') || 2)
      await sleep(Math.min(60, Math.max(1, wait)) * 1000)
      continue
    }
    if (code === 401 || code === 403) throw new Error('Freshdesk refused the API key (HTTP ' + code + '). Check FRESHDESK_API_KEY.')
    throw new Error('Freshdesk ' + path.split('?')[0] + ' failed with HTTP ' + code + '.')
  }
  throw new Error('Freshdesk kept rate-limiting the sync.')
}

/** fdGroups_ verbatim: group id -> name from /groups (paginated), cached 6 h. */
export async function fdGroups_(): Promise<Record<string, string>> {
  const hit = cacheGet('fd_groups_v1')
  if (hit) return JSON.parse(String(hit))
  const map: Record<string, string> = {}
  for (let page = 1; page <= 20; page++) {
    const list = (await fdGet_('/api/v2/groups?per_page=100&page=' + page)) as { id: unknown; name: string }[]
    list.forEach((g) => {
      map[String(g.id)] = g.name
    })
    if (list.length < 100) break
  }
  cachePut('fd_groups_v1', JSON.stringify(map), 21600)
  return map
}

export function fdIso_(s: unknown): string {
  if (!s) return ''
  const d = new Date(String(s))
  return isNaN(d.getTime()) ? '' : d.toISOString()
}

/** fdTicketToRow_ verbatim: one Freshdesk ticket -> one `tickets` row; no PII. */
export function fdTicketToRow_(t: Record<string, unknown>, groups: Record<string, string>, syncedAt: string): Record<string, unknown> {
  const cf = (t.custom_fields || {}) as Record<string, unknown>
  const st = (t.stats || {}) as Record<string, unknown>
  return {
    ticket_id: String(t.id),
    status: FD_STATUS_NAMES[t.status as number] || 'Status ' + t.status,
    group_name: t.group_id ? groups[String(t.group_id)] || 'Group ' + t.group_id : '',
    responder_id: t.responder_id ? String(t.responder_id) : '',
    requester_id: t.requester_id ? String(t.requester_id) : '',
    channel: String(cf.cf_channel || ''),
    country: String(cf.cf_country || ''),
    contact_type_1: String(cf.cf_contact_type_1 || ''),
    created_at: fdIso_(t.created_at),
    updated_at: fdIso_(t.updated_at),
    resolved_at: fdIso_(st.resolved_at),
    closed_at: fdIso_(st.closed_at),
    status_code: t.status,
    group_id: t.group_id ? String(t.group_id) : '',
    source: FD_SOURCE_NAMES[t.source as number] || 'Source ' + t.source,
    contact_type_2: String(cf.cf_contact_type_2 || ''),
    contact_type_3: String(cf.cf_contact_type_3 || ''),
    priority: t.priority || '',
    is_escalated: t.is_escalated === true,
    first_responded_at: fdIso_(st.first_responded_at),
    status_updated_at: fdIso_(st.status_updated_at),
    due_by: fdIso_(t.due_by),
    fr_due_by: fdIso_(t.fr_due_by),
    synced_at: syncedAt,
  }
}

// ---------- escalation sightings (inflow) ----------
const FD_ESC_SEEN_TABLE = 'esc_seen'

/** fdStatusAliases_ verbatim: inflow status labels -> label + "Status <code>" spellings. */
export function fdStatusAliases_(labels: unknown): Record<string, string> {
  const out: Record<string, string> = {}
  ;((labels as string[]) || []).forEach((l0) => {
    const l = String(l0)
    out[l] = l
    Object.keys(FD_STATUS_NAMES).forEach((code) => {
      if (FD_STATUS_NAMES[Number(code)] === l) out['Status ' + code] = l
    })
  })
  return out
}

/** fdNewSightings_ verbatim (pure): sighting rows for escalations not yet in `seen` (updated). */
export function fdNewSightings_(
  items: { ticket_id: unknown; status: unknown; at: string }[],
  seen: Record<string, boolean>,
  aliases: Record<string, string>,
  source: string
): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  items.forEach((it) => {
    const id = String(it.ticket_id || '')
    const label = aliases[String(it.status || '').trim()]
    if (!id || !label || seen[id]) return
    seen[id] = true
    out.push({ ticket_id: id, status: label, seen_at: it.at || '', source })
  })
  return out
}

/** fdSeenEscalations_ verbatim. */
export async function fdSeenEscalations_(): Promise<Record<string, boolean>> {
  const seen: Record<string, boolean> = {}
  const { data, error } = await db().from(FD_ESC_SEEN_TABLE).select('ticket_id')
  if (error && (error as { code?: string }).code !== '42P01') throw described(error, { table: FD_ESC_SEEN_TABLE })
  ;(data || []).forEach((r) => {
    seen[String((r as { ticket_id: unknown }).ticket_id)] = true
  })
  return seen
}

/** fdRecordSightings_ verbatim: sightings from one sync batch of ticket rows. */
export async function fdRecordSightings_(rows: Record<string, unknown>[], syncedAt: string): Promise<number> {
  const esc = String((await getConfig('inflow_escalation_channel', 'Internal Escalation')) || 'Internal Escalation')
  const items = rows
    .filter((r) => String(r.channel) === esc)
    .map((r) => ({ ticket_id: r.ticket_id, status: r.status, at: String(r.status_updated_at || syncedAt) }))
  if (!items.length) return 0
  const statuses = (await getConfig('inflow_escalation_statuses', ['Pending on CX'])) as string[]
  const fresh = fdNewSightings_(items, await fdSeenEscalations_(), fdStatusAliases_(statuses), 'sync')
  if (!fresh.length) return 0
  const { error } = await db().from(FD_ESC_SEEN_TABLE).insert(fresh)
  if (error) throw described(error, { table: FD_ESC_SEEN_TABLE })
  return fresh.length
}

function fdTicketsPage_(since: string, page: number): Promise<Record<string, unknown>[]> {
  return fdGet_(
    '/api/v2/tickets?updated_since=' +
      encodeURIComponent(since) +
      '&order_by=updated_at&order_type=asc&per_page=' +
      FD_PER_PAGE +
      '&page=' +
      page +
      '&include=stats'
  ) as Promise<Record<string, unknown>[]>
}

async function dqUpsertTickets_(rows: Record<string, unknown>[]): Promise<{ updated: number; appended: number }> {
  if (!rows.length) return { updated: 0, appended: 0 }
  const { error } = await db().from('tickets').upsert(rows, { onConflict: 'ticket_id' })
  if (error) throw described(error, { table: 'tickets' })
  return { updated: rows.length, appended: 0 }
}

/** dqLogRun_ seam -> refresh_log row. */
async function fdLogRun_(job: string, started: number, status: string, info: Record<string, unknown>): Promise<void> {
  await appendRow('refresh_log', {
    job, started_at: new Date(started).toISOString(), finished_at: new Date().toISOString(),
    rows_in: Number(info.rowsIn || 0), rows_out: Number(info.rowsOut || 0),
    source_cursor: info.cursor ? String(info.cursor) : '', status, error: String(info.error || ''),
    note: String(info.note || ''), log_id: '', type: 'job',
  }, 'system:job')
}

/**
 * fdSyncLoop_ verbatim: batches of up to FD_PAGE_CAP pages from the cursor;
 * each batch is upserted and the cursor saved before the next one.
 */
export async function fdSyncLoop_(
  cursor: string,
  cursorProp: string,
  budgetMs: number,
  started: number
): Promise<{ done: boolean; written: number; cursor: string }> {
  const groups = await fdGroups_()
  let written = 0
  for (;;) {
    const batch: Record<string, Record<string, unknown>> = {}
    let lastUpdated: string | null = null
    let page = 1
    let done = false
    while (page <= FD_PAGE_CAP) {
      const tickets = await fdTicketsPage_(cursor, page)
      if (!tickets || !tickets.length) {
        done = true
        break
      }
      tickets.forEach((t) => {
        batch[String(t.id)] = t
        lastUpdated = String(t.updated_at)
      })
      if (tickets.length < FD_PER_PAGE) {
        done = true
        break
      }
      if (Date.now() - started > budgetMs) break
      page++
      await sleep(300)
    }
    const syncedAt = new Date().toISOString()
    const rows = Object.keys(batch).map((id) => fdTicketToRow_(batch[id], groups, syncedAt))
    const res = await dqUpsertTickets_(rows)
    written += res.updated + res.appended
    await fdRecordSightings_(rows, syncedAt)
    // The cursor only moves forward: the incremental run re-reads a 5-minute overlap.
    const saved = (await getConfig(cursorProp, '')) as string
    if (lastUpdated && (!saved || new Date(lastUpdated) > new Date(String(saved)))) {
      await setConfig(cursorProp, lastUpdated, 'Freshdesk sync cursor (FreshdeskSync.js).', 'system:job')
    }
    if (done) {
      const cur = ((await getConfig(cursorProp, cursor)) as string) || cursor
      return { done: true, written, cursor: String(cur) }
    }
    if (!lastUpdated || (lastUpdated === cursor && page > FD_PAGE_CAP)) {
      throw new Error('Freshdesk sync made no progress past ' + cursor + '; cursor kept.')
    }
    cursor = lastUpdated
    if (Date.now() - started > budgetMs) return { done: false, written, cursor }
  }
}

/** fdAcquireRun_ verbatim: single-runner marker, stale after 8 min. */
export async function fdAcquireRun_(kind: string): Promise<boolean> {
  const cur = ((await getConfig(FD_RUNNING_PROP, '')) as string) || ''
  let parsed: { kind?: string; at?: number } | null = null
  try {
    parsed = cur ? JSON.parse(cur) : null
  } catch {
    parsed = null
  }
  if (parsed && Date.now() - Number(parsed.at) < 8 * 60000) return false
  await setConfig(FD_RUNNING_PROP, JSON.stringify({ kind, at: Date.now() }), 'Freshdesk sync in-flight marker.', 'system:job')
  return true
}

export async function fdReleaseRun_(): Promise<void> {
  await setConfig(FD_RUNNING_PROP, '', 'Freshdesk sync in-flight marker.', 'system:job')
}

/** dqSyncedTo_ verbatim: the incremental cursor as a Date, or null. */
export async function dqSyncedTo_(): Promise<Date | null> {
  const c = (await getConfig(FD_INC_CURSOR_PROP, '')) as string
  const d = c ? new Date(String(c)) : null
  return d && !isNaN(d.getTime()) ? d : null
}

/**
 * fdSyncIncremental_ verbatim: called by jobDataTick. Skips while a full sync
 * is running or has not finished. Re-reads 5 minutes before the cursor.
 */
export async function fdSyncIncremental_(budgetMs?: number): Promise<Record<string, unknown>> {
  const started = Date.now()
  if (await getConfig(FD_FULL_CURSOR_PROP, '')) return { skipped: 'full sync in progress' }
  const cursor = (await getConfig(FD_INC_CURSOR_PROP, '')) as string
  if (!cursor) return { skipped: 'run runFreshdeskFullSync first' }
  fdApiKey_()
  if (!(await fdAcquireRun_('incremental'))) return { skipped: 'another sync is running' }
  try {
    const since = new Date(new Date(String(cursor)).getTime() - 5 * 60000).toISOString().replace('.000Z', 'Z')
    const r = await fdSyncLoop_(since, FD_INC_CURSOR_PROP, budgetMs || 150000, started)
    await fdLogRun_('freshdesk_sync', started, r.done ? 'ok' : 'partial', { rowsOut: r.written, cursor: r.cursor })
    return r
  } catch (e) {
    await fdLogRun_('freshdesk_sync', started, 'error', { error: e instanceof Error ? e.message : String(e), cursor })
    throw e
  } finally {
    await fdReleaseRun_()
  }
}

/**
 * runFreshdeskFullSync verbatim: the admin-run backfill; reschedules itself
 * until done, then hands over to the incremental cursor.
 */
export async function runFreshdeskFullSync(): Promise<string> {
  fdApiKey_()
  const started = Date.now()
  if (!(await fdAcquireRun_('full'))) {
    return 'Another sync is running; retrying in a minute.'
  }
  try {
    const cursor = ((await getConfig(FD_FULL_CURSOR_PROP, '')) as string) || String((await getConfig('freshdesk_full_sync_start', '')) || '')
    const r = await fdSyncLoop_(cursor || '2000-01-01T00:00:00Z', FD_FULL_CURSOR_PROP, 4.5 * 60000, started)
    if (r.done) {
      await setConfig(FD_FULL_CURSOR_PROP, '', 'Freshdesk full-sync cursor.', 'system:job')
      await setConfig(FD_INC_CURSOR_PROP, r.cursor, 'Freshdesk incremental cursor.', 'system:job')
      await fdLogRun_('freshdesk_full_sync', started, 'ok', { rowsOut: r.written, cursor: r.cursor, note: 'complete' })
      return 'Full sync complete. ' + r.written + ' tickets written this run.'
    }
    await fdLogRun_('freshdesk_full_sync', started, 'partial', { rowsOut: r.written, cursor: r.cursor, note: 'continuing' })
    return 'Paused at ' + r.cursor + ' (' + r.written + ' tickets this run).'
  } catch (e) {
    await fdLogRun_('freshdesk_full_sync', started, 'error', {
      error: e instanceof Error ? e.message : String(e),
      cursor: await getConfig(FD_FULL_CURSOR_PROP, ''),
    })
    throw e
  } finally {
    await fdReleaseRun_()
  }
}

/** jobDataTick seam: incremental sync that records skipped runs instead of throwing. */
export async function runFreshdeskSyncStep(budgetMs?: number): Promise<Record<string, unknown>> {
  if (!hasFreshdeskKey()) {
    await fdLogRun_('freshdesk_sync', Date.now(), 'skipped', {
      note: 'FRESHDESK_API_KEY is not set; ticket state left as-is.',
    })
    return { skipped: 'FRESHDESK_API_KEY is not set' }
  }
  return fdSyncIncremental_(budgetMs)
}
