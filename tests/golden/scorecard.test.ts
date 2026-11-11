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
  scTrend_,
  scWorkbookFor_,
} from '@/features/cx-people/lib/scorecard'
import { pwTasksOut_ } from '@/features/cx-people/lib/work-core'
import type { Cfg } from '@/features/shared/lib/adapters'

const R = rng(0x77aa11)

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

  it('pwFit_ — exact fit boundaries (WP-23)', () => {
    // est<=0 always fits; est>free does_not_fit; est>0.8*free tight; else fits
    const cases: [unknown, unknown][] = [
      [0, 10], [-1, 10], [-0.5, 10], [10, 10], [8, 10], [8.0001, 10], [7.9999, 10],
      [10.0001, 10], [10, 0], [10, -1], [0, 0], [0, -5], ['x', 10], [10, 'x'],
      ['5', '10'], [1e-9, 10],
    ]
    cases.forEach(([est, free], i) => same('pwFit_', [est, free], () => pwFit_(est as number, free as number), {}, `fit edge ${i}`))
  })

  it('scDerive_ — FCR/audit/target absence edges (WP-23)', () => {
    const a = {
      days: 3, inbTarget: 300, inbAchieved: 40, txtTarget: 100, txtAchieved: 10,
      waTarget: 60, waAchieved: 9, audits: 4, scoreXaudits: 380,
    }
    // FCR: excluded-only -> fcr null (excluded never enters the denominator)
    same('scDerive_', [a, { passed: 0, failed: 0, excluded: 9 }, { found: true, cases: 0, details: [] }, null], () =>
      scDerive_(a as never, { passed: 0, failed: 0, excluded: 9 }, { found: true, cases: 0, details: [] }, null), {}, 'fcr excl only')
    same('scDerive_', [a, { passed: 1, failed: 0, excluded: 4 }, { found: true, cases: 0, details: [] }, null], () =>
      scDerive_(a as never, { passed: 1, failed: 0, excluded: 4 }, { found: true, cases: 0, details: [] }, null), {}, 'fcr 1/0')
    same('scDerive_', [a, null, { found: true, cases: 0, details: [] }, null], () =>
      scDerive_(a as never, null, { found: true, cases: 0, details: [] }, null), {}, 'fcr null')
    same('scDerive_', [a, { passed: 0, failed: 3, excluded: 0 }, { found: true, cases: 0, details: [] }, null], () =>
      scDerive_(a as never, { passed: 0, failed: 3, excluded: 0 }, { found: true, cases: 0, details: [] }, null), {}, 'fcr all fail')
    // audits 0 -> qual null; totalTarget 0 -> prod null
    same('scDerive_', [{ ...a, audits: 0, scoreXaudits: 0 }, null, { found: true, cases: 0, details: [] }, null], () =>
      scDerive_({ ...a, audits: 0, scoreXaudits: 0 } as never, null, { found: true, cases: 0, details: [] }, null), {}, 'audits 0')
    same('scDerive_', [
      { days: 0, inbTarget: 0, inbAchieved: 0, txtTarget: 0, txtAchieved: 0, waTarget: 0, waAchieved: 0, audits: 0, scoreXaudits: 0 },
      null, null, null,
    ], () =>
      scDerive_({ days: 0, inbTarget: 0, inbAchieved: 0, txtTarget: 0, txtAchieved: 0, waTarget: 0, waAchieved: 0, audits: 0, scoreXaudits: 0 } as never, null, null, null), {}, 'all zero')
    // behaviour: unknown (found false) vs found with cases vs found clean
    for (const b of [null, { found: false, cases: 7, details: [] }, { found: true, cases: 0, details: [] }, { found: true, cases: 1, details: [{ date: '2026-10-15', note: 'n' }] }]) {
      same('scDerive_', [a, { passed: 9, failed: 1, excluded: 0 }, b, null], () =>
        scDerive_(a as never, { passed: 9, failed: 1, excluded: 0 }, b as never, null), {}, `bhv ${JSON.stringify(b)}`)
    }
    // kctx: probation bands vs configured bands, OL halving, leave ineligibility
    for (const k of [null, {}, { probationMonth: 1 }, { probationMonth: 2 }, { probationMonth: 3 }, { probationMonth: 4 }, { olCases: 1 }, { leaveIneligible: true }, { olCases: 2, leaveIneligible: true, probationMonth: 3 }]) {
      same('scDerive_', [a, { passed: 15, failed: 5, excluded: 2 }, { found: true, cases: 1, details: [] }, k], () =>
        scDerive_(a as never, { passed: 15, failed: 5, excluded: 2 }, { found: true, cases: 1, details: [] }, k as never), {}, `kctx ${JSON.stringify(k)}`)
    }
  })

  it('scAggregate_ / scDayRows_ — kctx variants (WP-23)', () => {
    // Fixture-driven kctx inside the shared oracle: reads __FIXTURES__.kctxMap.
    oracle().eval(`globalThis.__fn_kctxMap__ = function (e) {
      var m = (__FIXTURES__ && __FIXTURES__.kctxMap) || {};
      // The real scKpiCtx_ never returns null: unmapped emails get the zero-context.
      return m[String(e).trim().toLowerCase()] || { probationMonth: 0, olCases: 0, leaveIneligible: false };
    }`)
    const daily = [
      { email: 'a@x.com', name: 'Agent A', date: '2026-10-27', matrix_day: 1, inb_target: 300, inb_achieved: 30, txt_target: 100, txt_achieved: 10, wa_target: 60, wa_achieved: 9, audits: 4, score_x_audits: 380, fcr_passed: 10, fcr_failed: 2, fcr_excluded: 1 },
      { email: 'a@x.com', name: 'Agent A', date: '2026-10-28', matrix_day: 1, inb_target: 280, inb_achieved: 10, txt_target: 90, txt_achieved: 9, wa_target: 55, wa_achieved: 8, audits: 0, score_x_audits: 0, fcr_passed: 3, fcr_failed: 4, fcr_excluded: 0 },
      { email: 'b@x.com', name: 'Agent B', date: '2026-10-28', matrix_day: 1, inb_target: 200, inb_achieved: 60, txt_target: 50, txt_achieved: 20, wa_target: 40, wa_achieved: 15, audits: 2, score_x_audits: 190, fcr_passed: 0, fcr_failed: 0, fcr_excluded: 6 },
      { email: 'a@x.com', name: 'Agent A', date: '2026-10-28', matrix_day: 0, inb_target: 0, inb_achieved: 0, txt_target: 0, txt_achieved: 0, wa_target: 0, wa_achieved: 0, audits: 0, score_x_audits: 0, fcr_passed: 2, fcr_failed: 1, fcr_excluded: 0 },
      { email: 'fcr@x.com', name: 'Fcr Only', date: '2026-10-28', matrix_day: 0, inb_target: 0, inb_achieved: 0, txt_target: 0, txt_achieved: 0, wa_target: 0, wa_achieved: 0, audits: 0, score_x_audits: 0, fcr_passed: 5, fcr_failed: 1, fcr_excluded: 0 },
    ]
    const cases = [
      { email: 'a@x.com', date: '2026-10-27', note: 'late' },
      { email: 'a@x.com', date: '', month: '2026-10', note: 'undated' },
    ]
    const who = { 'a@x.com': { name: 'Agent A', tlName: 'TL One', tlEmail: 'tl@x.com' } }
    const maps: Record<string, Record<string, unknown> | null>[] = [
      { 'a@x.com': { probationMonth: 1, olCases: 0, leaveIneligible: false }, 'b@x.com': { probationMonth: 4, olCases: 0, leaveIneligible: false } },
      { 'a@x.com': { probationMonth: 2, olCases: 1, leaveIneligible: false }, 'b@x.com': { probationMonth: 3, olCases: 0, leaveIneligible: true } },
      { 'a@x.com': { probationMonth: 0, olCases: 2, leaveIneligible: true } },
      {},
    ]
    maps.forEach((kctxMap, i) => {
      const fx = baseFixtures({ kctxMap } as never)
      const kctxPort = (e: string) =>
        (kctxMap as Record<string, never>)[String(e).trim().toLowerCase()] ||
        ({ probationMonth: 0, olCases: 0, leaveIneligible: false } as never)
      same('scAggregate_', [daily, cases, true, who, '@@fn:__fn_kctxMap__'], () =>
        scAggregate_(daily as never, cases as never, true, who as never, kctxPort), fx, `agg kctx ${i}`)
      same('scAggregate_', [daily, cases, false, who, '@@fn:__fn_kctxMap__'], () =>
        scAggregate_(daily as never, cases as never, false, who as never, kctxPort), fx, `agg kctx ${i} bhvF`)
      same('scDayRows_', [daily, cases, true, 'a@x.com', '@@fn:__fn_kctxMap__'], () =>
        scDayRows_(daily as never, cases as never, true, 'a@x.com', kctxPort), fx, `dr kctx ${i}`)
      // The empty-map iteration is the zero-context case (scKpiCtx_ never returns null).
    })
  })

  it('pwTasksOut_ — task fit/risk end-to-end (WP-23)', () => {
    const nowMs = Date.parse('2026-10-28T08:00:00Z') // Wed 11:00 Kuwait
    const iso = (ms: number) => new Date(ms).toISOString()
    const D = 86400000
    const roster = [
      ['email', 'name', 'tl_email', 'country', 'role', 'active', 'days_off', 'based_in_country'],
      ['a@x.com', 'Agent A', 'tl@x.com', 'Kuwait', 'agent', 'true', '', 'Kuwait'],
      ['b@x.com', 'Agent B', 'tl@x.com', 'Kuwait', 'agent', 'true', 'Fri,Sat', 'Kuwait'],
    ]
    const fx = baseFixtures({
      settings: {
        shift_break_hours: 1,
        days_off_default: [],
        days_off_by_country: {},
        shift_defs: { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } },
      },
      data: {
        Roster: roster,
        holidays: [['country', 'date', 'name', 'deleted_at'], ['Kuwait', '2026-10-29', 'National Day', '']],
      },
      nowMs,
    })
    const mk = (id: string, owner: string, over: Record<string, unknown> = {}) => ({
      action_id: id, title: 'Task ' + id, owner_email: owner, assigned_by: 'tl@x.com', due_date: '2026-11-01',
      source_type: 'task', source_id: '', series_id: '', topic: '', status: 'open', outcome_note: '', closed_at: '',
      closed_by: '', visibility: 'shared', track_as_task: true, carry_count: 0, source_deleted_at: '',
      submitted_at: iso(nowMs - 5 * D), ...over,
    })
    const det = (id: string, start: number, end: number, over: Record<string, unknown> = {}) => ({
      action_id: id, priority: 'P1', start_at: iso(start), deadline_at: iso(end), est_hours: 4,
      available_hours: '', fit_status: '', progress_state: '', blocked_reason: '', rag_self: '',
      delivered_at: '', delivery_ref: '', actual_hours: '', source_label: 'plan', assigned_anyway: '',
      expectation: '', outcome_rating: '', outcome_note: '', rated_by: '', rated_at: '', ...over,
    })
    const actions = [
      mk('T1', 'a@x.com'),                                                     // overdue (deadline before now)
      mk('T2', 'a@x.com'),                                                     // does_not_fit (est 40 > free)
      mk('T3', 'a@x.com'),                                                     // off_track
      mk('T4', 'a@x.com'),                                                     // no update >= 3 working days
      mk('T5', 'a@x.com'),                                                     // healthy, in progress
      mk('T6', 'a@x.com', { status: 'done', closed_at: iso(nowMs - D), closed_by: 'a@x.com', outcome_note: 'shipped' }),
      mk('T7', 'b@x.com'),                                                     // Fri/Sat days-off calendar
      mk('T8', 'a@x.com'),                                                     // excluded: no detail row
      mk('T9', 'a@x.com'),                                                     // planned milestone passed
      mk('TX', 'a@x.com', { track_as_task: 'x' }),                             // not a task: filtered out
    ]
    const details = [
      det('T1', nowMs - 4 * D, nowMs - 2 * D, { est_hours: 3 }),
      det('T2', nowMs - D, nowMs + 2 * D, { est_hours: 40 }),
      det('T3', nowMs - D, nowMs + 2 * D, { rag_self: 'off_track', progress_state: 'in_progress' }),
      det('T4', nowMs - 6 * D, nowMs + 2 * D),
      det('T5', nowMs - 2 * D, nowMs + 2 * D),
      det('T6', nowMs - 5 * D, nowMs - 3 * D, { actual_hours: '3.5' }),
      det('T7', nowMs - 2 * D, nowMs + 3 * D, { est_hours: 6 }),
      det('T9', nowMs - 6 * D, nowMs + 4 * D),
    ]
    const updates = [
      { update_id: 'U1', action_id: 'T5', kind: 'status', note: 'half', percent_complete: 55, rag: 'on_track', next_step: 'n', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '', submitted_by: 'a@x.com', submitted_at: iso(nowMs - D) },
      { update_id: 'U2', action_id: 'T4', kind: 'status', note: 'old', percent_complete: 10, rag: '', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '', submitted_by: 'a@x.com', submitted_at: iso(nowMs - 5 * D) },
      { update_id: 'U3', action_id: 'T7', kind: 'file', note: 'spec', percent_complete: '', rag: '', next_step: '', drive_file_id: 'drv1', file_name: 'f.pdf', mime_type: 'application/pdf', planned_milestone_id: 'PM1', submitted_by: 'b@x.com', submitted_at: iso(nowMs - 2 * 3600000) },
    ]
    const planned = [
      { milestone_id: 'PM1', action_id: 'T7', label: 'design', target_date: '2026-10-30', done_by_update_id: '', submitted_at: iso(nowMs - 3 * D) },
      { milestone_id: 'PM2', action_id: 'T9', label: 'kickoff', target_date: '2026-10-26', done_by_update_id: '', submitted_at: iso(nowMs - 3 * D) },
      { milestone_id: 'PM3', action_id: 'T9', label: 'sign-off', target_date: '2026-10-25', done_by_update_id: 'UX', submitted_at: iso(nowMs - 3 * D) },
    ]
    const dirArg = { name: '@@fn:__fn_dir_name__' } // 'Name '+e, built into the oracle prelude
    const calFor = (owner: string, f: string, t: string) =>
      (callLegacy('getWorkingCalendar_', [owner, f, t], fx).ok as never[]) || []
    const workdaysBetween = (owner: string, f: string, t: string) =>
      (callLegacy('pwWorkingDaysBetween_', [owner, f, t], fx).ok as number) || 0
    const cfg = JSON.parse(JSON.stringify(fx.settings)) as Cfg
    const portDir = {
      by: {}, admins: ['admin@dabdoob.com'],
      person: () => null, name: (e: string) => 'Name ' + e,
      managerOf: () => null, agentsOf: () => [], tls: () => [],
    }
    const l = callLegacy('pwTasksOut_', [{ dir: dirArg, actions, details, updates, planned, now: nowMs }], fx)
    const p = callPort(() => pwTasksOut_({
      dir: portDir as never, actions: JSON.parse(JSON.stringify(actions)), details: JSON.parse(JSON.stringify(details)),
      updates: JSON.parse(JSON.stringify(updates)), planned: JSON.parse(JSON.stringify(planned)), now: nowMs,
      cfg, calFor, workdaysBetween,
    }))
    expect(diffPath(l, p)).toBeNull()
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

  it('scTrend_ — 8 equal buckets over the range', () => {
    const row = (date: string, prodAchieved: number) => ({
      email: 'a@x.com', name: 'Agent A', date, matrix_day: 1,
      inb_target: 100, inb_achieved: prodAchieved,
      txt_target: 0, txt_achieved: 0,
      wa_target: 0, wa_achieved: 0,
      audits: 1, score_x_audits: 100,
      fcr_passed: 100, fcr_failed: 0, fcr_excluded: 0,
    })
    const daily = [
      row('2026-10-01', 100), row('2026-10-02', 0),
      row('2026-10-03', 90),
      row('2026-10-07', 0), row('2026-10-08', 82),
      row('2026-10-09', 82),
      row('2026-10-13', 82), row('2026-10-14', 90),
      row('2026-10-15', 100), row('2026-10-16', 90),
    ]
    expect(scTrend_(daily as never, [], true, 'a@x.com', undefined, '2026-10-01', '2026-10-16')).toEqual([
      82.5, 91.3, null, 73.8, 82.5, null, 86.9, 95.6,
    ])
  })

  it('scTrend_ — skips days without an overall score', () => {
    const scored = {
      email: 'a@x.com', name: 'Agent A', date: '2026-10-01', matrix_day: 1,
      inb_target: 100, inb_achieved: 100,
      txt_target: 100, txt_achieved: 100,
      wa_target: 100, wa_achieved: 100,
      audits: 1, score_x_audits: 100,
      fcr_passed: 100, fcr_failed: 0, fcr_excluded: 0,
    }
    const unscored = {
      ...scored,
      inb_target: 0, inb_achieved: 0,
      txt_target: 0, txt_achieved: 0,
      wa_target: 0, wa_achieved: 0,
      audits: 0, score_x_audits: 0,
      fcr_passed: 0,
    }
    expect(scTrend_([unscored, scored] as never, [], false, 'a@x.com', undefined, '2026-10-01', '2026-10-15')).toEqual([
      85, null, null, null, null, null, null, null,
    ])
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
    const readRange = (name: string) => {
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
