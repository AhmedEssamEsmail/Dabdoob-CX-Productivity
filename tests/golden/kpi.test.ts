/**
 * Golden tests: src/lib/kpi/index.ts vs KpiPayout.js verbatim in the oracle.
 */
import { describe, it, expect } from 'vitest'
import { baseFixtures, callLegacy, callPort, diffPath, oracle, rint, rng, rpick, same } from './helpers-oracle'
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
} from '@/features/cx-people/lib/kpi'

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

describe('kpiPayout_ — WP-23 configured-band, probation, behaviour edges', () => {
  /** A fully-known baseline arg; callers vary one field at a time. */
  const base = (over: Record<string, unknown>): Record<string, unknown> => ({
    prod: 100, qual: 100, fcr: 100,
    behaviorKnown: true, behaviorCases: 0, olCases: 0, leaveIneligible: false, probationMonth: 0,
    ...over,
  })
  const pay = (a: Record<string, unknown>, label: string) =>
    same('kpiPayout_', [a], () => kpiPayout_(a as never), {}, label)

  it('configured band edges per metric: at, just below and just above each edge, as numbers and strings', () => {
    // Productivity: >=95 -> 100, >=86 -> 75, >=80 -> 50, <80 -> 0
    for (const v of [95, 94.999, 94.5, 86, 85.999, 85.5, 80, 79.999, 79.5, '95', '86', '80', '79.9']) {
      pay(base({ prod: v }), `prod ${v}`)
    }
    // Quality: >=97 -> 100, >=93 -> 75, >=90 -> 50, <90 -> 0
    for (const v of [97, 96.999, 96.5, 93, 92.999, 92.5, 90, 89.999, 89.5, '97', '93', '90', '89.9']) {
      pay(base({ qual: v }), `qual ${v}`)
    }
    // FCR: >=90 -> 100, >=85 -> 75, >=80 -> 50, <80 -> 0
    for (const v of [90, 89.999, 89.5, 85, 84.999, 84.5, 80, 79.999, 79.5, '90', '85', '80', '79.9']) {
      pay(base({ fcr: v }), `fcr ${v}`)
    }
  })

  it('probation month 1-3 exact boundaries: prod/qual pass at the edge, FCR needs strictly more', () => {
    const t = {
      1: { prod: 50, qual: 80, fcr: 50, flags: { prod: 40, qual: 70, fcr: 40 } },
      2: { prod: 65, qual: 85, fcr: 65, flags: { prod: 50, qual: 80, fcr: 50 } },
      3: { prod: 80, qual: 90, fcr: 80, flags: { prod: 65, qual: 85, fcr: 65 } },
    } as const
    for (const pm of [1, 2, 3] as const) {
      for (const d of [-0.001, 0, 0.001]) {
        pay(base({ prod: t[pm].prod + d, probationMonth: pm }), `pm${pm} prod ${d}`)
        pay(base({ qual: t[pm].qual + d, probationMonth: pm }), `pm${pm} qual ${d}`)
        pay(base({ fcr: t[pm].fcr + d, probationMonth: pm }), `pm${pm} fcr ${d}`)
        // flag edges: at the flag line -> flag, just above -> clear
        pay(base({ prod: t[pm].flags.prod + d, probationMonth: pm }), `pm${pm} flag prod ${d}`)
        pay(base({ qual: t[pm].flags.qual + d, probationMonth: pm }), `pm${pm} flag qual ${d}`)
        pay(base({ fcr: t[pm].flags.fcr + d, probationMonth: pm }), `pm${pm} flag fcr ${d}`)
      }
      // values straddling band vs probation rules: pm3 prod 70 -> 0 (prob), pm0 70 -> 0; pm1 prod 70 -> 100 (prob)
      pay(base({ prod: 70, qual: 82, fcr: 66, probationMonth: pm }), `pm${pm} mixed`)
    }
  })

  it('probationMonth >= 4 and non-standard months take the configured-band path', () => {
    // prod 70: bands -> 50; pm2 probation -> 100. qual 88: bands -> 0; pm2 -> 100. fcr 66: bands -> 0; pm2 -> 100.
    for (const pm of [4, 5, 12, 100, -1, '4', 'x', null, undefined, '', 2.5, 0.9, NaN, 0]) {
      pay(base({ prod: 70, qual: 88, fcr: 66, probationMonth: pm }), `pm ${String(pm)}`)
      // a second combo: values that sit inside every band's top edge
      pay(base({ prod: 95, qual: 97, fcr: 90, probationMonth: pm }), `pm ${String(pm)} top`)
    }
  })

  it('behaviour deduction curve: known x cases coercion matrix', () => {
    for (const known of [true, false, 1, 0, 'true', '', null, undefined, 'x']) {
      for (const cases of [0, 1, 2, 0.5, -1, '2', 'x', null, undefined, '', NaN]) {
        pay(base({ behaviorKnown: known, behaviorCases: cases }), `bhv ${String(known)}/${String(cases)}`)
      }
    }
  })

  it('OL halving, leave ineligibility and missing-matrix edges', () => {
    for (const ol of [0, 1, 2, '2', 'x', -1, 0.5, null, undefined, NaN]) {
      pay(base({ olCases: ol }), `ol ${String(ol)}`)
    }
    for (const inel of [true, false, 'true', 'false', 1, 0, '', null, undefined]) {
      pay(base({ leaveIneligible: inel }), `inel ${String(inel)}`)
    }
    // all four KPIs missing -> base/total null
    pay({ probationMonth: 0 }, 'all missing')
    pay({ prod: null, qual: null, fcr: null, behaviorKnown: false, probationMonth: 2 }, 'all missing pm2')
    // exactly one missing at a time
    for (const k of ['prod', 'qual', 'fcr'] as const) {
      pay(base({ [k]: null }), `missing ${k}`)
      pay(base({ [k]: '' }), `missing '' ${k}`)
      pay(base({ [k]: 'x' }), `missing 'x' ${k}`)
      pay(base({ [k]: NaN }), `missing NaN ${k}`)
    }
    pay(base({ behaviorKnown: false }), 'missing behavior')
    // zero is data, not missing
    pay(base({ prod: 0, qual: 0, fcr: 0 }), 'zeros')
  })

  it('kpiLeaveIneligible_ — exact 61-day span and 92-day window edges', () => {
    const d = (key: string) => Date.parse(key + 'T00:00:00Z')
    const iso = (ms: number) => new Date(ms).toISOString().slice(0, 10)
    const asOf = '2026-12-15'
    // 3 leaves spanning exactly 61 days -> ineligible; 62 -> eligible
    same('kpiLeaveIneligible_', [['2026-10-15', '2026-11-14', '2026-12-15'], asOf], () =>
      kpiLeaveIneligible_(['2026-10-15', '2026-11-14', '2026-12-15'], asOf), {}, '61d span')
    same('kpiLeaveIneligible_', [['2026-10-14', '2026-11-14', '2026-12-15'], asOf], () =>
      kpiLeaveIneligible_(['2026-10-14', '2026-11-14', '2026-12-15'], asOf), {}, '62d span')
    // a leave exactly 92 days before asOf counts; 93 days does not
    same('kpiLeaveIneligible_', [[iso(d(asOf) - 92 * 86400000), '2026-12-01', '2026-12-15'], asOf], () =>
      kpiLeaveIneligible_([iso(d(asOf) - 92 * 86400000), '2026-12-01', '2026-12-15'], asOf), {}, 'at 92d boundary')
    same('kpiLeaveIneligible_', [[iso(d(asOf) - 93 * 86400000), '2026-12-01', '2026-12-15'], asOf], () =>
      kpiLeaveIneligible_([iso(d(asOf) - 93 * 86400000), '2026-12-01', '2026-12-15'], asOf), {}, 'at 93d (outside)')
    // a leave after asOf is ignored; the asOf day itself counts
    same('kpiLeaveIneligible_', [['2026-12-14', '2026-12-15', '2026-12-16'], asOf], () =>
      kpiLeaveIneligible_(['2026-12-14', '2026-12-15', '2026-12-16'], asOf), {}, 'future leave ignored')
    // three identical dates (span 0) and unsorted input
    same('kpiLeaveIneligible_', [['2026-12-10', '2026-12-10', '2026-12-10'], asOf], () =>
      kpiLeaveIneligible_(['2026-12-10', '2026-12-10', '2026-12-10'], asOf), {}, 'same day x3')
    same('kpiLeaveIneligible_', [['2026-12-15', '2026-10-15', '2026-11-14'], asOf], () =>
      kpiLeaveIneligible_(['2026-12-15', '2026-10-15', '2026-11-14'], asOf), {}, 'unsorted')
    // two inside, one outside the window: still ineligible when the window pair spans <=61d
    same('kpiLeaveIneligible_', [['2020-01-01', '2026-12-10', '2026-12-15'], asOf], () =>
      kpiLeaveIneligible_(['2020-01-01', '2026-12-10', '2026-12-15'], asOf), {}, '2 inside only')
    // non-strings and garbage
    same('kpiLeaveIneligible_', [['bad', '2026-12-10', '2026-12-15', null, 7], asOf], () =>
      kpiLeaveIneligible_(['bad', '2026-12-10', '2026-12-15', null, 7] as never, asOf), {}, 'garbage')
    same('kpiLeaveIneligible_', [['2026-12-10T00:00:00Z', '2026-12-11', '2026-12-12'], asOf], () =>
      kpiLeaveIneligible_(['2026-12-10T00:00:00Z', '2026-12-11', '2026-12-12'], asOf), {}, 'iso strings')
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
    // dqReadObjects_ pads KPI_LOG_HEADERS via ensureColumns_ — feed the port the same objects
    const leaveObjs = oracle().objects('kpi_leave_log', fx)
    const olObjs = oracle().objects('kpi_ol_cases', fx)
    const rosterObjs = oracle().table('Roster', fx)
    const l = callLegacy('kpiLogRows_', ['kpi_leave_log'], fx)
    const p = callPort(() => kpiLogRows_(leaveObjs))
    expect(diffPath(l, p)).toBeNull()
    const l2 = callLegacy('kpiLeaveDates_', [], fx)
    const p2 = callPort(() => kpiLeaveDates_(leaveObjs))
    expect(diffPath(l2, p2)).toBeNull()
    const l3 = callLegacy('kpiOlCases_', [['2026-10']], fx)
    const p3 = callPort(() => kpiOlCases_(olObjs, ['2026-10']))
    expect(diffPath(l3, p3)).toBeNull()
    const l4 = callLegacy('kpiHiringDates_', [], fx)
    const p4 = callPort(() => kpiHiringDates_(rosterObjs))
    expect(diffPath(l4, p4)).toBeNull()
  })
})
