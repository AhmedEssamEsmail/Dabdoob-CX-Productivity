/**
 * WP-22: TlQueue.js pure functions — oracle diffs against Queue_deprecated/TlQueue.js
 * run verbatim in the vm. Edge cases: first-slot start adjustment (09:30 -> 10:00
 * rounding rule), segment clipping, missing segments, 'out of hours' calls, abandoned
 * vs serviced precedence, merged working windows, message pairs, area SLA rules.
 */
import { describe, it } from 'vitest'
import { baseFixtures, callPort, expectSame, json, rint, rng, rpick } from './helpers-oracle'
import { qCallLegacy, qOracle } from './queue-oracle'
import { pwDirectory_ } from '@/features/shared/lib/adapters'
import { sheetBook } from '@/features/shared/jobs/sheets'
import { FD_TICKET_HEADERS } from '@/features/cx-queue/lib/index'
import {
  tlqAreaRows_,
  tlqAreaSla_,
  tlqCallClass_,
  tlqCallsFromMirrorRows_,
  tlqExclusions_,
  tlqMessagePairs_,
  tlqOlGridFromRecords_,
  tlqOlRows_,
  tlqParseFcMessages_,
  tlqQueueStats_,
  tlqReadOlRows_,
  tlqReadTexting_,
  tlqShiftsFromTimeline_,
  tlqTeamRows_,
  tlqTicketMatches_,
  tlqWorkingMinutes_,
  type TlqIo,
} from '@/features/cx-queue/lib/tlqueue'
import type { Cfg, Directory, SheetBookLike } from '@/features/shared/lib/adapters'

const same = (fn: string, args: unknown[], portFn: () => unknown, label?: string) =>
  expectSame(callPort(portFn), qCallLegacy(fn, args, baseFixtures({ nowMs: Date.parse('2026-10-15T12:00:00Z') })), label || fn)

const NOW = Date.parse('2026-10-15T12:00:00Z')
const fx = (over: Record<string, unknown>) => baseFixtures({ nowMs: NOW, ...over })

/** io.book fake mirroring __mkSs__: a named tab reads its cells, a missing one reads null. */
const bookFor = (spreadsheets: Record<string, Record<string, unknown[][]>>) => async (id: string): Promise<SheetBookLike> => {
  const cells = spreadsheets[id] || {}
  const sb = sheetBook(cells, id)
  return {
    getId: () => id,
    getSheetByName: (n: string) => (cells[n] && cells[n].length ? sb.getSheetByName(n) : null),
  } as SheetBookLike
}

/** A minimal TlqIo for the read-path tests: every seam inert unless the test fills it. */
const fakeIo = (over: Partial<TlqIo>): TlqIo => ({
  cfg: {} as Cfg,
  dir: { by: {}, tls: () => [], agentsOf: () => [] } as unknown as Directory,
  schedPlanRows: async () => [],
  maqsamRows: async () => [],
  fdActivityRows: async () => [],
  trackerRecords: async () => [],
  book: async () => sheetBook({}) as SheetBookLike,
  ticketsSince: async () => [],
  storeRows: async () => [],
  scores: async () => ({}),
  upsert: async () => {},
  nowMs: () => NOW,
  ...over,
})

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

// ---------------------------------------------------------------------------
// WP-F2: the build-path pure functions (rows, readers, OL, team, texting)
// ---------------------------------------------------------------------------

describe('tlqParseFcMessages_ (TlQueue.js:187)', () => {
  const head = [['conversation_id', 'created_time', 'actor_type']]
  it('headers, actors, window filter', () => {
    const cases: [unknown[][], string, number, number][] = [
      [head.concat([['c1', '2026-10-14T09:00:00+03:00', 'user'], ['c1', '2026-10-14T09:05:00+03:00', 'agent'], ['c1', '2026-10-14T09:07:00+03:00', 'bot'], ['c2', '2026-10-19T09:00:00+03:00', 'agent']]), 'Africa/Cairo', T(8), T(18)],
      [[['not', 'the', 'headers']], 'Africa/Cairo', T(8), T(18)],
      [head.concat([['c1', 'garbage', 'agent'], ['c1', '2026-10-14T20:00:00+03:00', 'agent']]), 'Africa/Cairo', T(8), T(18)],
      [[], 'Africa/Cairo', T(8), T(18)],
      [[['conv_id', 'timestamp', 'sender_type'], ['c9', '2026-10-14T10:00:00+03:00', 'Contact']], 'Africa/Cairo', T(8), T(18)],
    ]
    cases.forEach(([v, tz, f, t], i) =>
      same('tlqParseFcMessages_', [v, tz, f, t], () => tlqParseFcMessages_(v, tz, f, t), 'fc parse ' + i))
  })
})

