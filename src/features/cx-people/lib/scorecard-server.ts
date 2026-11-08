/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim Scorecard.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * Scorecard.js — the server half: scReadRange_/scMonthRows_ on Postgres, the
 * page endpoints (getScorecardPage, getScorecardDetail, getScorecardAdmin), the
 * workbook write paths (saveScorecardSource / removeScorecardSource /
 * refreshScorecard / scNightly_) and the shared seams the 1:1 context reuses
 * (scIo_, scWho_, scKpiCtx_).
 *
 * Datastore change: the yearly data stores (dqSheet_(name, year)) collapse into
 * the flat Postgres tables sc_daily / sc_behaviour — one read each, the callers
 * slice by date like scReadRange_ did. sc_months stays a live table keyed on
 * month. The workbook itself is read through the Sheets API seam
 * (jobs/sheets fetchWorkbookTabs) — absent creds it throws like openSpreadsheet_
 * did, so refresh reports the failure instead of wiping a month.
 */

import 'server-only'
import {
  dqAddDays_,
  dqDateKey_,
  dqKeyPart_,
  dqSetting_,
  prodDateKey_,
  type Cfg,
  type Directory,
} from '@/features/shared/lib/adapters'
import { readStore } from '@/features/shared/platform/stores'
import { db } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, requireJobCaller, pwDirectory } from '@/features/shared/platform/identity'
import { getConfig, setConfig, configAll } from '@/features/shared/platform/settings'
import { fetchWorkbookTabs, sheetCreds } from '@/features/shared/jobs/sheets'
import { dqStep_ } from '@/features/shared/jobs/steps'
import type { JobEnv } from '@/features/shared/jobs/env'
import { described } from '@/features/shared/lib/errors'
import {
  scAggregate_,
  scDayRows_,
  scEmail_,
  scLoad_,
  scMonthRows_,
  scMonthsOf_,
  scMonthView_,
  scNotes_,
  scNum_,
  scSources_,
  scWorkbookFor_,
} from './scorecard/index'
import {
  kpiHiringDates_,
  kpiLeaveDates_,
  kpiLeaveIneligible_,
  kpiOlCases_,
  kpiProbationMonth_,
  KPI_WEIGHTS,
  KPI_BANDS,
} from './kpi'

export const SC_MATRIX_TAB = 'Productivity Matrix'
export const SC_MATRIX_FIRST_ROW = 3 // rows 1-2 are headers
export const SC_MATRIX_LAST_COL = 22 // through V
// 1-based columns of the Matrix, as given by the sheet owner (same as V1).
export const SC_MC = { name: 1, date: 2, email: 3, inbTarget: 5, inbAchieved: 6, txtTarget: 11, txtAchieved: 12,
                       waTarget: 16, waAchieved: 17, audits: 21, qualScore: 22 }
export const SC_FCR_TAB = 'FCR'
export const SC_FCR_EMAIL_COL = 11 // K
export const SC_FCR_DATE_COL = 4 // D
// The behaviour log is found by its header text, on its own tab or (older months) the ranking tab.
export const SC_BEHAVIOUR_TABS = ['Business Behavior', 'Stackranking', 'Stack Ranking']
export const SC_BEHAVIOUR_HEADER = 'Date of Incident'
export const SC_BEHAVIOUR_SCAN_ROWS = 400
export const SC_BEHAVIOUR_SCAN_COLS = 12
export const SC_REFRESH_MIN_GAP_MS = 60000
export const SC_MAX_REFRESH_MONTHS = 3

// ---------- pure: parsing ----------

/** Quality may be stored as 0.92 or as 92. Normalise to a 0-100 percentage. */
export function scPct100_(v: unknown): number {
  const n = scNum_(v)
  return n > 0 && n <= 1 ? n * 100 : n
}

export function scMonthOk_(m: unknown): boolean {
  return /^\d{4}-(0[1-9]|1[0-2])$/.test(String(m))
}
export function scDateOk_(d: unknown): boolean {
  return /^\d{4}-\d\d-\d\d$/.test(String(d))
}

