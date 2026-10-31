/**
 * KPI API fragments — KpiPayout.js + the KpiLogs.js write paths on Postgres.
 *
 *   GET /api/kpi/payout     kpiPayout_ verbatim (KpiPayout.js:79). The input
 *                           assembly follows WorkCore.js scDerive_/scAggregate_:
 *                           prod/qual/fcr come from sc_daily when the scorecard
 *                           store is readable (the legacy sheet), else from the
 *                           platform stores that replaced it — prod_daily_layers
 *                           (effective layer, else raw) for productivity/quality
 *                           and fcr_daily for FCR. A missing store leaves its KPI
 *                           null (kpiHas_ false -> missing -> incomplete); nothing
 *                           is invented.
 *   /api/kpi/behaviour      kpi_behaviour_log — the Desk app's manual behaviour
 *   /api/kpi/leave          kpi_leave_log      case log (KpiLogs.js, absent from
 *   /api/kpi/ol-cases       kpi_ol_cases       the bundle). Writes keep to
 *                           KPI_LOG_HEADERS: logged_by/at stamped on create,
 *                           removed_by/at soft-delete (behaviour/leave),
 *                           key-upsert and updated_at for OL cases.
 *
 * The validators keep the legacy rule shape: required keys are named in the
 * error, leave type is checked against KPI_LEAVE_TYPES, dates are yyyy-MM-dd.
 */

import { db, updateRow, findRow, newId } from '@/lib/platform/repo'
import { assertWritable } from '@/lib/platform/viewas'
import { readStore } from '@/lib/platform/stores'
import { InputError } from '@/lib/api-error'
import { DATE_KEY_RE, MONTH_RE, inDateRange, monthRange, pick } from '@/lib/fragments'
import { normEmail_ } from '../prod/adapters'
import {
  KPI_LEAVE_TYPES,
  kpiLeaveDates_,
  kpiLeaveIneligible_,
  kpiLogRows_,
  kpiOlCases_,
  kpiPayout_,
  kpiProbationMonth_,
  type KpiPayoutResult,
} from './index'
import {
  scBucket_,
  scAdd_,
  scNumRow_,
  scNum_,
  scEmail_,
  scRound1_,
  scCasesInRange_,
} from '../scorecard/index'

// ---------------------------------------------------------------- helpers

const DATE_RE = DATE_KEY_RE

function num(v: unknown): number {
  return scNum_(v)
}

// ---------------------------------------------------------------- payout

export interface KpiPayoutEnvelope {
  email: string
  month: string
  from: string
  to: string
  asOf: string
  inputs: Record<string, unknown>
  /** Where each input came from — 'unavailable' when its store could not be read. */
  sources: Record<string, string>
  /** The verbatim kpiPayout_ result. */
  payout: KpiPayoutResult
}

/**
 * One agent's month payout. `asOf` is the leave-window end (today when the month
 * is not over yet — the scorecard scores month-to-date the same way).
 */