describe('tlqExclusions_ (TlQueue.js:431)', () => {
  it('not-removed rows keyed area|ticket_id', () => {
    const rows = [
      { area: 'Refunds', ticket_id: '101', removed_at: null },
      { area: 'Refunds', ticket_id: '102', removed_at: '2026-10-01T00:00:00Z' },
      { area: 'Returns', ticket_id: ' 103 ', removed_at: '' },
      { area: 'Refunds', ticket_id: '', removed_at: null },
    ]
    same('tlqExclusions_', [rows], () => tlqExclusions_(rows as never[]))
  })
})

describe('tlqOlRows_ (TlQueue.js:365)', () => {
  it('existing agents reset to 0, current-month counts overwrite', () => {
    const existing = [
      { month: '2026-10', email: 'a@x.com', cases: 3 },
      { month: '2026-10', email: 'C@X.com', cases: 1 },
      { month: '2026-09', email: 'd@x.com', cases: 9 },
    ]
    same(
      'tlqOlRows_',
      ['2026-10', { 'a@x.com': 2, 'b@x.com': 1 }, existing, 'STAMP'],
      () => tlqOlRows_('2026-10', { 'a@x.com': 2, 'b@x.com': 1 }, existing as never[], 'STAMP'))
  })
})

describe('tlqReadOl_ vs tlqReadOlRows_ (TlQueue.js:410)', () => {
  // The vm revives '@@ms:' cells into real Dates inside getValues(); the port
  // gets the same instants as host Dates.
  const DIR = { by: { 'alice@x.com': { name: 'Alice  Smith' }, 'bob@x.com': { name: 'Bob Jones' } } } as unknown as Directory
  const D = (iso: string) => Date.parse(iso)
  const head: unknown[] = ['Record ID', 'Date of Loss', 'Responsible Person', 'Loss Amount']
  const rows: { vm: unknown; port: unknown }[][] = [
    [{ vm: '@@ms:' + D('2026-10-14T21:00:00Z'), port: new Date(D('2026-10-14T21:00:00Z')) }, { vm: 'Alice Smith', port: 'Alice Smith' }],
    [{ vm: '@@ms:' + D('2026-10-14T21:00:00Z'), port: new Date(D('2026-10-14T21:00:00Z')) }, { vm: 'alice   SMITH', port: 'alice   SMITH' }],
    [{ vm: '@@ms:' + D('2026-10-01T21:00:00Z'), port: new Date(D('2026-10-01T21:00:00Z')) }, { vm: 'Bob Jones', port: 'Bob Jones' }],
    [{ vm: '2026-10-20', port: '2026-10-20' }, { vm: 'bob@x.com', port: 'bob@x.com' }],
    [{ vm: '2026-09-30', port: '2026-09-30' }, { vm: 'Alice Smith', port: 'Alice Smith' }], // wrong month
    [{ vm: '@@ms:' + D('2026-10-14T21:00:00Z'), port: new Date(D('2026-10-14T21:00:00Z')) }, { vm: 'Ghost Person', port: 'Ghost Person' }],
    [{ vm: '@@ms:' + D('2026-10-14T21:00:00Z'), port: new Date(D('2026-10-14T21:00:00Z')) }, { vm: '', port: '' }],
  ]
  const sheet = (which: 'vm' | 'port') => [head].concat(rows.map(([d, w]) => ['OL-n', d[which], w[which], '5'])) as unknown[][]
  it('month rows attributed by roster name; unmatched reported', () => {
    const fixtures = fx({ settings: { ol_sheet_id: 'ol-book' }, spreadsheets: { 'ol-book': { Sheet1: sheet('vm') } } })
    expectSame(
      callPort(() => tlqReadOlRows_(sheet('port'), '2026-10', DIR)),
      qCallLegacy('tlqReadOl_', ['2026-10', { by: DIR.by }], fixtures),
      'tlqReadOl_')
  })
  it('header missing the OL columns throws the same error', () => {
    const fixtures = fx({ settings: { ol_sheet_id: 'ol-book' }, spreadsheets: { 'ol-book': { Sheet1: [['a', 'b']] } } })
    expectSame(
      callPort(() => tlqReadOlRows_([['a', 'b']], '2026-10', DIR)),
      qCallLegacy('tlqReadOl_', ['2026-10', { by: DIR.by }], fixtures),
      'tlqReadOl_ bad header')
  })
})

