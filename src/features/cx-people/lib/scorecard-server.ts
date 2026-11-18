/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim Scorecard.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * Scorecard.js — the server half: scReadRange_/scMonthRows_ on Postgres, the
 * page endpoints (getScorecardPage, getScorecardDetail, getScorecardAdmin), the
 * month rebuild (scNightly_/refreshScorecard/scRefreshMonth_), the admin
 * workbook-id config (saveScorecardSource / removeScorecardSource) and the
 * shared seams the 1:1 context reuses (scIo_, scWho_, scKpiCtx_).
 *
 * Datastore change: the yearly data stores (dqSheet_(name, year)) collapse into
 * the flat Postgres tables sc_daily / sc_behaviour — one read each, the callers
 * slice by date like scReadRange_ did. sc_months stays a live table keyed on
 * month. sc_daily is rebuilt from prod_daily_layers + qa_audits
 * (scDailyRowsDb_) with stored fcr_* verdicts merged back (scMergeFcr_ — FCR
 * has no live source); sc_behaviour is append-only via the admin behaviour
 * form — refresh never touches it. No workbook is opened any more: the saved
 * month -> workbook id is display metadata only.
 */

import 'server-only'
import {
  dqAddDays_,
  dqDateKey_,
  dqKeyPart_,
  dqSetting_,
  type Cfg,
  type Directory,
} from '@/features/shared/lib/adapters'
import { readStore } from '@/features/shared/platform/stores'
import { db, readAllPaged } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, requireJobCaller, pwDirectory } from '@/features/shared/platform/identity'
import { getConfig, setConfig, configAll } from '@/features/shared/platform/settings'
import { dqStep_ } from '@/features/shared/jobs/steps'
import type { JobEnv } from '@/features/shared/jobs/env'
import { described } from '@/features/shared/lib/errors'
import {
  scAggregate_,
  scCasesInRange_,
  scDayRows_,
  scEmail_,
  scLoad_,
  scMonthRows_,
  scMonthsOf_,
  scMonthView_,
  scNotes_,
  scNum_,
  scRound1_,
  scSources_,
  scTrend_,
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
  const s = String(d)
  if (!/^\d{4}-\d\d-\d\d$/.test(s)) return false
  const t = new Date(s + 'T00:00:00Z')
  return isFinite(t.getTime()) && t.toISOString().slice(0, 10) === s
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
  const rows = await readAllPaged(name, {
    build:
      name === 'sc_behaviour'
        ? (q) => q.or(`date.is.null,date.eq.,and(date.gte.${from},date.lte.${to})`)
        : (q) => q.gte('date', from).lte('date', to),
  })
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
 * One month's sc_daily rows rebuilt from the DB mirrors — prod_daily_layers
 * ('effective' layer wins per date|email, else 'raw'/null) for the six
 * target/achieved numbers, qa_audits (kind 'audit' — ''/null counts as audit;
 * voided/disputed excluded, raw status compare) for
 * audits/score_x_audits, roster for names. fcr_* stay 0: stored verdicts are
 * merged back by the refresh caller (no live FCR source).
 */
export async function scDailyRowsDb_(month: string): Promise<{ rows: Record<string, unknown>[] }> {
  const first = new Date(month + '-01T00:00:00Z')
  const next = new Date(Date.UTC(first.getUTCFullYear(), first.getUTCMonth() + 1, 1))
  const from = month + '-01'
  const bound = next.toISOString().slice(0, 7) + '-01'
  const num0 = (v: unknown): number => {
    const n = Number(v)
    return isFinite(n) ? n : 0
  }

  const [layers, audits, roster] = await Promise.all([
    readAllPaged('prod_daily_layers', {
      columns: 'id,date,email,layer,agent_name,inbound_target,inbound_achieved,texting_target,texting_achieved,wa_target,wa_achieved',
      build: (q) => q.gte('date', from).lt('date', bound),
    }),
    readAllPaged('qa_audits', {
      columns: 'audit_date,agent_email,kind,status,score_final,score',
      build: (q) => q.gte('audit_date', from).lt('audit_date', bound),
    }),
    readStore('roster'),
  ])

  // prod_daily_layers: one row per date|email — 'effective' wins, else raw/null.
  const cand: Record<string, { eff?: Record<string, unknown>; raw?: Record<string, unknown> }> = {}
  layers.forEach((r) => {
    const date = String(r.date || '').slice(0, 10)
    const email = scEmail_(r.email)
    if (!date || !email) return
    const k = date + '|' + email
    const c = (cand[k] = cand[k] || {})
    if (String(r.layer) === 'effective') {
      if (!c.eff) c.eff = r
    } else if (String(r.layer || 'raw') === 'raw') {
      if (!c.raw) c.raw = r
    }
  })

  // qa_audits: audits + score_x_audits per audit_date|email (all sources count).
  const auditByKey: Record<string, { audits: number; scoreX: number }> = {}
  audits.forEach((r) => {
    if (String(r.kind || 'audit') !== 'audit') return
    if (r.status === 'voided' || r.status === 'disputed') return
    const date = String(r.audit_date || '').slice(0, 10)
    const email = scEmail_(r.agent_email)
    if (!date || !email) return
    const k = date + '|' + email
    const a = (auditByKey[k] = auditByKey[k] || { audits: 0, scoreX: 0 })
    a.audits += 1
    a.scoreX += scPct100_(r.score_final ?? r.score)
  })

  const nameOf: Record<string, string> = {}
  roster.rows.forEach((r) => {
    const e = scEmail_(r.email)
    if (e && !nameOf[e]) nameOf[e] = String(r.name || '').trim()
  })

  const byKey: Record<string, Record<string, any>> = {}
  const zero = (date: string, email: string, name: string) => ({
    month, date, email, name, matrix_day: 0, inb_target: 0, inb_achieved: 0, txt_target: 0,
    txt_achieved: 0, wa_target: 0, wa_achieved: 0, audits: 0, score_x_audits: 0, fcr_passed: 0, fcr_failed: 0, fcr_excluded: 0,
  })

  Object.keys(cand).forEach((k) => {
    const r = (cand[k].eff || cand[k].raw) as Record<string, unknown>
    const date = String(r.date).slice(0, 10)
    const email = scEmail_(r.email)
    const o = (byKey[k] = byKey[k] || zero(date, email, nameOf[email] || String(r.agent_name || '').trim()))
    o.matrix_day = 1
    o.inb_target = num0(r.inbound_target); o.inb_achieved = num0(r.inbound_achieved)
    o.txt_target = num0(r.texting_target); o.txt_achieved = num0(r.texting_achieved)
    o.wa_target = num0(r.wa_target); o.wa_achieved = num0(r.wa_achieved)
  })
  Object.keys(auditByKey).forEach((k) => {
    const [date, email] = k.split('|')
    const o = (byKey[k] = byKey[k] || zero(date, email, nameOf[email] || ''))
    o.audits = auditByKey[k].audits
    o.score_x_audits = auditByKey[k].scoreX
  })

  const rows = Object.keys(byKey).map((k) => byKey[k])
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
  return { rows }
}

/**
 * The io seam scLoad_ / pwScoreMonths_ take: every table the scorecard reads
 * prefetched once, then exposed through the synchronous shape the pure layer
 * expects (missing tables read as []).
 */
export async function scIo_(cfg: Cfg, range: { from: string; to: string }) {
  // Prefetch covers the previous comparison window too: pf is `spanDays` before
  // `from`, the same bound getScorecardPage / pwScoreMonths_ slice by.
  const spanDays = Math.round((Date.parse(range.to + 'T00:00:00Z') - Date.parse(range.from + 'T00:00:00Z')) / 86400000) + 1
  const pf = dqAddDays_(range.from, -spanDays)
  const [daily, behaviour, bhvLog, months] = await Promise.all([
    scReadRange_('sc_daily', pf, range.to),
    scReadRange_('sc_behaviour', pf, range.to),
    readAllPaged('kpi_behaviour_log', {
      build: (q) => q.gte('date', pf).lte('date', range.to),
    }),
    readStore('sc_months'),
  ])
  const tables: Record<string, Record<string, unknown>[]> = {
    sc_daily: daily,
    sc_behaviour: behaviour,
  }
  const monthMap = scMonthRows_(months.rows)
  return {
    readRange: (name: string, from: string, to: string) =>
      (tables[name] || []).filter((r) => {
        const d = dqKeyPart_('date', r.date)
        return d === '' ? name === 'sc_behaviour' : d >= from && d <= to
      }),
    behaviourLogRows: bhvLog,
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
  const io = await scIo_(cfg, range)
  const d = scLoad_(io, range)
  const dir = await pwDirectory()
  const kctx = await scKpiCtx_(range)
  const who = scWho_(dir)
  const rows = scVisible_(scAggregate_(d.daily, d.cases, d.bhvFound, who, kctx), user)
  rows.forEach((r) => {
    r.trend = scTrend_(d.daily, d.cases, d.bhvFound, r.email, kctx, range.from, range.to)
  })
  const spanDays = Math.round((Date.parse(range.to + 'T00:00:00Z') - Date.parse(range.from + 'T00:00:00Z')) / 86400000) + 1
  const pt = dqAddDays_(range.from, -1)
  const pf = dqAddDays_(range.from, -spanDays)
  const prev = scAggregate_(
    io.readRange('sc_daily', pf, pt),
    scCasesInRange_(io.readRange('sc_behaviour', pf, pt), pf, pt),
    d.bhvFound,
    who,
    kctx
  )
  const prevScores = prev.map((r) => r.overall).filter((v): v is number => typeof v === 'number' && isFinite(v))
  const prevTeam = prevScores.length ? scRound1_(prevScores.reduce((sum, v) => sum + v, 0) / prevScores.length) : null
  const stamps = d.views.map((v) => v.refreshedAt).filter(String).sort()
  return {
    today: range.today, from: range.from, to: range.to, scope: user.role, you: user.email, weights: KPI_WEIGHTS, bands: KPI_BANDS,
    dataAsOf: stamps.length ? stamps[stamps.length - 1] : '', canRefresh: user.role !== 'agent',
    months: d.views.map((v) => ({ month: v.month, status: v.status, refreshedAt: v.refreshedAt, lastDate: v.lastDate })),
    notes: scNotes_(d.months, d.views), agents: rows, prevTeam,
  }
}

export async function getScorecardDetail(params?: Record<string, unknown>) {
  const user = await requireRole(['admin', 'tl', 'agent'])
  const email = scEmail_(params && params.email)
  if (!email) throw new Error('No agent selected.')
  if (user.role === 'agent' && email !== user.email) throw new Error('You can only view your own scorecard.')
  const range = await scRange_(params)
  const cfg = (await configAll()) as Cfg
  const io = await scIo_(cfg, range)
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

/** Upserts an sc_months meta row (dqUpsert_('sc_months', ['month'], ...)). */
async function scMonthUpsert_(meta: Record<string, unknown>, actor: string) {
  const { error } = await db().from('sc_months').upsert({ ...meta, updated_by: actor, updated_at: new Date().toISOString() }, { onConflict: 'month' })
  if (error) throw described(error, { table: 'sc_months' })
}

/**
 * Merges a DB rebuild (scDailyRowsDb_) with the month's stored sc_daily rows:
 * stored fcr_* verdicts — FCR has no live source — land back on rebuilt rows by
 * date|email, and stored keys the rebuild no longer produces are kept as zero
 * rows (matrix_day 0, metrics 0, kept name). Returns the merged rows sorted like
 * scBuildDaily_ plus fcrRows, the total preserved verdict count for meta.
 */
export function scMergeFcr_(month: string, built: Record<string, any>[], stored: Record<string, unknown>[]) {
  const byKey: Record<string, Record<string, any>> = {}
  built.forEach((r) => { byKey[String(r.date) + '|' + r.email] = r })
  let fcrRows = 0
  stored.forEach((s) => {
    const fp = Number(s.fcr_passed) || 0
    const ff = Number(s.fcr_failed) || 0
    const fe = Number(s.fcr_excluded) || 0
    fcrRows += fp + ff + fe
    const o = byKey[String(s.date) + '|' + s.email]
    if (o) {
      o.fcr_passed = fp; o.fcr_failed = ff; o.fcr_excluded = fe
      return
    }
    byKey[String(s.date) + '|' + s.email] = {
      month, date: String(s.date), email: String(s.email), name: String(s.name || ''),
      matrix_day: 0, inb_target: 0, inb_achieved: 0, txt_target: 0, txt_achieved: 0,
      wa_target: 0, wa_achieved: 0, audits: 0, score_x_audits: 0,
      fcr_passed: fp, fcr_failed: ff, fcr_excluded: fe,
    }
  })
  const rows = Object.keys(byKey).map((k) => byKey[k])
  rows.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.email < b.email ? -1 : a.email > b.email ? 1 : 0))
  return { rows, fcrRows }
}

/**
 * scRefreshMonth_: rebuilds a month's sc_daily from the DB (scDailyRowsDb_),
 * merges the month's stored fcr_* verdicts back (scMergeFcr_ — FCR has no live
 * source), counts the month's sc_behaviour rows for meta, and leaves
 * sc_behaviour itself untouched (the admin behaviour form owns its writes).
 * Never wipes a month: with no prod_daily_layers rows dated in the month the
 * previous rows stay and the error is recorded.
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
  let built: { rows: Record<string, any>[] }
  let stored: Record<string, unknown>[]
  let bhvCases = 0
  try {
    const [b, s, bh] = await Promise.all([
      scDailyRowsDb_(month),
      readAllPaged('sc_daily', { build: (q) => q.eq('month', month) }),
      db().from('sc_behaviour').select('*', { count: 'exact', head: true }).eq('month', month),
    ])
    built = b
    stored = s
    bhvCases = Number(bh.count) || 0
  } catch (e) {
    return fail('Could not rebuild from the database: ' + ((e as Error)?.message || e) + '.')
  }
  const merged = scMergeFcr_(month, built.rows, stored)
  if (!merged.rows.some((r) => r.matrix_day)) {
    return fail('No prod_daily_layers rows dated in ' + month + ' — earlier data for this month is kept.')
  }
  const stamp = new Date().toISOString()
  merged.rows.forEach((r) => { r.computed_at = stamp })
  await scReplaceMonth_('sc_daily', month, merged.rows, who || 'nightly')
  const days = merged.rows.filter((r) => r.matrix_day).map((r) => String(r.date)).sort()
  const agents: Record<string, boolean> = {}
  merged.rows.forEach((r) => { if (r.matrix_day) agents[r.email] = true })
  meta.status = 'ok'
  meta.error = ''
  meta.title = 'DB rebuild (prod_daily_layers + qa_audits)'
  meta.matrix_rows = days.length
  meta.agents = Object.keys(agents).length
  meta.first_date = days[0]
  meta.last_date = days[days.length - 1]
  meta.skipped_rows = 0
  meta.fcr_rows = merged.fcrRows
  meta.fcr_dated = merged.fcrRows > 0
  meta.fcr_note = 'Stored FCR verdicts preserved on rebuild (no live source).'
  meta.behaviour_found = 1
  meta.behaviour_cases = bhvCases
  meta.behaviour_note = 'Managed via the admin behaviour form.'
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
 * hbRun_('scorecard', scNightly_). The rebuild reads Postgres only
 * (prod_daily_layers + qa_audits + sc_daily), so no credential gate remains.
 * The /api/cron/scorecard-nightly route runs the identical step inline; this
 * is the verbatim-named entry for callers that already hold a JobEnv.
 */
export async function jobScorecardNightly(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'scorecard', async () => ({ configured: true, months: await scNightly_() }))
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

/** Validates a pasted link or ID for a month and saves it in Config productivity_files (display metadata — no workbook is opened). */
export async function saveScorecardSource(month: unknown, link: unknown) {
  const user = await requireRole(['admin'])
  await assertWritable()
  month = String(month)
  if (!scMonthOk_(month)) throw new Error('Month is yyyy-MM.')
  const id = scSheetId_(link)
  if (!id) throw new Error('That is not a Google Sheets link or ID.')
  const cfg = (await configAll()) as Cfg
  const files = JSON.parse(JSON.stringify(scSources_(cfg))) as Record<string, string>
  files[String(month)] = id
  await setConfig('productivity_files', files, undefined, user.email)
  return { month, workbookId: id, saved: true }
}

/** Admin behaviour log: one case into sc_behaviour (month = the date's month); a duplicate (month,date,email,note) answers {saved:false,duplicate:true}. */
export async function addBehaviourCase(input: { email?: unknown; date?: unknown; note?: unknown }): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  const email = scEmail_(input.email)
  if (email.indexOf('@') === -1) throw new Error('Give a valid agent email.')
  const date = String(input.date || '').trim()
  if (!scDateOk_(date)) throw new Error('Date is yyyy-MM-dd.')
  const note = String(input.note || '').trim()
  if (note.length < 1 || note.length > 500) throw new Error('Note the behaviour in one line (1-500 chars).')
  const month = date.slice(0, 7)
  const { error } = await db().from('sc_behaviour').insert({ month, date, email, note, submitted_by: user.email })
  if (error) {
    const msg = String((error as { message?: string }).message || error)
    if ((error as { code?: string }).code === '23505' || /23505|duplicate key/i.test(msg)) return { saved: false, duplicate: true }
    throw described(error, { table: 'sc_behaviour' })
  }
  return { saved: true, month, date, email }
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
