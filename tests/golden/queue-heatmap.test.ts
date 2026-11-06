/**
 * WP-22: Heatmap coverage —
 *  (a) the browser engine: tests/golden/legacy/hm-engine.js is a verbatim extract of
 *      the minified bundle (beautified), run in a bare vm; port = heatmap-engine.ts.
 *  (b) the GAS server side (Queue_deprecated/Heatmap.js): hmParseWall_, hmKuwaitSlot_,
 *      buildHeatmapFromRawTabs_, inputMeta_, cleanHeatmap_ in the full queue oracle.
 */
import fs from 'node:fs'
import path from 'node:path'
import vm from 'node:vm'
import { describe, expect, it } from 'vitest'
import { baseFixtures, callPort, expectSame, json, rint, rng, rpick, sheetBook } from './helpers-oracle'
import { qCallLegacy } from './queue-oracle'
import {
  HM_AHT_GROUPS,
  HM_CHANNEL_NAMES,
  HM_DAYS,
  hmAlias_,
  hmAllocateShifts_,
  hmCallStaff_,
  hmCallStats_,
  hmChannelKey_,

  hmCountriesOf_,
  hmCsv_,
  hmCsvParse_,
  hmDay_,
  hmDedicated_,
  hmDeepCopy_,
  hmDeepMerge_,
  hmDefaults_,
  hmErlangB_,
  hmErlangC_,
  hmExampleLong_,
  hmExampleWide_,
  hmFmt_,
  hmGetPath_,
  hmHeadcount_,
  hmHHMM_,
  hmIsObj_,
  hmLongParse_,
  hmParseTime_,
  hmPlan_,
  hmProblems_,
  hmRequirement_,
  hmRoster_,
  hmSetPath_,
  hmSlots_,
  hmSniff_,
  hmSpread_,
  hmWideParse_,
} from '@/features/cx-queue/lib/heatmap-engine'
import { buildHeatmapFromRawTabs_, cleanHeatmap_, hmKuwaitSlot_, hmParseWall_, inputMeta_ } from '@/features/cx-queue/lib/heatmap'

// ---------------------------------------------------------------- closure engine

