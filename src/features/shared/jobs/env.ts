/**
 * The job environment (JobEnv) — the Supabase/Gmail/mail seams the ported job
 * orchestrators run against, in the same shape the pure engines expect
 * (ProdIo / TphStepIo), so the engines stay storage-free.
 *
 * Mapping to the legacy Apps Script world it replaces:
 *   prodRows(name)       prodRows_ / dqReadObjects_(missingOk) — one read per
 *                        table per run, writes update the memo like the
 *                        DQ_WRITE_GEN_ invalidation did; copies returned.
 *   upsert/upsertIn      dqUpsert_ / dqUpsertIn_ — key-column upsert; queued
 *                        and applied by flushWrites() at each step's end.
 *   append               dqAppend_ — plain insert.
 *   replaceIntervals     prodReplaceIntervals_ — delete the dates' rows, insert.
 *   openSpreadsheet      openSpreadsheet_ — prefetched SheetBookLike; a failed
 *                        prefetch throws here, inside the step that opens it.
 *   cachedLive           dqCachedLive_ — e.g. 'agg_queue_now'.
 *   markDirty/takeDirty  prodMarkDirty_/prodTakeDirty_ — config prod_dirty_dates.
 *   lastMail/setLastMail PROD_MAIL_PROP script property — config prod_last_mail.
 *   logRun               dqLogRun_ — refresh_log append, best effort.
 *   hbBeat/hbFlush       Health.js heartbeats — platform/health.ts.
 *   gmail                Gmail advanced service — platform/mail GmailReadAdapter.
 *   sendMail             MailApp.sendEmail — platform/mail sendMail (dry-run safe).
 *
 * The legacy script lock (LockService/withLock_) has no direct equivalent on
 * Postgres; upsert+delete ops apply serially at step end and Vercel cron does
 * not overlap schedules, keeping the same single-writer discipline.
 */

