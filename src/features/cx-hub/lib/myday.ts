/**
 * Assistant.js — verbatim port of Command_Center_V2_deprecated/Assistant.js
 * (My assistant, requirement 17). Owner-only. Calendar/Gmail/Drive go through
 * the myday-google adapter: when it reports configured:false the section
 * functions throw the not-configured error, which asSection_ turns into the
 * section error envelope exactly like a failed Gmail read did in GAS.
 *
 * The Apps Script caches become the repo cache (cc_myday_v2_* keys); the
 * ScriptApp trigger for the 07:30 digest becomes the assistant_digest_installed
 * config flag that /api/cron/job-assistant-digest honors.
 */

import 'server-only'

import {
  appendRow,
  assistantOwnerEmail,
  configAll,
  dqTitleLevel_,
  escapeHtml,
  getConfig,
  pwDirectory,
  readStore,
  realEmail,
  sendMail,
  setConfig,
} from '@/features/shared/platform'
import { dbCacheGet, dbCachePut, dbCacheRemove } from '@/features/shared/platform/shared-cache'
import { assertWritable } from '@/features/shared/platform/viewas'
import { getConfig_, normEmail_, type Cfg } from '@/features/shared/lib/adapters'
import { google, GOOGLE_NOT_CONFIGURED, type GoogleCalEvent } from './myday-google'

export const AS_TZ = 'Asia/Kuwait'
export const AS_CACHE_PREFIX = 'cc_myday_v2_'
export const AS_CACHE_SECONDS = 21600
export const AS_PARTS = ['core', 'mail', 'files', 'followups']
export const AS_DIGEST_HANDLER = 'jobAssistantMorningDigest'
export const AS_WARM_HANDLER = 'jobWarmMyDay'
export const AS_GMAIL_THREADS = 30
export const AS_GMAIL_BATCH = 15
export const AS_SETTING_KEYS: Record<string, { dflt: unknown; desc: string }> = {
  assistant_reply_after_hours: { dflt: 24, desc: 'My day: unread or starred inbox threads older than this many hours count as waiting for your reply.' },
  assistant_work_hours: { dflt: '09:30-18:30', desc: 'My day: your working hours (Kuwait), used for focus block suggestions.' },
  assistant_focus_min_minutes: { dflt: 45, desc: 'My day: shortest free gap worth suggesting as a focus block.' },
  assistant_drive_days: { dflt: 7, desc: 'My day: how many days of recently changed Drive files to show.' },
}

// ---------------------------------------------------------------------------
// Access
// ---------------------------------------------------------------------------

/** requireAssistantOwner_ — the signed-in caller, not the View as person. */
export async function requireAssistantOwner_(): Promise<string> {
  const email = await realEmail()
  const owner = await assistantOwnerEmail()
  if (!owner || email !== owner)
    throw new Error('My day is a personal assistant for ' + (owner || 'the owner') + ' only.')
  return email
}

export async function assistantSettings_(cfg?: Cfg): Promise<Record<string, unknown>> {
  const out: Record<string, unknown> = {}
  if (!cfg) cfg = await configAll()
  Object.keys(AS_SETTING_KEYS).forEach((k) => {
    out[k] = getConfig_(cfg as Cfg, k, AS_SETTING_KEYS[k].dflt)
  })
  return out
}

// ---------------------------------------------------------------------------
// Time helpers (Kuwait is UTC+3, no DST)
// ---------------------------------------------------------------------------

export function asKuwaitDate_(ms: number): string {
  const d = new Date(ms + 3 * 3600000)
  return d.getUTCFullYear() + '-' + ('0' + (d.getUTCMonth() + 1)).slice(-2) + '-' + ('0' + d.getUTCDate()).slice(-2)
}

export function asDayStart_(ms: number): number {
  return Date.parse(asKuwaitDate_(ms) + 'T00:00:00+03:00')
}

export function asHm_(s: unknown, fallback: number): number {
  const m = /^(\d{1,2}):(\d{2})$/.exec(String(s || '').trim())
  return m ? Number(m[1]) * 60 + Number(m[2]) : fallback
}

