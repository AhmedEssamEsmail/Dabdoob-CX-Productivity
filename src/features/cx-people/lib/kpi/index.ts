/**
 * KpiPayout.js ported 1:1 — the agent KPI payout scheme (Mohamed 2026-10-11), shared by the
 * scorecard (scDerive_) and the TL page. Reader seams (kpi_leave_log, kpi_ol_cases, Roster)
 * are injected row lists; the scoring functions are pure.
 */

import { normEmail_ } from '@/features/shared/lib/adapters'

export const KPI_LOG_HEADERS: Record<string, string[]> = {
  kpi_behaviour_log: ['log_id', 'email', 'date', 'note', 'logged_by', 'logged_at', 'removed_by', 'removed_at'],
  kpi_leave_log: ['log_id', 'email', 'from_date', 'to_date', 'type', 'note', 'logged_by', 'logged_at', 'removed_by', 'removed_at'],
  kpi_ol_cases: ['key', 'month', 'email', 'cases', 'updated_at'],
}
export const KPI_LEAVE_TYPES = ['Sick', 'Emergency', 'Absent without notice', 'Other']

export const KPI_WEIGHTS = { prod: 35, qual: 35, fcr: 15, behavior: 15 }
export const KPI_BANDS: Record<'prod' | 'qual' | 'fcr', [number, number][]> = {
  prod: [[95, 100], [86, 75], [80, 50]],
  qual: [[97, 100], [93, 75], [90, 50]],
  fcr: [[90, 100], [85, 75], [80, 50]],
}
export const KPI_PROBATION: Record<number, {
  prod: number
  qual: number
  fcr: number
  flags: Record<string, [number, string]>
}> = {
  1: { prod: 50, qual: 80, fcr: 50, flags: { prod: [40, 'red_zone'], qual: [70, 'action_plan'], fcr: [40, 'action_plan'] } },
  2: { prod: 65, qual: 85, fcr: 65, flags: { prod: [50, 'action_plan'], qual: [80, 'action_plan'], fcr: [50, 'action_plan'] } },
  3: { prod: 80, qual: 90, fcr: 80, flags: { prod: [65, 'action_plan'], qual: [85, 'action_plan'], fcr: [65, 'action_plan'] } },
}

export function kpiHas_(v: unknown): boolean {
  return v !== null && v !== undefined && v !== '' && isFinite(v as number)
}

/** kpiBandPay_: payout % of one KPI from its band table — the first edge the value reaches. */
export function kpiBandPay_(v: unknown, bands: [number, number][]): number {
  for (let i = 0; i < bands.length; i++) if (Number(v) >= bands[i][0]) return bands[i][1]
  return 0
}

/** kpiProbationMonth_: probation month 1..3 of `month` (yyyy-MM) for a hiring date; else 0. */
export function kpiProbationMonth_(hiringDate: unknown, month: unknown): number {
  const h =
    hiringDate instanceof Date
      ? hiringDate.toISOString().slice(0, 7)
      : String(hiringDate || '').slice(0, 7)
  if (!/^\d{4}-\d{2}$/.test(h) || !/^\d{4}-\d{2}$/.test(String(month))) return 0
  const n =
    Number(String(month).slice(0, 4)) * 12 +
    Number(String(month).slice(5, 7)) -
    (Number(h.slice(0, 4)) * 12 + Number(h.slice(5, 7))) +
    1
  return n >= 1 && n <= 3 ? n : 0
}

/** kpiLeaveIneligible_: 3 unplanned leaves inside any 61-day window of the last 92 days. */
export function kpiLeaveIneligible_(dates: unknown[] | null | undefined, asOf: string): boolean {
  const end = Date.parse(asOf + 'T00:00:00Z')
  const from = end - 92 * 86400000
  const ms = ([] as unknown[])
    .concat(dates || [])
    .map((d) => Date.parse(String(d).slice(0, 10) + 'T00:00:00Z'))
    .filter((t) => isFinite(t) && t >= from && t <= end)
    .sort((a, b) => a - b)
  for (let i = 0; i + 2 < ms.length; i++) if (ms[i + 2] - ms[i] <= 61 * 86400000) return true
  return false
}

export function kpiR2_(n: number): number {
  return Math.round(n * 100) / 100
}