export async function kpiPayoutFor(email: string, month: string, today: string): Promise<KpiPayoutEnvelope> {
  const { from, to } = monthRange(month)
  const asOf = today < to ? today : to
  const e = normEmail_(email)

  const [scDaily, scBehaviour, prodLayers, fcrDaily, behaviour, leave, ol, roster] = await Promise.all([
    readStore('sc_daily'),
    readStore('sc_behaviour'),
    readStore('prod_daily_layers'),
    readStore('fcr_daily'),
    readStore('kpi_behaviour_log'),
    readStore('kpi_leave_log'),
    readStore('kpi_ol_cases'),
    readStore('roster'),
  ])

  // ---- prod / qual / fcr (scDerive_'s pctOrNull semantics) ----
  const sources: Record<string, string> = {}
  let prod: number | null = null
  let qual: number | null = null
  let fcr: number | null = null
  let days = 0
  let fcrSums = { passed: 0, failed: 0, excluded: 0 }

  const scRows = scDaily.rows.map(scNumRow_).filter((r) => r.email === e && inDateRange(r.date, from, to))
  if (scDaily.exists && scRows.length) {
    sources.metrics = 'sc_daily'
    const a = scBucket_(0)
    scRows.forEach((r) => {
      fcrSums.passed += Number(r.fcr_passed) || 0
      fcrSums.failed += Number(r.fcr_failed) || 0
      fcrSums.excluded += Number(r.fcr_excluded) || 0
      if (!r.matrix_day) return
      scAdd_(a, r as Record<string, number>)
    })
    days = a.days
    const totalTarget = a.inbTarget + a.txtTarget + a.waTarget
    const totalAchieved = a.inbAchieved + a.txtAchieved + a.waAchieved
    prod = totalTarget > 0 ? scRound1_((totalAchieved / totalTarget) * 100) : null
    qual = a.audits > 0 ? scRound1_(a.scoreXaudits / a.audits) : null
  } else {
    if (!scDaily.exists) sources.scorecard = 'unavailable'
    // prod_daily_layers (camelCase columns; 'effective' layer, else 'raw') — the
    // platform store the scorecard's Matrix extract was replaced by.
    const layers = prodLayers.rows.filter(
      (r) => normEmail_(r.email) === e && inDateRange(r.date, from, to)
    )
    const eff = layers.filter((r) => String(r.layer) === 'effective')
    const use = eff.length ? eff : layers.filter((r) => String(r.layer || 'raw') === 'raw')
    if (prodLayers.exists && use.length) {
      sources.metrics = 'prod_daily_layers:' + (eff.length ? 'effective' : 'raw')
      let tgt = 0,
        ach = 0,
        audits = 0,
        scoreX = 0
      use.forEach((r) => {
        tgt += num(pick(r, 'inboundTarget')) + num(pick(r, 'textingTarget')) + num(pick(r, 'waTarget'))
        ach +=
          num(pick(r, 'inboundAchieved')) + num(pick(r, 'textingAchieved')) + num(pick(r, 'waAchieved'))
        audits += num(pick(r, 'totalAudits'))
        scoreX += num(pick(r, 'avgScore')) * num(pick(r, 'totalAudits'))
        days += 1
      })
      prod = tgt > 0 ? scRound1_((ach / tgt) * 100) : null
      qual = audits > 0 ? scRound1_(scoreX / audits) : null
    } else if (!prodLayers.exists) {
      sources.metrics = 'unavailable'
    }
  }

  // FCR: sc_daily counts first (they came from the same extract); else fcr_daily.
  if (sources.metrics === 'sc_daily') {
    const den = fcrSums.passed + fcrSums.failed
    fcr = den > 0 ? scRound1_((fcrSums.passed / den) * 100) : null
    sources.fcr = 'sc_daily'
  } else if (fcrDaily.exists) {
    const rows = fcrDaily.rows.filter(
      (r) =>
        normEmail_(pick(r, 'agent_email', 'email')) === e && inDateRange(pick(r, 'date'), from, to)
    )
    const p = rows.reduce((s, r) => s + num(pick(r, 'passed', 'fcr_passed')), 0)
    const f = rows.reduce((s, r) => s + num(pick(r, 'failed', 'fcr_failed')), 0)
    const x = rows.reduce((s, r) => s + num(pick(r, 'excluded', 'fcr_excluded')), 0)
    fcrSums = { passed: p, failed: f, excluded: x }
    fcr = p + f > 0 ? scRound1_((p / (p + f)) * 100) : null
    sources.fcr = 'fcr_daily'
  } else {
    sources.fcr = 'unavailable'
  }

  // ---- behaviour (scLoad_ + kpi_behaviour_log; deduped email|date|note) ----
  const seen: Record<string, boolean> = {}
  const manual = kpiLogRows_(behaviour.rows)
    .filter((c) => normEmail_(c.email) === e)
    .map((c) => {
      const d = String(c.date || '').slice(0, 10)
      return { month: d.slice(0, 7), date: d, email: scEmail_(c.email), note: String(c.note || '') }
    })
  const cases = scBehaviour.rows
    .concat(manual)
    .map((c) => ({
      month: String(c.month || String(c.date || '').slice(0, 7)),
      date: String(c.date || '').slice(0, 10),
      email: scEmail_(c.email),
      note: String(c.note || ''),
    }))
    .filter((c) => c.email === e)
    .filter((c) => {
      const k = c.email + '|' + c.date + '|' + c.note
      if (seen[k]) return false
      return (seen[k] = true)
    })
  const casesInRange = scCasesInRange_(cases, from, to)
  // scLoad_ bhvFound is unconditional: "Behaviour is always known now — no case
  // in the workbook log or the manual log = clear". A store that could not be
  // read contributes no cases (nothing is invented); sources reports the gap.
  const behaviorKnown = true
  sources.behaviour = behaviour.exists ? 'kpi_behaviour_log' : 'unavailable'

  // ---- OL, leave, probation (the readers of KpiPayout.js verbatim) ----
  const olBy = kpiOlCases_(ol.rows, [month])
  const olCases = olBy[e] || 0
  sources.ol = ol.exists ? 'kpi_ol_cases' : 'unavailable'

  const leaveDatesBy = kpiLeaveDates_(leave.rows)
  const leaveDates = leaveDatesBy[e] || []
  const leaveIneligible = leave.exists ? kpiLeaveIneligible_(leaveDates, asOf) : false
  sources.leave = leave.exists ? 'kpi_leave_log' : 'unavailable'

  const hiring = roster.rows.filter((r) => normEmail_(r.email) === e)[0]?.hiring_date
  const probationMonth = kpiProbationMonth_(hiring, month)
  sources.hiring = roster.exists ? 'roster' : 'unavailable'

  const payout = kpiPayout_({
    prod,
    qual,
    fcr,
    behaviorKnown,
    behaviorCases: casesInRange.length,
    olCases,
    leaveIneligible,
    probationMonth,
  })

  return {
    email: e,
    month,
    from,
    to,
    asOf,
    inputs: {
      prod,
      qual,
      fcr,
      days,
      fcrPassed: fcrSums.passed,
      fcrFailed: fcrSums.failed,
      fcrExcluded: fcrSums.excluded,
      behaviorKnown,
      behaviorCases: casesInRange.length,
      olCases,
      leaveIneligible,
      leaveDates,
      hiringDate: hiring || null,
      probationMonth,
    },
    sources,
    payout,
  }
}