/** suggestFocusBlocks_ verbatim (pure, tested by the golden suite). */
export function suggestFocusBlocks_(
  events: { start: unknown; end: unknown }[],
  day: string,
  work: string,
  minMin: number,
  maxMin: number,
  nowMs: number
): { start: string; end: string; minutes: number }[] {
  const parts = String(work || '09:30-18:30').split('-')
  const base = Date.parse(day + 'T00:00:00+03:00')
  const ws = base + asHm_(parts[0], 570) * 60000
  const we = base + asHm_(parts[1], 1110) * 60000
  const from = Math.max(ws, nowMs ? Math.ceil(nowMs / 900000) * 900000 : ws)
  const busy = (events || [])
    .map((e) => [
      typeof e.start === 'number' ? (e.start as number) : Date.parse(String(e.start)),
      typeof e.end === 'number' ? (e.end as number) : Date.parse(String(e.end)),
    ])
    .filter((b) => b[1] > from && b[0] < we)
    .sort((a, b) => a[0] - b[0])
  const out: { start: string; end: string; minutes: number }[] = []
  let cursor = from
  const minMs = (minMin || 45) * 60000
  const maxMs = (maxMin || 120) * 60000
  busy.concat([[we, we]]).forEach((b) => {
    const gapEnd = Math.min(b[0], we)
    while (gapEnd - cursor >= minMs) {
      const end = Math.min(cursor + maxMs, gapEnd)
      out.push({
        start: new Date(cursor).toISOString(),
        end: new Date(end).toISOString(),
        minutes: Math.round((end - cursor) / 60000),
      })
      cursor = end
    }
    cursor = Math.max(cursor, b[1])
  })
  return out
}

// ---------------------------------------------------------------------------
// Sections
// ---------------------------------------------------------------------------

async function asTableOrEmpty_(
  name: string,
  where?: (r: Record<string, unknown>) => boolean
): Promise<Record<string, unknown>[]> {
  const store = await readStore(name)
  if (!store.exists) return []
  return where ? store.rows.filter(where) : store.rows
}

function asOpen_(a: Record<string, unknown>): boolean {
  const s = String(a.status || 'open')
  return s === 'open' || s === 'blocked'
}

function isTrue_(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === 'true'
}

interface AsEvent {
  id: string
  title: string
  start: string
  end: string
  allDay: boolean
  location: string
  myStatus: string
  guests: number
  source?: string
  meeting: Record<string, unknown> | null
  actions: Record<string, unknown>[]
}

interface AsContext {
  openActions: Record<string, unknown>[]
  series: Record<string, unknown>[]
  oneOnOnes: Record<string, unknown>[]
  nameOf?: (e: string) => string
}

/** asEventsTwoDays_ verbatim — calendar via the adapter (throws when unconfigured). */
async function asEventsTwoDays_(
  dayStartMs: number,
  ctx: AsContext
): Promise<{ today: AsEvent[]; tomorrow: AsEvent[] }> {
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const evs = await g.calendarEvents(new Date(dayStartMs), new Date(dayStartMs + 2 * 86400000))
  const all = evs
    .map((e: GoogleCalEvent) => {
      const title = String(e.title || '(no title)')
      const start = e.start
      const end = e.end
      const match = asMatchMeeting_(title, start, ctx)
      let status = ''
      try {
        status = String(e.myStatus || '')
      } catch {
        status = ''
      }
      return {
        id: String(e.id),
        title,
        start: new Date(start).toISOString(),
        end: new Date(end).toISOString(),
        allDay: !!e.allDay,
        location: String(e.location || ''),
        myStatus: status,
        guests: e.guests || 0,
        meeting: match
          ? { kind: match.kind, label: match.label, person: match.person || '', scheduleId: match.scheduleId || '', link: match.link || '' }
          : null,
        actions: match ? match.actions : [],
        _s: start,
        _e: end,
      }
    })
    .filter((e) => e.myStatus !== 'NO')
  const day = (from: number): AsEvent[] =>
    all
      .filter((e) => e._s < from + 86400000 && e._e > from)
      .map((e) => {
        const o: Record<string, unknown> = {}
        Object.keys(e).forEach((k) => {
          if (k.charAt(0) !== '_') o[k] = (e as Record<string, unknown>)[k]
        })
        return o as unknown as AsEvent
      })
  return { today: day(dayStartMs), tomorrow: day(dayStartMs + 86400000) }
}

export function asDue_(v: unknown): string {
  if (v instanceof Date) return isNaN(v.getTime()) ? '' : asKuwaitDate_(v.getTime())
  const s = String(v || '').trim()
  if (/^\d{4}-\d{2}-\d{2}T/.test(s) && isFinite(Date.parse(s))) return asKuwaitDate_(Date.parse(s))
  return s.slice(0, 10)
}

function asActionOut_(a: Record<string, unknown>): Record<string, unknown> {
  return {
    id: String(a.action_id),
    title: String(a.title),
    owner: String(a.owner_email),
    due: asDue_(a.due_date),
    status: String(a.status || 'open'),
  }
}