/** Matrix values (rows from SC_MATRIX_FIRST_ROW, columns A..V) -> one row per agent per day. First row for an agent+day wins. */
export function scParseMatrix_(values: unknown[][], dateKey: (v: unknown) => string | null): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  const seen: Record<string, boolean> = {}
  values.forEach((r) => {
    const email = scEmail_(r[SC_MC.email - 1])
    const date = dateKey(r[SC_MC.date - 1])
    if (!email || !date) return // spilled-formula blanks and stray rows
    const k = email + '|' + date
    if (seen[k]) return
    seen[k] = true
    out.push({
      name: String(r[SC_MC.name - 1] || '').trim(), email, date,
      inbTarget: scNum_(r[SC_MC.inbTarget - 1]), inbAchieved: scNum_(r[SC_MC.inbAchieved - 1]),
      txtTarget: scNum_(r[SC_MC.txtTarget - 1]), txtAchieved: scNum_(r[SC_MC.txtAchieved - 1]),
      waTarget: scNum_(r[SC_MC.waTarget - 1]), waAchieved: scNum_(r[SC_MC.waAchieved - 1]),
      audits: scNum_(r[SC_MC.audits - 1]), qualScore: scPct100_(r[SC_MC.qualScore - 1]),
    })
  })
  return out
}

/** FCR verdicts from three parallel columns (email, date or null, verdict). Rows without an email are skipped. */
export function scParseFcr_(emails: unknown[], dates: unknown[] | null, verdicts: unknown[], dateKey: (v: unknown) => string | null) {
  const out: { email: string; date: string; verdict: string }[] = []
  for (let i = 0; i < emails.length; i++) {
    const email = scEmail_(emails[i])
    if (!email) continue
    const d = dates ? dateKey(dates[i]) : ''
    if (dates && !d) continue
    const v = String(verdicts[i] || '').trim().toLowerCase()
    if (v !== 'passed' && v !== 'failed' && v !== 'excluded') continue
    out.push({ email, date: d || '', verdict: v })
  }
  return out
}

/**
 * Behaviour cases from a block of cells: finds the 'Date of Incident' header, takes
 * the agent email from the cell to its left and the case details from the cell to its
 * right, and reads down until the first blank email (other tables sit below).
 */
export function scParseBehaviour_(grid: unknown[][], dateKey: (v: unknown) => string | null) {
  for (let r = 0; r < grid.length; r++) {
    for (let c = 1; c < grid[r].length; c++) {
      if (String(grid[r][c] || '').trim() !== SC_BEHAVIOUR_HEADER) continue
      const cases: { email: string; date: string; note: string }[] = []
      const seen: Record<string, boolean> = {}
      for (let i = r + 1; i < grid.length; i++) {
        const email = scEmail_(grid[i][c - 1])
        if (!email) break
        const d = dateKey(grid[i][c]) || ''
        const note = String(grid[i][c + 1] || '').trim()
        const k = email + '|' + d + '|' + note
        if (seen[k]) continue
        seen[k] = true
        cases.push({ email, date: d, note })
      }
      return { found: true, cases }
    }
  }
  return { found: false, cases: [] as { email: string; date: string; note: string }[] }
}

/**
 * Month rows for the sc_daily table: Matrix days merged with FCR counts by (date, email).
 * Matrix rows dated outside the month are skipped and counted. An undated FCR tab
 * (dated === false) is stored on the 1st of the month.
 */