// ---------------------------------------------------------------- behaviour log

/** The validated kpi_behaviour_log write shape (KPI_LOG_HEADERS minus the stamps). */
export function behaviourInput(body: Record<string, unknown>): { email: string; date: string; note: string } {
  const email = normEmail_(body.email)
  if (!email) throw new InputError('A behaviour case needs an email.')
  const date = String(body.date || '').slice(0, 10)
  if (!DATE_RE.test(date)) throw new InputError('Give the case date (yyyy-MM-dd).')
  return { email, date, note: String(body.note ?? '') }
}

export async function kpiLogList(table: 'kpi_behaviour_log' | 'kpi_leave_log', email?: string | null): Promise<Record<string, unknown>[]> {
  const store = await readStore(table)
  // kpiLogRows_ read with missingOk: a store that is not there yields no live rows.
  let rows = kpiLogRows_(store.rows)
  if (email) rows = rows.filter((r) => normEmail_(r.email) === normEmail_(email))
  return rows.sort((a, b) => String(b.logged_at || '').localeCompare(String(a.logged_at || '')))
}

export async function kpiLogAppend(
  table: 'kpi_behaviour_log' | 'kpi_leave_log',
  idPrefix: string,
  obj: Record<string, unknown>,
  actor: string
): Promise<Record<string, unknown>> {
  await assertWritable()
  const log_id = newId(idPrefix)
  const { data, error } = await db()
    .from(table)
    .insert({ ...obj, log_id, logged_by: actor, logged_at: new Date().toISOString() })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

/** Soft delete: removed_by/removed_at on a live row (kpiLogRows_ leaves removed ones out). */
export async function kpiLogRemove(
  table: 'kpi_behaviour_log' | 'kpi_leave_log',
  logId: string,
  actor: string
): Promise<Record<string, unknown>> {
  await assertWritable()
  if (!logId) throw new InputError('Give the log_id to remove.')
  const current = await findRow(table, 'log_id', logId)
  if (!current) throw new InputError('That log row does not exist.', 404)
  if (current.removed_at) throw new InputError('That log row is already removed.', 409)
  const updated = await updateRow(
    table,
    'log_id',
    logId,
    { removed_by: actor, removed_at: new Date().toISOString() },
    { actor, stampUpdates: false } // the log headers carry removed_*, not updated_*
  )
  return updated || current
}

// ---------------------------------------------------------------- leave log

/** The validated kpi_leave_log write shape; `type` must be one of KPI_LEAVE_TYPES. */
export function leaveInput(body: Record<string, unknown>): {
  email: string
  from_date: string
  to_date: string
  type: string
  note: string
} {
  const email = normEmail_(body.email)
  if (!email) throw new InputError('A leave needs an email.')
  const from_date = String(body.from_date ?? body.fromDate ?? '').slice(0, 10)
  if (!DATE_RE.test(from_date)) throw new InputError('A leave needs its first day (from_date yyyy-MM-dd).')
  const toRaw = String(body.to_date ?? body.toDate ?? '').slice(0, 10)
  const to_date = toRaw || from_date
  if (!DATE_RE.test(to_date)) throw new InputError('to_date must be a date (yyyy-MM-dd).')
  if (to_date < from_date) throw new InputError('to_date cannot be before from_date.')
  const type = String(body.type || '')
  if (KPI_LEAVE_TYPES.indexOf(type) === -1) {
    throw new InputError('Leave type must be one of ' + KPI_LEAVE_TYPES.join(', ') + '.')
  }
  return { email, from_date, to_date, type, note: String(body.note ?? '') }
}

// ---------------------------------------------------------------- OL cases

/** The validated kpi_ol_cases write shape (key = month|email unless given). */
export function olCaseInput(body: Record<string, unknown>): { key: string; month: string; email: string; cases: number } {
  const month = String(body.month || '').slice(0, 7)
  if (!MONTH_RE.test(month)) throw new InputError('OL cases need a month (yyyy-MM).')
  const email = normEmail_(body.email)
  if (!email) throw new InputError('OL cases need an email.')
  const cases = Number(body.cases)
  if (!isFinite(cases) || cases < 0 || Math.floor(cases) !== cases) {
    throw new InputError('cases is a non-negative whole number.')
  }
  const key = String(body.key || '') || month + '|' + email
  return { key, month, email, cases }
}

/** OL upsert on `key` (the TL job writes cases per agent per month). */
export async function olCaseUpsert(body: Record<string, unknown>): Promise<Record<string, unknown>> {
  await assertWritable()
  const input = olCaseInput(body)
  const { data, error } = await db()
    .from('kpi_ol_cases')
    .upsert({ ...input, updated_at: new Date().toISOString() }, { onConflict: 'key' })
    .select()
    .maybeSingle()
  if (error) throw new Error(error.message)
  return data as Record<string, unknown>
}

export async function olCaseList(month?: string | null, email?: string | null): Promise<Record<string, unknown>[]> {
  const store = await readStore('kpi_ol_cases') // missingOk -> []
  return store.rows
    .filter(
      (r) =>
        (!month || String(r.month).slice(0, 7) === month) &&
        (!email || normEmail_(r.email) === normEmail_(email))
    )
    .sort((a, b) => String(a.month).localeCompare(String(b.month)) || String(a.email).localeCompare(String(b.email)))
}

/** OL rows have no removed_* columns (KPI_LOG_HEADERS): a delete removes the row. */
export async function olCaseDelete(key: string): Promise<void> {
  await assertWritable()
  if (!key) throw new InputError('Give the key to remove.')
  const current = await findRow('kpi_ol_cases', 'key', key)
  if (!current) throw new InputError('That OL row does not exist.', 404)
  const { error } = await db().from('kpi_ol_cases').delete().eq('key', key)
  if (error) throw new Error(error.message)
}
