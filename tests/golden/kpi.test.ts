/**
 * Golden tests: src/lib/kpi/index.ts vs KpiPayout.js verbatim in the oracle.
 */
import { describe, it, expect } from 'vitest'
import { baseFixtures, callLegacy, callPort, diffPath, rint, rng, rpick, same } from './helpers-oracle'
import {
  kpiBandPay_,
  kpiHas_,
  kpiHiringDates_,
  kpiLeaveDates_,
  kpiLeaveIneligible_,
  kpiLogRows_,
  kpiOlCases_,
  kpiPayout_,
  kpiProbationMonth_,
  kpiR2_,
} from '../../src/lib/kpi'

const R = rng(0x1f3a5b)

describe('small rules', () => {
  it('kpiHas_ / kpiR2_ / kpiBandPay_', () => {
    const vals: unknown[] = [null, undefined, '', 'x', 0, 95, 97.3, -2, NaN, Infinity, '95', '  ']
    vals.forEach((v, i) => same('kpiHas_', [v], () => kpiHas_(v), {}, `has ${i}`))
    for (let i = 0; i < 100; i++) {
      const n = rint(R, -1000, 10000) / 37
      same('kpiR2_', [n], () => kpiR2_(n), {}, `r2 ${i}`)
      const bands: [number, number][] = [[95, 100], [86, 75], [80, 50]]
      same('kpiBandPay_', [n, bands], () => kpiBandPay_(n, bands), {}, `band ${i}`)
    }
    // edge: exactly on the band edge
    ;[95, 86, 80, 94.999, 79.999].forEach((v) =>
      same('kpiBandPay_', [v, [[95, 100], [86, 75], [80, 50]]], () => kpiBandPay_(v, [[95, 100], [86, 75], [80, 50]]), {}, `edge ${v}`)
    )
  })

  it('kpiProbationMonth_ — 120 vectors incl. boundaries', () => {
    for (let i = 0; i < 120; i++) {
      const hd = `20${rint(R, 20, 27)}-${String(rint(R, 1, 12)).padStart(2, '0')}-${String(rint(R, 1, 28)).padStart(2, '0')}`
      const m = `20${rint(R, 24, 27)}-${String(rint(R, 1, 12)).padStart(2, '0')}`
      same('kpiProbationMonth_', [hd, m], () => kpiProbationMonth_(hd, m), {}, `pm ${i}`)
    }
    // exact boundaries: month = hiring month +1,+2,+3,+4
    for (const off of [0, 1, 2, 3]) {
      const m = `2026-${String(7 + off).padStart(2, '0')}`
      same('kpiProbationMonth_', ['2026-07-15', m], () => kpiProbationMonth_('2026-07-15', m), {}, `bnd ${off}`)
    }
    same('kpiProbationMonth_', ['bad', '2026-09'], () => kpiProbationMonth_('bad', '2026-09'))
    same('kpiProbationMonth_', [null, '2026-09'], () => kpiProbationMonth_(null, '2026-09'))
  })

  it('kpiLeaveIneligible_ — 200 vectors: 3 leaves in any 61-day window of the last 92 days', () => {
    for (let i = 0; i < 200; i++) {
      const asOf = `2026-${String(rint(R, 4, 12)).padStart(2, '0')}-${String(rint(R, 1, 28)).padStart(2, '0')}`
      const n = rint(R, 0, 6)
      const dates: string[] = []
      const base = Date.parse(asOf + 'T00:00:00Z')
      for (let j = 0; j < n; j++) dates.push(new Date(base - rint(R, 0, 120) * 86400000).toISOString().slice(0, 10))
      same('kpiLeaveIneligible_', [dates, asOf], () => kpiLeaveIneligible_(dates, asOf), {}, `li ${i}`)
    }
    // hand edges: 61-day span, 92-day window
    same('kpiLeaveIneligible_', [['2026-10-01', '2026-10-31', '2026-12-01'], '2026-12-01'], () => kpiLeaveIneligible_(['2026-10-01', '2026-10-31', '2026-12-01'], '2026-12-01'))
    same('kpiLeaveIneligible_', [['2026-10-01', '2026-10-31', '2026-12-02'], '2026-12-01'], () => kpiLeaveIneligible_(['2026-10-01', '2026-10-31', '2026-12-02'], '2026-12-01'))
    same('kpiLeaveIneligible_', [null, '2026-12-01'], () => kpiLeaveIneligible_(null, '2026-12-01'))
  })
})