export function scBuildDaily_(
  month: string,
  matrix: Record<string, any>[],
  fcr: { email: string; date: string; verdict: string }[],
  dated: boolean,
  nameOf: Record<string, string> | null,
) {
  const byKey: Record<string, Record<string, any>> = {}
  let skipped = 0
  const zero = (date: string, email: string, name: string) => ({
    month, date, email, name, matrix_day: 0, inb_target: 0, inb_achieved: 0, txt_target: 0,
    txt_achieved: 0, wa_target: 0, wa_achieved: 0, audits: 0, score_x_audits: 0, fcr_passed: 0, fcr_failed: 0, fcr_excluded: 0,
  })
  matrix.forEach((m) => {
    if (String(m.date).slice(0, 7) !== month) { skipped++; return }
    const o = (byKey[String(m.date) + '|' + m.email] = zero(String(m.date), m.email, String(m.name || '')))
    o.matrix_day = 1
    o.inb_target = m.inbTarget; o.inb_achieved = m.inbAchieved
    o.txt_target = m.txtTarget; o.txt_achieved = m.txtAchieved
    o.wa_target = m.waTarget; o.wa_achieved = m.waAchieved
    // The Matrix score is the day's average over that day's audits: weighting by audits rebuilds the true mean.
    o.audits = m.audits; o.score_x_audits = Number(m.qualScore) * Number(m.audits)
  })
  fcr.forEach((f) => {
    const date = dated ? f.date : month + '-01'
    if (date.slice(0, 7) !== month) return
    const k = date + '|' + f.email
    const o = (byKey[k] = byKey[k] || zero(date, f.email, (nameOf && nameOf[f.email]) || ''))
    o['fcr_' + f.verdict]++
  })
  const rows = Object.keys(byKey).map((k) => byKey[k])
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
  return { rows, skipped }
}

// ---------- store: Postgres reads ----------

/**
 * scReadRange_ equivalent: rows of a flat store table whose 'date' key-part
 * falls in [from, to]; undated rows are kept for sc_behaviour like the legacy
 * block-read did (an undated case sits in its month).
 */
export async function scReadRange_(name: string, from: string, to: string): Promise<Record<string, unknown>[]> {
  const { rows } = await readStore(name)
  return rows.filter((r) => {
    const d = dqKeyPart_('date', r.date)
    return d === '' ? name === 'sc_behaviour' : d >= from && d <= to
  })
}

/** scMonthRows_ equivalent: sc_months keyed by month ([] when the store is absent). */
export async function scMonthRowsDb_(): Promise<Record<string, Record<string, unknown>>> {
  return scMonthRows_((await readStore('sc_months')).rows)
}

/**
 * The io seam scLoad_ / pwScoreMonths_ take: every table the scorecard reads
 * prefetched once, then exposed through the synchronous shape the pure layer
 * expects (missing tables read as []).
 */
export async function scIo_(cfg: Cfg) {
  const [daily, behaviour, bhvLog, months] = await Promise.all([
    readStore('sc_daily'),
    readStore('sc_behaviour'),
    readStore('kpi_behaviour_log'),
    readStore('sc_months'),
  ])
  const tables: Record<string, Record<string, unknown>[]> = {
    sc_daily: daily.rows,
    sc_behaviour: behaviour.rows,
  }
  const monthMap = scMonthRows_(months.rows)
  return {
    readRange: (name: string, from: string, to: string) =>
      (tables[name] || []).filter((r) => {
        const d = dqKeyPart_('date', r.date)
        return d === '' ? name === 'sc_behaviour' : d >= from && d <= to
      }),
    behaviourLogRows: bhvLog.rows,
    monthRows: () => monthMap,
    workbookFor: (m: string) => scWorkbookFor_(m, cfg),
  }
}

/** scWho_ equivalent: { name, tlName, tlEmail } by email, from the roster directory. */
export function scWho_(dir: Directory): Record<string, { name?: string; tlName?: string; tlEmail?: string }> {
  const out: Record<string, { name?: string; tlName?: string; tlEmail?: string }> = {}
  Object.keys(dir.by).forEach((e) => {
    const p = dir.by[e]
    const tl = p.tlEmail ? dir.by[p.tlEmail] : null
    out[e] = { name: p.name, tlName: tl ? tl.name : '', tlEmail: scEmail_(p.tlEmail) }
  })
  return out
}