const ENGINE_JS = path.resolve(__dirname, 'legacy/hm-engine.js')
let _ctx: vm.Context | null = null
function eng() {
  if (!_ctx) {
    _ctx = vm.createContext({})
    vm.runInContext(fs.readFileSync(ENGINE_JS, 'utf8'), _ctx, { filename: 'hm-engine.js' })
  }
  return _ctx
}
/** Call a minified engine function; Maps become plain objects so JSON can carry them. */
function engCall(fn: string, args: unknown[]) {
  try {
    const ctx = eng() as vm.Context & { __ARGS__: unknown[] }
    ctx.__ARGS__ = args
    const v = vm.runInContext(
      `(function(){var r=${fn}.apply(null, __ARGS__);return r instanceof Map?Object.fromEntries(r):r})`,
      ctx
    )()
    return { ok: json(v) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}
const sameEng = (legacyFn: string, args: unknown[], portFn: () => unknown, label?: string) =>
  expectSame(callPort(() => {
    const v = portFn() as unknown
    return v instanceof Map ? Object.fromEntries(v as Map<string, unknown>) : v
  }), engCall(legacyFn, args), label || legacyFn)

// ---------------------------------------------------------------- shared fixtures

const ASSUMPTIONS = hmDefaults_()
const CELLS = {
  intervalMinutes: 30,
  cells: [
    { country: 'Kuwait', channel: 'inbound_calls', day: 'Sun', start: '09:30', volume: 6, ahtSec: 240 },
    { country: 'Kuwait', channel: 'inbound_calls', day: 'Sun', start: '10:00', volume: 8 },
    { country: 'KSA', channel: 'social_media', day: 'Sun', start: '10:00', volume: 4 },
    { country: '*', channel: 'internal_tickets', day: 'Mon', start: '14:00', volume: 3 },
    { country: 'UAE', channel: 'waiting_address', day: 'Tue', start: '18:00', volume: 2 },
    { country: 'Kuwait', channel: 'in_app', day: 'Wed', start: '20:00', volume: 5 },
    { country: 'Saudi Arabia', channel: 'inbound_calls', day: 'Thu', start: '09:30', volume: 9 },
    { country: 'Kuwait', channel: 'customer_didnt_answer', day: 'Fri', start: '21:00', volume: 2 },
  ],
}
const SPARSE = { intervalMinutes: 60, cells: [{ country: '*', channel: 'inbound_calls', day: 'Sat', start: '21:30', volume: 1 }] }

describe('engine: Erlang + interval helpers vs the closure', () => {
  it('Erlang B/C, call stats, staffing', () => {
    const R = rng(4242)
    for (let i = 0; i < 40; i++) {
      const n = rint(R, 1, 30)
      const A = Math.round(r() * 0 + R() * 20 * 10) / 10
      sameEng('sl', [n, A], () => hmErlangB_(n, A), 'erlB ' + i)
      sameEng('al', [n, A], () => hmErlangC_(n, A), 'erlC ' + i)
      const lambda = Math.round(R() * 60 * 100) / 100
      const aht = rint(R, 60, 600)
      const agents = rint(R, 0, 40)
      const secs = rint(R, 10, 120)
      sameEng('ws', [lambda, aht, agents, secs], () => hmCallStats_(lambda, aht, agents, secs), 'callStats ' + i)
      sameEng('ll', [lambda, aht, 0.8, secs], () => hmCallStaff_(lambda, aht, 0.8, secs), 'callStaff ' + i)
    }
    // Edge: zero volume, understaffed, exactly at capacity.
    sameEng('ws', [0, 240, 3, 30], () => hmCallStats_(0, 240, 3, 30))
    sameEng('ws', [10, 240, 0, 30], () => hmCallStats_(10, 240, 0, 30))
    sameEng('ws', [10, 3600, 10, 30], () => hmCallStats_(10, 3600, 10, 30))
    sameEng('ll', [0, 240, 0.8, 30], () => hmCallStaff_(0, 240, 0.8, 30))
    function r() { return R() }
  })

  it('time parsing, slots, day, HH:MM, alias, channel key, fmt', () => {
    const times: unknown[] = ['09:30', '9:30', '13:00', '22:00', '1:05 PM', '12:00 AM', '12:30 pm', '7', 9.5, 13.25, 'bad', '25:99', '', null]
    times.forEach((t, i) => {
      sameEng('he', [t], () => hmParseTime_(t), 'parseTime ' + i)
      if (t !== null && t !== 'bad' && t !== '25:99' && t !== '')
        sameEng('qe', [hmParseTime_(t)], () => hmHHMM_(hmParseTime_(t)), 'hhmm ' + i)
    })
    ;['Sun', 'sunday', 'MON', 'tue ', 0, 6, 'Noday', '', -1].forEach((d, i) =>
      sameEng('ks', [d], () => hmDay_(d), 'day ' + i))
    const aliases = { 'Saudi Arabia': 'KSA', Emirates: 'UAE' }
    ;['Saudi Arabia', 'saudi arabia', 'UAE', 'Emirates', 'Qatar', '*', '', null].forEach((c, i) =>
      sameEng('ut', [c, aliases], () => hmAlias_(c, aliases), 'alias ' + i))
    ;['Inbound', 'inbound calls', 'Call Center', 'WA', 'Waiting Address', "Customer didn't answer", 'Unknown Thing', 'a/b c', ''].forEach((c, i) =>
      sameEng('$s', [c], () => hmChannelKey_(c), 'chanKey ' + i))
    ;[0, 1.04, 12.35, -3.7, 1234.56, 0.499].forEach((v, i) => sameEng('mt', [v], () => hmFmt_(v), 'fmt ' + i))
    ;[
      { intervalMinutes: 30, open: '09:30', close: '22:00' },
      { intervalMinutes: 60, open: '09:30', close: '22:00' },
      { intervalMinutes: 15, open: '0:00', close: '24:00' },
      { intervalMinutes: 30, open: '22:00', close: '09:00' },
      { intervalMinutes: 45, open: '09:30', close: '10:00' },
    ].forEach((t, i) => sameEng('il', [t], () => hmSlots_(t), 'slots ' + i))
  })

  it('defaults, merge, copy, isObj, countriesOf, set/getPath', () => {
    sameEng('xs', [], () => hmDefaults_())
    const R = rng(7)
    for (let i = 0; i < 15; i++) {
      const base = { a: 1, b: { c: [1, 2], d: 'x' }, e: null }
      const over = rpick(R, [null, { a: 2 }, { b: { d: 'y' } }, { b: [9] }, { f: { g: 1 } }])
      sameEng('ln', [base, over], () => hmDeepMerge_(base, over), 'deepMerge ' + i)
      const dc = rpick(R, [undefined, { a: { b: 1 } }, null, [1]])
      sameEng('Lt', [dc], () => hmDeepCopy_(dc), 'deepCopy ' + i)
      const io = rpick(R, [{}, [], 1, 'x', null])
      sameEng('Rn', [io], () => hmIsObj_(io), 'isObj ' + i)
      const p = rpick(R, [['a'], ['b', 'c'], ['b', 'd'], ['z'], []])
      sameEng('Ut', [base, p], () => hmGetPath_(base, p), 'getPath ' + i)
      const val = rpick(R, [1, 's', undefined, { n: 1 }])
      sameEng('Vt', [base, p, val], () => hmSetPath_(base, p, val), 'setPath ' + i)
    }
    sameEng('Ss', [CELLS, { countryAliases: { 'Saudi Arabia': 'KSA' } }], () =>
      hmCountriesOf_(CELLS, { countryAliases: { 'Saudi Arabia': 'KSA' } }))
    sameEng('Ss', [CELLS, null], () => hmCountriesOf_(CELLS as never))
  })
})

describe('engine: requirement / dedicated / roster / headcount / plan', () => {
  const ASSUMPTION_VARIANTS: Record<string, unknown>[] = [
    {},
    { pooling: 'dedicated', countries: ['Kuwait', 'KSA'] },
    { shrinkage: 0, shrinkagePlacement: 'flexible' },
    { overnight: 'forceBeforeClose' },
    { chats: { ...ASSUMPTIONS.chats, model: 'legacy' } },
    { chats: { ...ASSUMPTIONS.chats, slotMinutes: 8 } },
    { intervalMinutes: 60, minOnFloor: 2 },
    { sharedVolumeMode: 'full', countries: ['Kuwait'] },
    { sharedVolumeMode: 'allOnly', countries: ['Kuwait', 'KSA', 'UAE', 'Qatar', 'Bahrain', 'Egypt'] },
    { shifts: [{ id: 'AM', start: '09:30', end: '18:30', enabled: true }, { id: 'PM', start: '13:00', end: '22:00', enabled: true }], occupancyCap: 0.7 },
  ]
  const DATASETS = [CELLS, SPARSE, { intervalMinutes: 30, cells: [] }]
  DATASETS.forEach((hm, di) =>
    ASSUMPTION_VARIANTS.forEach((ov, ai) => {
      const merged = hmDeepMerge_(hmDefaults_(), ov)
      it(`requirement+plan d${di} a${ai}`, () => {
        sameEng('rl', [hm, merged], () => hmSpread_(hm, merged), 'spread')
        sameEng('ol', [hm, merged], () => hmProblems_(hm, merged), 'problems')
        sameEng('Cs', [hm, merged], () => hmRequirement_(hm, merged), 'requirement')
        sameEng('As', [hm, ov], () => hmPlan_(hm, ov), 'plan')
      })
    })
  )
  it('dedicated pooling on a country set', () => {
    const merged = hmDeepMerge_(hmDefaults_(), { pooling: 'dedicated', countries: ['Kuwait', 'KSA'] })
    sameEng('cl', [CELLS, merged], () => hmDedicated_(CELLS, merged))
  })
  it('allocateShifts: cover vs shortage vs no-shift coverage', () => {
    const shifts = [
      { id: 'AM', startMin: 570, endMin: 1110, paidHours: 9 },
      { id: 'PM', startMin: 780, endMin: 1320, paidHours: 9 },
      { id: 'MID', startMin: 660, endMin: 1200, paidHours: 9 },
    ]
    const slots = hmSlots_({ intervalMinutes: 30, open: '09:30', close: '22:00' })
    const cases: [number[], Record<string, unknown>][] = [
      [slots.map(() => 2), {}],
      [slots.map((s) => (s < 720 ? 3 : 1)), {}],
      [slots.map((s) => (s >= 1200 ? 2 : 0)), {}], // uncovered tail beyond 20:00
      [slots.map(() => 1), { flexible: true, presence: slots.map(() => 1), shrinkage: 0.3 }],
      [slots.map(() => 0), {}],
    ]
    cases.forEach(([req, opt], i) =>
      sameEng('dl', [req, slots, 30, shifts, opt], () => hmAllocateShifts_(req, slots, 30, shifts, opt), 'alloc ' + i))
  })
  it('roster + headcount on a computed requirement', () => {
    const merged = hmDeepMerge_(hmDefaults_(), {})
    const req = hmRequirement_(CELLS, merged) as never
    sameEng('hl', [req, merged], () => hmRoster_(req, merged))
    const roster = hmRoster_(req, merged) as never
    sameEng('ul', [req, roster, merged], () => hmHeadcount_(req, roster, merged))
  })
})

describe('engine: upload parsers (long / wide / sniff / csv / examples)', () => {
  it('csv grammar', () => {
    const cases = [
      'a,b,c\n1,2,3',
      'a,"b,c",d\n"x""y",2,3\n',
      'one\r\ntwo\nthree\r',
      'a,b\n1,\n,2\n',
      '',
      '"only"',
      'a\n\n\nb',
      '"unclosed,x\n1,2',
    ]
    cases.forEach((csv, i) => sameEng('rn', [csv], () => hmCsvParse_(csv), 'csvParse ' + i))
  })
  it('long format incl. aht_sec + errors', () => {
    const good = 'country,channel,day,interval,volume,aht_sec\nKuwait,Inbound,Sun,09:30,6,240\nKSA,WA,Mon,10:00,3,\nUAE,Calls,Tue,9:30 AM,2,300'
    const cases: [string, number][] = [
      [good, 60],
      ['channel,day,interval,volume,country\nCalls,Sun,09:30,6,Kuwait', 30],
      ['country,channel,day,interval\nKuwait,Calls,Sun,09:30', 60], // missing volume -> throw
      ['country,channel,day,interval,volume\nKuwait,Calls,Notday,09:30,6', 60], // bad day
      ['country,channel,day,interval,volume\nKuwait,Calls,Sun,bad,6', 60], // bad interval
      ['\n\n', 60],
      ['country,channel,day,interval,volume\nKuwait,Calls,Sun,0.4,6', 60], // fraction of a day -> HH:MM
    ]
    cases.forEach(([csv, iv], i) => sameEng('ml', [csv, iv], () => hmLongParse_(csv, iv), 'long ' + i))
  })
  it('wide format incl. queue/AHT block', () => {
    const wide = [
      'Inbound,,,,,,,,WA,,,,,,,,Queue,AHT',
      'Interval,Sun,Mon,Tue,Wed,Thu,Fri,Sat,Interval,Sun,Mon,Tue,Wed,Thu,Fri,Sat',
      '9,1,2,3,4,5,6,7,9,4,4,4,4,5,5,4,calls,4',
      '10,9,10,11,9,10,10,8,10,5,5,6,5,6,6,5,chats,3',
      '0.5,9,10,11,9,10,10,8,10,5,5,6,5,6,6,5,tickets,2',
    ].join('\n')
    const cases: [string, Record<string, unknown>][] = [
      [wide, {}],
      [wide, { country: 'Kuwait', intervalMinutes: 30 }],
      ['a,b\nInterval,Sun\n9,1\nx,2\n\n', {}],
      ['', {}],
    ]
    cases.forEach(([csv, o], i) => sameEng('Ts', [csv, o], () => hmWideParse_(csv, o), 'wide ' + i))
  })
  it('sniff + csv re-emit + examples', () => {
    const rows = [
      [['country', 'channel', 'day', 'interval', 'volume'], ['a', 'b', 'c', 'd', 'e']],
      [['block', '', ''], ['x', 'Interval', 'y'], ['', '9', '']],
      [['a', 'b'], ['c', 'd']],
      [[]],
      [],
      [['country', 'channel', 'day', 'interval'], ['a', 'b', 'c', 'd']], // missing volume -> unknown
    ]
    rows.forEach((r, i) => sameEng('gl', [r], () => hmSniff_(r as never), 'sniff ' + i))
    const csvRows = [['Interval', 'Sun'], [0.375, 1], ['09:00', 'x,y'], ['12:00', 'say "hi"'], [1, ''], ['', '']]
    sameEng('fl', [csvRows], () => hmCsv_(csvRows))
    sameEng('Kt', [], () => hmExampleLong_())
    sameEng('Ls', [], () => hmExampleWide_())
    expect(Object.keys(HM_CHANNEL_NAMES).length).toBeGreaterThan(0)
    expect(Object.keys(HM_AHT_GROUPS).length).toBeGreaterThan(0)
    expect(HM_DAYS).toEqual(['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'])
  })
})

// ---------------------------------------------------------------- GAS server side

describe('server side: hmParseWall_ / hmKuwaitSlot_ / inputMeta_ / cleanHeatmap_', () => {
  const rev = (x: unknown): unknown => (typeof x === 'string' && x.indexOf('@@ms:') === 0 ? new Date(+x.slice(5)) : x)
  const same = (fn: string, args: unknown[], portFn: (...a: unknown[]) => unknown, label?: string, fx = baseFixtures({ nowMs: Date.parse('2026-10-15T09:30:00Z') })) =>
    expectSame(callPort(() => portFn(...args.map(rev))), qCallLegacy(fn, args, fx), label || fn)

  it('hmParseWall_ formats', () => {
    ;['2026-10-12 09:30', '2026-10-12T09:30', '2026-10-12 9:30:15', '2026-10-12 09:30 PM', '2026-10-12 12:00 AM', '2026-10-12 12:30 PM',
      '10/12/2026 09:30', '3/5/2026 13:45:20', '12/25/2026 11:59 PM', '2026-10-12', 'garbage', '', null, '1999-01-01 10:00',
      '2026-13-40 10:00', '2026-10-12 25:00'].forEach((s, i) =>
      same('hmParseWall_', [s], () => hmParseWall_(s), 'wall ' + i))
  })
  it('hmKuwaitSlot_ dates, strings, zones', () => {
    const memo = {}
    const cases: [unknown, string][] = [
      ['@@ms:' + Date.parse('2026-10-12T06:30:00Z'), 'Africa/Cairo'],
      ['@@ms:' + Date.parse('2026-10-12T21:30:00Z'), 'Africa/Cairo'], // late Cairo -> next Kuwait day edge
      ['@@ms:' + Date.parse('2026-06-30T22:00:00Z'), 'Asia/Kuwait'],
      ['2026-10-12 09:30', 'Africa/Cairo'],
      ['2026-10-12 21:45', 'America/New_York'],
      ['10/12/2026 09:30', 'Africa/Cairo'],
      ['bad', 'Africa/Cairo'],
      ['@@ms:NaN', 'Africa/Cairo'],
    ]
    cases.forEach(([v, tz], i) =>
      same('hmKuwaitSlot_', [v, tz, {}], (a, b, m) => hmKuwaitSlot_(a, String(b), m as never), 'kwslot ' + i))
    void memo
  })
  it('inputMeta_', () => {
    const rows = [
      { input_id: 'i1', name: 'Raw tabs', source: 'raw_tabs', interval_minutes: 30, cells_count: 120, window_json: '{"from":"2026-09-01"}', notes: 'n', submitted_by: 'a@x.com', submitted_at: '2026-10-01 10:00:00' },
      { input_id: 'i2', name: '', source: '', interval_minutes: '', cells_count: '', window_json: 'bad', notes: null, submitted_by: '', submitted_at: '' },
      { input_id: 'i3', name: 'x', source: 'upload_long', interval_minutes: '60', cells_count: '5', window_json: null },
    ]
    rows.forEach((r, i) => same('inputMeta_', [r], () => inputMeta_(r as never), 'meta ' + i))
  })
  it('cleanHeatmap_ validation matrix', () => {
    const cell = (o: Record<string, unknown> = {}) => ({ country: 'Kuwait', channel: 'inbound_calls', day: 'Sun', start: '09:30', volume: 6, ...o })
    const cases: unknown[] = [
      { intervalMinutes: 30, cells: [cell()] },
      { intervalMinutes: 45, cells: [cell()] }, // bad interval
      { intervalMinutes: '', cells: [cell()] }, // defaults 30
      { cells: [cell({ day: 'Funday' })] },
      { cells: [cell({ start: '9:30' })] },
      { cells: [cell({ volume: -1 })] },
      { cells: [cell({ volume: 'x' })] },
      { cells: [cell({ channel: '  ' }), cell({ channel: '' })] },
      { cells: [cell({ ahtSec: 300 }), cell({ ahtSec: 0 }), cell({ ahtSec: 7201 }), cell({ ahtSec: '' })] },
      { cells: [] },
      null,
      { intervalMinutes: 15, cells: [cell({ country: '', ahtSec: null })], window: { from: 'a', to: 'b' } },
    ]
    cases.forEach((hm, i) => same('cleanHeatmap_', [hm], () => cleanHeatmap_(hm as never), 'clean ' + i))
  })
})

describe('server side: buildHeatmapFromRawTabs_ (Heatmap.js:235)', () => {
  const SAME = (tabs: Record<string, unknown[][]>, opts: Record<string, unknown>, label: string) => {
    const fx = baseFixtures({ nowMs: Date.parse('2026-10-15T09:30:00Z') })
    fx.spreadsheets = { 'raw-1': tabs }
    expectSame(
      callPort(() => buildHeatmapFromRawTabs_(sheetBook(tabs) as never, opts)),
      qCallLegacy('buildHeatmapFromRawTabs_', ['@@ss:raw-1', opts], fx),
      label
    )
  }
  const T = '2026-10-12 '
  it('all four tabs + excluded groups + out-of-hours + bots', () => {
    const tabs = {
      Maqsam: [
        ['Start time', 'Call direction', 'Call state', 'Country', 'Extra'],
        [T + '09:30:00', 'Inbound', 'Answered', 'Kuwait', 'x'],
        [T + '09:45:00', 'Inbound', 'Abandoned', 'KSA', ''],
        [T + '10:05:00', 'Outbound', 'Answered', 'UAE', ''],
        [T + '10:10:00', 'Inbound', 'Out Of Hours', 'Kuwait', ''],
        ['2026-10-13 11:00:00', 'inbound', 'Answered', 'UAE', ''],
      ],
      Freshchat: [
        ['Initiated At', 'Channel', 'Bot conversation flag', 'Status', 'Country'],
        [T + '09:35:00', 'In-App Web Chat', 'No', 'Open', 'Kuwait'],
        [T + '09:40:00', 'WhatsApp', 'Yes', 'Bot resolved', 'KSA'], // bot
        [T + '09:50:00', 'WhatsApp', 'No', 'Open', 'Exclude me'], // excluded country
        [T + '10:00:00', 'Instagram DM', 'No', 'Open', 'UAE'],
      ],
      'Excluded Groups': [
        ['Group name', 'In/excluded'],
        ['Escalations QA', 'Excluded'],
        ['Ops', 'Included'],
      ],
      Freshdesk: [
        ['Created date', 'Group name', 'Group Check', 'Country'],
        [T + '12:00:00', 'Ops', 'ok', 'KSA'],
        [T + '12:30:00', 'Escalations QA', 'ok', 'KSA'], // excluded group
        [T + '13:00:00', 'Ops', 'Out', 'UAE'], // out check
        [T + '13:30:00', 'Ops', '', 'Kuwait'],
      ],
      WA: [
        ['invoice_creation_date', 'Address Confirmed3', "Customer Didn't Answer3", 'Country_Name'],
        [T + '15:00:00', '1', '0', 'Kuwait'],
        [T + '15:30:00', '0', '1', 'UAE'],
        [T + '16:00:00', '0', '0', 'KSA'],
        [T + '16:30:00', 'x', 'y', 'Qatar'],
      ],
    }
    SAME(tabs, { intervalMinutes: 30 }, 'raw tabs full')
    SAME(tabs, { intervalMinutes: 60, from: '2026-10-12', to: '2026-10-12' }, 'raw tabs windowed 60')
    SAME(tabs, { intervalMinutes: 30, includeWaitingAddress: false }, 'no WA')
  })
  it('missing tabs -> notes', () => {
    SAME({}, { intervalMinutes: 30 }, 'empty book')
    SAME({ Maqsam: [['Start time'], ['2026-10-12 09:30:00']] }, { intervalMinutes: 30 }, 'only Maqsam, no dir/state/country cols')
    SAME({ Freshdesk: [['Created date', 'Group name', 'Group Check', 'Country'], ['2026-10-13 09:00:00', 'Freshchat', '', 'KSA']] }, {}, 'always-excluded group')
  })
  it('Date cells in another sheet zone stay Cairo-interpreted', () => {
    // The '@@ms:' marker revives to a real Date only inside the vm, so the port side
    // gets the same cells as host Date objects.
    const ms = [Date.parse('2026-10-12T07:30:00Z'), Date.parse('2026-10-12T21:59:00Z')]
    const mk = (cell: (ms: number) => unknown) => ({
      Maqsam: [
        ['Start time', 'Call direction', 'Call state', 'Country'],
        [cell(ms[0]), 'Inbound', 'Answered', 'Kuwait'],
        [cell(ms[1]), 'Inbound', 'Answered', 'KSA'],
      ],
    })
    const legacyTabs = mk((v) => '@@ms:' + v)
    const portTabs = mk((v) => new Date(v))
    const fx = baseFixtures({ nowMs: Date.parse('2026-10-15T09:30:00Z') })
    fx.spreadsheets = { 'raw-1': legacyTabs as never }
    expectSame(
      callPort(() => buildHeatmapFromRawTabs_(sheetBook(portTabs) as never, { intervalMinutes: 30 })),
      qCallLegacy('buildHeatmapFromRawTabs_', ['@@ss:raw-1', { intervalMinutes: 30 }], fx),
      'date cells'
    )
  })
})
