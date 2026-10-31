/**
 * Golden tests for src/lib/tph/index.ts against legacy ProdTph.js (run verbatim in the vm).
 * The pure rules get seeded vectors; the store readers/writers run through injected seams
 * whose fixtures mirror the oracle's fake spreadsheets.
 */
import { describe, it } from 'vitest'
import {
  oracle,
  baseFixtures,
  callLegacy,
  callPort,
  expectSame,
  same,
  rng,
  rint,
  rpick,
  sheetBook,
  openSpreadsheet,
  type GoldenFixture,
} from './helpers-oracle'
import {
  TPH_SLOTS,
  TPH_CALLS,
  TPH_OFF,
  tphHm_,
  tphTaskSlots_,
  tphParseSlot_,
  tphSlotValue_,
  tphResolveSlots_,
  tphCapMinutes_,
  tphAutoCases_,
  tphResolveCases_,
  tphCap_,
  tphTable_,
  tphDayTotals_,
  tphCallVariance_,
  tphClock_,
  tphFirstAtOrAfter_,
  tphReadTail_,
  tphTid_,
  tphActIndex_,
  tphHourMs_,
  tphCallMinutesFromRows_,
  tphCanEdit_,
  tphGroupIndex_,
  tphTouchFallback_,
  tphTouchesFromRows_,
  tphTouchList_,
  tphCasesFromQueue_,
  tphFoldCapture_,
  tphChatCases_,
  tphTicketCases_,
  tphCallCases_,
  tphRebuiltCases_,
  tphEligible_,
  tphCasesPart_,
  tphMergeRebuilt_,
  tphStaleSteps_,
  tphDaySummary_,
  tphChannels_,
  tphActivities_,
  tphKeys_,
  tphHours_,
  tphPeople_,
  tphJson_,
  tphCheckDate_,
  tphNowSlot_,
  tphCheckAgent_,
  tphCheckCalls_,
  tphFlagCalls_,
  tphEditDay_,
  tphLastAuto_,
  tphDayCore_,
  tphBuildTouches_,
  tphActivityTail_,
  tphBuildCallMinutes_,
  tphPastDay_,
  tphDiagnoseTouchLines_,
  tphCaptureCases_,
  type TphIo,
  type TphTableAgentRow,
} from '../../src/lib/tph/index'
import type { Cfg } from '../../src/lib/prod/adapters'