/**
 * scKpiCtx_: per-agent payout inputs for a period — OL cases in its months
 * (kpi_ol_cases), unplanned leaves as of the period end (kpi_leave_log),
 * probation month of the period end (Roster hiring_date).
 */
export async function scKpiCtx_(range: { from: string; to: string }) {
  const [olRows, leaveRows, rosterRows] = await Promise.all([
    readStore('kpi_ol_cases'),
    readStore('kpi_leave_log'),
    readStore('roster'),
  ])
  const ol = kpiOlCases_(olRows.rows, scMonthsOf_(range.from, range.to))
  const leaves = kpiLeaveDates_(leaveRows.rows)
  const hiring = kpiHiringDates_(rosterRows.rows)
  const month = range.to.slice(0, 7)
  return (email: string) => ({
    olCases: ol[email] || 0,
    leaveIneligible: kpiLeaveIneligible_(leaves[email] || [], range.to),
    probationMonth: kpiProbationMonth_(hiring[email], month),
  })
}

// ---------- page endpoints ----------

function scDefaultRange_(today: string) {
  return { from: today.slice(0, 7) + '-01', to: today }
}

export async function scRange_(params: Record<string, unknown> | null | undefined) {
  const today = dqDateKey_(new Date())
  const p = params || {}
  const def = scDefaultRange_(today)
  const from = String(p.from || def.from)
  const to = String(p.to || def.to)
  if (!scDateOk_(from) || !scDateOk_(to)) throw new Error('Dates are yyyy-MM-dd.')
  if (from > to) throw new Error('"From" is after "To".')
  if (scMonthsOf_(from, to).length > 14) throw new Error('Pick a period of 14 months or less.')
  return { today, from, to }
}

/** Rows each role may see: admin and TLs see everyone (V1's shared scoreboard); an agent sees only themself. */
function scVisible_(rows: Record<string, any>[], user: { email: string; role: string }) {
  if (user.role === 'agent') return rows.filter((r) => r.email === user.email)
  return rows
}

export async function getScorecardPage(params?: Record<string, unknown>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const range = await scRange_(params)
  const cfg = (await configAll()) as Cfg
  const io = await scIo_(cfg)
  const d = scLoad_(io, range)
  const dir = await pwDirectory()
  const kctx = await scKpiCtx_(range)
  const rows = scVisible_(scAggregate_(d.daily, d.cases, d.bhvFound, scWho_(dir), kctx), user)
  const stamps = d.views.map((v) => v.refreshedAt).filter(String).sort()
  return {
    today: range.today, from: range.from, to: range.to, scope: user.role, you: user.email, weights: KPI_WEIGHTS, bands: KPI_BANDS,
    dataAsOf: stamps.length ? stamps[stamps.length - 1] : '', canRefresh: user.role !== 'agent',
    months: d.views.map((v) => ({ month: v.month, status: v.status, refreshedAt: v.refreshedAt, lastDate: v.lastDate })),
    notes: scNotes_(d.months, d.views), agents: rows,
  }
}

export async function getScorecardDetail(params?: Record<string, unknown>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const email = scEmail_(params && params.email)
  if (!email) throw new Error('No agent selected.')
  if (user.role === 'agent' && email !== user.email) throw new Error('You can only view your own scorecard.')
  const range = await scRange_(params)
  const cfg = (await configAll()) as Cfg
  const io = await scIo_(cfg)
  const d = scLoad_(io, range)
  const dir = await pwDirectory()
  const who = scWho_(dir)
  const kctx = await scKpiCtx_(range)
  const totals = scAggregate_(d.daily, d.cases, d.bhvFound, who, kctx).filter((r) => r.email === email)[0] || null
  return { email, from: range.from, to: range.to, totals, days: scDayRows_(d.daily, d.cases, d.bhvFound, email, kctx) }
}

// ---------- store: month replace (scReplaceMonth_ on Postgres) ----------

