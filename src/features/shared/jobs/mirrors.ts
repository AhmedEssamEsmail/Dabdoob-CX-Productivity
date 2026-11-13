/**
 * Mirror sync — pulls the vendor APIs (Freshdesk/Maqsam/Freshchat) and
 * upserts them into the Supabase mirror tables the interactive TPH path
 * reads (fd_activities, maqsam_calls, freshchat — created by migration 004).
 *
 * Row model (what the ported readers expect):
 *   fd_activities   /api/v2/export/ticket_activities per UTC day, mapped to
 *                   the same 10 cells the 'Activities' tab held; ts = col A (ISO)
 *   maqsam_calls    'Maqsam Calls' tab of each month workbook (prodFileFor_),
 *                   cols D..J; ts = col D parsed in data_tz
 *   freshchat       'Freshchat' tab of daily_report_ss_id, cols A..G;
 *                   ts = col A parsed in data_tz, else the epoch suffix of col C
 *
 * Typed columns (toRow) are canonical; the legacy `cols` jsonb cell array
 * is no longer written (S05-03) — readers re-derive cells via
 * mirror-cells.ts.
 *
 * Watermark: config mirror_state_<table> = { last_ts_ms, last_sync_at }.
 * Incremental runs re-read the whole tab (the Sheets API has to) but only
 * upsert rows newer than last_ts_ms minus a 24 h overlap; dedupe_key makes
 * re-writes idempotent.
 *
 * Composition layer: intentionally imports pure cx-productivity engines
 * (prodToday_, tphClock_) to sync mirror tables — sanctioned shared -> feature
 * edge alongside jobs/env.ts (docs/ARCHITECTURE.md).
 */

import 'server-only'

import { createHash } from 'node:crypto'
import { dqSetting_, dqAddDays_, type Cfg } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { tphClock_ } from '@/features/cx-productivity/lib/tph'
import { db } from '@/features/shared/platform/repo'
import { getConfig, setConfig } from '@/features/shared/platform/settings'
import { described } from '@/features/shared/lib/errors'
import { fdActivityExport_, fdGroups_ } from './freshdesk'
import { fetchMaqsamRows, fetchFreshchatRows, fdActivityToCells_ } from './vendor-apis'

export type MirrorTable = 'fd_activities' | 'maqsam_calls' | 'freshchat'
export const MIRROR_TABLES: MirrorTable[] = ['fd_activities', 'maqsam_calls', 'freshchat']

const STATE_PREFIX = 'mirror_state_'
const OVERLAP_MS = 86400000 // re-upsert the newest day on incremental runs
// D4 purge floor — purged rows must never be re-imported.
const RETENTION_FLOOR_MS = Date.parse('2026-09-01T00:00:00Z')
const UPSERT_BATCH = 500

interface MirrorSpec {
  /** Rows for the months being synced: [{ id, tab, rows }] in source order.
   * `sinceMs` is the watermark/window cut (undefined on a full non-windowed
   * sync); `untilMs` bounds the current window for windowed specs. */
  fetch: (cfg: Cfg, months: string[], sinceMs?: number, untilMs?: number) => Promise<{ id: string; tab: string; rows: unknown[][] }[]>
  /** Source row -> mirror cells ([] = skip the row entirely). */
  cells: (r: unknown[]) => unknown[] | null
  /** Mirror cells -> epoch ms (null skips the row; counted). */
  tsMs: (cells: unknown[], cfg: Cfg) => number | null
  /** Mirror cells -> typed columns merged into the upsert row (canonical). */
  toRow?: (cells: unknown[]) => Record<string, unknown>
  /** When set, the sync walks [start, now] in chunks of this many ms —
   * upserting + persisting the watermark per window so a maxDuration kill
   * resumes instead of losing the whole pull. */
  windowMs?: number
  hint: string
}

/** ISO timestamp cell -> ISO instant, '' -> null. */
const isoCell = (v: unknown): string | null => {
  if (v === '' || v === null || v === undefined) return null
  const ms = Date.parse(String(v))
  return Number.isNaN(ms) ? null : new Date(ms).toISOString()
}

/** Non-timestamp cell -> string, '' -> null. */
const strCell = (v: unknown): string | null =>
  v === '' || v === null || v === undefined ? null : String(v)

/** Roster fd-directory for fdActivityToCells_: freshdesk_id -> freshdesk_name. */
async function fdActivityRosterNames_(): Promise<Record<string, string>> {
  const { data, error } = await db().from('roster').select('email,name,freshdesk_id,freshdesk_name')
  if (error) throw described(error, { step: 'roster directory' })
  const out: Record<string, string> = {}
  for (const r of (data as Record<string, unknown>[] | null) || []) {
    const id = String(r.freshdesk_id || '').trim()
    const name = String(r.freshdesk_name || '').trim()
    if (id && name) out[id] = name
  }
  return out
}

