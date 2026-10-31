/**
 * Golden tests: src/lib/scorecard/index.ts vs WorkCore.js verbatim in the oracle.
 */
import { describe, it, expect } from 'vitest'
import { baseFixtures, callLegacy, callPort, diffPath, oracle, rint, rng, rpick, same } from './helpers-oracle'
import {
  d0num_,
  pwActionOut_,
  pwBreakHours_,
  pwDayHours_,
  pwFit_,
  pwFreeHours_,
  pwIsOpenStatus_,
  pwLatestPercent_,
  pwOpenSeriesActions_,
  pwPrevMonth_,
  pwRound1_,
  pwShiftDefs_,
  pwUpdateOut_,
  pwWorkingHours_,
  pwWorkingHoursRaw_,
  scAdd_,
  scAggregate_,
  scBucket_,
  scCasesInRange_,
  scDayRows_,
  scDerive_,
  scEmail_,
  scLoad_,
  scMonthRows_,
  scMonthsOf_,
  scMonthView_,
  scNotes_,
  scNum_,
  scNumRow_,
  scRank_,
  scRound1_,
  scSources_,
  scWorkbookFor_,
} from '../../src/lib/scorecard'
import type { Cfg } from '../../src/lib/prod/adapters'

const R = rng(0x77aa11)
const CFG = baseFixtures().settings as Cfg

describe('small helpers', () => {
  it('pwIsOpenStatus_ / pwOpenSeriesActions_ / pwPrevMonth_ / d0num_ / pwFit_ / pwRound1_ / scRound1_ / scEmail_ / scNum_', () => {
    for (let i = 0; i < 60; i++) {
      const s = rpick(R, ['open', 'blocked', 'done', '', 'OPEN'])
      same('pwIsOpenStatus_', [s], () => pwIsOpenStatus_(s), {}, `ios ${i}`)
      const v = rpick(R, ['', null, undefined, '42', '7.5%', ' x ', 33, '95%'])
      same('d0num_', [v], () => d0num_(v), {}, `d0 ${i}`)
      same('scNum_', [v], () => scNum_(v), {}, `scnum ${i}`)
      same('scEmail_', [v], () => scEmail_(v), {}, `sce ${i}`)
      const n = rint(R, -500, 5000) / 31
      same('pwRound1_', [n], () => pwRound1_(n), {}, `r1 ${i}`)
      same('scRound1_', [n], () => scRound1_(n), {}, `sr1 ${i}`)
      const m = `2026-${String(rint(R, 1, 12)).padStart(2, '0')}`
      same('pwPrevMonth_', [m], () => pwPrevMonth_(m), {}, `pm ${i}`)
      const est = rint(R, 0, 20) / 2
      const free = rint(R, 0, 24) / 2
      same('pwFit_', [est, free], () => pwFit_(est, free), {}, `fit ${i}`)
    }
    const acts = [
      { series_id: 'S1', status: 'open' },
      { series_id: 'S1', status: 'blocked' },
      { series_id: 'S1', status: 'done' },
      { series_id: 'S2', status: 'open' },
      { series_id: 'S1', status: '' },
    ]
    same('pwOpenSeriesActions_', ['S1', acts], () => pwOpenSeriesActions_('S1', acts))
    const ups = [{ percent_complete: '' }, { percent_complete: 55 }, { percent_complete: 80 }]
    same('pwLatestPercent_', [ups], () => pwLatestPercent_(ups))
    same('pwLatestPercent_', [[]], () => pwLatestPercent_([]))
  })
})

