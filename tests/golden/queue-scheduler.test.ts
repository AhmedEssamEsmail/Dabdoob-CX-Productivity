/**
 * WP-22: Scheduler coverage — the pure/verbatim half of Queue_deprecated/Scheduler.js
 * run through the full queue oracle (vm) vs src/features/cx-queue/lib/scheduler.ts.
 *
 * Covers: scalar helpers, month/hour keying, productive hours, week index, variants,
 * team activity windows, the rest-block planner, shift hours, duty allocation, day
 * plans (shared on-queue counter), task placement, the hour grid, role/change helpers,
 * and the request row mapper. Plus the two big generators — weekly and daily rosters —
 * over a full deterministic month including mid-month joins/exits, fixed off-days,
 * forced shifts, WFH and the PM->AM ban.
 *
 * Date args cross the vm boundary as '@@ms:<epoch>' markers (oracle.mjs __rebind__
 * revives them inside the vm); rev() gives the port the same Date on the host side.
 */
import { describe, expect, it } from 'vitest'
import { callPort, expectSame, json } from './helpers-oracle'
import { qCallLegacy, qOracle } from './queue-oracle'
import {
  schActiveTLs_,
  schAllocate_,
  schBuildRoster_,
  schChangedCells_,
  schDateKey_,
  schDayPlan_,
  schDayPlans_,
  schDecimal_,
  schForRole_,
  schHourGrid_,
  schHourOf_,
  schKey_,
  schMonthDays_,
  schMonthName_,
  schMonthTag_,
  schNum_,
  schParse_,
  schPlaceTasks_,
  schProductiveHours_,
  schRequestOut_,
  schRestPlanner_,
  schRosterDaily_,
  schRosterWeekly_,
  schShiftHours_,
  schTlActiveOn_,
  schVariant_,
  schVariantKey_,
  schWeekIndex_,
} from '../../src/features/cx-queue/lib/scheduler'

// ---------------------------------------------------------------- marker revival

/** Deep-revive '@@ms:' markers into host Dates so the port sees what the vm saw. */
const rev = (x: unknown): unknown => {
  if (typeof x === 'string' && x.indexOf('@@ms:') === 0) return new Date(+x.slice(5))
  if (Array.isArray(x)) return x.map(rev)
  if (x && typeof x === 'object') {
    const o: Record<string, unknown> = {}
    Object.keys(x as Record<string, unknown>).forEach((k) => {
      o[k] = rev((x as Record<string, unknown>)[k])
    })
    return o
  }
  return x
}
const same = (fn: string, args: unknown[], portFn: (...a: unknown[]) => unknown, label?: string) =>
  expectSame(callPort(() => json(portFn(...args.map(rev)))), qCallLegacy(fn, args), label || fn)

const D = (y: number, m: number, d: number) => '@@ms:' + Date.UTC(y, m, d, 12)
const OCT = Array.from({ length: 31 }, (_, i) => D(2026, 9, i + 1)) // Oct 2026, Sun Oct 4? (Oct 1 2026 = Thursday)

const CFG = {
  working_days: 5,
  shift_rotation: 'weekly',
  forbid_pm_then_am: 'yes',
  shift_am_start: '09:30',
  shift_pm_start: '13:30',
  shift_hours: 9,
  break_minutes: 0,
  primary_queue_h: 7,
  primary_people_h: 1,
  primary_task_h: 1,
  secondary_queue_h: 3,
  secondary_people_h: 3,
  secondary_task_h: 3,
  peak_days: '0,4',
  peak_shift: 'BALANCE',
  _variant: 0,
  _offDays: {},
  _team: [
    { name: 'a@x', start: '', end: '' },
    { name: 'b@x', start: '', end: '' },
    { name: 'c@x', start: '2026-10-10', end: '' },
    { name: 'd@x', start: '', end: '2026-10-15' },
  ],
}
const TLS = ['a@x', 'b@x', 'c@x', 'd@x']

// ---------------------------------------------------------------- scalar helpers