describe('tlqOlGridFromRecords_ (native operational_loss store)', () => {
  const tracker = { record_id_header: 'Record ID', submitted_by_header: 'submitted_by', submitted_at_header: 'submitted_at' }
  const fields = [
    { id: 'date_of_loss', header: 'Date of Loss', type: 'date' },
    { id: 'responsible_person', header: 'Responsible Person', type: 'text' },
  ]
  it('sys cols first, field headers in order, ISO-instant date cells become Dates', () => {
    const grid = tlqOlGridFromRecords_(tracker, fields, [
      { record_id: 'OL2', submitted_by: 'u@x.com', submitted_at: '2026-10-15T01:00:00.000Z', values: { date_of_loss: '2026-10-14T21:00:00.000Z', responsible_person: 'Alice Smith' } },
      { record_id: 'OL3', submitted_by: '', submitted_at: null, values: { date_of_loss: '2026-10-20', responsible_person: 'Bob Jones' } },
    ] as never[])
    expectSame(
      { ok: json(grid) },
      { ok: [
        ['Record ID', 'submitted_by', 'submitted_at', 'Date of Loss', 'Responsible Person'],
        ['OL2', 'u@x.com', '2026-10-15T01:00:00.000Z', '2026-10-14T21:00:00.000Z', 'Alice Smith'],
        ['OL3', '', '', '2026-10-20', 'Bob Jones'],
      ] },
      'grid')
    // The Date-cell branch lands on pwKwDate_ -> the Kuwait date (the ISO instant is
    // 2026-10-15 in Kuwait, while its UTC slice is the 14th).
    const d = grid[1][3] as Date
    expectSame({ ok: d instanceof Date && d.toISOString() }, { ok: '2026-10-14T21:00:00.000Z' }, 'date cell')
  })
  it('grid feeds tlqReadOlRows_ like a sheet', () => {
    const DIR = { by: { 'alice@x.com': { name: 'Alice Smith' } } } as unknown as Directory
    const grid = tlqOlGridFromRecords_(tracker, fields, [
      { record_id: 'OL1', submitted_by: '', submitted_at: null, values: { date_of_loss: '2026-10-05', responsible_person: 'Alice Smith' } },
      { record_id: 'OL2', submitted_by: '', submitted_at: null, values: { date_of_loss: '2026-09-05', responsible_person: 'Alice Smith' } },
      { record_id: 'OL3', submitted_by: '', submitted_at: null, values: { date_of_loss: '2026-10-05', responsible_person: 'Nobody' } },
    ] as never[])
    expectSame(
      { ok: json(tlqReadOlRows_(grid, '2026-10', DIR)) },
      { ok: { byEmail: { 'alice@x.com': 1 }, unmatched: ['Nobody'] } },
      'native ol rows')
  })
})