import {
  dqAddDays_,
  dqRosterPeople_,
  dqSetting_,
  prodFileFor_,
  prodHeadcountRows_,
  pwDirectory_,
  type Cfg,
  type Directory,
  type HeadcountRow,
  type SheetBookLike,
} from '@/features/shared/lib/adapters'
import { prodNowIso_, prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { prodIntervalKey_, type ProdInterval } from '@/features/cx-productivity/lib/prod/validation'
import { tphBuildCallMinutes_, tphBuildCases_, tphBuildTouches_, tphClock_, tphHourMs_ } from '@/features/cx-productivity/lib/tph'
import { describeDbError } from '@/features/shared/lib/errors'
import { db, newId as repoNewId, readRows } from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { hbBeat as platformHbBeat, hbFlush as platformHbFlush } from '@/features/shared/platform/health'
import { getGmailReadAdapter, sendMail, type GmailReadAdapter, type MailMessage, type SendResult } from '@/features/shared/platform/mail'
import { FD_ACTIVITY_TABS, PROD_MONTH_TABS, fetchWorkbookTabs, sheetBook } from './sheets'

export type Row = Record<string, unknown>

// ---------------------------------------------------------------- table writes

/** prod_daily_layers DB columns are snake_case; the engine emits camelCase. */
export const LAYER_COL_MAP: Record<string, string> = {
  layer: 'layer',
  agentName: 'agent_name',
  date: 'date',
  email: 'email',
  inboundAvailMin: 'inbound_avail_min',
  inboundTarget: 'inbound_target',
  inboundAchieved: 'inbound_achieved',
  inboundMissed: 'inbound_missed',
  inboundProdPct: 'inbound_prod_pct',
  inboundGap: 'inbound_gap',
  textingAvailMin: 'texting_avail_min',
  textingTarget: 'texting_target',
  textingAchieved: 'texting_achieved',
  textingProdPct: 'texting_prod_pct',
  textingGap: 'texting_gap',
  waAvailMin: 'wa_avail_min',
  waTarget: 'wa_target',
  waAchieved: 'wa_achieved',
  waProdPct: 'wa_prod_pct',
  waGap: 'wa_gap',
  overallProdPct: 'overall_prod_pct',
  totalAudits: 'total_audits',
  avgScore: 'avg_score',
  productiveMinAux: 'productive_min_aux',
  productiveMinResolution: 'productive_min_resolution',
  idleMin: 'idle_min',
  computedAt: 'computed_at',
}

/** The CC2 Data year store the engine writes has no Supabase counterpart: its
 *  effective rows land in prod_daily_layers (layer='effective'), which the KPI
 *  reads already use. */
const TABLE_ALIAS: Record<string, { table: string; inject: Row }> = {
  agg_productivity_daily: { table: 'prod_daily_layers', inject: { layer: 'effective' } },
}

function isIsoDateCol(v: unknown): v is Date {
  return v instanceof Date
}

/**
 * Columns that are NOT text: a legacy '' cell (unset) must land as null —
 * Postgres rejects '' for timestamptz / numeric / jsonb.
 */
const NON_TEXT_COLS: Record<string, RegExp> = {
  default: /(_at|_ms|_json|_jsonb)$/,
}
const NON_TEXT_EXTRA: Record<string, RegExp> = {
  prod_intervals: /^(minutes)$/,
  prod_flags: /^(interval_min|flagged_min|case_count|distinct_cases|review_open_ms|confidence_score)$/,
  prod_daily_layers: /^(inbound|texting|wa|overall|total|avg|productive|idle)_/,
  prod_window_hist: /^(windows)$/,
  prod_flag_analytics: /^(total_flags|auto_accepted|total_flagged_min|avg_cases_per_flag)$/,
  prod_quarterly_reports: /^(quarter|year)$/,
  refresh_log: /^(rows_in|rows_out)$/,
}
function nonTextCol(table: string, col: string): boolean {
  return NON_TEXT_COLS.default.test(col) || (NON_TEXT_EXTRA[table] ? NON_TEXT_EXTRA[table].test(col) : false)
}

/** Engine row -> DB row: column map, drop identity id, Dates to ISO, '' -> null on non-text cols. */
export function toDbRow(table: string, row: Row): Row {
  const src = table === 'prod_daily_layers' ? mapLayerRow(row) : { ...row }
  const out: Row = {}
  Object.keys(src).forEach((k) => {
    if (k === 'id') return // GENERATED ALWAYS identity columns take no input
    const v = src[k]
    if (v === '' && nonTextCol(table, k)) {
      out[k] = null
      return
    }
    out[k] = isIsoDateCol(v) ? v.toISOString() : v
  })
  return out
}

function mapLayerRow(row: Row): Row {
  const out: Row = {}
  Object.keys(row).forEach((k) => {
    const dbCol = LAYER_COL_MAP[k]
    if (dbCol) out[dbCol] = row[k]
  })
  return out
}

type WriteOp =
  | { kind: 'upsert'; table: string; keys: string[]; rows: Row[]; soft?: boolean }
  | { kind: 'append'; table: string; rows: Row[]; soft?: boolean }
  | { kind: 'replaceKeys'; table: string; key: string; vals: unknown[]; rows: Row[]; soft?: boolean }

// ---------------------------------------------------------------- the env

export interface JobEnv {
  cfg: Cfg
  dir: Directory
  /** Stores whose preload/read failed (table -> described message). Reads stay
   *  missingOk (dqReadObjects_ contract) but callers can tell "empty" from "missing". */
  tableErrors: Record<string, string>
  /** dqHeadcount_ resolved: synced roster, else the current month Headcount tab. */
  headcount: HeadcountRow[]
  /** ProdIo.roster: dqRosterPeople_ only (null lets the engine read month Headcount tabs). */
  roster: HeadcountRow[] | null
  /** Freeze for tests: engine `now` (computedAt) and `today`/`nowMs` (prodToday_). */
  now?: number | Date
  today?: number | Date
  nowMs?: number

  // ---- prod rows memo (prodRows_) ----
  prodRows(name: string): Row[]

  // ---- write seams (queued; flushWrites applies) ----
  upsert(table: string, cols: string[], rows: Row[], year: number | null): void
  upsertIn(table: string, cols: string[], rows: Row[], year: number | null): void
  append(table: string, rows: Row[]): void
  /** prodReplaceIntervals_: delete prod_intervals rows of `dates`, insert the new ones. */
  replaceIntervals(dates: string[], intervals: ProdInterval[]): { removed: number; added: number }
  flushWrites(): Promise<void>

  // ---- spreadsheet seams (prefetched SheetBookLike) ----
  openSpreadsheet(id: string): SheetBookLike
  prefetchWorkbook(id: string, tabs: string[]): Promise<void>
  prefetchMonthBooks(dates: string[]): Promise<void>
  /** The FD 'Activities' rows (header skipped), memoized for the run (prodReadActivityRows_). */
  activityRows(): Promise<unknown[][]>
  /** TphStepIo.activityTail: rows from `days` before date 00:00 business_tz on. */
  activityTail(date: string, days: number): unknown[][]
  ensureHeadcount(): Promise<void>

  // ---- lean reads used by tphBuildCases_ / tphCaptureCases_ ----
  cachedLive(name: string): Row[]
  readTickets(cols: string[], pick: (o: Row) => boolean): void
  readInflow(year: number): Row[]
  prefetchTables(names: string[]): Promise<void>
  /** Widens the prod_intervals preload when a step needs dates older than the
   *  initial window (the snapshot can hold dates from further back). */
  ensureIntervals(dates: string[]): Promise<void>

  // ---- TphStepIo step builders (delegate to the ported pure fns with this env as io) ----
  buildTouches(dates: string[], activityRows: unknown[][]): unknown
  buildCallMinutes(dates: string[]): number
  buildCases(
    dates: string[],
    activityRows: unknown[][] | null,
    part?: string
  ): Record<string, { cells: Record<string, unknown>; reasons: Record<string, string> }>

  // ---- script-property seams ----
  markDirty(dates: string[]): void
  takeDirty(): string[]
  lastMail(): { id?: string; ms?: number; importedAt?: string; dates?: string[] }
  setLastMail(v: { id: string; ms: number; importedAt: string; dates: string[] }): void

  // ---- run plumbing ----
  logRun(job: string, startedMs: number, status: string, info: Row): void
  newId(prefix: string): string
  log(msg: string): void

  // ---- adapters ----
  gmail: GmailReadAdapter | null
  sendMail(msg: MailMessage, actor: string): Promise<SendResult>

  // ---- health (injectable; platform/health by default) ----
  hbBeat(job: string, status: unknown, note?: unknown): void
  hbFlush(): Promise<number>
}

const PROD_TABLES = [
  'prod_intervals',
  'prod_flags',
  'prod_flag_log',
  'prod_daily_layers',
  'prod_window_hist',
  'prod_flag_analytics',
  'prod_quarterly_reports',
  'prod_tph_days',
  'prod_tph_tasks',
  'prod_tph_cases',
  'prod_tph_touches',
  'prod_tph_calls',
]

export interface BuildJobEnvOptions {
  /** Extra tables to preload into prodRows (e.g. 'tickets', 'agg_inflow_hourly', 'agg_queue_now'). */
  tables?: string[]
  /** Lower bound for the prod_intervals preload (business date); default today-45d. */
  intervalSince?: string
  /** Gmail adapter override (defaults to getGmailReadAdapter()). */
  gmail?: GmailReadAdapter | null
  /** Freeze clocks (tests). */
  now?: number | Date
  /** Health seam override (tests). */
  hbBeat?: JobEnv['hbBeat']
  hbFlush?: JobEnv['hbFlush']
  /** sendMail seam override (tests). */
  sendMail?: JobEnv['sendMail']
}

/**
 * Loads the shared run context (config, roster/directory, prod tables) once —
 * legacy's per-execution globals. Supabase reads are missingOk ([] on error),
 * matching dqReadObjects_(..., { missingOk: true }).
 */
export async function buildJobEnv(opts: BuildJobEnvOptions = {}): Promise<JobEnv> {
  const cfg = ((await configAll().catch(() => ({}))) || {}) as Cfg
  const rosterRows = await readRows('roster').catch(() => [] as Row[])
  const dir = pwDirectory_(rosterRows, cfg.admin_emails)
  // RosterPerson carries the fields the readers use (name/fdName/fdId/email).
  const roster = dqRosterPeople_(rosterRows) as HeadcountRow[] | null

  const tables: Record<string, Row[]> = {}
  const tableErrors: Record<string, string> = {}
  const today = prodToday_(cfg, opts.now)
  let intervalBound = opts.intervalSince || dqAddDays_(today, -45)
  const wanted = PROD_TABLES.concat(opts.tables || [])
  await Promise.all(
    wanted.map(async (name) => {
      try {
        let q = db().from(name).select('*').limit(200000)
        if (name === 'prod_intervals') q = q.gte('date', intervalBound)
        const { data, error } = await q
        if (error) tableErrors[name] = describeDbError(error, { table: name }).message
        tables[name] = error ? [] : ((data || []) as Row[])
      } catch (e) {
        tableErrors[name] = describeDbError(e, { table: name }).message
        tables[name] = []
      }
    })
  )

  const ops: WriteOp[] = []
  const books: Record<string, { cells: Record<string, unknown[][]>; book: SheetBookLike } | Error> = {}
  let activityMemo: unknown[][] | null = null
  let headcount: JobEnv['headcount'] = roster || []

  const keyOf = (keys: string[]) => (r: Row) => keys.map((k) => String(r[k])).join('')
  /** dqUpsert_ on the in-memory memo: matching key rows are replaced, the rest appended. */
  const memoUpsert = (table: string, keys: string[], rows: Row[]) => {
    const out = (tables[table] || []).slice()
    const key = keyOf(keys)
    rows.forEach((r) => {
      const k = key(r)
      const i = out.findIndex((x) => key(x) === k)
      if (i === -1) out.push(r)
      else out[i] = r
    })
    tables[table] = out
  }
  const memoAppend = (table: string, rows: Row[]) => {
    tables[table] = (tables[table] || []).concat(rows)
  }
  /** setConfig_ equivalent: memo update + queued config upsert (flushed at step end). */
  const setConfigValue = (key: string, value: unknown) => {
    cfg[key] = value
    ops.push({
      kind: 'upsert',
      table: 'config',
      keys: ['key'],
      rows: [{ key, value: JSON.stringify(value), updated_at: new Date().toISOString(), updated_by: 'system:trigger' }],
    })
  }
  const memoReplaceKeys = (table: string, key: string, vals: unknown[], rows: Row[]) => {
    const want: Record<string, boolean> = {}
    vals.forEach((v) => {
      want[String(v)] = true
    })
    const removed = (tables[table] || []).filter((r) => want[String(r[key])]).length
    tables[table] = (tables[table] || []).filter((r) => !want[String(r[key])]).concat(rows)
    return removed
  }

  const writeTable = (t: string): { table: string; inject: Row } =>
    TABLE_ALIAS[t] || { table: t, inject: {} }

  const env: JobEnv = {
    cfg,
    dir,
    tableErrors,
    headcount,
    roster,
    now: opts.now,
    today: opts.now,
    nowMs: opts.now === undefined ? undefined : new Date(opts.now).getTime(),

    prodRows(name) {
      // prodRows_ also reads [] when the store is not set up (prodReady_ gate is
      // the caller's job — the engines check it themselves).
      return (tables[name] || []).map((r) => ({ ...r }))
    },

    upsert(table, cols, rows) {
      const w = writeTable(table)
      const dbRows = rows.map((r) => toDbRow(w.table, { ...w.inject, ...r }))
      const keys = w.table === 'prod_daily_layers' ? ['date', 'email', 'layer'] : cols
      memoUpsert(w.table, keys, rows.map((r) => ({ ...w.inject, ...r })))
      ops.push({ kind: 'upsert', table: w.table, keys, rows: dbRows })
    },
    upsertIn(table, cols, rows, _year) {
      env.upsert(table, cols, rows, _year)
    },
    append(table, rows) {
      const w = writeTable(table)
      memoAppend(w.table, rows.map((r) => ({ ...w.inject, ...r })))
      ops.push({ kind: 'append', table: w.table, rows: rows.map((r) => toDbRow(w.table, { ...w.inject, ...r })) })
    },
    replaceIntervals(dates, intervals) {
      const now = prodNowIso_(env.now)
      const rows = intervals.map((iv) =>
        toDbRow('prod_intervals', {
          interval_key: prodIntervalKey_(iv),
          date: iv.date,
          agent_email: iv.agentEmail,
          agent_name: iv.agentName,
          status: iv.status,
          source_status: iv.sourceStatus,
          start_at: new Date(iv.startMs).toISOString(),
          end_at: new Date(iv.endMs).toISOString(),
          minutes: iv.minutes,
          source: iv.source,
          snapshot_at: now,
        })
      )
      const removed = memoReplaceKeys('prod_intervals', 'date', dates, rows)
      ops.push({ kind: 'replaceKeys', table: 'prod_intervals', key: 'date', vals: dates, rows })
      return { removed, added: rows.length }
    },

    async flushWrites() {
      while (ops.length) {
        const op = ops.shift()!
        try {
          await applyOp(op)
        } catch (e) {
          if (op.soft) {
            console.log('soft write failed (' + op.table + '): ' + ((e as Error)?.message || e))
            continue
          }
          throw e
        }
      }
    },

    openSpreadsheet(id) {
      const b = books[String(id)]
      if (!b) throw new Error('Spreadsheet ' + id + ' was not prefetched for this run.')
      if (b instanceof Error) throw b
      return (b as { book: SheetBookLike }).book
    },
    async prefetchWorkbook(id, tabs) {
      const key = String(id)
      const existing = books[key]
      const have = existing && !(existing instanceof Error) ? Object.keys((existing as { cells: Record<string, unknown[][]> }).cells) : []
      const missing = tabs.filter((t) => have.indexOf(t) === -1)
      if (existing && !missing.length) return // already fetched (or a stored open error)
      try {
        const cells = await fetchWorkbookTabs(key, missing.length ? missing : tabs)
        if (existing && !(existing instanceof Error)) {
          const hold = existing as { cells: Record<string, unknown[][]>; book: SheetBookLike }
          Object.assign(hold.cells, cells)
          hold.book = sheetBook(hold.cells, key)
        } else {
          books[key] = { cells, book: sheetBook(cells, key) }
        }
      } catch (e) {
        books[key] = e as Error
      }
    },
    async prefetchMonthBooks(dates) {
      const months = dates.map((d) => d.slice(0, 7)).filter((m, i, a) => a.indexOf(m) === i)
      await Promise.all(months.map((m) => env.prefetchWorkbook(prodFileFor_(m, cfg), PROD_MONTH_TABS)))
    },
    async activityRows() {
      if (activityMemo) return activityMemo
      await env.prefetchWorkbook(String(dqSetting_(cfg, 'fd_activity_ss_id')), FD_ACTIVITY_TABS)
      const rows = env.openSpreadsheet(String(dqSetting_(cfg, 'fd_activity_ss_id'))).getSheetByName('Activities')
      const n = rows ? rows.getLastRow() : 0
      activityMemo = n > 1 ? (rows!.getRange(2, 1, n - 1, 10).getValues() as unknown[][]) : []
      return activityMemo
    },
    activityTail(date, days) {
      const rows = activityMemo || []
      const from = tphHourMs_(date, 0, String(dqSetting_(cfg, 'business_tz'))) - days * 86400000
      const clock = tphClock_(String(dqSetting_(cfg, 'activity_local_tz')))
      return rows.filter((r) => {
        const t = clock.ms(r[0])
        return t !== null && t >= from
      })
    },
    async ensureHeadcount() {
      if (env.headcount.length) return
      // dqHeadcount_ fallback: the current month file's Headcount tab.
      const month = prodToday_(cfg, env.today).slice(0, 7)
      await env.prefetchWorkbook(prodFileFor_(month, cfg), ['Headcount'])
      try {
        env.headcount = prodHeadcountRows_(env.openSpreadsheet(prodFileFor_(month, cfg)))
      } catch {
        env.headcount = []
      }
      headcount = env.headcount
    },

    cachedLive(name) {
      return (tables[name] || []).map((r) => ({ ...r }))
    },
    readTickets(_cols, pick) {
      ;(tables['tickets'] || []).forEach((o) => {
        pick(o)
      })
    },
    readInflow(year) {
      return (tables['agg_inflow_hourly'] || []).filter((r) => Number(r.year) === year)
    },
    async prefetchTables(names) {
      await Promise.all(
        names.map(async (name) => {
          if (tables[name]) return
          try {
            const { data, error } = await db().from(name).select('*').limit(200000)
            if (error) tableErrors[name] = describeDbError(error, { table: name }).message
            tables[name] = error ? [] : ((data || []) as Row[])
          } catch (e) {
            tableErrors[name] = describeDbError(e, { table: name }).message
            tables[name] = []
          }
        })
      )
    },
    async ensureIntervals(dates) {
      const min = dates.reduce((m, d) => (d < m ? d : m), dates[0] || '')
      if (!min || min >= intervalBound) return
      intervalBound = min
      try {
        const { data, error } = await db().from('prod_intervals').select('*').gte('date', min).limit(200000)
        if (!error) tables['prod_intervals'] = (data || []) as Row[]
      } catch {
        /* keep the narrower window */
      }
    },

    markDirty(dates) {
      const cur = Array.isArray(cfg.prod_dirty_dates) ? (cfg.prod_dirty_dates as string[]) : []
      const next = cur.slice()
      dates.forEach((d) => {
        if (d && next.indexOf(d) === -1) next.push(d)
      })
      next.sort()
      setConfigValue('prod_dirty_dates', next)
    },
    takeDirty() {
      const cur = Array.isArray(cfg.prod_dirty_dates) ? (cfg.prod_dirty_dates as string[]) : []
      const take = cur.slice(0, 31) // PROD_DIRTY_MAX
      setConfigValue('prod_dirty_dates', cur.slice(31))
      return take
    },
    lastMail() {
      const v = cfg.prod_last_mail
      return v && typeof v === 'object' ? (v as { id?: string; ms?: number; importedAt?: string; dates?: string[] }) : {}
    },
    setLastMail(v) {
      setConfigValue('prod_last_mail', v)
    },

    logRun(job, startedMs, status, info) {
      ops.push({
        kind: 'append',
        table: 'refresh_log',
        soft: true,
        rows: [
          toDbRow('refresh_log', {
            // legacy refresh_log has log_id/type NOT NULL; post-004 both exist.
            log_id: repoNewId('rl'),
            type: job,
            job,
            started_at: new Date(startedMs).toISOString(),
            finished_at: new Date().toISOString(),
            rows_in: info.rowsIn === undefined ? '' : info.rowsIn,
            rows_out: info.rowsOut === undefined ? '' : info.rowsOut,
            source_cursor: info.cursor || '',
            status,
            error: info.error ? String(info.error).slice(0, 500) : '',
            note: info.note || '',
          }),
        ],
      })
    },
    newId(prefix) {
      return repoNewId(prefix)
    },
    log(msg) {
      console.log(msg)
    },

    // TphStepIo step builders — the ported pure fns with this env as their io.
    buildTouches(dates, rows) {
      return tphBuildTouches_(dates, rows, env)
    },
    buildCallMinutes(dates) {
      return tphBuildCallMinutes_(dates, env)
    },
    buildCases(dates, rows, part) {
      return tphBuildCases_(dates, rows, part, env)
    },

    gmail: opts.gmail === undefined ? getGmailReadAdapter() : opts.gmail,
    sendMail: opts.sendMail || ((msg, actor) => sendMail(msg, actor)),
    hbBeat: opts.hbBeat || platformHbBeat,
    hbFlush: opts.hbFlush || platformHbFlush,
  }

  return env
}

// ---------------------------------------------------------------- apply ops

async function applyOp(op: WriteOp): Promise<void> {
  if (op.kind === 'append') {
    if (!op.rows.length) return
    const { error } = await db().from(op.table).insert(op.rows)
    if (error) throw new Error(op.table + ' insert: ' + error.message)
    return
  }
  if (op.kind === 'replaceKeys') {
    const del = db().from(op.table).delete().in(op.key, op.vals as never[])
    const { error } = await del
    if (error) throw new Error(op.table + ' delete: ' + error.message)
    if (op.rows.length) {
      const { error: insErr } = await db().from(op.table).insert(op.rows)
      if (insErr) throw new Error(op.table + ' insert: ' + insErr.message)
    }
    return
  }
  // upsert: prefer Postgres upsert on a constraint when the table has one;
  // without one (the prod tables' keys are plain columns), delete the key rows
  // then insert — the sheet replace semantic dqUpsert_ had. A single key column
  // batches into one .in() delete; composite keys delete per distinct tuple so
  // rows outside the write set (e.g. an agent absent from today's analytics)
  // survive, like the legacy row-by-row match.
  const { error } = await db().from(op.table).upsert(op.rows, { onConflict: op.keys.join(',') })
  if (!error) return
  if (!/constraint|conflict|42P10/i.test(error.message)) throw new Error(op.table + ' upsert: ' + error.message)
  if (op.keys.length === 1) {
    const vals = [...new Set(op.rows.map((r) => r[op.keys[0]]))]
    const { error: delErr } = await db()
      .from(op.table)
      .delete()
      .in(op.keys[0], vals as never[])
    if (delErr) throw new Error(op.table + ' delete: ' + delErr.message)
  } else {
    for (const tuple of tuplesOf(op.keys, op.rows)) {
      let del = db().from(op.table).delete()
      op.keys.forEach((k, i) => {
        del = del.eq(k, tuple[i] as never)
      })
      const { error: delErr } = await del
      if (delErr) throw new Error(op.table + ' delete: ' + delErr.message)
    }
  }
  if (op.rows.length) {
    const { error: insErr } = await db().from(op.table).insert(op.rows)
    if (insErr) throw new Error(op.table + ' insert: ' + insErr.message)
  }
}

function tuplesOf(keys: string[], rows: Row[]): unknown[][] {
  const seen: Record<string, boolean> = {}
  const out: unknown[][] = []
  rows.forEach((r) => {
    const t = keys.map((k) => r[k])
    const j = JSON.stringify(t)
    if (seen[j]) return
    seen[j] = true
    out.push(t)
  })
  return out
}