describe('scheduler: scalar + keying helpers vs oracle', () => {
  it('schNum_', () => {
    // (undefined can't cross JSON; null reaches the vm instead — covered separately)
    ;[['5', 0], [3.5, 0], ['x', 9], [null, 4], ['', 2], [0, 7], [-2, 0], [' 12 ', 0], [' ', 6], [true, 3]].forEach(
      ([v, d], i) => same('schNum_', [v, d], (a, b) => schNum_(a, Number(b)), 'num ' + i)
    )
  })

  it('schKey_ / schParse_ round-trip + schDateKey_', () => {
    const dates = [D(2026, 9, 12), D(2026, 0, 1), D(2026, 11, 31), D(2024, 1, 29)]
    dates.forEach((d, i) => same('schKey_', [d], (a) => schKey_(a as Date), 'key ' + i))
    ;['2026-10-12', '2024-02-29', 'garbage', '', '2026-13-40'].forEach((s, i) =>
      same('schParse_', [s], (a) => schParse_(String(a)), 'parse ' + i)
    )
    ;[null, '', '2026-10-12', D(2026, 9, 12), '  2026-10-12  ', 45937, 'x'].forEach((v, i) =>
      same('schDateKey_', [v], (a) => schDateKey_(a), 'dateKey ' + i)
    )
  })

  it('schMonthDays_/schMonthTag_/schMonthName_', () => {
    ;[[2026, 9], [2024, 1], [2025, 11], [2026, 0]].forEach(([y, m], i) => {
      same('schMonthDays_', [y, m], (a, b) => schMonthDays_(Number(a), Number(b)), 'mdays ' + i)
      same('schMonthTag_', [y, m], (a, b) => schMonthTag_(Number(a), Number(b)), 'mtag ' + i)
      same('schMonthName_', [y, m], (a, b) => schMonthName_(Number(a), Number(b)), 'mname ' + i)
    })
  })

  it('schHourOf_/schDecimal_', () => {
    ;['09:30', '13:00', '22:30', '9', '0:00', '', null, 'x', '23:59', 7].forEach((v, i) => {
      same('schHourOf_', [v], (a) => schHourOf_(a), 'hourOf ' + i)
      same('schDecimal_', [v], (a) => schDecimal_(a), 'dec ' + i)
    })
  })

  it('schProductiveHours_ / schWeekIndex_', () => {
    ;[{ shift_hours: 9, break_minutes: 0 }, { shift_hours: 8, break_minutes: 60 }, { shift_hours: '10', break_minutes: '30' }, {}].forEach(
      (cfg, i) => same('schProductiveHours_', [cfg], (a) => schProductiveHours_(a as never), 'prod ' + i)
    )
    ;[D(2026, 9, 4), D(2026, 9, 5), D(2026, 0, 1), D(2026, 11, 31)].forEach((d, i) =>
      same('schWeekIndex_', [d], (a) => schWeekIndex_(a as Date), 'wk ' + i)
    )
  })

  it('schVariantKey_/schVariant_', () => {
    ;['2026-10', '2024-02', 'x'].forEach((t, i) => same('schVariantKey_', [t], (a) => schVariantKey_(String(a)), 'vkey ' + i))
    ;[
      [{ roster_variant_2026x10: '3' }, '2026-10'],
      [{ roster_variant_2026x10: 2 }, '2026-10'],
      [{ roster_variant_2026x10: 'x' }, '2026-10'],
      [{}, '2026-10'],
      [{ roster_variant_2024x02: '1' }, '2024-02'],
    ].forEach(([cfg, tag], i) => same('schVariant_', [cfg, tag], (a, b) => schVariant_(a as never, String(b)), 'variant ' + i))
  })

  it('schActiveTLs_ / schTlActiveOn_', () => {
    const team = [
      { name: 'a@x', start: '', end: '' },
      { name: 'b@x', start: '2026-10-10', end: '' },
      { name: 'c@x', start: '', end: '2026-10-15' },
      { name: 'd@x', start: '2026-09-01', end: '2026-09-30' },
      { name: 'e@x', start: '@@bad', end: '' },
    ]
    ;[[2026, 9], [2026, 8], [2026, 10]].forEach(([y, m], i) =>
      same('schActiveTLs_', [team, y, m], (a, b, c) => schActiveTLs_(a as never, Number(b), Number(c)), 'active ' + i)
    )
    ;[
      [team, 'a@x', '2026-10-01'],
      [team, 'b@x', '2026-10-09'],
      [team, 'b@x', '2026-10-10'],
      [team, 'c@x', '2026-10-15'],
      [team, 'c@x', '2026-10-16'],
      [team, 'zz@x', '2026-10-01'],
      [team, 'e@x', '2026-10-05'],
    ].forEach(([t, n, k], i) =>
      same('schTlActiveOn_', [t, n, k], (a, b, c) => schTlActiveOn_(a as never, String(b), String(c)), 'on ' + i)
    )
  })
})

