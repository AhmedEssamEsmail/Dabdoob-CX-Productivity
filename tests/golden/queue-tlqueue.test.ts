/**
 * WP-22: TlQueue.js pure functions — oracle diffs against Queue_deprecated/TlQueue.js
 * run verbatim in the vm. Edge cases: first-slot start adjustment (09:30 -> 10:00
 * rounding rule), segment clipping, missing segments, 'out of hours' calls, abandoned
 * vs serviced precedence, merged working windows, message pairs, area SLA rules.
 */
import { describe, it } from 'vitest'
import { baseFixtures, callPort, expectSame, rint, rng, rpick } from './helpers-oracle'
import { qCallLegacy } from './queue-oracle'
import {
  tlqAreaSla_,
  tlqCallClass_,
  tlqMessagePairs_,
  tlqQueueStats_,
  tlqShiftsFromTimeline_,
  tlqTicketMatches_,
  tlqWorkingMinutes_,
} from '@/features/cx-queue/lib/tlqueue'

const same = (fn: string, args: unknown[], portFn: () => unknown, label?: string) =>
  expectSame(callPort(portFn), qCallLegacy(fn, args, baseFixtures({ nowMs: Date.parse('2026-10-15T12:00:00Z') })), label || fn)

// The H slot the scheduler rounds the first hour up to; 09:30 -> 10.
const T = (h: number, m = 0) => Date.parse(`2026-10-12T${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:00+03:00`)

describe('tlqShiftsFromTimeline_ (TlQueue.js:38)', () => {
  it('canonical vectors', () => {
    const cases: Record<string, unknown>[][] = [
      // First queue segment at the row's first slot starts at true shift start.
      [{ tl: 'a@x.com', date: '2026-10-12', from: 9.5, to: 18.5, segments: [{ kind: 'queue', from: 10, to: 12 }, { kind: 'people', from: 12, to: 13 }, { kind: 'queue', from: 13, to: 18 }] }],
      // Segment ending past the shift end clips at r.to.
      [{ tl: 'b@x.com', date: '2026-10-12', from: 13, to: 20, segments: [{ kind: 'queue', from: 13, to: 19 }, { kind: 'queue', from: 19, to: 22 }] }],
      // No segments -> dropped.
      [{ tl: 'c@x.com', date: '2026-10-12', from: 9, to: 18 }],
      [{ tl: 'c@x.com', date: '2026-10-12', from: 9, to: 18, segments: [] }],
      // r.to <= r.from -> dropped even with segments.
      [{ tl: 'd@x.com', date: '2026-10-12', from: 18, to: 9, segments: [{ kind: 'queue', from: 18, to: 22 }] }],
      // Date not wanted -> dropped.
      [{ tl: 'e@x.com', date: '2026-10-13', from: 9, to: 18, segments: [{ kind: 'queue', from: 9, to: 18 }] }],
      // Non-queue segments only -> shift row with empty queue.
      [{ tl: 'f@x.com', date: '2026-10-12', from: 9, to: 18, segments: [{ kind: 'meeting', from: 10, to: 11 }] }],
      // First segment is not queue, but a later queue segment still starts at its own from.
      [{ tl: 'g@x.com', date: '2026-10-12', from: 9.5, to: 18.5, segments: [{ kind: 'task', from: 10, to: 11 }, { kind: 'queue', from: 11, to: 15 }] }],
    ]
    cases.forEach((rows, i) =>
      same('tlqShiftsFromTimeline_', [rows, ['2026-10-12']], () => tlqShiftsFromTimeline_(rows as never[], ['2026-10-12']), 'shifts case ' + i))
  })

  it('seeded vectors', () => {
    const r = rng(77)
    for (let i = 0; i < 25; i++) {
      const from = rint(r, 8, 14) + rpick(r, [0, 0.5])
      const to = from + rint(r, 1, 10)
      const nSeg = rint(r, 0, 4)
      const segments = Array.from({ length: nSeg }, () => {
        const s = from + rint(r, 0, 8)
        return { kind: rpick(r, ['queue', 'people', 'task', 'meeting', 'break']), from: s, to: s + rint(r, 1, 4) }
      }).sort((a, b) => a.from - b.from)
      const rows = [{ tl: 'tl' + i + '@x.com', date: '2026-10-12', from, to, segments }]
      same('tlqShiftsFromTimeline_', [rows, ['2026-10-12']], () => tlqShiftsFromTimeline_(rows as never[], ['2026-10-12']), 'seeded ' + i)
    }
  })
})