describe('tlqReadCalls_ vs tlqCallsFromMirrorRows_ (TlQueue.js:231)', () => {
  // Sheet layout A..J: id, -, -, start, end, state, direction, duration, waiting, handlingSec.
  // Mirror cols (maqsamCallToCols): [start, end, durationSec, agent, state, direction, handlingDays].
  const CA = '2026-10-14' // a Cairo date inside [T(8), T(18)] of the 12th? no — calls use the 14th window
  const FROM = Date.parse('2026-10-14T00:00:00+03:00')
  const TO = Date.parse('2026-10-15T00:00:00+03:00')
  const calls: { id: string; start: string; end: string; state: string; dir: string; sec: number; agent?: string }[] = [
    { id: 'c-1', start: CA + ' 09:30:00', end: CA + ' 09:35:00', state: 'answered', dir: 'inbound', sec: 120, agent: 'a@x.com' },
    { id: 'c-1', start: CA + ' 09:30:00', end: CA + ' 09:35:00', state: 'answered', dir: 'inbound', sec: 120 }, // dedupe
    { id: 'c-2', start: CA + ' 10:00:00', end: CA + ' 10:02:00', state: 'abandoned', dir: 'inbound', sec: 0 },
    { id: 'c-3', start: CA + ' 11:00:00', end: CA + ' 11:03:00', state: 'answered', dir: 'outbound', sec: 60 },
    { id: 'c-4', start: '2026-10-13 09:30:00', end: '2026-10-13 09:35:00', state: 'answered', dir: 'inbound', sec: 10 },
    { id: 'c-5', start: CA + ' 23:59:00', end: CA + ' 23:59:30', state: 'answered', dir: 'inbound', sec: 30 },
  ]
  const sheetRows = [['id', '', '', 'start', 'end', 'state', 'dir', 'dur', 'wait', 'handling']].concat(
    calls.map((c) => [c.id, '', '', c.start, c.end, c.state, c.dir, '300', '5', String(c.sec)]))
  const mirrorRows = calls.map((c) => ({ dedupe_key: c.id, cols: [c.start, c.end, '300', c.agent || '', c.state, c.dir, c.sec / 86400] }))
  it('inbound calls, dedupe by call id, window filter', () => {
    const fixtures = fx({ spreadsheets: { 'daily-report': { Maqsam: sheetRows } } })
    expectSame(
      callPort(() => tlqCallsFromMirrorRows_(mirrorRows as never[], FROM, TO)),
      qCallLegacy('tlqReadCalls_', [FROM, TO], fixtures),
      'tlqReadCalls_')
  })
})

describe('tlqReadTexting_ (TlQueue.js:248)', () => {
  // The vm wrapper captures the notes array tlqReadTexting_ appends to.
  qOracle().eval('globalThis.__tlqText__ = function (f, t) { var n = []; var r = tlqReadTexting_(f, t, n); return { r: r, notes: n }; }')
  const FROM = Date.parse('2026-10-14T00:00:00+03:00')
  const TO = Date.parse('2026-10-15T00:00:00+03:00')
  const CFG = {
    fc_messages_ss_id: 'fc-book', fc_messages_tab: 'Freshchat Messages (auto)', fc_messages_tz: 'Africa/Cairo',
    tlp_texting_groups: ['FreshChat'], fd_activity_ss_id: 'fd-activity', activity_local_tz: 'Asia/Kuwait',
  } as unknown as Cfg
  const FC = { 'fc-book': { 'Freshchat Messages (auto)': [['conversation_id', 'created_time', 'actor_type'],
    ['c1', '2026-10-14T09:00:00+03:00', 'user'], ['c1', '2026-10-14T09:05:00+03:00', 'agent'],
    ['c2', '2026-10-14T10:00:00+03:00', 'customer'], ['c2', '2026-10-14T10:30:00+03:00', 'agent']] } }
  const ACT = { 'fd-activity': { Activities: [
    ['h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h', 'h'],
    ['10-14-2026 09:20:00', 't-100', 'x', 'agent', '', '', '', '', 'FreshChat', ''],
    ['10-14-2026 09:40:00', 't-100', 'x', 'customer', '', '', '', '', 'FreshChat', ''],
    ['10-14-2026 09:50:00', 't-101', 'x', 'agent', '', '', '', '', 'Phones', ''],
    ['10-15-2026 09:20:00', 't-102', 'x', 'agent', '', '', '', '', 'FreshChat', ''],
  ] } }
  const TIX = [
    { ticket_id: 't-100', group_name: 'FreshChat', created_at: '2026-10-14T06:20:00Z', first_responded_at: '2026-10-14T06:40:00Z' },
    { ticket_id: 't-103', group_name: 'FreshChat', created_at: '2026-10-14T08:00:00Z', first_responded_at: '' },
    { ticket_id: 't-104', group_name: 'Phones', created_at: '2026-10-14T08:00:00Z', first_responded_at: '2026-10-14T08:30:00Z' },
  ]
  const tixTab = [FD_TICKET_HEADERS.slice() as unknown[]].concat(
    TIX.map((t) => FD_TICKET_HEADERS.map((h) => (t as Record<string, unknown>)[h] ?? '')))
  const textingIo = (spreadsheets: Record<string, Record<string, unknown[][]>>, cfg: Cfg, tickets: Record<string, unknown>[]) =>
    fakeIo({ cfg, book: bookFor(spreadsheets), ticketsSince: async () => tickets, fdActivityRows: async () => [] })

  it('freshchat sheet: pairs + notes + source', async () => {
    const fixtures = fx({ settings: CFG as unknown as Record<string, unknown>, spreadsheets: FC })
    const notes: string[] = []
    const r = await tlqReadTexting_(textingIo(FC, CFG, []), FROM, TO, notes)
    expectSame({ ok: json({ r, notes }) }, qCallLegacy('__tlqText__', [FROM, TO], fixtures), 'texting freshchat')
  })
  it('freshdesk fallback when the fc tab is absent', async () => {
    const fixtures = fx({ settings: CFG as unknown as Record<string, unknown>, spreadsheets: { ...ACT, 'tickets-store': { tickets: tixTab } } })
    const notes: string[] = []
    const r = await tlqReadTexting_(textingIo({ ...ACT }, CFG, TIX as never[]), FROM, TO, notes)
    expectSame({ ok: json({ r, notes }) }, qCallLegacy('__tlqText__', [FROM, TO], fixtures), 'texting freshdesk')
  })
  it('fd_activities mirror stands in when the Activities sheet fails', async () => {
    // vm side: same data via the sheet path (the mirror is the same tab's copy).
    const fixtures = fx({ settings: CFG as unknown as Record<string, unknown>, spreadsheets: { ...ACT, 'tickets-store': { tickets: tixTab } } })
    const notes: string[] = []
    const io = textingIo({}, CFG, TIX as never[])
    ;(io as { book: TlqIo['book'] }).book = async () => { throw new Error('sheets credentials missing') }
    io.fdActivityRows = async () => ACT['fd-activity'].Activities.slice(1).map((cols) => ({ cols })) as never[]
    const r = await tlqReadTexting_(io, FROM, TO, notes)
    // Same r as the sheet path; notes differ (sheet failure + fallback is reported).
    const legacy = qCallLegacy('__tlqText__', [FROM, TO], fixtures) as { ok?: { r: unknown; notes: string[] } }
    expectSame({ ok: json(r) }, { ok: legacy.ok?.r }, 'texting mirror rows')
  })
})