// ---------------------------------------------------------------- rest planner

describe('scheduler: rest-block planner', () => {
  it('schRestPlanner_ predicates match the oracle for every tl/day', () => {
    const oracle = qOracle()
    const cases = [
      { cfg: { _variant: 0, _offDays: {} }, wd: 5 },
      { cfg: { _variant: 2, _offDays: { 'b@x': [0, 6] } }, wd: 5 },
      { cfg: { _variant: '3' }, wd: 6 },
      { cfg: { _variant: -1, _offDays: { 'a@x': [2], 'c@x': [] } }, wd: 4 },
    ]
    const tls = ['a@x', 'b@x', 'c@x', 'd@x', 'e@x']
    const dayMs = [Date.UTC(2026, 9, 4, 12), Date.UTC(2026, 9, 12, 12), Date.UTC(2026, 9, 31, 12), Date.UTC(2026, 10, 2, 12)]
    cases.forEach(({ cfg, wd }, ci) => {
      const code =
        'JSON.stringify((function(){var f=schRestPlanner_(' + JSON.stringify(cfg) + ',' + wd + ');' +
        'return ' + JSON.stringify(dayMs) + '.map(function(dm){var d=new Date(dm);' +
        'return ' + JSON.stringify(tls) + '.map(function(t,j){return f(j,t,d)})})})())'
      const legacy = JSON.parse(oracle.eval(code) as string)
      const f = schRestPlanner_(cfg as never, wd)
      const port = dayMs.map((dm) => tls.map((t, j) => f(j, t, new Date(dm))))
      expect(json(port), 'restPlanner case ' + ci).toEqual(legacy)
    })
  })
})

// ---------------------------------------------------------------- rosters

describe('scheduler: weekly + daily roster generators', () => {
  const rosters: [string, object][] = [
    ['weekly plain', { ...CFG }],
    ['weekly variant 2', { ...CFG, _variant: 2 }],
    ['weekly variant str', { ...CFG, _variant: '1' }],
    ['weekly fixed offdays', { ...CFG, _offDays: { 'a@x': [0, 6], 'd@x': [1, 2] } }],
    ['weekly 6-day', { ...CFG, working_days: 6 }],
    ['weekly pm-am allowed', { ...CFG, forbid_pm_then_am: 'no' }],
    ['daily plain', { ...CFG, shift_rotation: 'daily' }],
    ['daily peak AM', { ...CFG, shift_rotation: 'daily', peak_days: '0,1,4', peak_shift: 'AM' }],
    ['daily peak PM 6-day', { ...CFG, shift_rotation: 'daily', working_days: 6, peak_shift: 'PM' }],
    ['daily no-pm-am-ban', { ...CFG, shift_rotation: 'daily', forbid_pm_then_am: 'no' }],
  ]
  rosters.forEach(([label, cfg], i) => {
    it('schBuildRoster_ ' + label, () => {
      const overrides = {
        '2026-10-05': { 'a@x': { shift: 'OFF', wfh: false, reason: 'leave' } },
        '2026-10-12': { 'b@x': { shift: 'AM', wfh: true, reason: 'manual' } },
        '2026-10-20': { 'c@x': { shift: 'PM', wfh: false, reason: 'manual' }, 'd@x': { shift: 'LEAVE', wfh: false, reason: 'x' } },
      }
      same('schBuildRoster_', [TLS, OCT, cfg, overrides], (t, d, c, o) =>
        schBuildRoster_(t as string[], d as Date[], c as never, o as never), 'build ' + i)
    })
  })

  it('schRosterWeekly_/schRosterDaily_ direct + empty overrides', () => {
    ;[{}, undefined].forEach((ov, i) => {
      same('schRosterWeekly_', [TLS, OCT, CFG, ov], (t, d, c, o) =>
        schRosterWeekly_(t as string[], d as Date[], c as never, o as never), 'weekly ' + i)
      same('schRosterDaily_', [TLS, OCT, CFG, ov], (t, d, c, o) =>
        schRosterDaily_(t as string[], d as Date[], c as never, o as never), 'daily ' + i)
    })
  })

  it('edge: 3-lead team (odd window), forced PM->AM exception, no _team', () => {
    const cases: [string[], string[], object, unknown][] = [
      [['a@x', 'b@x', 'c@x'], OCT, { ...CFG, _team: [{ name: 'a@x' }, { name: 'b@x' }, { name: 'c@x' }] }, {}],
      [TLS, OCT, { ...CFG }, { '2026-10-06': { 'd@x': { shift: 'AM', wfh: false, reason: 'forced' } } }],
      [TLS, OCT, { working_days: 5, forbid_pm_then_am: 'yes' }, {}], // no _team at all
      [TLS, OCT.slice(0, 7), CFG, {}], // single partial week
    ]
    cases.forEach(([tls, days, cfg, ov], i) =>
      same('schRosterWeekly_', [tls, days, cfg, ov], (t, d, c, o) =>
        schRosterWeekly_(t as string[], d as Date[], c as never, o as never), 'edge ' + i)
    )
  })
})