describe('tlqCallClass_ (TlQueue.js:58)', () => {
  const STATES = { serviced: ['answered', 'completed'], abandoned: ['abandoned', 'missed', 'no-answer'] }
  const cases: [unknown, unknown][] = [
    ['Out Of Hours', 0],
    ['out of hours', 30],
    ['OUT  OF   HOURS', 0],
    ['answered', 0],
    [' Answered ', 0],
    ['ANSWERED', 0],
    ['abandoned', 0],
    ['abandoned', 45], // handling sec wins over the abandoned list
    ['no-answer', 120],
    ['weird state', 0],
    ['', 10],
    [null, 0],
    [undefined, 5],
    ['completed', 0],
  ]
  cases.forEach(([state, sec], i) =>
    it('case ' + i + ' ' + JSON.stringify(state) + '/' + sec, () =>
      same('tlqCallClass_', [state, sec, STATES], () => tlqCallClass_(String(state ?? ''), Number(sec), STATES))))
})

describe('tlqWorkingMinutes_ (TlQueue.js:67)', () => {
  it('boundary + merge vectors', () => {
    const W = (h: number, m: number, h2: number, m2: number) => ({ startMs: T(h, m), endMs: T(h2, m2) })
    const cases: [number, number, { startMs: number; endMs: number[] | number }[]][] = [
      [T(9), T(12), [W(9, 0, 12, 0) as never]],
      [T(9), T(12), [W(10, 0, 11, 0) as never]],
      [T(10), T(11), [W(9, 0, 10, 0) as never, W(11, 0, 12, 0) as never]],
      [T(9), T(12), [W(9, 30, 10, 30) as never, W(10, 0, 11, 30) as never]],
      [T(9), T(12), []],
      [T(9), T(9), [W(8, 0, 20, 0) as never]],
      [T(9), T(22), [W(9, 0, 13, 0) as never, W(12, 0, 18, 0) as never, W(17, 0, 23, 0) as never]],
    ]
    cases.forEach(([a, b, ws], i) =>
      same('tlqWorkingMinutes_', [a, b, ws], () => tlqWorkingMinutes_(a, b, ws as never[]), 'wm ' + i))
  })
})

describe('tlqMessagePairs_ (TlQueue.js:83)', () => {
  it('conversations, ordering, missing answer', () => {
    const M = (conv: string, h: number, m: number, actor: string) => ({ conv, ms: T(h, m), actor })
    const cases: Record<string, unknown>[][] = [
      [M('c1', 9, 0, 'customer'), M('c1', 9, 10, 'agent')],
      [M('c1', 9, 0, 'customer'), M('c1', 9, 5, 'customer'), M('c1', 9, 30, 'agent')],
      [M('c1', 9, 0, 'customer')], // never answered -> endMs NaN
      [M('c1', 9, 0, 'agent'), M('c1', 9, 5, 'customer'), M('c1', 9, 10, 'agent'), M('c1', 9, 20, 'customer'), M('c1', 9, 25, 'agent')],
      [M('c2', 9, 5, 'customer'), M('c1', 9, 0, 'customer'), M('c1', 9, 3, 'agent'), M('c2', 9, 7, 'agent')],
      [M('c1', 9, 0, 'customer'), M('c1', 9, 10, 'agent'), M('c1', 9, 0, 'customer')], // out-of-order, sorts by ms
      [],
      [M('c1', 9, 0, 'customer'), M('c1', 9, 10, 'system'), M('c1', 9, 20, 'agent')],
    ]
    cases.forEach((msgs, i) =>
      same('tlqMessagePairs_', [msgs], () => tlqMessagePairs_(msgs as never[]), 'pairs ' + i))
  })
})