describe('tlqTeamRows_ (TlQueue.js:378)', () => {
  // The port takes a Directory; inside the vm pwDirectory_ builds it from the
  // roster tab — the wrapper keeps the arg list JSON-safe.
  qOracle().eval('globalThis.__tlqTeam__ = function (m, ol, l, h, t, s) { return tlqTeamRows_(pwDirectory_(), m, ol, l, h, t, s); }')
  const rosterTab = [
    ['email', 'name', 'role', 'tl_email', 'active', 'position'],
    ['tl@x.com', 'T One', 'tl', '', 'true', 'Customer Experience Team Leader'],
    ['a@x.com', 'Agent A', 'agent', 'tl@x.com', 'true', 'Customer Experience Agent'],
    ['b@x.com', 'Agent B', 'agent', 'tl@x.com', 'true', 'Customer Experience Agent'],
    ['c@x.com', 'Agent C', 'agent', 'tl@x.com', 'false', 'Customer Experience Agent'],
    ['tl2@x.com', 'T Two', 'tl', '', 'true', 'Customer Experience Team Leader'],
  ]
  const rosterRows = rosterTab.slice(1).map((r) => ({ email: r[0], name: r[1], role: r[2], tl_email: r[3], active: r[4], position: r[5] }))
  const month = { month: '2026-10', from: '2026-10-01', to: '2026-10-31', rows: [
    { email: 'a@x.com', prod: 80, qual: 90, fcr: 70, behavior: 1, behaviorCases: 0, days: 20 },
    { email: 'b@x.com', prod: 60, qual: '', fcr: null, behavior: null, behaviorCases: 2, days: 20 },
  ] }
  it('means + payout + flags for the roster TLs', () => {
    const fixtures = fx({ data: { Roster: rosterTab } })
    const dir = pwDirectory_(rosterRows as never[], 'admin@dabdoob.com')
    expectSame(
      callPort(() => tlqTeamRows_(dir, month as never, { 'a@x.com': 2 }, { 'b@x.com': ['2026-10-10', '2026-10-14'] }, { 'a@x.com': '2026-09-01' }, '2026-10-15', 'STAMP')),
      qCallLegacy('__tlqTeam__', [month, { 'a@x.com': 2 }, { 'b@x.com': ['2026-10-10', '2026-10-14'] }, { 'a@x.com': '2026-09-01' }, '2026-10-15', 'STAMP'], fixtures),
      'tlqTeamRows_')
  })
})