/** Replaces one month's rows in a store table (every row carries a 'month' column). */
async function scReplaceMonth_(name: string, month: string, objs: Record<string, unknown>[], actor: string) {
  const { error: delErr } = await db().from(name).delete().eq('month', month)
  if (delErr) throw described(delErr, { table: name })
  if (!objs.length) return 0
  const now = new Date().toISOString()
  const rows = objs.map((o) => ({ ...o, submitted_by: actor, submitted_at: now }))
  const { error } = await db().from(name).insert(rows)
  if (error) throw described(error, { table: name })
  return objs.length
}

/** A pasted sheet link or bare ID -> the ID, or ''. */
export function scSheetId_(text: unknown): string {
  const s = String(text || '').trim()
  const m = s.match(/\/d\/([A-Za-z0-9_-]{20,})/)
  if (m) return m[1]
  return /^[A-Za-z0-9_-]{20,}$/.test(s) ? s : ''
}

// ---------- store: reading a workbook ----------

/** Header cells of a tab's first row, lower-cased; '' when the tab is missing or empty. */
function scHeaders_(cells: unknown[][]): string[] {
  const first = cells && cells[0]
  if (!first || !first.length) return []
  return first.map((h) => String(h || '').trim().toLowerCase())
}

function scColumn_(cells: unknown[][], col: number, rows: number): unknown[] {
  const out: unknown[] = []
  for (let i = 0; i < rows; i++) out.push((cells[1 + i] || [])[col - 1])
  return out
}

/**
 * Reads one month's three tabs of a prefetched workbook. Returns
 * { matrix, fcr, fcrDated, fcrNote, behaviour, behaviourNote, title }.
 * Throws only when the Matrix tab is missing; FCR and behaviour problems come back as notes.
 */
export function scReadWorkbook_(cells: Record<string, unknown[][]>, title: string) {
  const res: Record<string, any> = { title, matrix: [], fcr: [], fcrDated: true, fcrNote: '', fcrFound: false, behaviour: { found: false, cases: [] }, behaviourNote: '' }
  const mx = cells[SC_MATRIX_TAB]
  if (!mx) throw new Error('This workbook has no "' + SC_MATRIX_TAB + '" tab.')
  if (mx.length >= SC_MATRIX_FIRST_ROW) {
    res.matrix = scParseMatrix_(mx.slice(SC_MATRIX_FIRST_ROW - 1).map((r) => r.slice(0, SC_MATRIX_LAST_COL)), (v) => prodDateKey_(v, 'Africa/Cairo'))
  }
  const fs = cells[SC_FCR_TAB]
  if (!fs) {
    res.fcrNote = 'No "' + SC_FCR_TAB + '" tab.'
  } else {
    const headers = scHeaders_(fs)
    const fcrCol = headers.indexOf('fcr') + 1
    const fl = fs.length
    if (!fcrCol) {
      res.fcrNote = 'No column headed "FCR" on the FCR tab.'
    } else if (fl >= 2) {
      const n = fl - 1
      let dateCol: number | null = SC_FCR_DATE_COL
      let dates = scColumn_(fs, dateCol, n)
      // Column D should hold dates; if not, look for a "date" header, else treat the tab as undated (V1).
      if (!dates.some((v) => prodDateKey_(v, 'Africa/Cairo'))) {
        const idx = headers.findIndex((h) => h.indexOf('date') !== -1)
        dateCol = idx >= 0 ? idx + 1 : null
        dates = dateCol ? scColumn_(fs, dateCol, n) : (null as never)
      }
      res.fcrFound = true
      res.fcrDated = !!dates
      if (!dates) res.fcrNote = 'The FCR tab has no date column: FCR is counted per month, not per day.'
      res.fcr = scParseFcr_(scColumn_(fs, SC_FCR_EMAIL_COL, n), dates as unknown[] | null, scColumn_(fs, fcrCol, n), (v) => prodDateKey_(v, 'Africa/Cairo'))
    } else {
      res.fcrFound = true
    }
  }
  for (let t = 0; t < SC_BEHAVIOUR_TABS.length && !res.behaviour.found; t++) {
    const bs = cells[SC_BEHAVIOUR_TABS[t]]
    if (!bs || bs.length < 1) continue
    const rows = Math.min(bs.length, SC_BEHAVIOUR_SCAN_ROWS)
    const cols = Math.min(bs.reduce((m, r) => Math.max(m, (r || []).length), 0) || 1, SC_BEHAVIOUR_SCAN_COLS)
    res.behaviour = scParseBehaviour_(bs.slice(0, rows).map((r) => r.slice(0, cols)), (v) => prodDateKey_(v, 'Africa/Cairo'))
  }
  if (!res.behaviour.found) res.behaviourNote = 'No "' + SC_BEHAVIOUR_HEADER + '" header on the Business Behavior tab.'
  return res
}