const SPECS: Record<MirrorTable, MirrorSpec> = {
  fd_activities: {
    async fetch(_cfg, months, sinceMs, untilMs) {
      // Freshdesk ticket_activities export — one call per UTC day covering
      // [startOfDay(sinceMs), untilMs); a failing day fails the window.
      const roster = await fdActivityRosterNames_()
      const groups = await fdGroups_().catch(() => ({}) as Record<string, string>)
      const startMs = sinceMs ?? Date.parse(months[months.length - 1] + '-01T00:00:00Z')
      const endMs = untilMs ?? Date.now()
      const d0 = new Date(startMs)
      d0.setUTCHours(0, 0, 0, 0)
      const rows: unknown[][] = []
      for (const d = new Date(d0); d.getTime() < endMs; d.setUTCDate(d.getUTCDate() + 1)) {
        const dateKey = d.toISOString().slice(0, 10)
        let acts: Record<string, unknown>[]
        try {
          acts = await fdActivityExport_(dateKey)
        } catch (e) {
          throw described(e, { step: 'ticket_activities export ' + dateKey })
        }
        for (const a of acts) {
          const cells = fdActivityToCells_(a, roster, groups)
          if (cells) rows.push(...cells)
        }
      }
      return [{ id: 'fd-activities-export', tab: 'ticket_activities', rows }]
    },
    // Export activities map straight to the 10-cell mirror layout.
    cells: (r) => r,
    tsMs: (cells) => {
      const ms = Date.parse(String(cells[0]))
      return Number.isNaN(ms) ? null : ms
    },
    toRow: (c) => ({
      performed_at: isoCell(c[0]),
      ticket_id: strCell(c[1]),
      performer_name: strCell(c[2]),
      performer_type: strCell(c[3]),
      activity_type: strCell(c[4]),
      field_changed: strCell(c[5]),
      new_value: strCell(c[6]),
      old_value: strCell(c[7]),
      group_name: strCell(c[8]),
    }),
    windowMs: 86400000,
    hint: 'Freshdesk ticket_activities export API',
  },
  maqsam_calls: {
    async fetch(_cfg, months, sinceMs, untilMs) {
      // Maqsam Calls API — calls created in [window start, window end).
      const startMs = sinceMs ?? Date.parse(months[0] + '-01T00:00:00Z')
      const rows = await fetchMaqsamRows(startMs, untilMs)
      return [{ id: 'maqsam-api', tab: 'v2/calls', rows }]
    },
    // API rows are already the 7-cell mirror shape (sheet cols D..J).
    cells: (r) => r,
    tsMs: (cells, cfg) => tphClock_(String(dqSetting_(cfg, 'data_tz'))).ms(cells[0]),
    toRow: (c) => ({
      started_at: isoCell(c[0]),
      ended_at: isoCell(c[1]),
      duration: strCell(c[2]),
      agent_email: strCell(c[3]),
      state: strCell(c[4]),
      direction: strCell(c[5]),
      handling: strCell(c[6]),
    }),
    windowMs: 7 * 86400000,
    hint: 'Maqsam Calls API v2 (MAQSAM_* env vars)',
  },
  freshchat: {
    async fetch(_cfg, _months, sinceMs) {
      // Freshchat API — conversations updated since the watermark.
      const rows = await fetchFreshchatRows(sinceMs)
      return [{ id: 'freshchat-api', tab: 'v2/conversations', rows }]
    },
    // API rows are already the 7-cell mirror shape (sheet cols A..G).
    cells: (r) => r,
    tsMs: (cells, cfg) => {
      const clock = tphClock_(String(dqSetting_(cfg, 'data_tz')))
      // ts_ms tracks UPDATED so late resolutions move the watermark and
      // still-open old conversations stay inside reader windows.
      let ms = clock.ms(cells[3]) ?? clock.ms(cells[0])
      if (ms === null) {
        const m = String(cells[2] || '').match(/-(\d{12,14})$/)
        ms = m ? Number(m[1]) : null
      }
      return ms
    },
    toRow: (c) => ({
      initiated_at: isoCell(c[0]),
      status: strCell(c[1]),
      ref_key: strCell(c[2]),
      updated_at: isoCell(c[3]),
      resolved_at: isoCell(c[4]),
      channel: strCell(c[5]),
      conversation_id: strCell(c[6]),
    }),
    hint: 'Freshchat conversations API (FRESHCHAT_* env vars)',
  },
}

export interface MirrorSyncResult {
  table: MirrorTable
  fetched: number
  written: number
  skipped: number
  watermark: string
  full: boolean
  /** True when the time budget ran out mid-walk — rerun to resume from the watermark. */
  partial?: boolean
  note?: string
}

interface MirrorState {
  last_ts_ms?: number
  last_sync_at?: string
}

function dedupeKey(table: string, cells: unknown[]): string {
  return createHash('sha1').update(table + '|' + JSON.stringify(cells)).digest('hex')
}

/**
 * Months to read for a sync: incremental -> current and previous month;
 * full -> `monthsBack` months ending at the current one (default 6, covering a
 * Jul->Oct backfill window).
 */