describe('tlqAreaRows_ (TlQueue.js:438)', () => {
  // Legacy reads tickets + settings inside; the port takes them as args — feed
  // the same objects both sides. tlp_ticket_exclusions is not a dqTableDefs_
  // table in this app, so the vm's tlqExclusions_ sees [] — pass {}.
  const TIX_H = FD_TICKET_HEADERS.slice()
  const tix = (o: Record<string, unknown>) => TIX_H.map((h) => o[h] ?? '')
  const tixObj = (o: Record<string, unknown>) => o
  const settings = {
    tlp_area_sources: {
      Refunds: { groups: ['Refunds - CX Group'], rule: 'due_by' },
      Complaints: { contactTypes: ['complain'], rule: 'same_day' },
    },
    tlp_tl_areas: { 'TL@x.com': ['Refunds', 'Complaints'], 'other@x.com': ['Nothing'] },
  }
  const tickets = [
    tixObj({ ticket_id: '1', group_name: 'Refunds - CX Group', created_at: '2026-10-13T09:00:00Z', resolved_at: '2026-10-13T10:00:00Z', due_by: '2026-10-14T00:00:00Z' }),
    tixObj({ ticket_id: '2', group_name: 'Refunds - CX Group', created_at: '2026-10-13T09:00:00Z', resolved_at: '2026-10-15T10:00:00Z', due_by: '2026-10-14T00:00:00Z' }),
    tixObj({ ticket_id: '3', group_name: 'Refunds - CX Group', created_at: '2026-10-14T09:00:00Z', resolved_at: '', due_by: '2026-10-14T10:00:00Z' }),
    tixObj({ ticket_id: '4', contact_type_1: 'Complain', created_at: '2026-10-14T09:00:00Z', resolved_at: '2026-10-14T20:00:00Z' }),
    tixObj({ ticket_id: '5', contact_type_2: 'complain', created_at: '2026-10-14T09:00:00Z', resolved_at: '2026-10-16T20:00:00Z' }),
    tixObj({ ticket_id: '6', group_name: 'Other', created_at: '2026-10-13T09:00:00Z', resolved_at: '2026-10-13T10:00:00Z' }),
    tixObj({ ticket_id: '7', group_name: 'Refunds - CX Group', created_at: '2026-10-01T09:00:00Z', resolved_at: '2026-10-01T10:00:00Z' }),
  ]
  it('one row per owning TL per area, 7-day SLA window', () => {
    const fixtures = fx({
      settings: settings as unknown as Record<string, unknown>,
      spreadsheets: { 'tickets-store': { tickets: [TIX_H].concat(tickets.map(tix) as never[][]) } },
    })
    expectSame(
      callPort(() => tlqAreaRows_(settings.tlp_area_sources as never, settings.tlp_tl_areas as never, tickets as never[], {}, '2026-10-15', 'STAMP', NOW)),
      qCallLegacy('tlqAreaRows_', ['2026-10-15', 'STAMP'], fixtures),
      'tlqAreaRows_')
  })
  it('an excluded ticket drops out port-side', () => {
    const rows = tlqAreaRows_(settings.tlp_area_sources as never, settings.tlp_tl_areas as never, tickets as never[], { 'Refunds|3': true }, '2026-10-15', 'STAMP', NOW)
    expectSame(
      { ok: json(rows.map((r) => ({ key: r.key, met: r.met, total: r.total }))) },
      { ok: [
        { key: 'tl@x.com|Refunds', met: 1, total: 2 },
        { key: 'tl@x.com|Complaints', met: 1, total: 2 },
      ] },
      'exclusions')
  })
})
