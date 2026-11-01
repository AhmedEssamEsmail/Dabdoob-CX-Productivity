/**
 * Mirror sync — reads the source Google Sheet tabs and upserts them into the
 * Supabase mirror tables the interactive TPH path reads (fd_activities,
 * maqsam_calls, freshchat — created by migration 004).
 *
 * Row model (what the ported readers expect):
 *   fd_activities   'Activities' tab of fd_activity_ss_id, cols A..J;
 *                   ts = col A parsed in activity_local_tz
 *   maqsam_calls    'Maqsam Calls' tab of each month workbook (prodFileFor_),
 *                   cols D..J; ts = col D parsed in data_tz
 *   freshchat       'Freshchat' tab of daily_report_ss_id, cols A..G;
 *                   ts = col A parsed in data_tz, else the epoch suffix of col C
 *
 * Watermark: config mirror_state_<table> = { last_ts_ms, last_sync_at }.
 * Incremental runs re-read the whole tab (the Sheets API has to) but only
 * upsert rows newer than last_ts_ms minus a 24 h overlap; dedupe_key makes
 * re-writes idempotent.
 */

import { createHash } from 'node:crypto'
import { dqSetting_, prodFileFor_, dqAddDays_, type Cfg } from '@/lib/prod/adapters'
import { prodToday_ } from '@/lib/prod/engine'
import { tphClock_ } from '@/lib/tph'
import { db } from '@/lib/platform/repo'
import { getConfig, setConfig } from '@/lib/platform/settings'
import { described } from '@/lib/errors'
import { fetchWorkbookTabs } from './sheets'

export type MirrorTable = 'fd_activities' | 'maqsam_calls' | 'freshchat'
export const MIRROR_TABLES: MirrorTable[] = ['fd_activities', 'maqsam_calls', 'freshchat']

const STATE_PREFIX = 'mirror_state_'
const OVERLAP_MS = 86400000 // re-upsert the newest day on incremental runs
const UPSERT_BATCH = 500

interface MirrorSpec {
  /** Sheet rows for the months being synced: [{ id, tab, rows }] in source order. */
  fetch: (cfg: Cfg, months: string[]) => Promise<{ id: string; tab: string; rows: unknown[][] }[]>
  /** Source row -> mirror cells ([] = skip the row entirely). */
  cols: (r: unknown[]) => unknown[] | null
  /** Mirror cells -> epoch ms (null skips the row; counted). */
  tsMs: (cells: unknown[], cfg: Cfg) => number | null
  hint: string
}

const MAQSAM_MONTH_TAB = 'Maqsam Calls'

const SPECS: Record<MirrorTable, MirrorSpec> = {
  fd_activities: {
    async fetch(cfg) {
      const id = String(dqSetting_(cfg, 'fd_activity_ss_id') || '')
      if (!id) throw described(new Error('fd_activity_ss_id is not configured'), { configKey: 'fd_activity_ss_id' })
      const tabs = await fetchWorkbookTabs(id, ['Activities'])
      return [{ id, tab: 'Activities', rows: (tabs['Activities'] || []).slice(1) }]
    },
    cols: (r) => r.slice(0, 10),
    tsMs: (cells, cfg) => tphClock_(String(dqSetting_(cfg, 'activity_local_tz'))).ms(cells[0]),
    hint: 'fd_activity_ss_id workbook, tab Activities',
  },
  maqsam_calls: {
    async fetch(cfg, months) {
      const out: { id: string; tab: string; rows: unknown[][] }[] = []
      for (const m of months) {
        const id = prodFileFor_(m, cfg)
        if (!id) continue
        const tabs = await fetchWorkbookTabs(id, [MAQSAM_MONTH_TAB])
        out.push({ id, tab: MAQSAM_MONTH_TAB, rows: (tabs[MAQSAM_MONTH_TAB] || []).slice(1) })
      }
      return out
    },
    // keep D..J (indices 3..9 of the full row): the call row the engine reads
    cols: (r) => {
      if (r.length < 4) return null
      const c = r.slice(3, 10)
      while (c.length < 7) c.push('')
      return c
    },
    tsMs: (cells, cfg) => tphClock_(String(dqSetting_(cfg, 'data_tz'))).ms(cells[0]),
    hint: 'Maqsam Calls tab of each month workbook (productivity_files)',
  },
  freshchat: {
    async fetch(cfg) {
      const id = String(dqSetting_(cfg, 'daily_report_ss_id') || '')
      if (!id) throw described(new Error('daily_report_ss_id is not configured'), { configKey: 'daily_report_ss_id' })
      const tabs = await fetchWorkbookTabs(id, ['Freshchat'])
      return [{ id, tab: 'Freshchat', rows: (tabs['Freshchat'] || []).slice(1) }]
    },
    cols: (r) => r.slice(0, 7),
    tsMs: (cells, cfg) => {
      const ms = tphClock_(String(dqSetting_(cfg, 'data_tz'))).ms(cells[0])
      if (ms !== null) return ms
      const m = String(cells[2] || '').match(/-(\d{12,14})$/)
      return m ? Number(m[1]) : null
    },
    hint: 'daily_report_ss_id workbook, tab Freshchat',
  },
}

export interface MirrorSyncResult {
  table: MirrorTable
  fetched: number
  written: number
  skipped: number
  watermark: string
  full: boolean
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

  const sources = await spec.fetch(cfg, table === 'maqsam_calls' ? months : months.slice(-1))
  const now = new Date().toISOString()
  let fetched = 0
  let skipped = 0
  let written = 0
  let maxTs = (state.last_ts_ms as number) || 0

  const pending: { dedupe_key: string; ts_ms: number; cols: unknown[]; synced_at: string }[] = []
  for (const src of sources) {
    for (const r of src.rows) {
      const cells = spec.cols(r)
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
      if (ts <= cut) continue
      if (ts > maxTs) maxTs = ts
      pending.push({ dedupe_key: dedupeKey(table, cells), ts_ms: ts, cols: cells, synced_at: now })
    }
  }

  for (let i = 0; i < pending.length; i += UPSERT_BATCH) {
    const { error } = await db()
      .from(table)
      .upsert(pending.slice(i, i + UPSERT_BATCH), { onConflict: 'dedupe_key' })
    if (error) throw described(error, { table })
    written += Math.min(UPSERT_BATCH, pending.length - i)
  }

  await setConfig(
    STATE_PREFIX + table,
    { last_ts_ms: maxTs, last_sync_at: now },
    'Mirror sync watermark (managed by mirrors.ts).',
    'system:mirror'
  )

  return {
    table,
    fetched,
    written,
    skipped,
    watermark: maxTs ? new Date(maxTs).toISOString() : '',
    full,
    note: `${pending.length} rows upserted from ${sources.map((s) => `${s.tab} (${s.rows.length})`).join(', ')}`,
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