// ---------------------------------------------------------------- allocation / day plan

describe('scheduler: shift hours, allocation, day plan', () => {
  it('schShiftHours_ / schAllocate_', () => {
    ;['AM', 'PM', 'OFF', ''].forEach((s, i) =>
      same('schShiftHours_', [s, CFG], (a, c) => schShiftHours_(String(a), c as never), 'shiftH ' + i))
    ;['primary', 'secondary', 'other', ''].forEach((r, i) =>
      same('schAllocate_', [r, CFG], (a, c) => schAllocate_(String(a), c as never), 'alloc ' + i))
    // allocation squeeze: duty wants exceed productive hours
    ;[
      { ...CFG, primary_queue_h: 9, primary_people_h: 2, primary_task_h: 2 },
      { ...CFG, secondary_queue_h: 8, secondary_people_h: 4, secondary_task_h: 5 },
      { shift_hours: 6, break_minutes: 30, primary_queue_h: 7, primary_people_h: 1, primary_task_h: 1, secondary_queue_h: 3, secondary_people_h: 3, secondary_task_h: 3 },
    ].forEach((cfg, i) => {
      same('schAllocate_', ['primary', cfg], (r, c) => schAllocate_(String(r), c as never), 'sq-prim ' + i)
      same('schAllocate_', ['secondary', cfg], (r, c) => schAllocate_(String(r), c as never), 'sq-sec ' + i)
    })
  })

  it('schDayPlan_ — shared on-queue counter incl. secondary-first ordering', () => {
    const rosters = [
      [{ tl: 'a@x', shift: 'AM', role: 'primary' }],
      [
        { tl: 'a@x', shift: 'AM', role: 'primary' },
        { tl: 'b@x', shift: 'AM', role: 'secondary' },
      ],
      [
        { tl: 'a@x', shift: 'AM', role: 'primary' },
        { tl: 'b@x', shift: 'AM', role: 'secondary' },
        { tl: 'c@x', shift: 'PM', role: 'primary' },
        { tl: 'd@x', shift: 'PM', role: 'secondary' },
      ],
      [
        { tl: 'a@x', shift: 'AM', role: 'primary' },
        { tl: 'b@x', shift: 'PM', role: 'primary' },
      ],
      [],
    ]
    const cfgs = [CFG, { ...CFG, break_minutes: 60 }, { ...CFG, secondary_people_h: 6, secondary_task_h: 6 }]
    rosters.forEach((r, i) =>
      cfgs.forEach((cfg, j) =>
        same('schDayPlan_', [r, cfg], (a, c) => schDayPlan_(a as never, c as never), `dayplan ${i}.${j}`)))
  })

  it('schDayPlans_ over a built roster', () => {
    same('schDayPlans_', [
      {
        '2026-10-04': { AM: ['a@x', 'c@x'], PM: ['b@x'], OFF: ['d@x'], WFH: {} },
        '2026-10-05': { AM: ['a@x'], PM: ['b@x', 'c@x'], OFF: [], WFH: { 'b@x': true } },
        '2026-10-06': { AM: [], PM: ['d@x'], OFF: ['a@x', 'b@x', 'c@x'], WFH: {} },
      },
      [D(2026, 9, 4), D(2026, 9, 5), D(2026, 9, 6), D(2026, 9, 7)],
      CFG,
    ], (p, d, c) => schDayPlans_(p as never, d as Date[], c as never))
  })
})