export function mirrorMonths(today: string, full: boolean, monthsBack = 6): string[] {
  const cur = today.slice(0, 7)
  if (!full) {
    const prev = dqAddDays_(cur + '-01', -1).slice(0, 7)
    return [prev, cur]
  }
  const out: string[] = [cur]
  for (let i = 1; i < Math.max(1, monthsBack); i++) {
    const [y, mm] = out[out.length - 1].split('-').map(Number)
    out.push(new Date(Date.UTC(y, mm - 2, 1)).toISOString().slice(0, 7))
  }
  return out.reverse()
}

const SYNC_BUDGET_MS = 240000 // stop the window walk before maxDuration kills it

export async function syncMirror(
  cfg: Cfg,
  table: MirrorTable,
  opts: { full?: boolean; monthsBack?: number; now?: number | Date } = {}
): Promise<MirrorSyncResult> {
  const spec = SPECS[table]
  const today = prodToday_(cfg, opts.now)
  const state = ((await getConfig(STATE_PREFIX + table)) || {}) as MirrorState
  const full = !!opts.full || !state.last_ts_ms
  const months = mirrorMonths(today, full, opts.monthsBack)
  const cut = full ? -Infinity : (state.last_ts_ms as number) - OVERLAP_MS
  const monthsForSpec = table === 'maqsam_calls' ? months : months.slice(-1)
  const now = new Date().toISOString()
  const endBound = opts.now !== undefined ? +new Date(opts.now) : Date.now()
  const t0 = Date.now()

  let fetched = 0
  let skipped = 0
  let written = 0
  let partial = false
  let maxTs = (state.last_ts_ms as number) || 0
  const srcNotes: string[] = []

  const saveState = (ts: number) =>
    setConfig(STATE_PREFIX + table, { last_ts_ms: ts, last_sync_at: now }, 'Mirror sync watermark (managed by mirrors.ts).', 'system:mirror')

  const consume = async (sinceMs?: number, untilMs?: number) => {
    const sources = await spec.fetch(cfg, monthsForSpec, sinceMs, untilMs)
    // Map dedupes within the window — identical cell-tuples collide on
    // dedupe_key and Postgres refuses a second ON CONFLICT hit in one batch.
    const pending = new Map<string, Record<string, unknown>>()
    for (const src of sources) {
      srcNotes.push(`${src.tab} (${src.rows.length})`)
      for (const r of src.rows) {
        const cells = spec.cells(r)
        if (!cells) {
          skipped++
          continue
        }
        fetched++
        const ts = spec.tsMs(cells, cfg)
        if (ts === null) {
          skipped++
          continue
        }
        if (ts < RETENTION_FLOOR_MS) {
          skipped++ // D4 purge floor — a sub-floor row inside a fetched window is never re-imported
          continue
        }
        if (ts <= cut) continue
        if (untilMs !== undefined && ts > untilMs) continue
        if (ts > maxTs) maxTs = ts
        const k = dedupeKey(table, cells)
        pending.set(k, { dedupe_key: k, ts_ms: ts, synced_at: now, ...spec.toRow?.(cells) })
      }
    }
    const rows = [...pending.values()]
    for (let i = 0; i < rows.length; i += UPSERT_BATCH) {
      const { error } = await db()
        .from(table)
        .upsert(rows.slice(i, i + UPSERT_BATCH), { onConflict: 'dedupe_key' })
      if (error) throw described(error, { table })
      written += Math.min(UPSERT_BATCH, rows.length - i)
    }
  }

  if (spec.windowMs) {
    // Walk fixed windows; each is fully fetched+upserted before the watermark
    // advances past it, so a partial run resumes exactly where it stopped.
    // Clamp to the retention floor: a full sync whose months[0] precedes
    // Sep-2026 (or an incremental cut below it) starts at the floor instead.
    let w = Math.max(cut === -Infinity ? Date.parse(months[0] + '-01T00:00:00Z') : cut, RETENTION_FLOOR_MS)
    while (w < endBound) {
      const until = Math.min(w + spec.windowMs, endBound)
      await consume(w, until)
      if (until > maxTs) maxTs = until
      await saveState(maxTs)
      if (Date.now() - t0 > SYNC_BUDGET_MS) {
        partial = true
        break
      }
      w = until
    }
  } else {
    await consume(cut === -Infinity ? undefined : cut)
    await saveState(maxTs)
  }

  return {
    table,
    fetched,
    written,
    skipped,
    watermark: maxTs ? new Date(maxTs).toISOString() : '',
    full,
    partial: partial || undefined,
    note: `${written} rows upserted from ${srcNotes.slice(-6).join(', ')}${partial ? ' — partial, rerun to resume' : ''}`,
  }
}

/** All three mirrors, each failure isolated per table. */
export async function syncAllMirrors(
  cfg: Cfg,
  opts: { full?: boolean; monthsBack?: number; tables?: MirrorTable[]; now?: number | Date } = {}
): Promise<Record<string, MirrorSyncResult | { table: string; error: string }>> {
  const out: Record<string, MirrorSyncResult | { table: string; error: string }> = {}
  const tables = opts.tables?.length ? opts.tables : MIRROR_TABLES
  for (const t of tables) {
    try {
      out[t] = await syncMirror(cfg, t, opts)
    } catch (e) {
      const d = described(e, { table: t })
      out[t] = { table: t, error: d.message }
    }
  }
  return out
}