/** asMatchMeeting_ verbatim. */
export function asMatchMeeting_(
  title: string,
  startMs: number,
  ctx: AsContext
): { kind: string; label: string; person?: string; scheduleId?: string; link?: string; actions: Record<string, unknown>[] } | null {
  const t = title.toLowerCase()
  const series = ctx.series.filter((s) => {
    const st = String(s.title || '').toLowerCase().trim()
    return st.length >= 3 && (t.indexOf(st) !== -1 || st.indexOf(t) !== -1)
  })[0]
  if (series) {
    return {
      kind: 'meeting',
      label: String(series.title),
      actions: ctx.openActions.filter((a) => String(a.series_id) === String(series.series_id)).map(asActionOut_),
    }
  }
  const near = ctx.oneOnOnes.filter((s) => Math.abs(Date.parse(String(s.scheduled_at)) - startMs) <= 30 * 60000)
  const oo =
    near.filter((s) => asTitleNames_(t, String(s.report_email), ctx))[0] ||
    (near.length === 1 && /\b1\s*[:\-]\s*1\b|one[\s-]*(to|on)[\s-]*one/.test(t) ? near[0] : null)
  if (oo) return asOneOnOneMatch_(oo, ctx)
  return null
}

/** asTitleNames_ verbatim. */
export function asTitleNames_(t: string, email: string, ctx: AsContext): boolean {
  const name = String(ctx.nameOf ? ctx.nameOf(email) : '').toLowerCase().trim()
  const local = normEmail_(email).split('@')[0]
  const keys = [name, name.split(/\s+/)[0], local, local.split(/[._-]/)[0]].filter((k) => k && k.length >= 3)
  return keys.some((k) => t.indexOf(k) !== -1)
}

/** asOneOnOneMatch_ verbatim. */
export function asOneOnOneMatch_(
  oo: Record<string, unknown>,
  ctx: AsContext
): { kind: string; label: string; person: string; scheduleId: string; link: string; actions: Record<string, unknown>[] } {
  const key = normEmail_(oo.manager_email) + '|' + normEmail_(oo.report_email)
  const who = ctx.nameOf ? ctx.nameOf(String(oo.report_email)) : String(oo.report_email)
  return {
    kind: 'one_on_one',
    label: '1:1 with ' + who,
    person: who,
    scheduleId: String(oo.schedule_id),
    link: '#/one-on-ones?schedule=' + encodeURIComponent(String(oo.schedule_id)),
    actions: ctx.openActions.filter((a) => String(a.series_id) === key).map(asActionOut_),
  }
}

/** asAddOneOnOnes_ verbatim — merges app-booked 1:1s that have no calendar twin. */
export function asAddOneOnOnes_(
  days: { today: AsEvent[]; tomorrow: AsEvent[] },
  dayStartMs: number,
  ctx: AsContext
): { today: AsEvent[]; tomorrow: AsEvent[] } {
  const shown: Record<string, boolean> = {}
  ;(['today', 'tomorrow'] as const).forEach((k) => {
    days[k].forEach((e) => {
      if (e.meeting && e.meeting.scheduleId) shown[String(e.meeting.scheduleId)] = true
    })
  })
  ctx.oneOnOnes.forEach((oo) => {
    const start = Date.parse(String(oo.scheduled_at))
    if (!isFinite(start) || shown[String(oo.schedule_id)]) return
    const k =
      start >= dayStartMs && start < dayStartMs + 86400000
        ? 'today'
        : start >= dayStartMs + 86400000 && start < dayStartMs + 2 * 86400000
          ? 'tomorrow'
          : ''
    if (!k) return
    const m = asOneOnOneMatch_(oo, ctx)
    const end = start + (Number(oo.duration_min) || 30) * 60000
    days[k].push({
      id: 'oos-' + String(oo.schedule_id),
      title: m.label,
      start: new Date(start).toISOString(),
      end: new Date(end).toISOString(),
      allDay: false,
      location: '',
      myStatus: 'OWNER',
      guests: 1,
      source: 'one_on_one',
      meeting: { kind: m.kind, label: m.label, person: m.person, scheduleId: m.scheduleId, link: m.link },
      actions: m.actions,
    })
  })
  ;(['today', 'tomorrow'] as const).forEach((k) => {
    days[k].sort((a, b) => Date.parse(a.start) - Date.parse(b.start))
  })
  return days
}

/** asNameOf_ — email -> roster name via the ported directory. */
async function asNameOf_(): Promise<(e: string) => string> {
  try {
    const dir = await pwDirectory()
    return (e: string) => dir.name(e)
  } catch {
    return (x: string) => String(x || '')
  }
}

async function asContext_(owner: string): Promise<AsContext> {
  const openActions = await asTableOrEmpty_('actions', asOpen_)
  return {
    openActions,
    series: await asTableOrEmpty_('meeting_series', (s) => s.active === '' || isTrue_(s.active)),
    oneOnOnes: await asTableOrEmpty_(
      'one_on_one_schedule',
      (s) => normEmail_(s.manager_email) === owner && String(s.status || 'scheduled') === 'scheduled'
    ),
    nameOf: await asNameOf_(),
  }
}

