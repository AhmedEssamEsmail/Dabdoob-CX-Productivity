/**
 * Golden tests: src/lib/prod/adapters.ts + engine.ts vs ProdCore.js / productivity.js /
 * ProductivityApp.js run verbatim in the oracle.
 */
import { describe, it, expect } from 'vitest'
import {
  baseFixtures,
  callLegacy,
  callPort,
  diffPath,
  json,
  oracle,
  rint,
  rng,
  rpick,
  same,
  sheetBook,
} from './helpers-oracle'
import {
  dqAddDays_,
  dqDateKey_,
  dqNormCell_,
  dqParseTs_,
  dqRosterPeople_,
  dqTzOffsetMin_,
  dqWallToUtc_,
  normEmail_,
  prodActivityKey_,
  prodDateKey_,
  prodFileFor_,
  prodHeadcountRows_,
  prodNameToEmail_,
  prodReadCols_,
  type Cfg,
} from '../../src/lib/prod/adapters'
import {
  computeProductivityForDate_,
  prodActivitiesFromRows_,
  prodAssumptions_,
  prodComputeDates_,
  prodComputeRange_,
  prodDetectDates_,
  prodAutoAccept_,
  prodFlagView_,
  prodGroups_,
  prodIntervalOf_,
  prodList_,
  prodLoadActivities_,
  prodLoadMonth_,
  prodNowIso_,
  prodPersonName_,
  prodReady_,
  prodRule_,
  prodRuleView_,
  prodScope_,
  prodSeenStatuses_,
  prodSetting_,
  prodStatusChoices_,
  prodTicketUrl_,
  prodToday_,
  prodFlagsForDates_,
  dqProductivityRollup_,
  runProductivityRange,
  type ProdIo,
} from '../../src/lib/prod/engine'

const R = rng(0x51ab3f)
const CFG = () => (baseFixtures().settings ?? {}) as Cfg