export interface KpiPayoutInput {
  prod?: unknown
  qual?: unknown
  fcr?: unknown
  behaviorKnown?: unknown
  behaviorCases?: unknown
  olCases?: unknown
  leaveIneligible?: unknown
  probationMonth?: unknown
}

export interface KpiPayoutResult {
  pay: Record<string, number | null>
  points: Record<string, number>
  base: number | null
  total: number | null
  missing: string[]
  incomplete: boolean
  olDeduction: boolean
  olCases: number
  ineligible: boolean
  probationMonth: number
  flags: string[]
}

/** kpiPayout_ verbatim: raw % -> band payout -> weighted points -> total. */
export function kpiPayout_(a: KpiPayoutInput): KpiPayoutResult {
  const pm = Number(a.probationMonth) || 0
  const prob = KPI_PROBATION[pm]
  const pay: Record<string, number | null> = {}
  const missing: string[] = []
  ;(['prod', 'qual', 'fcr'] as const).forEach((k) => {
    if (!kpiHas_(a[k])) {
      pay[k] = null
      missing.push(k)
      return
    }
    const v = Number(a[k])
    pay[k] = prob
      ? (k === 'fcr' ? v > prob[k] : v >= prob[k])
        ? 100
        : 0
      : kpiBandPay_(v, KPI_BANDS[k])
  })
  pay.behavior = a.behaviorKnown ? (Number(a.behaviorCases) > 0 ? 0 : 100) : null
  if (pay.behavior === null) missing.push('behavior')
  const points: Record<string, number> = {}
  let sum = 0
  Object.keys(KPI_WEIGHTS).forEach((k) => {
    sum += (pay[k] || 0) * KPI_WEIGHTS[k as keyof typeof KPI_WEIGHTS]
    points[k] = kpiR2_(((pay[k] || 0) * KPI_WEIGHTS[k as keyof typeof KPI_WEIGHTS]) / 100)
  })
  const base = missing.length === 4 ? null : kpiR2_(sum / 100)
  const ol = Number(a.olCases) > 0
  const inel = !!a.leaveIneligible
  const flags: string[] = []
  if (prob) {
    ;(['prod', 'qual', 'fcr'] as const).forEach((k) => {
      const f = prob.flags[k]
      if (kpiHas_(a[k]) && Number(a[k]) < f[0]) flags.push(k + ':' + f[1])
    })
  }
  return {
    pay,
    points,
    base,
    total: base === null ? null : inel ? 0 : ol ? kpiR2_(base / 2) : base,
    missing,
    incomplete: missing.length > 0,
    olDeduction: ol,
    olCases: Number(a.olCases) || 0,
    ineligible: inel,
    probationMonth: pm,
    flags,
  }
}

// ---------- readers (row seams injected) ----------

/** kpiLogRows_: a manual log's live rows (removed ones left out). */
export function kpiLogRows_(rows: Record<string, unknown>[]): Record<string, unknown>[] {
  return rows.filter((r) => !r.removed_at)
}

/** kpiLeaveDates_: unplanned leave dates by email (one leave per entry, first day). */
export function kpiLeaveDates_(leaveLogRows: Record<string, unknown>[]): Record<string, string[]> {
  const out: Record<string, string[]> = {}
  kpiLogRows_(leaveLogRows).forEach((r) => {
    const e = normEmail_(r.email)
    if (e && r.from_date) (out[e] = out[e] || []).push(String(r.from_date).slice(0, 10))
  })
  return out
}

/** kpiOlCases_: OL cases by email summed over the given months. */
export function kpiOlCases_(olRows: Record<string, unknown>[], months: string[]): Record<string, number> {
  const out: Record<string, number> = {}
  olRows.forEach((r) => {
    if (months.indexOf(String(r.month).slice(0, 7)) === -1) return
    const e = normEmail_(r.email)
    out[e] = (out[e] || 0) + (Number(r.cases) || 0)
  })
  return out
}

/** kpiHiringDates_: Roster hiring_date by email. */
export function kpiHiringDates_(rosterRows: Record<string, unknown>[]): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  rosterRows.forEach((r) => {
    if (r.hiring_date) out[normEmail_(r.email)] = r.hiring_date
  })
  return out
}