/** asDeadlines_ verbatim. */
export function asDeadlines_(owner: string, ctx: AsContext, nowMs: number): Record<string, unknown>[] {
  const horizon = asKuwaitDate_(nowMs + 7 * 86400000)
  const today = asKuwaitDate_(nowMs)
  return ctx.openActions
    .filter((a) => {
      const due = asDue_(a.due_date)
      if (!due || due > horizon) return false
      return normEmail_(a.owner_email) === owner || (normEmail_(a.assigned_by) === owner && isTrue_(a.track_as_task))
    })
    .map((a) => {
      const o = asActionOut_(a)
      o.mine = normEmail_(a.owner_email) === owner
      o.overdue = (o.due as string) < today
      o.source = String(a.source_type || '')
      return o
    })
    .sort((x, y) => ((x.due as string) < (y.due as string) ? -1 : (x.due as string) > (y.due as string) ? 1 : 0))
}

/** asHeader_ verbatim. */
export function asHeader_(msg: { payload?: { headers?: { name: string; value: string }[] } }, name: string): string {
  const hs = (msg && msg.payload && msg.payload.headers) || []
  for (let i = 0; i < hs.length; i++)
    if (String(hs[i].name).toLowerCase() === name.toLowerCase()) return String(hs[i].value || '')
  return ''
}

/** asGmailThreads_ verbatim — metadata reads through the adapter. */
async function asGmailThreads_(ids: string[], headers?: string[]) {
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const hdrs = headers || ['From', 'Subject']
  const got: Record<string, unknown>[] = []
  for (let i = 0; i < ids.length; i += AS_GMAIL_BATCH) {
    const chunk = ids.slice(i, i + AS_GMAIL_BATCH)
    ;(await g.getThreads(chunk, hdrs)).forEach((t, j) => {
      got[i + j] = t as unknown as Record<string, unknown>
    })
  }
  return ids.map((_id, i) => got[i])
}