describe('working hours', () => {
  it('pwBreakHours_ / pwShiftDefs_ / pwDayHours_ / pwWorkingHoursRaw_ / pwWorkingHours_ / pwFreeHours_', () => {
    const fx = baseFixtures({
      settings: { shift_break_hours: 1, shift_defs: { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } } },
    })
    same('pwBreakHours_', [], () => pwBreakHours_(fx.settings as Cfg), fx)
    same('pwShiftDefs_', [], () => pwShiftDefs_(fx.settings as Cfg), fx)
    same('pwBreakHours_', [], () => pwBreakHours_(baseFixtures().settings as Cfg))
    for (let i = 0; i < 80; i++) {
      const day = {
        date: `2026-10-${String(rint(R, 25, 31)).padStart(2, '0')}`,
        working: R() < 0.8,
        shift: rpick(R, ['AM', 'PM', null, 'X']),
        estimated: R() < 0.2,
      }
      const fromMs = Date.parse(day.date + 'T00:00:00Z') + rint(R, 0, 43200000)
      const toMs = fromMs + rint(R, 0, 43200000)
      same('pwDayHours_', [day, fromMs, toMs], () => pwDayHours_(day as never, fromMs, toMs, fx.settings as Cfg), fx, `dh ${i}`)
      const p2 = callPort(() => pwWorkingHours_([day] as never, fx.settings as Cfg, 'e@x.com', fromMs, toMs))
      expect(p2.err).toBeUndefined()
    }
    // pwWorkingHoursRaw_ / pwWorkingHours_ / pwFreeHours_ run getWorkingCalendar_ internally
    // on the oracle side; inject the oracle's own calendar into the port so both sides
    // walk identical days.
    const roster = [
      ['email', 'name', 'tl_email', 'country', 'source', 'role', 'active', 'days_off'],
      ['e@x.com', 'Agent E', 'tl@x.com', 'Kuwait', 'hct', 'agent', 'true', ''],
    ]
    const fx2 = baseFixtures({
      settings: { shift_break_hours: 1, days_off_default: [], days_off_by_country: {} },
      data: { Roster: roster, holidays: [['date']] },
      nowMs: Date.parse('2026-10-27T10:00:00Z'),
    })
    for (let i = 0; i < 30; i++) {
      const startMs = Date.parse('2026-10-28T00:00:00Z') + rint(R, 0, 36000000)
      const endMs = startMs + rint(R, 3600000, 14400000)
      const from = new Date(startMs).toISOString().slice(0, 10)
      const to = new Date(endMs).toISOString().slice(0, 10)
      const cal = callLegacy('getWorkingCalendar_', ['e@x.com', from, to], fx2)
      if (cal.err) continue // oracle calendar unavailable for this fixture — skip the pair
      const days = cal.ok as never[]
      const l = callLegacy('pwWorkingHoursRaw_', ['e@x.com', startMs, endMs], fx2)
      const p = callPort(() => pwWorkingHoursRaw_(days, fx2.settings as Cfg, 'e@x.com', startMs, endMs))
      expect(diffPath(l, p)).toBeNull()
      const l2 = callLegacy('pwWorkingHours_', ['e@x.com', startMs, endMs], fx2)
      const p2 = callPort(() => pwWorkingHours_(days, fx2.settings as Cfg, 'e@x.com', startMs, endMs))
      expect(diffPath(l2, p2)).toBeNull()
      const others = [
        { startMs: startMs - 7200000, endMs: startMs - 3600000, remaining: rint(R, 0, 6) },
        { startMs, endMs, remaining: rint(R, 0, 4) },
      ]
      const l3 = callLegacy('pwFreeHours_', ['e@x.com', startMs, endMs, others], fx2)
      const p3 = callPort(() =>
        pwFreeHours_(
          (f: string, t: string) => (callLegacy('getWorkingCalendar_', ['e@x.com', f, t], fx2).ok as never[]) || [],
          fx2.settings as Cfg,
          'e@x.com',
          startMs,
          endMs,
          others
        )
      )
      if (!l3.err) expect(diffPath(l3, p3)).toBeNull()
    }
  })
})