describe('kpiPayout_ — the month rule', () => {
  it('250 vectors covering bands/probation/OL/leave/missing', () => {
    for (let i = 0; i < 250; i++) {
      const a: Record<string, unknown> = {
        prod: R() < 0.2 ? rpick(R, [null, '', 'x']) : rint(R, 0, 12000) / 100,
        qual: R() < 0.2 ? rpick(R, [null, undefined]) : rint(R, 0, 11000) / 100,
        fcr: R() < 0.25 ? null : rint(R, 0, 11000) / 100,
        behaviorKnown: R() < 0.7,
        behaviorCases: rint(R, 0, 3),
        olCases: rint(R, 0, 2),
        leaveIneligible: R() < 0.15,
        probationMonth: rint(R, 0, 4),
      }
      same('kpiPayout_', [a], () => kpiPayout_(a as never), {}, `po ${i}`)
    }
  })
  it('hand cases: probation strictness (fcr > threshold), OL halves, ineligible zeroes', () => {
    for (const pm of [1, 2, 3]) {
      // thresholds: probation KPI_PROBATION[pm] — read from legacy through oracle once
      same('kpiPayout_', [
        { prod: 95, qual: 97, fcr: 90, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: pm },
      ], () => kpiPayout_({ prod: 95, qual: 97, fcr: 90, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: pm }))
      same('kpiPayout_', [
        { prod: 30, qual: 40, fcr: 50, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: pm },
      ], () => kpiPayout_({ prod: 30, qual: 40, fcr: 50, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: pm }))
    }
    same('kpiPayout_', [{ prod: 100, qual: 100, fcr: 100, behaviorKnown: true, behaviorCases: 0, olCases: 2, leaveIneligible: false, probationMonth: 0 }], () =>
      kpiPayout_({ prod: 100, qual: 100, fcr: 100, behaviorKnown: true, behaviorCases: 0, olCases: 2, leaveIneligible: false, probationMonth: 0 }))
    same('kpiPayout_', [{ prod: 100, qual: 100, fcr: 100, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: true, probationMonth: 0 }], () =>
      kpiPayout_({ prod: 100, qual: 100, fcr: 100, behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: true, probationMonth: 0 }))
    same('kpiPayout_', [{ prod: null, qual: null, fcr: null, behaviorKnown: false, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: 0 }], () =>
      kpiPayout_({ prod: null, qual: null, fcr: null, behaviorKnown: false, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: 0 }))
  })
})

describe('kpi readers — store seams', () => {
  it('kpiLogRows_ / kpiLeaveDates_ / kpiOlCases_ / kpiHiringDates_', () => {
    const rows = [
      { email: ' A@x.com ', from_date: '2026-10-05', removed_at: '' },
      { email: 'b@x.com', from_date: '2026-10-09', removed_at: '2026-10-10' },
      { email: 'a@x.com', from_date: '2026-10-11', removed_at: '' },
    ]
    // oracle: kpiLogRows_('kpi_leave_log') reads the live store tab
    const fx = baseFixtures({
      spreadsheets: {
        'live-store': {
          kpi_leave_log: [['email', 'from_date', 'removed_at'], ...rows.map((r) => [r.email, r.from_date, r.removed_at])],
          kpi_ol_cases: [['email', 'month', 'cases'], ['a@x.com', '2026-10', '2'], ['b@x.com', '2026-09', '1']],
        },
      },
      data: {
        Roster: [['email', 'hiring_date'], ['a@x.com', '2026-07-15'], ['b@x.com', '']],
      },
    })
    const l = callLegacy('kpiLogRows_', ['kpi_leave_log'], fx)
    const p = callPort(() => kpiLogRows_(rows))
    expect(diffPath(l, p)).toBeNull()
    const l2 = callLegacy('kpiLeaveDates_', [], fx)
    const p2 = callPort(() => kpiLeaveDates_(rows))
    expect(diffPath(l2, p2)).toBeNull()
    const l3 = callLegacy('kpiOlCases_', [['2026-10']], fx)
    const p3 = callPort(() =>
      kpiOlCases_(
        [
          { email: 'a@x.com', month: '2026-10', cases: '2' },
          { email: 'b@x.com', month: '2026-09', cases: '1' },
        ],
        ['2026-10']
      )
    )
    expect(diffPath(l3, p3)).toBeNull()
    const l4 = callLegacy('kpiHiringDates_', [], fx)
    const p4 = callPort(() =>
      kpiHiringDates_([
        { email: 'a@x.com', hiring_date: '2026-07-15' },
        { email: 'b@x.com', hiring_date: '' },
      ])
    )
    expect(diffPath(l4, p4)).toBeNull()
  })
})