/** asAwaitingReply_ verbatim (Gmail -> adapter). */
export async function asAwaitingReply_(owner: string, hours: unknown, nowMs: number): Promise<Record<string, unknown>[]> {
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const h = Number(hours || 24)
  const base = 'in:inbox newer_than:30d' + (h >= 24 ? ' older_than:' + Math.floor(h / 24) + 'd' : '')
  const ids: string[] = []
  const seen: Record<string, boolean> = {}
  for (const q of [base + ' is:starred', base + ' is:unread -is:starred']) {
    const list = await g.listThreads(q, AS_GMAIL_THREADS)
    list.forEach((id) => {
      if (!seen[id]) {
        seen[id] = true
        ids.push(id)
      }
    })
  }
  const cutoff = nowMs - h * 3600000
  const out: Record<string, unknown>[] = []
  const threads = await asGmailThreads_(ids)
  threads.forEach((th, i) => {
    const id = ids[i]
    const msgs = (th && (th as { messages?: { internalDate?: string; labelIds?: string[] }[] }).messages) || []
    if (!msgs.length) return
    const lastMsg = msgs[msgs.length - 1]
    const last = Number(lastMsg.internalDate)
    if (!isFinite(last) || last > cutoff) return
    const from = asHeader_(lastMsg as never, 'From')
    const lastLabels = lastMsg.labelIds || []
    if (lastLabels.indexOf('SENT') !== -1 || from.toLowerCase().indexOf(owner) !== -1) return
    let labels: string[] = []
    msgs.forEach((m) => {
      labels = labels.concat(m.labelIds || [])
    })
    out.push({
      id,
      subject: asHeader_(msgs[0] as never, 'Subject') || '(no subject)',
      from: from.replace(/<.*>/, '').replace(/"/g, '').trim() || from,
      lastAt: new Date(last).toISOString(),
      hoursWaiting: Math.floor((nowMs - last) / 3600000),
      unread: labels.indexOf('UNREAD') !== -1,
      starred: labels.indexOf('STARRED') !== -1,
      url: 'https://mail.google.com/mail/u/0/#inbox/' + id,
    })
  })
  out.sort((a, b) => (b.hoursWaiting as number) - (a.hoursWaiting as number))
  return out
    .filter((m) => m.starred)
    .slice(0, 25)
    .concat(out.filter((m) => !m.starred).slice(0, 25))
}

/** searchMyMail verbatim — read-only metadata, newest first, 20 max. */
export async function searchMyMail(query: string): Promise<Record<string, unknown>[]> {
  const owner = await requireAssistantOwner_()
  const q = String(query || '').trim().slice(0, 200)
  if (!q) return []
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const nowMs = Date.now()
  const ids = await g.listThreads(q, 20)
  const out: Record<string, unknown>[] = []
  const threads = await asGmailThreads_(ids)
  threads.forEach((th, i) => {
    const msgs = (th && (th as { messages?: { internalDate?: string; labelIds?: string[] }[] }).messages) || []
    if (!msgs.length) return
    const lastMsg = msgs[msgs.length - 1]
    const last = Number(lastMsg.internalDate)
    const from = asHeader_(lastMsg as never, 'From')
    let labels: string[] = []
    msgs.forEach((m) => {
      labels = labels.concat(m.labelIds || [])
    })
    out.push({
      id: ids[i],
      subject: asHeader_(msgs[0] as never, 'Subject') || '(no subject)',
      from: from.toLowerCase().indexOf(owner) !== -1 ? 'You' : from.replace(/<.*>/, '').replace(/"/g, '').trim() || from,
      lastAt: isFinite(last) ? new Date(last).toISOString() : '',
      hoursWaiting: isFinite(last) ? Math.floor((nowMs - last) / 3600000) : 0,
      unread: labels.indexOf('UNREAD') !== -1,
      starred: labels.indexOf('STARRED') !== -1,
      url: 'https://mail.google.com/mail/u/0/#all/' + ids[i],
    })
  })
  return out
}

/** asRecentFiles_ verbatim — one Drive query, 12 newest. */
async function asRecentFiles_(days: unknown, nowMs: number): Promise<Record<string, unknown>[]> {
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const since = new Date(nowMs - Number(days || 7) * 86400000).toISOString()
  const q =
    "trashed = false and mimeType != 'application/vnd.google-apps.folder' and modifiedTime > '" +
    since +
    "' and ('me' in owners or viewedByMeTime > '" + since + "')"
  const files = await g.driveFiles(q)
  return files.map((f) => ({
    id: String(f.id),
    name: String(f.name),
    url: String(f.webViewLink || 'https://drive.google.com/open?id=' + f.id),
    mimeType: String(f.mimeType),
    updatedAt: new Date(String(f.modifiedTime)).toISOString(),
  }))
}

export const AS_FOLLOWUP_TABLE = 'follow_up_done'
export const AS_FOLLOWUP_HEADERS = ['thread_id', 'last_at_ms', 'done_at', 'submitted_by', 'submitted_at']
export const AS_FOLLOWUP_MANAGER = 'k.alnaggar@dabdoob.com'
const ROSTER_TABLE = 'roster'

/** asFromEmail_ verbatim. */
export function asFromEmail_(msg: { payload?: { headers?: { name: string; value: string }[] } }): string {
  const from = asHeader_(msg, 'From')
  const m = from.match(/<([^>]+)>/)
  return normEmail_(m ? m[1] : from)
}

/** asTlFollowUps_ verbatim — TL threads to the manager without a reply. */
export async function asTlFollowUps_(nowMs: number): Promise<Record<string, unknown>[]> {
  const manager = normEmail_(await getConfig('assistant_followup_manager', AS_FOLLOWUP_MANAGER))
  const tls: Record<string, string> = {}
  ;(await asTableOrEmpty_(ROSTER_TABLE, (r) => dqTitleLevel_(r.position, String(r.role || '')) === 'tl' && (r.active !== false && String(r.active).toLowerCase() !== 'false'))).forEach((r) => {
    tls[normEmail_(r.email)] = String(r.name || r.email)
  })
  const emails = Object.keys(tls)
  if (!emails.length) throw new Error('No active team leads in the Roster.')
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const q = 'from:(' + emails.join(' OR ') + ') (to:' + manager + ' OR cc:' + manager + ') newer_than:30d'
  const ids = await g.listThreads(q, 40)
  const threads = await asGmailThreads_(ids, ['From', 'Subject', 'To', 'Cc'])
  const done: Record<string, number> = {}
  ;(await asTableOrEmpty_(AS_FOLLOWUP_TABLE)).forEach((r) => {
    const k = String(r.thread_id)
    done[k] = Math.max(done[k] || 0, Number(r.last_at_ms) || 0)
  })
  const toManager = (m: { payload?: { headers?: { name: string; value: string }[] } }) =>
    (asHeader_(m, 'To') + ',' + asHeader_(m, 'Cc')).toLowerCase().indexOf(manager) !== -1
  const out: Record<string, unknown>[] = []
  threads.forEach((th, i) => {
    const id = ids[i]
    const msgs = (th && (th as { messages?: { internalDate?: string; labelIds?: string[]; payload?: { headers?: { name: string; value: string }[] } }[] }).messages) || []
    let lastTl: (typeof msgs)[number] | null = null
    msgs.forEach((m) => {
      if (tls[asFromEmail_(m)] && toManager(m)) lastTl = m
    })
    if (!lastTl) return
    const at = Number((lastTl as { internalDate?: string }).internalDate)
    const replied = msgs.some(
      (m) => asFromEmail_(m) === manager && Number(m.internalDate) > at
    )
    if (replied || (done[id] && at <= done[id])) return
    out.push({
      id,
      subject: asHeader_(msgs[0] as never, 'Subject') || '(no subject)',
      from: tls[asFromEmail_(lastTl as never)],
      lastAt: new Date(at).toISOString(),
      lastAtMs: at,
      hoursWaiting: Math.max(0, Math.floor((nowMs - at) / 3600000)),
      url: 'https://mail.google.com/mail/u/0/#all/' + id,
    })
  })
  return out.sort((a, b) => (b.hoursWaiting as number) - (a.hoursWaiting as number))
}

/** markFollowUpDone verbatim — one appended row; the cached part drops it. */
export async function markFollowUpDone(threadId: string, lastAtMs: number): Promise<Record<string, unknown>> {
  await assertWritable() // FollowUpDone is a core-store write: View as refused it via the wrapped sheet
  const owner = await requireAssistantOwner_()
  const id = String(threadId || '')
  if (!/^[0-9a-f]{8,32}$/i.test(id)) throw new Error('Unknown thread.')
  const at = Number(lastAtMs) || Date.now()
  await appendRow(AS_FOLLOWUP_TABLE, { thread_id: id, last_at_ms: at, done_at: new Date().toISOString() }, owner)
  await asDropCachedFollowUp_(id, at)
  return { id }
}

/** asDropCachedFollowUp_ verbatim (shared cache). */
export async function asDropCachedFollowUp_(id: string, atMs: number): Promise<void> {
  const key = AS_CACHE_PREFIX + 'followups'
  const hit = await dbCacheGet(key)
  if (!hit) return
  try {
    const d = JSON.parse(hit)
    const s = d.followups
    if (!s || !s.ok || !s.data) return
    s.data = s.data.filter((f: { id: unknown; lastAtMs: unknown }) => !(String(f.id) === id && Number(f.lastAtMs) <= atMs))
    await dbCachePut(key, JSON.stringify(d), AS_CACHE_SECONDS)
  } catch {
    await dbCacheRemove(key)
  }
}

/** asSection_ verbatim — a section failure becomes its envelope. */
export async function asSection_<T>(fn: () => T | Promise<T>): Promise<
  { ok: true; data: T; ms: number } | { ok: false; error: string; data: T | []; ms: number }
> {
  const t = Date.now()
  try {
    return { ok: true, data: await fn(), ms: Date.now() - t }
  } catch (e) {
    return { ok: false, error: String((e && (e as Error).message) || e), data: [], ms: Date.now() - t }
  }
}

/** asCollectPart_ verbatim — one part of the page. */
export async function asCollectPart_(part: string, owner: string, nowMs: number): Promise<Record<string, unknown>> {
  const settings = await assistantSettings_()
  const stamp = new Date(nowMs).toISOString()
  if (part === 'mail')
    return { generatedAt: stamp, mail: await asSection_(() => asAwaitingReply_(owner, settings.assistant_reply_after_hours, nowMs)) }
  if (part === 'followups')
    return { generatedAt: stamp, followups: await asSection_(() => asTlFollowUps_(nowMs)) }
  if (part === 'files')
    return { generatedAt: stamp, files: await asSection_(() => asRecentFiles_(settings.assistant_drive_days, nowMs)) }
  const todayStart = asDayStart_(nowMs)
  const ctxS = await asSection_(() => asContext_(owner))
  const ctx = ctxS.ok ? (ctxS.data as AsContext) : { openActions: [], series: [], oneOnOnes: [] }
  const cal = await asSection_(() => asEventsTwoDays_(todayStart, ctx).then((d) => asAddOneOnOnes_(d, todayStart, ctx)))
  const calDay = (k: 'today' | 'tomorrow') =>
    cal.ok ? { ok: true, data: (cal.data as { today: AsEvent[]; tomorrow: AsEvent[] })[k], ms: cal.ms } : { ok: false, error: cal.error, data: [], ms: cal.ms }
  const today = calDay('today')
  const tomorrow = calDay('tomorrow')
  const focus = await asSection_(() => {
    const minMin = Number(settings.assistant_focus_min_minutes) || 45
    const timed = (s: { ok?: boolean; data?: AsEvent[] }) => ((s.ok ? s.data || [] : []).filter((e) => !e.allDay))
    return suggestFocusBlocks_(timed(today), asKuwaitDate_(todayStart + 3600000), String(settings.assistant_work_hours), minMin, 120, nowMs)
      .concat(suggestFocusBlocks_(timed(tomorrow), asKuwaitDate_(todayStart + 86400000 + 3600000), String(settings.assistant_work_hours), minMin, 120, nowMs))
  })
  const t = Date.now()
  const digest = await asDigestInstalled_()
  return {
    generatedAt: stamp,
    today: asKuwaitDate_(nowMs),
    tomorrow: asKuwaitDate_(nowMs + 86400000),
    settings,
    context: { ok: ctxS.ok, error: (ctxS as { error?: string }).error, data: [], ms: ctxS.ms },
    events: { today, tomorrow },
    deadlines: ctxS.ok ? await asSection_(() => asDeadlines_(owner, ctx, nowMs)) : ctxS,
    focus,
    digestInstalled: digest,
    digestCheckMs: Date.now() - t,
  }
}

/** collectMyDay_ verbatim. */
export async function collectMyDay_(owner: string): Promise<Record<string, unknown>> {
  const nowMs = Date.now()
  const d = await asCollectPart_('core', owner, nowMs)
  d.mail = (await asCollectPart_('mail', owner, nowMs)).mail
  d.files = (await asCollectPart_('files', owner, nowMs)).files
  d.followups = (await asCollectPart_('followups', owner, nowMs)).followups
  return d
}

/** asCachedPart_ verbatim — cached copy, rebuilt on refresh or a stale day. */
export async function asCachedPart_(part: string, owner: string, refresh: boolean): Promise<Record<string, unknown>> {
  const key = AS_CACHE_PREFIX + part
  if (!refresh) {
    const hit = await dbCacheGet(key)
    if (hit) {
      const d = JSON.parse(hit)
      if (part !== 'core' || d.today === asKuwaitDate_(Date.now())) {
        d.cached = true
        return d
      }
    }
  }
  const json = JSON.stringify(await asCollectPart_(part, owner, Date.now()))
  try {
    await dbCachePut(key, json, AS_CACHE_SECONDS)
  } catch {
    /* too large to cache: served uncached */
  }
  return JSON.parse(json)
}

async function asClearCache_(): Promise<void> {
  for (const p of AS_PARTS) await dbCacheRemove(AS_CACHE_PREFIX + p)
}

/** The GAS ScriptApp trigger becomes the assistant_digest_installed config flag. */
export async function asDigestInstalled_(): Promise<boolean> {
  try {
    return !!(await getConfig('assistant_digest_installed', false))
  } catch {
    return false
  }
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

/** getMyDayPart verbatim. */
export async function getMyDayPart(part: string, refresh?: boolean): Promise<Record<string, unknown>> {
  const owner = await requireAssistantOwner_()
  if (AS_PARTS.indexOf(part) === -1) throw new Error('Unknown My day part: ' + part)
  return asCachedPart_(part, owner, !!refresh)
}

/** getMyDay verbatim. */
export async function getMyDay(refresh?: boolean): Promise<Record<string, unknown>> {
  const owner = await requireAssistantOwner_()
  const d = await asCachedPart_('core', owner, !!refresh)
  d.mail = (await asCachedPart_('mail', owner, !!refresh)).mail
  d.files = (await asCachedPart_('files', owner, !!refresh)).files
  d.followups = (await asCachedPart_('followups', owner, !!refresh)).followups
  return d
}

/** jobWarmMyDay verbatim — refresh every part between 06:00 and 22:00 Kuwait. */
export async function jobWarmMyDay(): Promise<string> {
  const owner = await assistantOwnerEmail()
  const hour = Number(new Date(Date.now() + 3 * 3600000).toISOString().slice(11, 13))
  if (hour < 6 || hour >= 22) return 'skipped'
  const t = Date.now()
  for (const p of AS_PARTS) await asCachedPart_(p, owner, true)
  return 'jobWarmMyDay: My day cached in ' + (Date.now() - t) + ' ms.'
}

/** debugMyDay verbatim — the collected payload + section timings. */
export async function debugMyDay(): Promise<Record<string, unknown>> {
  const owner = await requireAssistantOwner_()
  const t0 = Date.now()
  const d = await collectMyDay_(owner)
  return {
    caller: owner,
    collectMs: Date.now() - t0,
    data: d,
    payloadChars: JSON.stringify(d).length,
  }
}

/** createFocusBlock verbatim — clash check, then a real calendar event. */
export async function createFocusBlock(startIso: string, endIso: string, title?: string): Promise<Record<string, unknown>> {
  await assertWritable()
  await requireAssistantOwner_()
  const start = Date.parse(startIso)
  const end = Date.parse(endIso)
  const now = Date.now()
  if (!isFinite(start) || !isFinite(end) || end <= start) throw new Error('Pick a start and an end time.')
  if (end - start < 15 * 60000 || end - start > 4 * 3600000) throw new Error('Focus blocks are 15 minutes to 4 hours.')
  if (end < now || start > now + 14 * 86400000) throw new Error('Focus blocks can be set for the next two weeks only.')
  const g = google()
  if (!g.configured) throw new Error(GOOGLE_NOT_CONFIGURED)
  const clash = (await g.calendarEvents(new Date(start), new Date(end))).filter((e) => !e.allDay)
  if (clash.length) throw new Error('That time is no longer free ("' + clash[0].title + '"). Refresh My day.')
  const name = String(title || 'Focus time').replace(/\s+/g, ' ').trim().slice(0, 100) || 'Focus time'
  const ev = await g.createEvent(name, new Date(start), new Date(end), { description: 'Blocked from Dabdoob CX, My day.' })
  await dbCacheRemove(AS_CACHE_PREFIX + 'core')
  return { id: String(ev.id), title: name, start: new Date(start).toISOString(), end: new Date(end).toISOString() }
}

/** setAssistantSettings verbatim — whitelisted keys only. */
export async function setAssistantSettings(patch: Record<string, unknown>): Promise<Record<string, unknown>> {
  await assertWritable() // Config writes sat behind the same wrapped core sheet
  const owner = await requireAssistantOwner_()
  for (const k of Object.keys(patch || {})) {
    if (!AS_SETTING_KEYS[k]) throw new Error('Unknown setting: ' + k)
    let v = patch[k]
    if (k === 'assistant_work_hours') {
      if (!/^\d{1,2}:\d{2}-\d{1,2}:\d{2}$/.test(String(v))) throw new Error('Working hours look like 09:30-18:30.')
    } else {
      v = Number(v)
      if (!isFinite(v as number) || (v as number) < 1 || (v as number) > 720) throw new Error('Enter a number between 1 and 720.')
    }
    await setConfig(k, v, AS_SETTING_KEYS[k].desc, owner)
  }
  await asClearCache_()
  return assistantSettings_()
}

/**
 * installAssistantDigestTrigger — the GAS ScriptApp trigger becomes the
 * assistant_digest_installed config flag the digest cron route checks.
 */
export async function installAssistantDigestTrigger(): Promise<string> {
  await assertWritable() // Config writes sat behind the same wrapped core sheet
  const owner = await requireAssistantOwner_()
  await setConfig('assistant_digest_installed', true, 'My day: the 07:30 Kuwait morning digest is scheduled.', owner)
  return 'Morning digest scheduled for about 07:30 Kuwait time. Mail follows the mail_dry_run setting.'
}

/** asDigestHtml_ verbatim. */
export function asDigestHtml_(d: Record<string, unknown>): string {
  const esc = escapeHtml
  const time = (iso: string) => {
    const t = new Date(iso)
    const kw = new Date(t.getTime() + 3 * 3600000)
    return ('0' + kw.getUTCHours()).slice(-2) + ':' + ('0' + kw.getUTCMinutes()).slice(-2)
  }
  const h = ['<div style="font-family:Arial,sans-serif;font-size:14px;color:#18242a">', '<h2 style="font-size:18px">Your day, ' + esc(d.today) + '</h2>']
  const evs = ((d.events as { today?: { ok?: boolean; data?: AsEvent[] } })?.today?.ok ? (d.events as { today: { data: AsEvent[] } }).today.data : []) as AsEvent[]
  h.push('<h3 style="font-size:15px">Meetings (' + evs.length + ')</h3><ul>')
  evs.forEach((e) => {
    h.push('<li>' + (e.allDay ? 'All day' : time(e.start) + '-' + time(e.end)) + ' ' + esc(e.title) +
      (e.actions.length ? ' <em>(' + e.actions.length + ' open action' + (e.actions.length > 1 ? 's' : '') + ')</em>' : '') + '</li>')
  })
  h.push('</ul>')
  const dl = ((d.deadlines as { ok?: boolean; data?: Record<string, unknown>[] })?.ok ? (d.deadlines as { data: Record<string, unknown>[] }).data : [])
  h.push('<h3 style="font-size:15px">Deadlines this week (' + dl.length + ')</h3><ul>')
  dl.forEach((a) => {
    h.push('<li>' + esc(a.due) + (a.overdue ? ' <b>overdue</b>' : '') + ': ' + esc(a.title) + (a.mine ? '' : ' (' + esc(a.owner) + ')') + '</li>')
  })
  h.push('</ul>')
  const mail = ((d.mail as { ok?: boolean; data?: Record<string, unknown>[] })?.ok ? (d.mail as { data: Record<string, unknown>[] }).data : [])
  h.push('<h3 style="font-size:15px">Waiting for your reply (' + mail.length + ')</h3><ul>')
  mail.slice(0, 10).forEach((m) => {
    h.push('<li>' + esc(m.subject) + ' from ' + esc(m.from) + ', ' + m.hoursWaiting + ' h</li>')
  })
  h.push('</ul></div>')
  return h.join('')
}

/** jobAssistantMorningDigest verbatim — sends through sendMail (mail_dry_run). */
export async function jobAssistantMorningDigest(): Promise<unknown> {
  const owner = await assistantOwnerEmail()
  if (!(await asDigestInstalled_())) return 'skipped'
  const d = await collectMyDay_(owner)
  return sendMail(
    { to: owner, subject: 'My day: ' + d.today, htmlBody: asDigestHtml_(d), kind: 'assistant_digest', ref: String(d.today) },
    'system:assistant_digest'
  )
}