const CFG = {
  business_tz: 'Asia/Kuwait',
  data_tz: 'Africa/Cairo',
  activity_local_tz: 'Asia/Kuwait',
  ss_productivity_id: 'prod-store',
  ss_live_id: 'live-store',
  ss_tickets_id: 'tickets-store',
  fd_activity_ss_id: 'fd-activity',
  daily_report_ss_id: 'daily-report',
  productivity_fallback_id: 'prod-fallback',
  productivity_files: {},
  tph_channels: [
    { key: 'internal', name: 'Internal', kind: 'ticket', groups: ['Customer Support - Internal', 'OOS - Kuwait'] },
    { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
    { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address'] },
    { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
  ],
  tph_activities: [{ key: 'break', name: 'Break' }, { key: 'meeting', name: 'Meeting' }],
  tph_ticket_statuses: ['Open', 'Pending on CX'],
  tph_chat_exclude_statuses: [],
  tph_day_hours: [8, 24],
  tph_minutes_per_case: 3,
  tph_cap_window_min: 55,
  tph_calls_minute_factor: 0.5,
  tph_call_states: ['Serviced'],
  tph_tl_edit_days: 3,
  tph_eligible_days: 28,
} as unknown as Cfg

// Thursday 2026-10-29 13:20 Asia/Kuwait (10:20Z) -> today '2026-10-29', nowSlot 53.
const NOW_MS = Date.UTC(2026, 9, 29, 10, 20, 0)
const TODAY = '2026-10-29'
const YESTERDAY = '2026-10-28'

function fx(extra: GoldenFixture = {}): GoldenFixture {
  return baseFixtures({ settings: { ...CFG, ...(extra.settings as object) }, nowMs: NOW_MS, ...extra })
}

/** Sheet tab rows -> the objects dqReadObjects_ would return (cells are already plain). */
function toObjs(rows: unknown[][]): Record<string, unknown>[] {
  if (!rows.length) return []
  const h = rows[0].map(String)
  return rows
    .slice(1)
    .filter((r) => r[0] !== '' && r[0] !== null && r[0] !== undefined)
    .map((r) => {
      const o: Record<string, unknown> = {}
      h.forEach((k, c) => {
        o[k] = c < r.length ? r[c] : ''
      })
      return o
    })
}

/** A prod-store TphIo over raw tab rows, recording writes the way the oracle's wrappers do. */
function prodIo(tabs: Record<string, unknown[][]>, writes: { fn: string; args: unknown[] }[], extra: Partial<TphIo> = {}): TphIo & {
  upsert: NonNullable<TphIo['upsert']>
  upsertIn: NonNullable<TphIo['upsertIn']>
} {
  const io = {
    cfg: CFG,
    now: NOW_MS,
    prodRows: (name: string) => toObjs(tabs[name] || []),
    upsert: (t: string, cols: string[], rows: Record<string, unknown>[], y: number | null) => {
      writes.push({ fn: 'dqUpsert_', args: [t, cols, rows, y] })
      writes.push({ fn: 'dqUpsertIn_', args: [t, cols, rows, y] })
    },
    upsertIn: (t: string, cols: string[], rows: Record<string, unknown>[], y: number | null) => {
      writes.push({ fn: 'dqUpsertIn_', args: [t, cols, rows, y] })
    },
    ...extra,
  }
  return io as ReturnType<typeof prodIo>
}

/** Writes recorded on the oracle side, JSON-normalised. */
function legacyWrites() {
  return JSON.parse(JSON.stringify(oracle().writes()))
}

describe('tph slots', () => {
  it('hm/taskSlots/parse/slotValue/resolve', () => {
    const R = rng(7001)
    for (let i = 0; i < 60; i++) {
      const s = rpick(R, ['9:15', '09:30', '23:45', '24:00', '0:00', 'bad', '', '8:05', ' 12:30 ', '25:00', '7:60'])
      same('tphHm_', [s], () => tphHm_(s), {}, `hm ${s}`)
      const a = rint(R, 0, 95)
      const b = rint(R, 0, 95)
      same('tphTaskSlots_', [a, b], () => tphTaskSlots_(a, b), {}, `ts ${a} ${b}`)
      const v = rpick(R, ['calls', 'chats+calls', 'internal', 'off', 'break+calls', 'cs:calls', '', 'x+calls', 'calls+calls'])
      same('tphParseSlot_', [v], () => tphParseSlot_(v), {}, `ps ${v}`)
      const callsFlag = R() < 0.5
      same('tphSlotValue_', [v, callsFlag], () => tphSlotValue_(v, callsFlag), {}, `sv ${v}`)
    }
  })

  it('resolveSlots over seeded logged maps', () => {
    const R = rng(7002)
    const keys = ['internal', 'chats', 'wa', 'calls', 'off', 'break', 'calls+chats']
    for (let i = 0; i < 40; i++) {
      const logged: Record<number, string> = {}
      for (let s = 0; s < 96; s++) if (R() < 0.18) logged[s] = rpick(R, keys)
      const from = rint(R, 0, 40)
      const to = rint(R, from, 96)
      const until = rint(R, from, 96)
      const shift = R() < 0.4 ? { from: rint(R, 0, 48), to: rint(R, 48, 96) } : undefined
      same('tphResolveSlots_', [logged, from, to, until, shift], () => tphResolveSlots_(logged, from, to, until, shift), {}, `rs ${i}`)
    }
  })
})

describe('tph caps + table', () => {
  const HOURS = [8, 9, 10, 11]
  const KEYS = ['internal', 'chats', 'wa', 'calls']

  it('capMinutes / autoCases / resolveCases / cap', () => {
    const R = rng(7003)
    const chans = KEYS
    for (let i = 0; i < 50; i++) {
      const s = rint(R, 0, 95)
      const capWin = rpick(R, [15, 30, 45, 55, 60, 0])
      same('tphCapMinutes_', [s, capWin], () => tphCapMinutes_(s, capWin), {}, `cm ${i}`)
      const auto: Record<string, { stock: number; c0: number; c1: number }> = {}
      HOURS.forEach((h) =>
        chans.forEach((c) => {
          if (R() < 0.5) auto[h + '|' + c] = { stock: rint(R, 0, 30), c0: rint(R, 0, 10), c1: rint(R, 0, 20) }
        })
      )
      same('tphAutoCases_', [auto, HOURS, chans], () => tphAutoCases_(auto, HOURS, chans), {}, `ac ${i}`)
      const tl: Record<string, number | string> = {}
      const reb: Record<string, number> = {}
      HOURS.forEach((h) =>
        chans.forEach((c) => {
          if (R() < 0.3) tl[h + '|' + c] = R() < 0.2 ? '' : rint(R, 0, 40)
          if (R() < 0.3) reb[h + '|' + c] = rint(R, 0, 40)
        })
      )
      const until = rint(R, 8, 25)
      same('tphResolveCases_', [tl, auto, HOURS, chans, until, reb], () => tphResolveCases_(tl, auto, HOURS, chans, until, reb), {}, `rc ${i}`)
      const cs = rint(R, 0, 60)
      const mins = rint(R, 0, 90)
      const mpc = rpick(R, [3, 5, 0])
      same('tphCap_', [cs, mins, mpc], () => tphCap_(cs, mins as unknown as Record<string, unknown>, mpc), {}, `cap ${i}`)
    }
  })

  it('table / dayTotals / callVariance / daySummary', () => {
    const R = rng(7004)
    const agents = ['a@dabdoob.com', 'b@dabdoob.com', 'c@dabdoob.com']
    const chans = KEYS
    for (let i = 0; i < 12; i++) {
      const grid: Record<string, Record<number, { channel: string; calls: boolean; carried: boolean }>> = {}
      agents.forEach((e) => {
        grid[e] = {}
        for (let s = 32; s < 48; s++) {
          if (R() < 0.8) grid[e][s] = { channel: rpick(R, KEYS.concat('off', 'break')), calls: R() < 0.3, carried: R() < 0.2 }
        }
      })
      const cases: Record<string, { cases: number; source: string }> = {}
      HOURS.forEach((h) =>
        chans.forEach((c) => {
          cases[h + '|' + c] = { cases: rint(R, 0, 30), source: rpick(R, ['tl', 'auto', 'rebuilt', '']) }
        })
      )
      const touches: Record<string, number> = {}
      agents.forEach((e) =>
        HOURS.forEach((h) =>
          chans.forEach((c) => {
            if (R() < 0.3) touches[e + '|' + h + '|' + c] = rint(R, 1, 8)
          })
        )
      )
      const callMinutes: Record<string, [number, number]> | null = R() < 0.6
        ? Object.fromEntries(
            agents.filter(() => R() < 0.7).flatMap((e) => HOURS.filter(() => R() < 0.6).map((h) => [e + '|' + h, [rint(R, 0, 40), rint(R, 0, 8)]]))
          ) as Record<string, [number, number]>
        : null
      const inp = {
        hours: HOURS,
        channels: chans,
        grid,
        cases,
        touches,
        minutesPerCase: 3,
        capWindowMin: 55,
        callsFactor: 0.5,
        callMinutes,
      }
      same('tphTable_', [inp], () => tphTable_(inp), {}, `tbl ${i}`)
      const rows = callLegacy('tphTable_', [inp])
      if (!('ok' in rows)) throw new Error('legacy tphTable_ failed: ' + rows.err)
      const table = rows.ok as { hour: number; channel: string; cases: number | null; source: string; agents: TphTableAgentRow[] }[]
      same('tphDayTotals_', [table], () => tphDayTotals_(table), {}, `dt ${i}`)
      same('tphCallVariance_', [grid, callMinutes || {}, HOURS, TPH_CALLS], () => tphCallVariance_(grid, callMinutes || {}, HOURS, TPH_CALLS), {}, `cv ${i}`)
      same('tphDaySummary_', [table, TPH_CALLS], () => tphDaySummary_(table, TPH_CALLS), {}, `ds ${i}`)
    }
  })
})

describe('tph clocks + tails', () => {
  it('tphClock_ ms/day/hour against the oracle (via eval: methods do not JSON-cross)', () => {
    const R = rng(7005)
    const tzs = ['Asia/Kuwait', 'Africa/Cairo', 'UTC']
    const vals = ['2026-10-29 05:00', '2026-10-29', '10-29-2026 3:45 PM', '10/29/2026 08:30:00', '2026-10-29T05:00:00Z', '', 'nonsense', null]
    for (let i = 0; i < 36; i++) {
      const tz = rpick(R, tzs)
      const v = rpick(R, vals)
      const legacy = JSON.parse(
        oracle().eval(
          `(function(){ var c = tphClock_(${JSON.stringify(tz)}); var m = c.ms(${JSON.stringify(v)}); return JSON.stringify({ms:m, day: m===null?null:c.day(m), hour: m===null?null:c.hour(m)}); })()`
        )
      )
      const c = tphClock_(tz)
      const m = c.ms(v)
      const port = { ms: m, day: m === null ? null : c.day(m), hour: m === null ? null : c.hour(m) }
      expectSame({ ok: port }, { ok: legacy }, `clock ${tz} ${JSON.stringify(v)}`)
    }
  })

  it('firstAtOrAfter + readTail over a fixture tab', () => {
    const R = rng(7006)
    for (let i = 0; i < 10; i++) {
      const rows: unknown[][] = [['h1', 'h2', 'h3']]
      for (let r = 0; r < rint(R, 3, 30); r++) rows.push([`2026-10-2${R() < 0.5 ? '8' : '9'} ${String(rint(R, 0, 23)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`, rint(R, 100, 999), 'x'])
      const ssTabs = { Activities: rows }
      const fxSpreadsheets = { 'fd-activity': ssTabs }
      const from = tphHourMs_('2026-10-29', rint(R, 0, 20), 'Africa/Cairo')
      same(
        'tphReadTail_',
        ['@@ss:fd-activity', 'Activities', 1, 3, 1, from, 'Africa/Cairo'],
        () => tphReadTail_(sheetBook(ssTabs), 'Activities', 1, 3, 1, from, 'Africa/Cairo'),
        fx({ spreadsheets: fxSpreadsheets }),
        `rt ${i}`
      )
      const col = rows.slice(1).map((r) => [r[0]])
      const legacyFirst = oracle().eval(
        `(function(){ __reset__(${JSON.stringify(fx({}))}); return tphFirstAtOrAfter_(${JSON.stringify(col)}, ${from}, tphClock_('Africa/Cairo')); })()`
      )
      expectSame({ ok: tphFirstAtOrAfter_(col, from, tphClock_('Africa/Cairo')) }, { ok: legacyFirst }, `first ${i}`)
    }
  })
})

describe('tph id/index/rows', () => {
  it('tid / actIndex / hourMs', () => {
    const R = rng(7007)
    for (let i = 0; i < 30; i++) {
      const v = rpick(R, [123, '123', '123.0', ' 45 ', 'abc', '', null, '007', 12.5])
      same('tphTid_', [v], () => tphTid_(v), {}, `tid ${JSON.stringify(v)}`)
      const acts: unknown[][] = []
      for (let k = 0; k < rint(R, 1, 8); k++)
        acts.push([`2026-10-29 ${String(rint(R, 8, 20)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`, String(rint(R, 100, 200)), 'Agent', '', '', rpick(R, ['status', 'group', '']), rpick(R, ['Open', 'Pending on CX', '']), '', rpick(R, ['Customer Support - Internal', 'FreshChat'])])
      same('tphActIndex_', [acts, 'Asia/Kuwait'], () => tphActIndex_(acts, 'Asia/Kuwait'), {}, `ai ${i}`)
      const hh = rint(R, 0, 23)
      const tz2 = rpick(R, ['Asia/Kuwait', 'Africa/Cairo'])
      same('tphHourMs_', ['2026-10-29', hh, tz2], () => tphHourMs_('2026-10-29', hh, tz2), {}, `hm2 ${i}`)
    }
  })

  it('callMinutesFromRows over Maqsam-shaped rows', () => {
    const R = rng(7008)
    const emails = { 'a@dabdoob.com': true, 'b@dabdoob.com': true }
    const states = ['Serviced']
    for (let i = 0; i < 12; i++) {
      const rows: unknown[][] = []
      for (let k = 0; k < rint(R, 0, 30); k++)
        rows.push([
          `2026-10-29 ${String(rint(R, 0, 23)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`,
          rpick(R, ['a@dabdoob.com', 'b@dabdoob.com', 'x@dabdoob.com', '']),
          '',
          rint(R, 0, 900),
          rpick(R, ['Serviced', 'Missed', '']),
          rpick(R, ['Inbound', 'Outbound', '']),
          rint(R, 0, 600),
        ])
      const args: unknown[] = [rows, ['2026-10-29'], emails, states, 'Africa/Cairo', 'Asia/Kuwait', 55]
      same('tphCallMinutesFromRows_', args, () => tphCallMinutesFromRows_(rows as never, ['2026-10-29'], emails, states, 'Africa/Cairo', 'Asia/Kuwait', 55), {}, `cmr ${i}`)
    }
  })
})

describe('tph people/settings/helpers', () => {
  it('canEdit / groupIndex / touchFallback / json / people', () => {
    const R = rng(7009)
    const chans = tphChannels_(CFG)
    for (let i = 0; i < 40; i++) {
      const role = rpick(R, ['admin', 'tl', 'agent', ''])
      const date = rpick(R, ['2026-10-29', '2026-10-26', '2026-10-27', '2026-10-30', 'bad', '2026-10-25'])
      same('tphCanEdit_', [role, date, TODAY, 3], () => tphCanEdit_(role, date, TODAY, 3), {}, `ce ${i}`)
      const chs = [
        { key: 'internal', groups: ['A', ' B '] },
        { key: 'x', groups: ['A', 'C'] },
        { key: 'y' },
      ]
      same('tphGroupIndex_', [chs], () => tphGroupIndex_(chs as never), {}, `gi ${i}`)
      const chs2 = rpick(R, [[{ key: 'internal' }], [{ key: 'x' }, { key: 'internal' }], [{ key: 'z' }]])
      same('tphTouchFallback_', [chs2], () => tphTouchFallback_(chs2 as never), {}, `fb ${i}`)
      const jv = rpick(R, ['{"a":1}', 'bad', '', null, { x: 2 }, '[1]'])
      same('tphJson_', [jv, { d: 1 }], () => tphJson_(jv, { d: 1 }), {}, `js ${i}`)
    }
    const dir = {
      by: {
        'a@dabdoob.com': { email: 'a@dabdoob.com', name: 'Zed', tlEmail: 'tl@dabdoob.com', active: true, role: 'agent' },
        'b@dabdoob.com': { email: 'b@dabdoob.com', name: 'Amy', tlEmail: '', active: true, role: 'specialist' },
        'c@dabdoob.com': { email: 'c@dabdoob.com', name: 'Bo', tlEmail: 'tl@dabdoob.com', active: false, role: 'agent' },
        'tl@dabdoob.com': { email: 'tl@dabdoob.com', name: 'Tee', tlEmail: '', active: true, role: 'tl' },
      },
    }
    same('tphPeople_', [{ email: 'tl@dabdoob.com' }, dir], () => tphPeople_({ email: 'tl@dabdoob.com' }, dir), {}, 'people')
  })

  it('settings readers: channels/activities/keys/hours', () => {
    for (const nm of ['tphChannels_', 'tphActivities_', 'tphKeys_', 'tphHours_'] as const) {
      const legacy = callLegacy(nm, [], fx())
      const port = callPort(() => {
        if (nm === 'tphChannels_') return tphChannels_(CFG)
        if (nm === 'tphActivities_') return tphActivities_(CFG)
        if (nm === 'tphKeys_') return tphKeys_(CFG)
        return tphHours_(CFG)
      })
      expectSame(port, legacy, nm)
    }
    // degenerate hours
    const legacy2 = callLegacy('tphHours_', [], fx({ settings: { tph_day_hours: [20, 8] } }))
    expectSame(callPort(() => tphHours_({ ...CFG, tph_day_hours: [20, 8] })), legacy2, 'hours-degenerate')
  })

  it('checkDate / nowSlot / checkAgent / checkCalls / pastDay', () => {
    const user = { role: 'tl' }
    for (const d of ['2026-10-29', '2026-10-26', '2026-10-25', '2026-10-30', 'bad', '']) {
      same('tphCheckDate_', [user, d], () => tphCheckDate_(user, d, CFG, NOW_MS), fx(), `cd ${d}`)
      same('tphCheckDate_', [{ role: 'admin' }, d], () => tphCheckDate_({ role: 'admin' }, d, CFG, NOW_MS), fx(), `cda ${d}`)
      same('tphPastDay_', [d], () => tphPastDay_(d, CFG, NOW_MS), fx(), `pd ${d}`)
    }
    same('tphNowSlot_', [], () => tphNowSlot_(CFG, NOW_MS), fx(), 'nowSlot')
    const persons: Record<string, { email: string; active: boolean; role: string }> = {
      'a@dabdoob.com': { email: 'a@dabdoob.com', active: true, role: 'agent' },
      's@dabdoob.com': { email: 's@dabdoob.com', active: true, role: 'specialist' },
      't@dabdoob.com': { email: 't@dabdoob.com', active: true, role: 'tl' },
      'x@dabdoob.com': { email: 'x@dabdoob.com', active: false, role: 'agent' },
    }
    const fxDir = fx({ dirPersons: persons })
    const portDir = { person: (e: string) => persons[String(e).trim().toLowerCase()] || null }
    for (const e of ['a@dabdoob.com', 's@dabdoob.com', 't@dabdoob.com', 'x@dabdoob.com', 'ghost@dabdoob.com'])
      same('tphCheckAgent_', [{ person: '@@fn:__fn_dirPerson__' }, e], () => tphCheckAgent_(portDir, e), fxDir, `ca ${e}`)
    same('tphCheckCalls_', [], () => tphCheckCalls_(CFG), fx(), 'checkCalls')
    const noCalls = { ...CFG, tph_channels: (CFG.tph_channels as { key: string }[]).filter((c) => c.key !== 'calls') }
    same('tphCheckCalls_', [], () => tphCheckCalls_(noCalls as Cfg), fx({ settings: { tph_channels: (CFG.tph_channels as { key: string }[]).filter((c) => c.key !== 'calls') } }), 'checkCalls-none')
  })

  it('flagCalls mutates logged/src identically', () => {
    const R = rng(7010)
    for (let i = 0; i < 12; i++) {
      const logged: Record<number, string> = {}
      const src: Record<number, string> = {}
      for (let s = 0; s < 96; s++) if (R() < 0.12) { logged[s] = rpick(R, ['internal', 'chats', 'calls', 'wa+calls']); src[s] = 'grid' }
      const slots: number[] = []
      for (let k = 0; k < rint(R, 1, 10); k++) slots.push(rint(R, 0, 95))
      const on = R() < 0.6
      const legacy = JSON.parse(
        oracle().eval(
          `(function(){ var l=${JSON.stringify(logged)}, s=${JSON.stringify(src)}; tphFlagCalls_(l, s, ${JSON.stringify(slots)}, ${on}, 'grid'); return JSON.stringify([l, s]); })()`
        )
      )
      const l2: Record<number, string> = { ...logged }
      const s2: Record<number, string> = { ...src }
      tphFlagCalls_(l2, s2, slots, on, 'grid')
      expectSame({ ok: [l2, s2] }, { ok: legacy }, `flagCalls ${i}`)
    }
  })
})

describe('tph touches/cases from rows', () => {
  const NAME2MAIL = { 'zed ahmed': 'a@dabdoob.com', 'amy saad': 'b@dabdoob.com' }
  const CHANS = [
    { key: 'internal', name: 'Internal', kind: 'ticket', groups: ['Customer Support - Internal', 'OOS - Kuwait'] },
    { key: 'chats', name: 'Chats', kind: 'chat', groups: ['FreshChat'] },
    { key: 'wa', name: 'Waiting address', kind: 'manual', groups: ['Waiting Address'] },
    { key: 'calls', name: 'Inbound calls', kind: 'manual', groups: ['Inbound Calls Documentation'] },
  ]

  function actRow(r: () => number, day = '2026-10-29'): unknown[] {
    return [
      `${day} ${String(rint(r, 0, 23)).padStart(2, '0')}:${String(rint(r, 0, 59)).padStart(2, '0')}`,
      String(rint(r, 100, 120)),
      rpick(r, ['Zed Ahmed', 'Amy Saad', 'Ghost', '']),
      '',
      '',
      rpick(r, ['status', 'group', '']),
      rpick(r, ['Open', 'Resolved', 'Pending on CX']),
      '',
      rpick(r, ['Customer Support - Internal', 'FreshChat', 'Inbound Calls Documentation', 'Refunds', '']),
    ]
  }

  it('touchesFromRows / touchList', () => {
    const R = rng(7011)
    for (let i = 0; i < 15; i++) {
      const rows: unknown[][] = []
      for (let k = 0; k < rint(R, 5, 40); k++) rows.push(actRow(R, R() < 0.3 ? '2026-10-28' : '2026-10-29'))
      const dates = ['2026-10-29', '2026-10-28']
      same('tphTouchesFromRows_', [rows, dates, NAME2MAIL, 'Asia/Kuwait', CHANS, 'Asia/Kuwait'], () =>
        tphTouchesFromRows_(rows, dates, NAME2MAIL, 'Asia/Kuwait', CHANS as never, 'Asia/Kuwait'), {}, `tf ${i}`)
      const hours = [8, 9, 10, 11, 12, 13, 14, 15]
      same('tphTouchList_', [rows, '2026-10-29', 'a@dabdoob.com', NAME2MAIL, 'Asia/Kuwait', CHANS, 'Asia/Kuwait', hours], () =>
        tphTouchList_(rows, '2026-10-29', 'a@dabdoob.com', NAME2MAIL, 'Asia/Kuwait', CHANS as never, 'Asia/Kuwait', hours), {}, `tl ${i}`)
    }
  })

  it('casesFromQueue / foldCapture', () => {
    const R = rng(7012)
    for (let i = 0; i < 20; i++) {
      const q: Record<string, unknown>[] = []
      const queues = ['Customer Support - Internal', 'OOS - Kuwait', 'Other', 'chat']
      queues.forEach((name) => {
        if (R() < 0.7)
          q.push({
            kind: name === 'chat' ? 'chat' : 'ticket',
            queue: name,
            open: rint(R, 0, 40),
            created_today: rint(R, 0, 15),
            stale: R() < 0.1,
            by_status_json: JSON.stringify({ Open: rint(R, 0, 20), 'Pending on CX': rint(R, 0, 10), Resolved: rint(R, 0, 30) }),
          })
      })
      same('tphCasesFromQueue_', [q, CHANS, ['Open', 'Pending on CX'], []], () =>
        tphCasesFromQueue_(q, CHANS as never, ['Open', 'Pending on CX'], []), {}, `cq ${i}`)
      const auto: Record<string, { stock: number; c0: number; c1: number }> = {}
      const hour = rint(R, 8, 20)
      const got: Record<string, { stock: number; created: number }> = {}
      CHANS.forEach((c) => {
        if (R() < 0.5) got[c.key] = { stock: rint(R, 0, 20), created: rint(R, 0, 10) }
      })
      const legacy = JSON.parse(
        oracle().eval(
          `(function(){ var a=${JSON.stringify(auto)}; var n=tphFoldCapture_(a, ${hour}, ${JSON.stringify(got)}); return JSON.stringify({added:n, auto:a}); })()`
        )
      )
      const a2 = JSON.parse(JSON.stringify(auto))
      const n2 = tphFoldCapture_(a2, hour, got)
      expectSame({ ok: { added: n2, auto: a2 } }, { ok: legacy }, `fold ${i}`)
    }
  })

  it('chatCases / ticketCases / callCases / rebuiltCases / eligible / casesPart / mergeRebuilt / staleSteps', () => {
    const R = rng(7013)
    const hours = [8, 9, 10]
    for (let i = 0; i < 10; i++) {
      const chatRows: unknown[][] = []
      for (let k = 0; k < rint(R, 0, 15); k++)
        chatRows.push([
          `2026-10-29 ${String(rint(R, 6, 14)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`,
          rpick(R, ['Open', 'Resolved', '']),
          'int-' + rint(R, 100, 105),
          `2026-10-29 ${String(rint(R, 6, 22)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`,
          R() < 0.4 ? `2026-10-29 ${String(rint(R, 10, 22)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}` : '',
          'Web',
          'conv-' + rint(R, 1, 6),
        ])
      same('tphChatCases_', [chatRows, '2026-10-29', hours, 'Africa/Cairo', 'Asia/Kuwait'], () =>
        tphChatCases_(chatRows, '2026-10-29', hours, 'Africa/Cairo', 'Asia/Kuwait'), {}, `cc ${i}`)

      const acts: unknown[][] = []
      for (let k = 0; k < rint(R, 0, 20); k++) acts.push(actRow(R))
      const tickets: Record<string, unknown>[] = []
      for (let k = 0; k < rint(R, 0, 15); k++)
        tickets.push({
          ticket_id: String(rint(R, 100, 120)),
          status: rpick(R, ['Open', 'Pending on CX', 'Resolved', 'Closed']),
          group_name: rpick(R, ['Customer Support - Internal', 'OOS - Kuwait', 'Other']),
          created_at: `2026-10-29T${String(rint(R, 5, 20)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}:00Z`,
          resolved_at: R() < 0.3 ? `2026-10-29T${String(rint(R, 10, 22)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}:00Z` : '',
          closed_at: '',
        })
      const o = {
        groups: ['customer support - internal', 'oos - kuwait'],
        statuses: ['open', 'pending on cx'],
        dataTz: 'Africa/Cairo',
        bizTz: 'Asia/Kuwait',
        storeHasDate: R() < 0.8,
      }
      same('tphTicketCases_', [tickets, callLegacy('tphActIndex_', [acts, 'Asia/Kuwait']).ok, '2026-10-29', hours, o], () =>
        tphTicketCases_(tickets as never, tphActIndex_(acts, 'Asia/Kuwait'), '2026-10-29', hours, o), {}, `tc ${i}`)

      const inflow: Record<string, unknown>[] = []
      for (let k = 0; k < rint(R, 0, 24); k++)
        inflow.push({ date: rpick(R, ['2026-10-29', '2026-10-28']), hour: rint(R, 0, 23), calls: rint(R, 0, 30) })
      same('tphCallCases_', [inflow, '2026-10-29', hours], () => tphCallCases_(inflow, '2026-10-29', hours), {}, `cal ${i}`)

      const stored = R() < 0.3
        ? null
        : { cells: { '8|internal': { stock: rint(R, 0, 9), new: rint(R, 0, 5) }, '9|chats': { stock: rint(R, 0, 9), new: rint(R, 0, 5) } }, reasons: { chats: 'x' } }
      same('tphRebuiltCases_', [stored], () => tphRebuiltCases_(stored as never), {}, `rb ${i}`)

      const dayRows = [
        { date: '2026-10-29', touches_json: JSON.stringify({ 'a@dabdoob.com|9|internal': 3, 'b@dabdoob.com|9|chats': 5 }) },
        { date: '2026-10-01', touches_json: '{"a@dabdoob.com|8|internal":2}' },
        { date: 'bad' },
      ]
      same('tphEligible_', [dayRows, '2026-10-02'], () => tphEligible_(dayRows as { date: unknown; touches_json: unknown }[], '2026-10-02'), {}, `el ${i}`)

      const c = { key: rpick(R, ['internal', 'chats', 'calls']), kind: rpick(R, ['ticket', 'chat', 'manual']) }
      const part = rpick(R, ['tickets', 'chats', '', null])
      same('tphCasesPart_', [c, part], () => tphCasesPart_(c as never, part as string), {}, `cp ${i}`)

      const old = { cells: { '8|internal': { stock: 1, new: 2 }, '8|wa': { stock: 3, new: 4 } }, reasons: { wa: 'r1', chats: 'r2' } }
      const fresh = { cells: { '8|internal': { stock: 9, new: 9 } }, reasons: { chats: 'r9' } }
      const keys = ['internal', 'chats']
      same('tphMergeRebuilt_', [old, fresh, keys], () => tphMergeRebuilt_(old, fresh, keys), {}, `mr ${i}`)

      const stamps = { touches: '2026-10-28T06:00:00.000Z', calls: '', cases: '2026-10-28T23:00:00.000Z' }
      const now = Date.UTC(2026, 9, 29, 10, 0, 0)
      same('tphStaleSteps_', [stamps, now, 6 * 3600 * 1000], () => tphStaleSteps_(stamps, now, 6 * 3600 * 1000), {}, `st ${i}`)
    }
  })
})

describe('tph store seams', () => {
  const DAY_ROWS = [
    ['date', 'agent_email', 'slots_json', 'sources_json', 'by', 'at'],
    ['2026-10-29', 'a@dabdoob.com', '{"32":"internal","33":"calls"}', '{"32":"grid","33":"grid"}', 'tl@dabdoob.com', '2026-10-29T07:00:00.000Z'],
    ['2026-10-28', 'a@dabdoob.com', '{"32":"chats"}', '{"32":"grid"}', 'tl@dabdoob.com', '2026-10-28T09:00:00.000Z'],
  ]
  const CASES_ROWS = [
    ['date', 'source', 'cases_json', 'by', 'at'],
    ['2026-10-29', 'tl', '{"8|internal":5,"9|chats":3}', 'tl@dabdoob.com', '2026-10-29T08:00:00.000Z'],
    ['2026-10-29', 'auto', '{"8|internal":{"stock":4,"c0":1,"c1":3}}', 'system', '2026-10-29T09:00:00.000Z'],
    ['2026-10-29', 'rebuilt', '{"cells":{"8|internal":{"stock":7,"new":2}},"reasons":{"chats":"r"}}', 'system', '2026-10-29T06:00:00.000Z'],
  ]
  const TOUCH_ROWS = [
    ['date', 'touches_json', 'computed_at'],
    ['2026-10-29', '{"a@dabdoob.com|9|internal":4}', '2026-10-29T06:30:00.000Z'],
  ]
  const CALL_ROWS = [
    ['date', 'calls_json', 'computed_at'],
    ['2026-10-29', '{"a@dabdoob.com|9":[30,2]}', '2026-10-29T06:30:00.000Z'],
  ]

  function prodFx(): GoldenFixture {
    return fx({
      spreadsheets: {
        'prod-store': {
          prod_tph_days: DAY_ROWS,
          prod_tph_cases: CASES_ROWS,
          prod_tph_touches: TOUCH_ROWS,
          prod_tph_calls: CALL_ROWS,
        },
      },
    })
  }

  it('dayCore over the prod store', () => {
    const people = [{ email: 'a@dabdoob.com' }, { email: 'b@dabdoob.com' }]
    const hours = tphHours_(CFG)
    const keys = tphKeys_(CFG)
    for (const d of ['2026-10-29', '2026-10-28', '2026-10-30']) {
      const tabs = {
        prod_tph_days: DAY_ROWS,
        prod_tph_cases: CASES_ROWS,
        prod_tph_touches: TOUCH_ROWS,
        prod_tph_calls: CALL_ROWS,
      }
      const io = prodIo(tabs, [])
      same('tphDayCore_', [d, TODAY, hours, keys, people], () => tphDayCore_(d, TODAY, hours, keys, people, io), prodFx(), `dayCore ${d}`)
    }
  })

  it('editDay writes prod_tph_days identically', () => {
    const f = prodFx()
    // the port-side mirror of __fn_tphEdit__ below
    const editPort = (logged: Record<string, string>, src: Record<string, string>) => {
      logged['40'] = 'calls'
      src['40'] = 'grid'
      logged['41'] = 'wa+calls'
      src['41'] = 'grid'
      delete logged['32']
      delete src['32']
    }
    const writes: { fn: string; args: unknown[] }[] = []
    const tabs = { prod_tph_days: DAY_ROWS }
    const io = prodIo(tabs, writes)
    const portRes = callPort(() => tphEditDay_({ email: 'tl@dabdoob.com' }, '2026-10-29', 'a@dabdoob.com', editPort, io, NOW_MS))
    const legacyRes = callLegacy('tphEditDay_', [{ email: 'tl@dabdoob.com' }, '2026-10-29', 'a@dabdoob.com', '@@fn:__fn_tphEdit__'], f)
    expectSame(portRes, legacyRes, 'editDay result')
    // compare recorded writes (dqUpsertIn_ + dqUpsert_ both wrapped in the oracle)
    expectSame({ ok: writes }, { ok: legacyWrites() }, 'editDay writes')
  })

  it('buildTouches writes prod_tph_touches identically', () => {
    const R = rng(7014)
    const rows: unknown[][] = []
    for (let k = 0; k < 25; k++)
      rows.push([
        `2026-10-28 ${String(rint(R, 8, 20)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`,
        String(rint(R, 100, 110)),
        rpick(R, ['Zed Ahmed', 'Amy Saad']),
        '',
        '',
        'status',
        'Open',
        '',
        rpick(R, ['Customer Support - Internal', 'FreshChat']),
      ])
    const headcount = [
      { email: 'a@dabdoob.com', name: 'Zed Ahmed', fdName: '', fdId: '' },
      { email: 'b@dabdoob.com', name: 'Amy Saad', fdName: '', fdId: '' },
    ]
    const writes: { fn: string; args: unknown[] }[] = []
    const io = prodIo({}, writes, { headcount } as never)
    // legacy reads headcount via prodNameToEmail_(dqHeadcount_()) — dqRosterPeople_ keeps
    // only Roster rows with source 'hct'.
    const f = fx({
      data: {
        Roster: [
          ['email', 'name', 'role', 'active', 'source', 'freshdesk_id', 'freshdesk_name', 'maqsam_name', 'tl_email'],
          ['a@dabdoob.com', 'Zed Ahmed', 'agent', true, 'hct', '', '', '', ''],
          ['b@dabdoob.com', 'Amy Saad', 'agent', true, 'hct', '', '', '', ''],
        ],
      },
    })
    const legacyRes = callLegacy('tphBuildTouches_', [['2026-10-28'], rows], f)
    const portRes = callPort(() => tphBuildTouches_(['2026-10-28'], rows, io))
    expectSame(portRes, legacyRes, 'buildTouches result')
    expectSame({ ok: writes }, { ok: legacyWrites() }, 'buildTouches writes')
  })

  it('activityTail reads the Activities tab from the first row at/after fromMs', () => {
    const tab = [
      ['t', 'id', 'n'],
      ['2026-10-27 08:00', '1', 'a'],
      ['2026-10-28 09:00', '2', 'b'],
      ['2026-10-28 10:00', '3', 'c'],
      ['2026-10-29 01:00', '4', 'd'],
    ]
    const f = fx({ spreadsheets: { 'fd-activity': { Activities: tab } } })
    const legacy = callLegacy('tphActivityTail_', ['2026-10-29', 1], f)
    const port = callPort(() => tphActivityTail_('2026-10-29', 1, CFG, openSpreadsheet({ 'fd-activity': { Activities: tab } })))
    expectSame(port, legacy, 'activityTail')
  })

  it('lastAuto reads refresh_log tail', () => {
    const log = [
      ['job', 'started_at', 'finished_at', 'rows_in', 'rows_out', 'source_cursor', 'status', 'error', 'note'],
      ['prod_tph_touches', '2026-10-29T05:00:00.000Z', '2026-10-29T05:01:00.000Z', '', 5, '', 'ok', '', 'daily run'],
      ['prod_tph_cases_rebuilt', '2026-10-29T05:10:00.000Z', '2026-10-29T05:11:00.000Z', '', 2, '', 'ok', '', 'TPH cases_chats 2026-10-28 by tl@dabdoob.com in 9 ms'],
      ['prod_tph_auto', '2026-10-29T06:00:00.000Z', '2026-10-29T06:02:00.000Z', '', 3, '', 'ok', '', 'Built 2026-10-28 touches'],
    ]
    const f = fx({ spreadsheets: { 'live-store': { refresh_log: log } } })
    const legacy = callLegacy('tphLastAuto_', [], f)
    const port = callPort(() => tphLastAuto_(toObjs(log)))
    expectSame(port, legacy, 'lastAuto')
    const legacy2 = callLegacy('tphLastAuto_', [], fx())
    expectSame(callPort(() => tphLastAuto_([])), legacy2, 'lastAuto-empty')
  })

  it('captureCases folds the live queue into prod_tph_cases', () => {
    const queueNow = [
      ['kind', 'queue', 'open', 'created_today', 'stale', 'by_status_json'],
      ['ticket', 'Customer Support - Internal', 9, 4, false, '{"Open":5,"Pending on CX":4}'],
      ['chat', 'chat', 12, 7, false, '{"Open":12}'],
    ]
    const casesTab = [
      ['date', 'source', 'cases_json', 'by', 'at'],
      ['2026-10-29', 'auto', '{"13|internal":{"stock":2,"c0":1,"c1":1}}', 'system', '2026-10-29T09:00:00.000Z'],
    ]
    const f = fx({
      spreadsheets: {
        'live-store': { agg_queue_now: queueNow },
        'prod-store': { prod_tph_cases: casesTab },
      },
    })
    const writes: { fn: string; args: unknown[] }[] = []
    const io = prodIo({ prod_tph_cases: casesTab }, writes)
    const legacy = callLegacy('tphCaptureCases_', [], f)
    const port = callPort(() =>
      tphCaptureCases_({ ...io, cachedLive: (name: string) => (name === 'agg_queue_now' ? toObjs(queueNow) : []) })
    )
    expectSame(port, legacy, 'captureCases')
    expectSame({ ok: writes }, { ok: legacyWrites() }, 'captureCases writes')
  })

  it('diagnoseTouchLines matches line for line', () => {
    const R = rng(7015)
    const rows: unknown[][] = []
    for (let k = 0; k < 30; k++)
      rows.push([
        `2026-10-29 ${String(rint(R, 8, 20)).padStart(2, '0')}:${String(rint(R, 0, 59)).padStart(2, '0')}`,
        String(rint(R, 100, 110)),
        rpick(R, ['Zed Ahmed', 'Amy Saad', 'Unknown Agent - raw id 42', 'Unknown Agent - raw id 7']),
        '',
        '',
        'status',
        'Open',
        '',
        rpick(R, ['Customer Support - Internal', 'Refunds', '', 'FreshChat']),
      ])
    const headcount = [
      { email: 'a@dabdoob.com', name: 'Zed Ahmed', fdName: 'Zed', fdId: '42' },
      { email: 'b@dabdoob.com', name: 'Amy Saad', fdName: '', fdId: '' },
    ]
    const name2mail = { 'zed ahmed': 'a@dabdoob.com', 'amy saad': 'b@dabdoob.com', 'unknown agent - raw id 7': 'x@dabdoob.com' }
    same(
      'tphDiagnoseTouchLines_',
      [rows, '2026-10-29', 'zed', name2mail, 'Asia/Kuwait', tphChannels_(CFG), 'Asia/Kuwait', headcount],
      () => tphDiagnoseTouchLines_(rows, '2026-10-29', 'zed', name2mail, 'Asia/Kuwait', tphChannels_(CFG) as never, 'Asia/Kuwait', headcount),
      {},
      'diagnose'
    )
  })
})