/** Upserts an sc_months meta row (dqUpsert_('sc_months', ['month'], ...)). */
async function scMonthUpsert_(meta: Record<string, unknown>, actor: string) {
  const { error } = await db().from('sc_months').upsert({ ...meta, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: 'month' })
  if (error) throw described(error, { table: 'sc_months' })
}

/**
 * scRefreshMonth_: reads a month's workbook into the three tables. Never wipes
 * a month: with no Matrix rows dated in the month the previous rows stay and
 * the error is recorded. The workbook tabs are fetched through the Sheets seam;
 * absent creds the refresh fails like openSpreadsheet_ failing did.
 */
export async function scRefreshMonth_(month: string, who: string, cfg?: Cfg) {
  const c = (cfg || ((await configAll()) as Cfg))
  const src = scWorkbookFor_(month, c)
  const meta: Record<string, unknown> = { month, workbook_id: src.id, refreshed_at: new Date().toISOString(), refreshed_by: who || 'nightly' }
  const months = await scMonthRowsDb_()
  const prev = months[month]
  const fail = async (msg: string) => {
    meta.status = 'error'
    meta.error = msg + (prev && prev.refreshed_at ? ' The earlier data for this month is kept.' : '')
    ;['title', 'matrix_rows', 'agents', 'first_date', 'last_date', 'skipped_rows', 'fcr_rows', 'fcr_dated', 'fcr_note', 'behaviour_found',
     'behaviour_cases', 'behaviour_note'].forEach((k) => { if (prev) meta[k] = prev[k] })
    // The last good read time stays visible as "data as of"; the failed attempt is in error.
    if (prev && prev.refreshed_at) meta.refreshed_at = prev.refreshed_at
    await scMonthUpsert_(meta, who || 'nightly')
    return scMonthView_(month, meta, src)
  }
  if (!src.id) return fail('No workbook is set for ' + month + '.')
  let data: Record<string, any>
  try {
    const cells = await fetchWorkbookTabs(String(src.id), [SC_MATRIX_TAB, SC_FCR_TAB].concat(SC_BEHAVIOUR_TABS))
    data = scReadWorkbook_(cells, String(src.id))
  } catch (e) {
    return fail('Could not read the workbook: ' + ((e as Error)?.message || e) + '.')
  }
  const names: Record<string, string> = {}
  data.matrix.forEach((m: Record<string, any>) => { if (m.name) names[m.email] = m.name })
  const built = scBuildDaily_(month, data.matrix, data.fcr, data.fcrDated, names)
  if (!built.rows.some((r) => r.matrix_day)) {
    return fail('"' + data.title + '" has no Productivity Matrix rows dated in ' + month + (src.fallback ? " (it is the fallback workbook: add this month's workbook in Admin)" : '') + '.')
  }
  const stamp = new Date().toISOString()
  built.rows.forEach((r) => { r.computed_at = stamp })
  const cases = data.behaviour.cases.map((x: { date: string; email: string; note: string }) => ({ month, date: x.date, email: x.email, note: x.note }))
  await scReplaceMonth_('sc_daily', month, built.rows, who || 'nightly')
  await scReplaceMonth_('sc_behaviour', month, cases, who || 'nightly')
  const days = built.rows.filter((r) => r.matrix_day).map((r) => String(r.date)).sort()
  const agents: Record<string, boolean> = {}
  built.rows.forEach((r) => { if (r.matrix_day) agents[r.email] = true })
  meta.status = 'ok'
  meta.error = ''
  meta.title = data.title
  meta.matrix_rows = days.length
  meta.agents = Object.keys(agents).length
  meta.first_date = days[0]
  meta.last_date = days[days.length - 1]
  meta.skipped_rows = built.skipped
  meta.fcr_rows = data.fcr.length
  meta.fcr_dated = data.fcrFound ? (data.fcrDated ? 1 : 0) : ''
  meta.fcr_note = data.fcrNote
  meta.behaviour_found = data.behaviour.found ? 1 : 0
  meta.behaviour_cases = cases.length
  meta.behaviour_note = data.behaviourNote
  await scMonthUpsert_(meta, who || 'nightly')
  return scMonthView_(month, meta, src)
}