describe('tlqQueueStats_ (TlQueue.js:105)', () => {
  const STATES = { serviced: ['answered', 'completed'], abandoned: ['abandoned', 'missed', 'no-answer'] }
  const SH = (tl: string, win: [number, number, number, number][]) => ({
    tl, date: '2026-10-12', startMs: T(9), endMs: T(18),
    queue: win.map(([h, m, h2, m2]) => ({ startMs: T(h, m), endMs: T(h2, m2) })),
  })
  const C = (h: number, m: number, state: string, sec = 0) => ({ ms: T(h, m), state, handlingSec: sec })
  const TC = (h: number, m: number, id: string) => ({ ms: T(h, m), ticketId: id })
  const P = (h: number, m: number, h2?: number, m2?: number) => ({ startMs: T(h, m), endMs: h2 === undefined ? NaN : T(h2, m2 ?? 0) })

  it('canonical vectors', () => {
    const cases: [unknown[], unknown[], unknown[], unknown[]][] = [
      // Basic: serviced + abandoned + other + out-of-hours inside one window.
      [[SH('a@x.com', [[9, 0, 13, 0]])],
        [C(9, 30, 'answered', 60), C(10, 0, 'abandoned'), C(11, 0, 'voicemail'), C(12, 0, 'Out Of Hours')], [], []],
      // Shift with no queue windows -> no stat row.
      [[SH('a@x.com', [])], [C(9, 30, 'answered', 10)], [], []],
      // Call exactly at window end excluded; at window start included.
      [[SH('a@x.com', [[9, 0, 12, 0]])], [C(9, 0, 'answered', 5), C(12, 0, 'answered', 5)], [], []],
      // Touches + pairs: answered in-window, missing response, response counted vs working minutes.
      [[SH('a@x.com', [[9, 0, 12, 0]])], [], [TC(9, 30, 't1'), TC(9, 45, 't1'), TC(13, 0, 't2')],
        [P(9, 10, 9, 40), P(10, 0), P(11, 0, 11, 20)]],
      // Two TLs overlapping: both count the shared calls; response minutes merge windows.
      [[SH('a@x.com', [[9, 0, 14, 0]]), SH('b@x.com', [[12, 0, 18, 0]])],
        [C(12, 30, 'answered', 30)], [TC(12, 45, 't9')], [P(12, 10, 13, 0)]],
      // Resp pair spanning an off-queue gap counts only staffed minutes.
      [[SH('a@x.com', [[9, 0, 10, 0], [11, 0, 12, 0]])], [], [], [P(9, 30, 11, 30)]],
      // Duplicate shifts for one tl|date: legacy overwrites the accumulator.
      [[SH('a@x.com', [[9, 0, 11, 0]]), SH('a@x.com', [[15, 0, 18, 0]])], [C(10, 0, 'answered', 5), C(16, 0, 'answered', 5)], [], []],
      // Reversed pair endMs < startMs -> resp_missing, not counted.
      [[SH('a@x.com', [[9, 0, 12, 0]])], [], [], [P(9, 30, 9, 10)]],
    ]
    cases.forEach(([sh, ca, to, pa], i) =>
      same('tlqQueueStats_', [sh, ca, to, pa, STATES], () => tlqQueueStats_(sh as never[], ca as never[], to as never[], pa as never[], STATES), 'stats ' + i))
  })
})

describe('tlqAreaSla_ (TlQueue.js:152)', () => {
  const NOW = T(15)
  // Missing values: NaN cannot cross the oracle's JSON boundary, so the open ticket uses
  // '@@ms:NaN' (revived as an invalid Date inside the vm, an unparseable string in the
  // port — isFinite is false on both sides) and 'null' (resolved at epoch, equally).
  const MISS = '@@ms:NaN'
  const cases: [unknown[], Record<string, unknown>][] = [
    // due_by: resolved by due; resolved after; open past due; open before due (not counted).
    [[{ createdMs: T(9), resolvedMs: T(10), dueMs: T(11) }, { createdMs: T(9), resolvedMs: T(12), dueMs: T(11) },
      { createdMs: T(9), resolvedMs: MISS, dueMs: T(14) }, { createdMs: T(9), resolvedMs: MISS, dueMs: T(20) }], { rule: 'due_by' }],
    // same_day: resolved same Kuwait day vs next day; open while day still running.
    [[{ createdMs: T(9), resolvedMs: T(22), dueMs: null }, { createdMs: T(23), resolvedMs: T(23, 30), dueMs: null },
      { createdMs: T(23, 30), resolvedMs: MISS, dueMs: null }], { rule: 'same_day' }],
    // days: N x 24h limit.
    [[{ createdMs: T(9), resolvedMs: T(9) + 86400000, dueMs: null }, { createdMs: T(9), resolvedMs: MISS, dueMs: null }], { rule: 'days', days: 2 }],
    [[{ createdMs: MISS, resolvedMs: T(10), dueMs: null }], { rule: 'days' }],
    [[{ createdMs: T(9), resolvedMs: null, dueMs: T(11) }], { rule: 'due_by' }],
    [[], { rule: 'due_by' }],
  ]
  cases.forEach(([tickets, rule], i) =>
    it('area ' + i, () =>
      same('tlqAreaSla_', [tickets, rule, NOW], () => tlqAreaSla_(tickets as never[], rule as never, NOW))))
})

describe('tlqTicketMatches_ (TlQueue.js:165)', () => {
  const T1 = { group_name: 'UAE Phones', contact_type_1: 'WA', contact_type_2: 'Phones', contact_type_3: '', country: 'UAE', channel: 'chat', source: 'whatsapp' }
  const cases: [Record<string, unknown>, Record<string, unknown>][] = [
    [T1, { groups: ['UAE Phones'] }],
    [T1, { groups: ['KSA Phones'] }],
    [T1, { contactTypes: ['wa'] }],
    [T1, { contactTypes: ['phones', 'other'] }],
    [T1, { countries: ['uae'] }],
    [T1, { excludeText: ['whatsapp'] }],
    [T1, { excludeText: ['telegram'] }],
    [T1, {}],
    [{ ...T1, contact_type_1: null }, { contactTypes: ['wa'] }],
    [T1, { groups: ['uae phones'], contactTypes: ['phones'], countries: ['UAE'] }],
    [T1, { groups: [] }],
  ]
  cases.forEach(([t, src], i) =>
    it('match ' + i, () => same('tlqTicketMatches_', [t, src], () => tlqTicketMatches_(t as never, src as never))))
})