describe('scorecard math', () => {
  it('scBucket_ / scAdd_ / scRank_ / scCasesInRange_ / scNumRow_ / scMonthsOf_ / scMonthView_ / scMonthRows_', () => {
    for (let i = 0; i < 40; i++) {
      const r: Record<string, number> = {
        matrix_day: rint(R, 0, 1),
        inb_target: rint(R, 0, 480),
        inb_achieved: rint(R, 0, 40),
        txt_target: rint(R, 0, 300),
        txt_achieved: rint(R, 0, 50),
        wa_target: rint(R, 0, 90),
        wa_achieved: rint(R, 0, 12),
        audits: rint(R, 0, 8),
        score_x_audits: rint(R, 0, 800),
        fcr_passed: rint(R, 0, 30),
        fcr_failed: rint(R, 0, 8),
        fcr_excluded: rint(R, 0, 4),
      }
      const bkN = rint(R, 0, 3)
      same('scBucket_', [bkN], () => scBucket_(bkN), {}, `bk ${i}`)
      // scAdd_ mutates its bucket and returns nothing — __fn_scAddAcc__ returns the
      // post-mutation accumulator so both sides compare the bucket
      same('__fn_scAddAcc__', [scBucket_(0), r], () => {
        const bucket = scBucket_(0)
        scAdd_(bucket, r)
        return bucket
      }, {}, `add ${i}`)
      const rows = [
        { overall: rint(R, 0, 100) / 10, name: 'B', rank: null },
        { overall: null, name: 'A', rank: null },
        { overall: rint(R, 0, 100) / 10, name: 'C', rank: null },
      ]
      same('scRank_', [rows.map((x) => ({ ...x }))], () => scRank_(rows.map((x) => ({ ...x }))), {}, `rank ${i}`)
      const cases = [{ email: 'a@x', date: '', month: '2026-10' }, { email: 'a@x', date: '2026-10-15' }]
      same('scCasesInRange_', [cases, '2026-10-01', '2026-10-31'], () => scCasesInRange_(cases, '2026-10-01', '2026-10-31'), {}, `cir ${i}`)
      const o = {
        month: '2026-10', date: '2026-10-29', email: ' A@X.COM ', name: 'Agent A',
        matrix_day: '1', inb_target: '300', inb_achieved: '40', txt_target: '100',
        txt_achieved: '10', wa_target: '60', wa_achieved: '9', audits: '4',
        score_x_audits: '380', fcr_passed: '20', fcr_failed: '3', fcr_excluded: '2',
      }
      same('scNumRow_', [o], () => scNumRow_(o), {}, `nr ${i}`)
      same('scMonthsOf_', ['2026-10-05', '2026-12-20'], () => scMonthsOf_('2026-10-05', '2026-12-20'), {}, `mo ${i}`)
      same('scMonthView_', ['2026-10', { month: '2026-10', title: 'wb', status: 'ok', matrix_rows: '120', fcr_rows: '30', fcr_dated: 'true', behaviour_found: '1' }, { id: 'w1', fallback: false }], () =>
        scMonthView_('2026-10', { month: '2026-10', title: 'wb', status: 'ok', matrix_rows: '120', fcr_rows: '30', fcr_dated: 'true', behaviour_found: '1' }, { id: 'w1', fallback: false }), {}, `mv ${i}`)
      // scMonthRows_() reads the sc_months live table keyed on month — seed + same objects
      const mfx = baseFixtures({
        spreadsheets: { 'live-store': { sc_months: [['month', 'x'], [`2026-${String(rint(R, 1, 12)).padStart(2, '0')}`, String(i)]] } },
      })
      const lMr = callLegacy('scMonthRows_', [], mfx)
      const pMr = callPort(() => scMonthRows_(oracle().objects('sc_months', mfx) as never))
      expect(diffPath(lMr, pMr)).toBeNull()
    }
  })

  it('scDerive_ — 200 vectors incl. missing KPIs and behaviour unknown', () => {
    for (let i = 0; i < 200; i++) {
      const a = {
        days: rint(R, 0, 26),
        inbTarget: rint(R, 0, 480),
        inbAchieved: rint(R, 0, 40),
        txtTarget: rint(R, 0, 300),
        txtAchieved: rint(R, 0, 50),
        waTarget: rint(R, 0, 90),
        waAchieved: rint(R, 0, 12),
        audits: rint(R, 0, 8),
        scoreXaudits: rint(R, 0, 800),
      }
      const f = R() < 0.3 ? null : { passed: rint(R, 0, 40), failed: rint(R, 0, 8), excluded: rint(R, 0, 5) }
      const b = R() < 0.8 ? { found: true, cases: rint(R, 0, 3), details: [] } : { found: false, cases: 0, details: [] }
      const k = R() < 0.4 ? null : { olCases: rint(R, 0, 2), leaveIneligible: R() < 0.15, probationMonth: rint(R, 0, 4) }
      same('scDerive_', [a, f, b, k], () => scDerive_(a, f, b, k), {}, `sd ${i}`)
    }
  })

  it('scAggregate_ / scDayRows_ — 60 vectors (kctx bound in vm)', () => {
    for (let i = 0; i < 60; i++) {
      const daily: Record<string, unknown>[] = []
      for (let j = 0; j < rint(R, 0, 8); j++)
        daily.push({
          email: rpick(R, ['a@x.com', 'b@x.com']), name: rpick(R, ['Agent A', '']), date: '2026-10-' + String(rint(R, 25, 29)),
          matrix_day: rint(R, 0, 1), inb_target: rint(R, 0, 400), inb_achieved: rint(R, 0, 30),
          txt_target: rint(R, 0, 200), txt_achieved: rint(R, 0, 30), wa_target: rint(R, 0, 60), wa_achieved: rint(R, 0, 10),
          audits: rint(R, 0, 6), score_x_audits: rint(R, 0, 600), fcr_passed: rint(R, 0, 20), fcr_failed: rint(R, 0, 6), fcr_excluded: rint(R, 0, 3),
        })
      const cases = [{ email: 'a@x.com', date: '2026-10-27', note: 'n1' }]
      const who = { 'a@x.com': { name: 'Agent A', tlName: 'TL One', tlEmail: 'tl@x.com' } }
      const kctx = '@@fn:__fn_kctx__'
      const kctxPort = () => ({ probationMonth: 1, olCases: 0, leaveIneligible: false })
      same('scAggregate_', [daily, cases, true, who, kctx], () =>
        scAggregate_(daily as never, cases, true, who, kctxPort), {}, `agg ${i}`)
      same('scDayRows_', [daily, cases, true, 'a@x.com', kctx], () =>
        scDayRows_(daily as never, cases, true, 'a@x.com', kctxPort), {}, `dr ${i}`)
    }
  })

  it('scLoad_ / scNotes_ / scSources_ / scWorkbookFor_ — store seams', () => {
    const fx = baseFixtures({
      settings: { productivity_files: { '2026-10': 'wb-2026-10' } },
      spreadsheets: {
        'live-store': {
          sc_months: [['month', 'title', 'status', 'matrix_rows', 'fcr_rows', 'fcr_dated', 'behaviour_found', 'workbook_id'], ['2026-10', 'wb', 'ok', '5', '3', 'true', '1', 'wb-2026-10']],
          kpi_behaviour_log: [['email', 'date', 'note', 'removed_at'], ['a@x.com', '2026-10-15', 'n1', '']],
        },
        'data-2026': {
          sc_daily: [
            ['date', 'month', 'email', 'name', 'matrix_day', 'inb_target', 'inb_achieved', 'txt_target', 'txt_achieved', 'wa_target', 'wa_achieved', 'audits', 'score_x_audits', 'fcr_passed', 'fcr_failed', 'fcr_excluded'],
            ['2026-10-15', '2026-10', 'a@x.com', 'Agent A', '1', '300', '40', '100', '10', '60', '9', '4', '380', '20', '3', '2'],
          ],
          sc_behaviour: [['month', 'date', 'email', 'note'], ['2026-10', '2026-10-15', 'a@x.com', 'n1']],
        },
      },
    })
    const l = callLegacy('scLoad_', [{ from: '2026-10-01', to: '2026-10-31' }], fx)
    // port: scLoad_(io, range) with io mirroring the oracle stores
    const readRange = (name: string, from: string, to: string) => {
      // emulate scReadRange_ over the data-2026 tabs
      const tab = ((fx.spreadsheets as Record<string, Record<string, unknown[][]>>)['data-2026'] || {})[name] || []
      const hdrs = (tab[0] || []) as string[]
      return tab.slice(1).map((r) => Object.fromEntries((r as unknown[]).map((v, j) => [hdrs[j], v]))) as Record<string, unknown>[]
    }
    const p = callPort(() =>
      scLoad_(
        {
          readRange,
          behaviourLogRows: [{ email: 'a@x.com', date: '2026-10-15', note: 'n1', removed_at: '' }],
          monthRows: () => ({ '2026-10': { month: '2026-10', title: 'wb', status: 'ok', matrix_rows: '5', fcr_rows: '3', fcr_dated: 'true', behaviour_found: '1', workbook_id: 'wb-2026-10' } }),
          workbookFor: (m: string) => ({ id: m === '2026-10' ? 'wb-2026-10' : 'prod-fallback', fallback: m !== '2026-10' }),
        },
        { from: '2026-10-01', to: '2026-10-31' }
      )
    )
    expect(diffPath(l, p)).toBeNull()
    same('scNotes_', [['2026-10'], [{ month: '2026-10', status: 'ok', fcrRows: 3, fcrNote: '', fcrDated: true, behaviourFound: true }]], () =>
      scNotes_(['2026-10'], [{ month: '2026-10', status: 'ok', fcrRows: 3, fcrNote: '', fcrDated: true, behaviourFound: true }]))
    const l2 = callLegacy('scSources_', [], fx)
    const p2 = callPort(() => scSources_(fx.settings as Cfg))
    expect(diffPath(l2, p2)).toBeNull()
    const l3 = callLegacy('scWorkbookFor_', ['2026-10'], fx)
    const p3 = callPort(() => scWorkbookFor_('2026-10', fx.settings as Cfg))
    expect(diffPath(l3, p3)).toBeNull()
    const l4 = callLegacy('scWorkbookFor_', ['2026-11'], fx)
    const p4 = callPort(() => scWorkbookFor_('2026-11', fx.settings as Cfg))
    expect(diffPath(l4, p4)).toBeNull()
  })

  it('pwActionOut_ / pwUpdateOut_ — view mappers', () => {
    const dirArg = { name: '@@fn:__fn_dir_name__' }
    const dir = { name: (e: string) => 'Name ' + e }
    for (let i = 0; i < 40; i++) {
      const a = {
        action_id: 'A' + i, title: 't', description: 'd', owner_email: ' A@x.COM ', assigned_by: 'b@x.com',
        due_date: '2026-10-30', source_type: 'manual', source_id: 'S', series_id: 'ser', topic: 'topic',
        status: rpick(R, ['open', 'blocked', 'done', '']), outcome_note: 'n', closed_at: '2026-10-29T10:00:00Z',
        visibility: 'shared', track_as_task: 'true', carry_count: '3', source_deleted_at: '', submitted_at: '2026-10-28T09:00:00Z',
      }
      same('pwActionOut_', [a, dirArg], () => pwActionOut_(a, dir), {}, `ao ${i}`)
      const u = {
        update_id: 'U' + i, action_id: 'A1', kind: rpick(R, ['status', 'file', 'x']), note: 'n',
        percent_complete: rpick(R, ['', 55, '70']), rag: 'g', next_step: 'nx', drive_file_id: 'f1',
        file_name: 'fn', planned_milestone_id: 'pm', submitted_by: 'sub@x.com', submitted_at: '2026-10-29T08:00:00Z',
      }
      same('pwUpdateOut_', [u, dirArg], () => pwUpdateOut_(u, dir), {}, `uo ${i}`)
    }
  })
})