/** Nightly: the current month, plus last month in the first days of a month (late corrections to the workbook). */
export async function scNightly_() {
  const today = dqDateKey_(new Date())
  const months = [today.slice(0, 7)]
  if (Number(today.slice(8, 10)) <= 3) months.push(dqAddDays_(today.slice(0, 7) + '-01', -1).slice(0, 7))
  const out = []
  for (const m of months) out.push(await scRefreshMonth_(m, 'nightly'))
  return out
}

/**
 * jobScorecardNightly (PeopleTriggers.js), verbatim: requireJobCaller_ +
 * hbRun_('scorecard', scNightly_). The workbook read needs the Sheets service
 * account; without creds the run degrades honestly ({configured:false,skipped})
 * instead of writing error rows for a read that could never succeed. The
 * /api/cron/scorecard-nightly route runs the identical step inline; this is the
 * verbatim-named entry for callers that already hold a JobEnv.
 */
export async function jobScorecardNightly(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'scorecard', async () => {
    if (!sheetCreds()) {
      return {
        configured: false,
        skipped:
          'Google Sheets credentials are not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).',
        months: [] as unknown[],
      }
    }
    return { configured: true, months: await scNightly_() }
  })
}

/** Refresh now, for leaders: up to three months, each at most once a minute (the workbook read takes a few seconds). */
export async function refreshScorecard(months: unknown) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const list = (Array.isArray(months) ? months : [months]).map(String)
  list.forEach((m) => { if (!scMonthOk_(m)) throw new Error('Months are yyyy-MM.') })
  if (!list.length || list.length > SC_MAX_REFRESH_MONTHS) throw new Error('Refresh one to ' + SC_MAX_REFRESH_MONTHS + ' months at a time.')
  const cfg = (await configAll()) as Cfg
  const monthRows = await scMonthRowsDb_()
  const out = []
  for (const m of list) {
    const key = 'dq_sc_refresh_' + m.replace('-', '_')
    const lastMs = Number(await getConfig(key, 0)) || 0
    const wait = lastMs + SC_REFRESH_MIN_GAP_MS - Date.now()
    if (wait > 0) {
      const v = scMonthView_(m, monthRows[m], scWorkbookFor_(m, cfg)) as Record<string, unknown>
      v.retryInS = Math.ceil(wait / 1000)
      out.push(v)
      continue
    }
    await setConfig(key, String(Date.now()), undefined, user.email)
    out.push(await scRefreshMonth_(m, user.email, cfg))
  }
  return { months: out }
}

// ---------- admin endpoints ----------

/** What the admin box shows: the months that have a workbook, were read, or are current, each with what was found. */
export async function getScorecardAdmin() {
  await requireRole(['admin'])
  const cfg = (await configAll()) as Cfg
  const files = scSources_(cfg)
  const all = await scMonthRowsDb_()
  const current = dqDateKey_(new Date()).slice(0, 7)
  const set: Record<string, boolean> = {}
  Object.keys(files).concat(Object.keys(all), [current]).forEach((m) => { if (scMonthOk_(m)) set[m] = true })
  const months = Object.keys(set).sort().reverse().map((m) => scMonthView_(m, all[m], scWorkbookFor_(m, cfg)))
  return { current, fallbackId: String(dqSetting_(cfg, 'productivity_fallback_id') || ''), months,
           tabs: [SC_MATRIX_TAB, SC_FCR_TAB, SC_BEHAVIOUR_TABS[0]] }
}