describe('adapters: time + keys', () => {
  it('dqParseTs_ — 200 vectors, every accepted format', () => {
    const tzs = ['Asia/Kuwait', 'Africa/Cairo', 'Europe/London', 'Asia/Kolkata', 'Pacific/Kiritimati', 'America/New_York']
    for (let i = 0; i < 200; i++) {
      const y = rint(R, 2018, 2030)
      const mo = rint(R, 1, 12)
      const d = rint(R, 1, 28)
      const h = rint(R, 0, 23)
      const mi = rint(R, 0, 59)
      const tz = rpick(R, tzs)
      const kind = rint(R, 0, 6)
      let v: unknown
      if (kind === 0) v = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')} ${String(h).padStart(2, '0')}:${String(mi).padStart(2, '0')}`
      else if (kind === 1) v = `${mo}/${d}/${y} ${h % 12 || 12}:${String(mi).padStart(2, '0')} ${h >= 12 ? 'PM' : 'AM'}`
      else if (kind === 2) v = `${y}-${mo}-${d}T${h}:${mi}`
      else if (kind === 3) v = new Date(Date.UTC(y, mo - 1, d, h, mi)).toISOString()
      else if (kind === 4) v = `${d}-${mo}-${y} ${h}:${mi}:30`
      else if (kind === 5) v = ''
      else v = `garbage ${i}`
      same('dqParseTs_', [v, tz], () => {
        const r = dqParseTs_(v, tz)
        return r === null ? null : r.getTime()
      }, {}, `ts ${i}`)
    }
  })

  it('dqWallToUtc_ / dqTzOffsetMin_ / dqDateKey_ / dqAddDays_ / prodDateKey_ / normEmail_ — 150 vectors', () => {
    const tzs = ['Asia/Kuwait', 'Africa/Cairo', 'Pacific/Kiritimati', 'America/New_York', 'Asia/Kolkata', 'UTC']
    const cfg = CFG()
    for (let i = 0; i < 150; i++) {
      const y = rint(R, 2019, 2030)
      const mo = rint(R, 1, 12)
      const d = rint(R, 1, 28)
      const h = rint(R, 0, 23)
      const mi = rint(R, 0, 59)
      const tz = rpick(R, tzs)
      same('dqWallToUtc_', [y, mo, d, h, mi, 0, tz], () => dqWallToUtc_(y, mo, d, h, mi, 0, tz).getTime(), {}, `wall ${i}`)
      const ms = Date.UTC(y, mo - 1, d, h, mi)
      same('dqTzOffsetMin_', [ms, tz], () => dqTzOffsetMin_(new Date(ms), tz), {}, `off ${i}`)
      // legacy dqDateKey_(date, tz) — tz optional (business_tz fallback)
      same('dqDateKey_', [new Date(ms).toISOString(), tz], () => dqDateKey_(new Date(ms), tz), {}, `dk ${i}`)
      const k = `${y}-${String(mo).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const n = rint(R, -30, 30)
      same('dqAddDays_', [k, n], () => dqAddDays_(k, n), {}, `add ${i}`)
      same('prodDateKey_', [new Date(ms).toISOString()], () => prodDateKey_(new Date(ms).toISOString()), {}, `pdk ${i}`)
      const e = rpick(R, [' A@x.COM ', 'b@y.COM', 'C@z.com', '', '  '])
      same('normEmail_', [e], () => normEmail_(e), {}, `ne ${i}`)
      // dqNormCell_: Date -> date/ISO by column name
      const col = rpick(R, ['date', 'created_at', 'week', 'month', 'decided_at', 'name'])
      same('dqNormCell_', [col, new Date(ms).toISOString()], () => dqNormCell_(col, new Date(ms)), {}, `nc ${i}`)
    }
    // dqDateKey_ with tz omitted -> business_tz fallback
    const ms = Date.parse('2026-10-29T22:30:00Z')
    same('dqDateKey_', [new Date(ms).toISOString()], () => dqDateKey_(new Date(ms), CFG()), baseFixtures(), 'dk default tz')
  })

  it('prodFileFor_ / prodHeadcountRows_ / prodNameToEmail_ / prodReadCols_ / dqRosterPeople_', () => {
    for (let i = 0; i < 30; i++) {
      const k = `20${rint(R, 24, 27)}-${String(rint(R, 1, 12)).padStart(2, '0')}`
      const fx = baseFixtures({ settings: { productivity_files: { '2026-10': 'ss-2026-10' } } })
      same('prodFileFor_', [k], () => prodFileFor_(k, fx.settings as Cfg), fx, `pff ${i}`)
    }
    // prodHeadcountRows_(ss) — marker resolves to the prod-fallback book
    const headcount = [
      ['EmpID', 'Agent Name', 'X', 'Email', 'FD id', 'FD Name', 'TL Name', 'TL Email'],
      ['E1', 'Agent A', '', 'a@dabdoob.com', 'FD1', 'FD Agent A', 'TL One', 'tl@dabdoob.com'],
      ['E2', 'Agent B', '', 'b@dabdoob.com', '', '', 'TL One', 'tl@dabdoob.com'],
      ['E3', 'No Mail', '', '', '', '', '', ''],
    ]
    const fx = baseFixtures({ spreadsheets: { 'prod-fallback': { Headcount: headcount } } })
    const legacy = callLegacy('prodHeadcountRows_', ['@@ss:prod-fallback'], fx)
    const port = callPort(() => prodHeadcountRows_(sheetBook({ Headcount: headcount }) as never))
    expect(diffPath(legacy, port)).toBeNull()
    const rows = legacy.ok as { name: string; email: string; fdId: string; fdName: string }[]
    same('prodNameToEmail_', [rows], () => prodNameToEmail_(rows as never), {}, 'n2e')
    // dqRosterPeople_() — Roster tab of the data spreadsheet
    const roster = [
      ['email', 'name', 'freshdesk_id', 'freshdesk_name', 'maqsam_name', 'tl_email', 'source', 'active'],
      ['a@dabdoob.com', 'Agent A', 'FD1', 'FD Agent A', 'A', 'tl@dabdoob.com', 'hct', 'true'],
      ['tl@dabdoob.com', 'TL One', '', '', '', '', 'hct', 'true'],
      ['gone@dabdoob.com', 'Left', '', '', '', '', 'manual', 'true'],
    ]
    const fx2 = baseFixtures({ data: { Roster: roster } })
    const l2 = callLegacy('dqRosterPeople_', [], fx2)
    const p2 = callPort(() =>
      dqRosterPeople_(
        roster.slice(1).map((r) => ({
          email: r[0], name: r[1], freshdesk_id: r[2], freshdesk_name: r[3],
          maqsam_name: r[4], tl_email: r[5], source: r[6],
        })) as never
      )
    )
    expect(diffPath(l2, p2)).toBeNull()
    // prodReadCols_(ss, 'Headcount', 1, 8, 1) over the same tab
    const l3 = callLegacy('prodReadCols_', ['@@ss:prod-fallback', 'Headcount', 1, 8, 1], fx)
    const p3 = callPort(() => prodReadCols_(sheetBook({ Headcount: headcount }) as never, 'Headcount', 1, 8, 1))
    expect(diffPath(l3, p3)).toBeNull()
  })
})

describe('engine settings + views', () => {
  it('prodSetting_ / prodList_ / prodRule_ / prodGroups_ / prodReady_ / prodRuleView_ / prodTicketUrl_', () => {
    const fx = baseFixtures({
      settings: {
        prod_flag_cases_x: 3,
        prod_flag_window_min: 15,
        prod_flag_min_interval_min: 5,
        prod_flag_statuses: ['IDLE', 'Not Ready'],
        prod_channel_status: { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' },
        prod_chat_groups: ['FreshChat'],
        prod_wa_groups: ['Waiting Address'],
        prod_review_days: 2,
        freshdesk_domain: 'dabdoobapp.freshdesk.com',
      },
    })
    for (const key of ['prod_flag_cases_x', 'prod_flag_window_min', 'prod_flag_statuses', 'prod_channel_status', 'prod_review_days', 'missing_key']) {
      same('prodSetting_', [key], () => prodSetting_(fx.settings as Cfg, key), fx, `set ${key}`)
      same('prodList_', [key], () => prodList_(fx.settings as Cfg, key), fx, `list ${key}`)
    }
    same('prodRule_', [], () => prodRule_(fx.settings as Cfg), fx)
    same('prodGroups_', [], () => prodGroups_(fx.settings as Cfg), fx)
    same('prodReady_', [], () => prodReady_(fx.settings as Cfg), fx)
    same('prodReady_', [], () => prodReady_({} as Cfg), baseFixtures({ settings: { ss_productivity_id: '' } }), 'not ready')
    same('prodRuleView_', [], () => prodRuleView_(fx.settings as Cfg), fx)
    same('prodTicketUrl_', [], () => prodTicketUrl_(fx.settings as Cfg), fx)
  })

  it('prodToday_ / prodNowIso_ pinned via nowMs', () => {
    const fx = baseFixtures({ nowMs: Date.parse('2026-10-29T21:47:31Z') })
    const legacy = callLegacy('prodToday_', [], fx)
    const port = callPort(() => prodToday_(fx.settings as Cfg, new Date(fx.nowMs as number)))
    expect(diffPath(legacy, port)).toBeNull()
    const legacy2 = callLegacy('prodNowIso_', [], fx)
    const port2 = callPort(() => prodNowIso_(new Date(fx.nowMs as number)))
    expect(diffPath(legacy2, port2)).toBeNull()
  })

  it('prodIntervalOf_ / prodFlagView_ / prodSeenStatuses_ / prodStatusChoices_ / prodScope_ / prodPersonName_', () => {
    const fx = baseFixtures({
      settings: {
        prod_replacement_statuses: ['Chats', 'Waiting Address', 'Busy'],
        prod_flag_statuses: ['IDLE'],
        prod_offline_statuses: ['Offline'],
      },
      data: {
        prod_intervals_store_stub: [],
      },
      spreadsheets: {
        'prod-store': {
          prod_intervals: [
            ['date', 'status', 'agent_email'],
            ['2026-10-29', 'IDLE', 'a@x.com'],
            ['2026-10-20', 'Aux Time', 'a@x.com'],
            ['2026-10-01', 'Old Status', 'b@x.com'],
          ],
        },
      },
      nowMs: Date.parse('2026-10-29T10:00:00Z'),
    })
    for (let i = 0; i < 40; i++) {
      const f: Record<string, unknown> = {
        flag_id: 'PF' + i,
        date: '2026-10-29',
        agent_email: 'a@dabdoob.com',
        agent_name: 'Agent A',
        tl_email: 'tl@dabdoob.com',
        raw_status: rpick(R, ['IDLE', 'Available']),
        interval_start: `2026-10-29T0${rint(R, 3, 9)}:${String(rint(R, 0, 59)).padStart(2, '0')}:00.000Z`,
        interval_end: '2026-10-29T10:00:00.000Z',
        interval_min: rint(R, 1, 90),
        flagged_min: rint(R, 1, 60),
        spans_json: '[[0,600000]]',
        case_count: rint(R, 0, 8),
        distinct_cases: rint(R, 0, 6),
        case_ids_json: '[["T1","chat"]]',
        channel_mix_json: '{"chat":2}',
        suggested_status: 'Chats',
        decision: rpick(R, ['pending', 'accepted', 'auto', 'reverted', 'void']),
        validated_status: rpick(R, ['Chats', '', 'Busy']),
        decided_by: rpick(R, ['auto', 'tl@dabdoob.com', '']),
        decided_at: '2026-10-29T11:00:00.000Z',
        reason: 'r',
        due_date: '2026-10-30',
        start_at: '2026-10-29T06:00:00.000Z',
        end_at: '2026-10-29T07:00:00.000Z',
        status: 'IDLE',
        minutes: 60,
      }
      const dirArg = { name: '@@fn:__fn_dir_name__' }
      same('prodFlagView_', [f, dirArg], () =>
        prodFlagView_(f, { name: (e: string) => 'Name ' + e }), fx, `fv ${i}`)
      same('prodIntervalOf_', [f], () => prodIntervalOf_(f), fx, `iv ${i}`)
      same('prodPersonName_', [dirArg, rpick(R, ['a@x.com', '', null])], () =>
        prodPersonName_({ name: (e: string) => 'Name ' + e }, rpick(R, ['a@x.com', '', null])), fx, `pn ${i}`)
    }
    // store-backed views
    const lSeen = callLegacy('prodSeenStatuses_', [], fx)
    const pSeen = callPort(() =>
      prodSeenStatuses_(
        [
          { date: '2026-10-29', status: 'IDLE' },
          { date: '2026-10-20', status: 'Aux Time' },
          { date: '2026-10-01', status: 'Old Status' },
        ],
        '2026-10-29'
      )
    )
    expect(diffPath(lSeen, pSeen)).toBeNull()
    const lCh = callLegacy('prodStatusChoices_', [], fx)
    const pCh = callPort(() =>
      prodStatusChoices_(fx.settings as Cfg, [
        { status: 'IDLE', rows: 1 },
        { status: 'Aux Time', rows: 1 },
        { status: 'Old Status', rows: 1 },
      ])
    )
    expect(diffPath(lCh, pCh)).toBeNull()
    // prodScope_(user, dir) -> predicate; compare predicate behaviour on emails inside vm
    for (const [user, e] of [
      [{ role: 'admin', email: 'ad@x.com' }, 'anyone@x.com'],
      [{ role: 'tl', email: 'tl@dabdoob.com' }, 'a@dabdoob.com'],
      [{ role: 'agent', email: 'me@x.com' }, 'me@x.com'],
      [{ role: 'agent', email: 'me@x.com' }, 'other@x.com'],
    ] as const) {
      const l = callLegacy('prodScope_', [user, { managerOf: '@@fn:__fn_dir_managerOf__' }], fx)
      // result is a function; compare by applying it through eval (fixtures persist until next call)
      const lv = oracle().eval(`__lastScope = prodScope_(${JSON.stringify(user)}, { managerOf: __fn_dir_managerOf__ }); __lastScope(${JSON.stringify(e)})`)
      const p = prodScope_(user as { role: string; email: string }, { managerOf: () => 'tl@dabdoob.com' })(e)
      expect(l.ok).toBeUndefined() // scope returns a function, not JSON
      expect(Boolean(lv)).toBe(Boolean(p))
    }
  })

  it('prodFlagsForDates_ — store read seam', () => {
    const fx = baseFixtures({
      spreadsheets: {
        'prod-store': {
          prod_flags: [
            ['flag_id', 'date', 'agent_email', 'decision'],
            ['PF1', '2026-10-29', 'a@x.com', 'pending'],
            ['PF2', '2026-10-30', 'a@x.com', 'accepted'],
          ],
        },
      },
    })
    const l = callLegacy('prodFlagsForDates_', [['2026-10-29']], fx)
    const p = callPort(() =>
      prodFlagsForDates_(['2026-10-29'], [
        { flag_id: 'PF1', date: '2026-10-29', agent_email: 'a@x.com', decision: 'pending' },
        { flag_id: 'PF2', date: '2026-10-30', agent_email: 'a@x.com', decision: 'accepted' },
      ])
    )
    // dqReadObjects_ adds no extra fields; shapes match when the fixture row carries the same keys
    expect(diffPath(l, p)).toBeNull()
  })
})

describe('prodAssumptions_ / prodActivityKey_ / prodActivitiesFromRows_ / prodLoadMonth_', () => {
  it('prodAssumptions_ (Assumptions B4/B5/B6)', () => {
    const tab = [['', ''], ['', ''], ['', ''], ['', 0.8], ['', 480], ['', 6]]
    const fx = baseFixtures({ spreadsheets: { 'prod-fallback': { Assumptions: tab } } })
    const l = callLegacy('prodAssumptions_', ['@@ss:prod-fallback'], fx)
    const p = callPort(() => prodAssumptions_(sheetBook({ Assumptions: tab }) as never))
    expect(diffPath(l, p)).toBeNull()
    // missing tab -> TypeError both sides
    const l2 = callLegacy('prodAssumptions_', ['@@ss:prod-fallback'], baseFixtures())
    const p2 = callPort(() => prodAssumptions_(sheetBook({}) as never))
    expect(typeof l2.err).toBe('string')
    expect(typeof p2.err).toBe('string')
  })

  it('prodActivityKey_ — dedupe key incl. \\u0001 separator, 200 vectors', () => {
    for (let i = 0; i < 200; i++) {
      const t = rint(R, Date.parse('2026-10-28T00:00:00Z'), Date.parse('2026-10-31T00:00:00Z'))
      const r: unknown[] = [
        rpick(R, [new Date(t).toISOString().replace('T', ' ').slice(0, 19), 'bad', '', new Date(t).toISOString()]),
        rpick(R, ['T1', 'T2', '', 42]),
        rpick(R, ['Agent A', '  Agent  B', '']),
        'Agent',
        'Update',
        rpick(R, ['status', 'note', '']),
        rpick(R, ['Open', 'Resolved', '']),
      ]
      const tz = rpick(R, ['Asia/Kuwait', 'Africa/Cairo'])
      same('prodActivityKey_', [r, tz], () => prodActivityKey_(r, tz), {}, `ak ${i}`)
    }
  })

  it('prodActivitiesFromRows_ — 120 vectors', () => {
    const names = { 'agent a': 'a@dabdoob.com', 'agent b': 'b@dabdoob.com' }
    for (let i = 0; i < 120; i++) {
      const rows: unknown[][] = []
      for (let j = 0; j < rint(R, 0, 8); j++) {
        const t = rint(R, Date.parse('2026-10-28T20:00:00Z'), Date.parse('2026-10-30T22:00:00Z'))
        rows.push([
          new Date(t).toISOString().replace('T', ' ').slice(0, 19),
          rpick(R, ['T1', 'T2', '']),
          rpick(R, ['Agent A', 'Agent B', 'Ghost']),
          'Agent',
          'Update',
          rpick(R, ['status', 'note']),
          rpick(R, ['Open', 'Resolved']),
          '',
          rpick(R, ['FreshChat', 'Waiting Address']),
          new Date(t).toISOString().slice(0, 10),
        ])
      }
      const dates = [rpick(R, ['2026-10-29', '2026-10-30'])]
      same('prodActivitiesFromRows_', [rows, dates, names, 'Asia/Kuwait'], () =>
        prodActivitiesFromRows_(rows, dates, names, 'Asia/Kuwait'), {}, `acts ${i}`)
    }
    // prodLoadActivities_ — reads fd_activity_ss_id 'Activities'
    const fx = baseFixtures({
      spreadsheets: { 'fd-activity': { Activities: [['h'], ['2026-10-29 06:00', 'T1', 'Agent A', 'Agent', 'Update', 'status', 'Open', '', 'FreshChat', '2026-10-29']] } },
      settings: { activity_local_tz: 'Asia/Kuwait' },
    })
    const l = callLegacy('prodLoadActivities_', [['2026-10-29'], names], fx)
    const p = callPort(() =>
      prodLoadActivities_(fx.settings as Cfg, (id: string) => sheetBook((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)[id]) as never, ['2026-10-29'], names)
    )
    expect(diffPath(l, p)).toBeNull()
  })

  it('prodLoadMonth_ — 40 vectors across the four tabs', () => {
    for (let i = 0; i < 40; i++) {
      const tabs: Record<string, unknown[][]> = {
        'Maqsam Calls': [['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']],
        FD_AUX: [['h']],
        'AUXes Exceptions': [['h']],
        Quality: [['h']],
      }
      for (let j = 0; j < rint(R, 0, 5); j++) {
        const t = rint(R, Date.parse('2026-10-28T00:00:00Z'), Date.parse('2026-10-31T00:00:00Z'))
        const iso = new Date(t).toISOString()
        tabs['Maqsam Calls'].push(['', '', '', '', '', '', rpick(R, ['a@dabdoob.com', 'B@DABDOOB.COM', '']), rpick(R, ['Serviced', 'Abandoned']), rpick(R, ['Inbound', 'Outbound']), '', iso, rint(R, 0, 900) / 60])
        tabs['FD_AUX'].push([rpick(R, ['Agent A', 'Agent B']), rpick(R, ['IDLE', 'Available', 'Inbound Calls', 'Chats', 'Waiting Address']), '', '', 'a@dabdoob.com', rint(R, 0, 300), iso])
        tabs['AUXes Exceptions'].push([rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), iso, '', rint(R, 0, 60)])
        tabs['Quality'].push([rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), iso, rint(R, 0, 100)])
      }
      const dates = [rpick(R, ['2026-10-29', '2026-10-30'])]
      const acts: unknown[] = [{ agentEmail: 'a@dabdoob.com', performerName: 'Agent A', fieldChanged: 'status', newValue: 'Open', channelGroup: 'FreshChat', date: '2026-10-29' }]
      const fx = baseFixtures({ spreadsheets: { 'prod-fallback': tabs } })
      const l = callLegacy('prodLoadMonth_', ['@@ss:prod-fallback', dates, acts], fx)
      const p = callPort(() => prodLoadMonth_(sheetBook(tabs) as never, dates, acts as never))
      const d = diffPath(l, p)
      if (d) throw new Error(`vec ${i}: ${d}`)
    }
  })
})

describe('computeProductivityForDate_ + prodComputeDates_ — full path incl. writes', () => {
  const monthTabs = (opts: { fdAux?: unknown[][]; maqsam?: unknown[][]; exc?: unknown[][]; qual?: unknown[][]; headcount?: unknown[][] }) => ({
    Headcount: [
      ['EmpID', 'Name', 'X', 'Email', 'FDid', 'FDName', 'TLName', 'TLEmail'],
      ['E1', 'Agent A', '', 'a@dabdoob.com', 'FD1', 'FD Agent A', 'TL One', 'tl@dabdoob.com'],
      ['E2', 'Agent B', '', 'b@dabdoob.com', 'FD2', 'FD Agent B', 'TL One', 'tl@dabdoob.com'],
    ],
    Assumptions: [['', ''], ['', ''], ['', ''], ['', 5], ['', 480], ['', 6]],
    'Maqsam Calls': ([['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h', 'i', 'j', 'k', 'l']] as unknown[][]).concat(opts.maqsam || []),
    FD_AUX: ([['h']] as unknown[][]).concat(opts.fdAux || []),
    'AUXes Exceptions': ([['h']] as unknown[][]).concat(opts.exc || []),
    Quality: ([['h']] as unknown[][]).concat(opts.qual || []),
  })

  function computeFixture(vec: { fdAux: unknown[][]; maqsam: unknown[][]; acts: unknown[][]; exc: unknown[][]; qual: unknown[][]; flags?: unknown[][] }) {
    return baseFixtures({
      nowMs: Date.parse('2026-10-29T13:00:00Z'),
      spreadsheets: {
        'prod-fallback': monthTabs({ fdAux: vec.fdAux, maqsam: vec.maqsam, exc: vec.exc, qual: vec.qual }),
        'fd-activity': { Activities: ([['h']] as unknown[][]).concat(vec.acts) },
        'prod-store': { prod_flags: ([['flag_id', 'date', 'agent_email', 'agent_name', 'raw_status', 'interval_start', 'interval_end', 'interval_min', 'flagged_min', 'suggested_status', 'validated_status', 'decision', 'due_date', 'tl_email', 'created_at', 'decided_at', 'decided_by', 'reason', 'review_open_ms', 'spans_json', 'case_count', 'distinct_cases', 'case_ids_json', 'channel_mix_json', 'confidence_score', 'confidence_level', 'confidence_factors_json', 'rule_json', 'source', 'updated_at']] as unknown[][]).concat(vec.flags || []) },
        'data-2026': {},
      },
    })
  }

  const portIo = (fx: ReturnType<typeof computeFixture>) => {
    const writes: { fn: string; args: unknown[] }[] = []
    const io: ProdIo = {
      cfg: fx.settings as Cfg,
      openSpreadsheet: (id: string) => sheetBook((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)[id] || {}) as never,
      prodRows: (name: string) => {
        const tab = ((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)['prod-store'] || {})[name] || []
        const hdrs = (tab[0] || []) as string[]
        return tab.slice(1).filter((r) => (r as unknown[])[0] !== '' && (r as unknown[])[0] !== null).map((r) => Object.fromEntries((r as unknown[]).map((v, i) => [hdrs[i], v]))) as Record<string, unknown>[]
      },
      roster: null,
      upsert: (t, cols, rows) => writes.push({ fn: 'dqUpsert_', args: [t, cols, rows, null] }),
      upsertIn: (t, cols, rows) => writes.push({ fn: 'dqUpsertIn_', args: [t, cols, rows, null] }),
    }
    return { io, writes }
  }

  it('computeProductivityForDate_ — 100 vectors, every field byte-identical', () => {
    for (let i = 0; i < 100; i++) {
      const dateStr = '2026-10-29'
      const maqsam: unknown[][] = []
      const fdAux: unknown[][] = []
      const exc: unknown[][] = []
      const qual: unknown[][] = []
      const acts: unknown[][] = []
      for (let j = 0; j < rint(R, 0, 6); j++) {
        maqsam.push(['', '', '', '', '', '', rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), rpick(R, ['Serviced', 'Abandoned', 'x']), rpick(R, ['Inbound', 'Outbound']), '', '2026-10-29', rint(R, 0, 900) / 60])
        fdAux.push([rpick(R, ['Agent A', 'Agent B']), rpick(R, ['IDLE', 'Available', 'Inbound Calls', 'Chats', 'Waiting Address', 'Busy']), '', '', rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), rint(R, 0, 480), '2026-10-29'])
        exc.push([rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), '2026-10-29', '', rint(R, 0, 60)])
        qual.push([rpick(R, ['a@dabdoob.com', 'b@dabdoob.com']), '2026-10-29', rint(R, 0, 100)])
      }
      for (let j = 0; j < rint(R, 0, 10); j++) {
        acts.push(['2026-10-29 08:00', 'T' + rint(R, 1, 4), rpick(R, ['Agent A', 'Agent B']), 'Agent', 'Update', 'status', rpick(R, ['Open', 'Pending on CX', 'Resolved']), '', rpick(R, ['FreshChat', 'Chat', 'Internal Escalation', 'Waiting Address', 'Other']), '2026-10-29'])
      }
      const fx = computeFixture({ fdAux, maqsam, acts, exc, qual })
      const ss = sheetBook(fx.spreadsheets!['prod-fallback']) as never
      const names = prodNameToEmail_(prodHeadcountRows_(ss))
      const activities = prodActivitiesFromRows_((fx.spreadsheets!['fd-activity']!['Activities'] as unknown[][]).slice(1), [dateStr], names, 'Asia/Kuwait')
      const assumptions = prodAssumptions_(ss)
      const raw = prodLoadMonth_(ss, [dateStr], activities)
      const l = callLegacy('computeProductivityForDate_', [dateStr, raw, assumptions], fx)
      const p = callPort(() => computeProductivityForDate_(dateStr, raw as never, assumptions))
      const d = diffPath(l, p)
      if (d) throw new Error(`vec ${i}: ${d}`)
    }
  })

  it('prodComputeDates_ / prodComputeRange_ — writes identical (30 vectors)', () => {
    for (let i = 0; i < 30; i++) {
      const fdAux: unknown[][] = [
        ['Agent A', 'Available', '', '', 'a@dabdoob.com', rint(R, 60, 480), '2026-10-29'],
        ['Agent A', 'IDLE', '', '', 'a@dabdoob.com', rint(R, 0, 60), '2026-10-29'],
        ['Agent B', 'Chats', '', '', 'b@dabdoob.com', rint(R, 60, 400), '2026-10-29'],
      ]
      const maqsam: unknown[][] = [['', '', '', '', '', '', 'a@dabdoob.com', 'Serviced', 'Inbound', '', '2026-10-29', rint(R, 60, 600) / 60]]
      const acts: unknown[][] = [['2026-10-29 08:00', 'T1', 'Agent A', 'Agent', 'Update', 'status', 'Open', '', 'FreshChat', '2026-10-29']]
      const fx = computeFixture({ fdAux, maqsam, acts, exc: [], qual: [] })
      const dates = ['2026-10-29']
      const l = callLegacy('prodComputeDates_', [dates, (fx.spreadsheets!['fd-activity']!['Activities'] as unknown[][]).slice(1)], fx)
      const { io, writes } = portIo(fx)
      const p = callPort(() => prodComputeDates_(dates, (fx.spreadsheets!['fd-activity']!['Activities'] as unknown[][]).slice(1), io))
      const d = diffPath(l, p)
      if (d) throw new Error(`dates ${i}: ${d}`)
      // writes: oracle __WRITES__ vs port io.upsert — same tables, same row fields
      const ow = oracle().writes()
      const dW = diffPath(json(ow.map((w: { fn: string; args: unknown[] }) => ({ fn: w.fn, args: json(w.args) }))), json(writes))
      if (dW) throw new Error(`writes ${i}: ${dW}`)
    }
  })

  it('dqProductivityRollup_ / runProductivityRange', () => {
    const fx = computeFixture({ fdAux: [['Agent A', 'Available', '', '', 'a@dabdoob.com', 300, '2026-10-27']], maqsam: [], acts: [], exc: [], qual: [] })
    const l = callLegacy('dqProductivityRollup_', [], fx)
    const { io } = portIo(fx)
    const p = callPort(() => dqProductivityRollup_(io, new Date(fx.nowMs as number)))
    expect(diffPath(l, p)).toBeNull()

    const l2 = callLegacy('runProductivityRange', ['2026-10-27', '2026-10-27'], fx)
    const { io: io2 } = portIo(fx)
    const p2 = callPort(() => runProductivityRange('2026-10-27', '2026-10-27', { ...io2, startedMs: fx.nowMs as number }))
    expect(diffPath(l2, p2)).toBeNull()
    // bad dates throw identically
    same('runProductivityRange', ['xx', '2026-10-27'], () =>
      runProductivityRange('xx', '2026-10-27', io2), fx, 'bad range')
  })
})

describe('prodDetectDates_ / prodAutoAccept_ — flag orchestration', () => {
  it('prodDetectDates_ — 30 vectors, writes + result identical (log ids masked)', () => {
    for (let i = 0; i < 30; i++) {
      const s = Date.parse('2026-10-29T05:00:00Z') + rint(R, 0, 7200000)
      const e = s + rint(R, 600000, 10800000)
      const intervals = [
        ['date', 'agent_email', 'agent_name', 'status', 'start_at', 'end_at', 'minutes'],
        ['2026-10-29', 'a@dabdoob.com', 'Agent A', 'IDLE', new Date(s).toISOString(), new Date(e).toISOString(), (e - s) / 60000],
      ]
      const acts: unknown[][] = []
      for (let j = 0; j < rint(R, 0, 8); j++)
        acts.push(['2026-10-29 06:00', 'T' + rint(R, 1, 4), 'Agent A', 'Agent', 'Update', 'status', 'Open', '', rpick(R, ['FreshChat', 'Waiting Address']), '2026-10-29'])
      const fx = baseFixtures({
        nowMs: Date.parse('2026-10-29T13:00:00Z'),
        settings: {
          prod_flag_cases_x: 2, prod_flag_window_min: 10, prod_flag_min_interval_min: 5,
          prod_flag_statuses: ['IDLE'], prod_channel_status: { ticket: 'Available', chat: 'Chats', wa: 'Waiting Address' },
          prod_chat_groups: ['FreshChat'], prod_wa_groups: ['Waiting Address'], prod_review_days: 2,
          prod_flag_auto_accept: R() < 0.5, prod_confidence_auto_threshold: 70, prod_working_statuses: ['Available'],
        },
        spreadsheets: {
          'prod-store': { prod_intervals: intervals, prod_flags: [['flag_id']], prod_window_hist: [], prod_flag_log: [] },
          'fd-activity': { Activities: ([['h']] as unknown[][]).concat(acts) },
        },
        data: {
          Roster: [
            ['email', 'name', 'freshdesk_id', 'freshdesk_name', 'maqsam_name', 'tl_email', 'source', 'active'],
            ['a@dabdoob.com', 'Agent A', 'FD1', 'FD Agent A', 'A', 'tl@dabdoob.com', 'hct', 'true'],
            ['tl@dabdoob.com', 'TL One', '', '', '', '', 'hct', 'true'],
          ],
        },
      })
      const l = callLegacy('prodDetectDates_', [['2026-10-29'], (fx.spreadsheets!['fd-activity']!['Activities'] as unknown[][]).slice(1)], fx)
      const writes: { fn: string; args: unknown[] }[] = []
      const io: ProdIo & { dir: { managerOf: (e: string) => string | null }; headcount: never[]; today: number | Date; nowMs: number; newId: () => string; prodRows: (n: string) => Record<string, unknown>[] } = {
        cfg: fx.settings as Cfg,
        openSpreadsheet: (id: string) => sheetBook((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)[id] || {}) as never,
        prodRows: (name: string) => {
          const tab = ((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)['prod-store'] || {})[name] || []
          const hdrs = (tab[0] || []) as string[]
          return tab.slice(1).filter((r) => (r as unknown[])[0] !== '' && (r as unknown[])[0] !== null).map((r) => Object.fromEntries((r as unknown[]).map((v, i2) => [hdrs[i2], v]))) as Record<string, unknown>[]
        },
        dir: { managerOf: () => 'tl@dabdoob.com' },
        headcount: [{ email: 'a@dabdoob.com', name: 'Agent A', fdId: 'FD1', fdName: 'FD Agent A', tlEmail: 'tl@dabdoob.com' } as never],
        today: new Date(fx.nowMs as number),
        nowMs: fx.nowMs as number,
        newId: () => 'pfl_x',
        upsert: (t, cols, rows) => writes.push({ fn: 'dqUpsert_', args: [t, cols, rows, null] }),
        upsertIn: (t, cols, rows) => writes.push({ fn: 'dqUpsertIn_', args: [t, cols, rows, null] }),
        append: (t, rows) => writes.push({ fn: 'dqAppend_', args: [t, rows] }),
      }
      const p = callPort(() => prodDetectDates_(['2026-10-29'], (fx.spreadsheets!['fd-activity']!['Activities'] as unknown[][]).slice(1), io as never))
      const d = diffPath(l, p)
      if (d) throw new Error(`detect ${i}: ${d}`)
      // writes — mask log_id (random id, both sides use their own generator)
      const mask = (v: unknown): unknown => {
        if (v && typeof v === 'object' && !Array.isArray(v)) {
          const o = { ...(v as Record<string, unknown>) }
          if ('log_id' in o) o.log_id = 'X'
          Object.keys(o).forEach((k) => (o[k] = mask(o[k])))
          return o
        }
        if (Array.isArray(v)) return v.map(mask)
        return v
      }
      const dW = diffPath(json(mask(oracle().writes())), json(mask(writes)))
      if (dW) throw new Error(`detect writes ${i}: ${dW}`)
    }
  })

  it('prodAutoAccept_ — pending flags past due flip to auto', () => {
    for (let i = 0; i < 20; i++) {
      const flags = [
        ['flag_id', 'date', 'agent_email', 'decision', 'suggested_status', 'raw_status', 'due_date'],
        ['PF1', '2026-10-27', 'a@x.com', 'pending', 'Chats', 'IDLE', rpick(R, ['2026-10-28', '2026-10-29', '2026-10-30', ''])],
        ['PF2', '2026-10-28', 'b@x.com', 'accepted', 'Chats', 'IDLE', '2026-10-28'],
      ]
      const fx = baseFixtures({
        nowMs: Date.parse('2026-10-29T10:00:00Z'),
        spreadsheets: { 'prod-store': { prod_flags: flags, prod_flag_log: [] } },
      })
      const l = callLegacy('prodAutoAccept_', [], fx)
      const writes: { fn: string; args: unknown[] }[] = []
      const io = {
        cfg: fx.settings as Cfg,
        openSpreadsheet: (id: string) => sheetBook({}) as never,
        prodRows: (name: string) => {
          const tab = ((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)['prod-store'] || {})[name] || []
          const hdrs = (tab[0] || []) as string[]
          return tab.slice(1).filter((r) => (r as unknown[])[0] !== '' && (r as unknown[])[0] !== null).map((r) => Object.fromEntries((r as unknown[]).map((v, i2) => [hdrs[i2], v]))) as Record<string, unknown>[]
        },
        today: new Date(fx.nowMs as number),
        nowMs: fx.nowMs as number,
        upsert: (t: string, c: string[], rows: Record<string, unknown>[]) => writes.push({ fn: 'dqUpsert_', args: [t, c, rows, null] }),
        upsertIn: (t: string, c: string[], rows: Record<string, unknown>[]) => writes.push({ fn: 'dqUpsertIn_', args: [t, c, rows, null] }),
        append: (t: string, rows: Record<string, unknown>[]) => writes.push({ fn: 'dqAppend_', args: [t, rows] }),
      }
      const p = callPort(() => prodAutoAccept_(io as never))
      const d = diffPath(l, p)
      if (d) throw new Error(`auto ${i}: ${d}`)
    }
  })
})