// ---------------------------------------------------------------- task placement

describe('scheduler: task placement', () => {
  const dayPlans = {
    '2026-10-04': { 'a@x': { queue: 7, people: 1, task: 1 }, 'b@x': { queue: 3, people: 3, task: 3 } },
    '2026-10-05': { 'a@x': { queue: 7, people: 1, task: 1 }, 'b@x': { queue: 3, people: 3, task: 3 } },
    '2026-10-06': { 'a@x': { queue: 8, people: 0, task: 1 }, 'c@x': { queue: 3, people: 2, task: 4 } },
    '2026-10-07': { 'c@x': { queue: 3, people: 2, task: 4 } },
    '2026-10-08': {},
  }
  const days = [D(2026, 9, 4), D(2026, 9, 5), D(2026, 9, 6), D(2026, 9, 7), D(2026, 9, 8)]

  it('placements/problems/capacityLeft', () => {
    const taskSets = [
      [
        { id: 't1', desc: 'WBR', who: 'b@x', pri: 'High', status: 'Open', estHours: 2, due: '2026-10-08', startKey: '' },
        { id: 't2', desc: 'Audit', who: 'c@x', pri: 'Low', status: 'Open', estHours: 9, due: '2026-10-07', startKey: '' },
        { id: 't3', desc: 'Big', who: 'a@x', pri: 'Medium', status: 'Open', estHours: 12, due: '2026-10-08', startKey: '' },
        { id: 't4', desc: 'NoTL', who: '', pri: 'High', status: 'Open', estHours: 3, due: '2026-10-08', startKey: '' },
      ],
      [
        { id: 't1', desc: 'Done task', who: 'b@x', pri: 'High', status: 'Done', estHours: 2, due: '2026-10-08', startKey: '' },
        { id: 't2', desc: 'Cancelled', who: 'b@x', pri: 'High', status: 'Cancelled', estHours: 2, due: '2026-10-08', startKey: '' },
        { id: 't3', desc: 'Zero', who: 'b@x', pri: 'Low', status: 'Open', estHours: 0, due: '2026-10-08', startKey: '' },
        { id: 't4', desc: 'NoDue', who: 'b@x', pri: 'Medium', status: 'Open', estHours: 1.5, due: '', startKey: '' },
      ],
      [
        // V2 tasks never recur, but the verbatim routing must still drop one that claims to.
        { id: 't1', desc: 'Recur', who: 'b@x', pri: 'High', status: 'Open', estHours: 2, due: '2026-10-08', startKey: '', recurrence: 'weekly', recurDay: 'Sun' },
        { id: 't2', desc: 'StartKey', who: 'b@x', pri: 'High', status: 'Open', estHours: 2, due: '2026-10-08', startKey: '2026-10-06' },
        { id: 't3', desc: 'PastDue', who: 'b@x', pri: 'High', status: 'Open', estHours: 2, due: '2026-10-02', startKey: '' },
      ],
    ]
    taskSets.forEach((tasks, i) =>
      same('schPlaceTasks_', [{}, days, { ...CFG, _today: '2026-10-04' }, tasks, dayPlans],
        (p, d, c, t, dp) => schPlaceTasks_(p as never, d as Date[], c as never, t as never, dp as never), 'place ' + i))
  })
})

// ---------------------------------------------------------------- hour grid

describe('scheduler: hour grid', () => {
  it('schHourGrid_ layouts', () => {
    const cells = [
      undefined,
      { shift: 'OFF' },
      { shift: 'AM', start: '09:30', queue: 7, people: 1, task: 1, offQueueHours: [16, 17], tasks: [{ desc: 'WBR', hours: 1 }], manual: false, reason: '' },
      { shift: 'PM', start: '13:30', queue: 3, people: 3, task: 3, offQueueHours: [18, 19, 20, 21], tasks: [{ desc: 'A', hours: 2 }], manual: false, reason: '' },
      { shift: 'PM', start: '13:30', queue: 3, people: 3, task: 3, offQueueHours: [], tasks: [], manual: false, reason: '' },
    ]
    const cfgs = [CFG, { ...CFG, break_minutes: 60 }, { ...CFG, people_source: 'reserve' }]
    const booked = [0, 1, 2.5]
    cells.forEach((cell, i) =>
      cfgs.forEach((cfg, j) =>
        booked.forEach((b, k) =>
          same('schHourGrid_', [cell, cfg, b], (a, c, x) => schHourGrid_(a as never, c as never, Number(x)), `grid ${i}.${j}.${k}`))))
  })
})