/** Opens a workbook and reports what the scorecard would read from it, without storing anything. */
export async function scInspect_(id: string, month: string) {
  const cells = await fetchWorkbookTabs(id, [SC_MATRIX_TAB, SC_FCR_TAB].concat(SC_BEHAVIOUR_TABS))
  const out: Record<string, unknown> = { title: id, matrix: false, fcr: false, behaviour: false, matrixDays: 0, firstDate: '', lastDate: '', agents: 0, monthMatches: false, note: '' }
  const mx = cells[SC_MATRIX_TAB]
  out.fcr = !!cells[SC_FCR_TAB]
  out.behaviour = SC_BEHAVIOUR_TABS.some((t) => !!cells[t])
  if (mx) {
    out.matrix = true
    if (mx.length >= SC_MATRIX_FIRST_ROW) {
      const rows = scParseMatrix_(mx.slice(SC_MATRIX_FIRST_ROW - 1).map((r) => {
        const x: unknown[] = []; x[SC_MC.name - 1] = r[0]; x[SC_MC.date - 1] = r[1]; x[SC_MC.email - 1] = r[2]; return x
      }), (v) => prodDateKey_(v, 'Africa/Cairo'))
      const dates = rows.map((r) => String(r.date)).sort()
      const ag: Record<string, boolean> = {}
      rows.forEach((r) => { ag[String(r.email)] = true })
      out.matrixDays = rows.length
      out.agents = Object.keys(ag).length
      out.firstDate = dates[0] || ''
      out.lastDate = dates[dates.length - 1] || ''
      out.monthMatches = rows.some((r) => String(r.date).slice(0, 7) === month)
    }
  }
  if (!out.matrix) out.note = 'No "' + SC_MATRIX_TAB + '" tab: this is not a productivity workbook.'
  else if (!out.monthMatches) out.note = 'The Matrix has no rows dated in ' + month + (out.firstDate ? ' (it covers ' + out.firstDate + ' to ' + out.lastDate + ')' : '') + '.'
  return out
}

/** Validates a pasted link or ID for a month and, when it opens and has the Matrix tab, saves it in Config productivity_files. */
export async function saveScorecardSource(month: unknown, link: unknown) {
  const user = await requireRole(['admin'])
  await assertWritable()
  month = String(month)
  if (!scMonthOk_(month)) throw new Error('Month is yyyy-MM.')
  const id = scSheetId_(link)
  if (!id) throw new Error('That is not a Google Sheets link or ID.')
  let found: Record<string, unknown>
  try {
    found = await scInspect_(id, String(month))
  } catch (e) {
    throw new Error('The workbook could not be opened: ' + ((e as Error)?.message || e) + '. Share it with the script owner and try again.')
  }
  if (!found.matrix) throw new Error(String(found.note))
  const cfg = (await configAll()) as Cfg
  const files = JSON.parse(JSON.stringify(scSources_(cfg))) as Record<string, string>
  files[String(month)] = id
  await setConfig('productivity_files', files, undefined, user.email)
  return { month, workbookId: id, found, saved: true }
}

export async function removeScorecardSource(month: unknown) {
  const user = await requireRole(['admin'])
  await assertWritable()
  month = String(month)
  const cfg = (await configAll()) as Cfg
  const files = JSON.parse(JSON.stringify(scSources_(cfg))) as Record<string, string>
  if (!files[String(month)]) throw new Error('No workbook is set for ' + month + '.')
  delete files[String(month)]
  await setConfig('productivity_files', files, undefined, user.email)
  return { month }
}