// ---------------------------------------------------------------- role view / changes / request row

describe('scheduler: role view, changed cells, request row', () => {
  interface FullPlan {
    plan: {
      tls: string[]
      days: { key: string; dow: number; dom: number }[]
      grid: Record<string, Record<string, { shift: string; start?: string }>>
      gaps: Record<string, unknown>[]
      problems: Record<string, unknown>[]
      exceptions: Record<string, unknown>[]
      [k: string]: unknown
    }
    timeline: Record<string, unknown>
  }
  const mkFull = (tls: string[]): FullPlan => ({
    plan: {
      year: 2026, month: 9, monthName: 'October 2026', tag: '2026-10',
      tls,
      names: { 'a@x': 'A' },
      days: [{ key: '2026-10-04', dow: 0, dom: 4 }],
      grid: { 'a@x': { '2026-10-04': { shift: 'AM', start: '09:30' } }, 'b@x': { '2026-10-04': { shift: 'OFF' } } },
      totals: {}, gaps: [], problems: [], exceptions: [],
      config: {}, productiveHours: 9, variant: 0, version: 'x',
    },
    timeline: { '2026-10-04': { 'a@x': { '9': { kind: 'queue' } } } },
  })

  it('schForRole_ strips gaps/problems/exceptions/conflicts for non-admin', () => {
    const full = mkFull(['a@x', 'b@x'])
    const withNoise = mkFull(['a@x', 'b@x'])
    withNoise.plan.gaps = [{ tl: 'a@x' }]
    withNoise.plan.problems = [{ kind: 'x' }]
    withNoise.plan.exceptions = [{ tl: 'b@x' }]
    ;(withNoise.timeline as Record<string, unknown>).conflicts = [{ a: 1 }]
    ;[
      [full, false],
      [full, true],
      [withNoise, false],
      [withNoise, true],
    ].forEach(([f, adm], i) =>
      same('schForRole_', [f, adm], (a, b) => schForRole_(a as never, Boolean(b)), 'role ' + i))
  })

  it('schChangedCells_', () => {
    const a = mkFull(['a@x']).plan
    const b = mkFull(['a@x']).plan
    const c = mkFull(['a@x']).plan
    ;(c.grid['a@x'] as Record<string, { shift: string }>)['2026-10-04'].shift = 'PM'
    ;[
      [{ plan: a }, { plan: b }],
      [{ plan: a }, { plan: c }],
      [{ plan: a }, { plan: { ...a, grid: {} } }],
    ].forEach(([x, y], i) =>
      same('schChangedCells_', [x, y], (p, q) => schChangedCells_(p as never, q as never), 'chg ' + i))
  })

  it('schRequestOut_ — V1-shaped row parity (no packed note)', () => {
    const dir = { name: (e: string) => 'Name ' + e }
    const rows = [
      {
        request_id: 'r1', tl_email: 'A@X.com ', with_email: 'b@x', type: 'SWAP', subtype: 'full',
        date_from: '2026-10-12', date_to: '2026-10-13', shift: 'AM', with_shift: 'PM',
        reason: 'childcare', status: 'Awaiting peer', peer_status: 'Pending',
        submitted_at: '@@ms:' + Date.UTC(2026, 9, 4, 8), decided_by: '', decided_at: '', note: '',
      },
      {
        request_id: 'r2', tl_email: 'a@x', with_email: '', type: 'time_off', subtype: '',
        date_from: D(2026, 9, 15), date_to: '', shift: '', with_shift: '',
        reason: '', status: 'Approved', peer_status: '',
        submitted_at: '@@ms:' + Date.UTC(2026, 9, 1), decided_by: 'boss@x', decided_at: '@@ms:' + Date.UTC(2026, 9, 2, 9), note: '',
      },
    ]
    rows.forEach((r, i) =>
      same('schRequestOut_', [r, { email: 'b@x' }, { name: '@@fn:__fn_dir_name__' }],
        (a, u) => schRequestOut_(a as never, u as never, dir as never), 'req ' + i))
  })
})
