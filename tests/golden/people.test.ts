/**
 * Golden tests: the pure parts of the People & Performance port
 * (one-on-ones*.ts, one-on-one-reminders.ts, scorecard-server.ts, notify.ts)
 * vs OneOnOnes.js / OneOnOneReminders.js / Scorecard.js verbatim in the oracle.
 */
import { describe, it, expect } from 'vitest'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOracle } from '../../scripts/oracle.mjs'
import { LEGACY_FILES, baseFixtures, diffPath, json } from './helpers-oracle'
import { pwIsMissed_, pwDayLabel_, pwWeekOf_ } from '@/features/cx-people/lib/one-on-ones'
import {
  pwSuggestTopics_, pwParamRank_, pwPrevPeriod_, pwProdSum_, pwBuildSummary_, pwNumOrNull_, pwPct_,
} from '@/features/cx-people/lib/one-on-ones-page'
import { pwOoDue, pwOoEmailApplies, pwOoUpcoming } from '@/features/shared/platform/notify'
import {
  scParseMatrix_, scParseFcr_, scBuildDaily_, scPct100_, scMonthOk_, scDateOk_, scSheetId_,
} from '@/features/cx-people/lib/scorecard-server'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILES = LEGACY_FILES.concat([
  'OneOnOnes.js', 'OneOnOneReminders.js', 'OneOnOneAlerts.js', 'Scorecard.js', path.join(HERE, 'fixtures-people.js'),
])

let _o: ReturnType<typeof createOracle> | null = null
const O = () => (_o = _o || createOracle(FILES))
const call = (fn: string, args: unknown[] = [], fx: unknown = {}) => {
  try {
    return { ok: json(O().call(fn, args, fx as object)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}
const same = (fn: string, args: unknown[], port: () => unknown, fx: unknown, label: string) => {
  const l = call(fn, args, fx)
  let p: { ok?: unknown; err?: string }
  try {
    p = { ok: json(port()) }
  } catch (e) {
    p = { err: String((e as Error).message || e) }
  }
  if ('err' in l || 'err' in p) {
    expect({ l, label }).toEqual({ l: p, label })
    return
  }
  const d = diffPath(l.ok, p.ok)
  expect(d === null ? null : `${label}: ${d} :: ${JSON.stringify(l.ok)} vs ${JSON.stringify(p.ok)}`).toBeNull()
}

const DAY = 24 * 3600000
const now = Date.parse('2025-11-20T12:00:00Z')

describe('one-on-ones pure helpers', () => {
  it('pwIsMissed_ / pwDayLabel_ / pwWeekOf_', () => {
    for (const [sch, logged, cut] of [
      [now - 30 * DAY, NaN, '22:00'], [now - DAY, now - DAY + 3600000, '22:00'],
      [now - 3600000, NaN, '22:00'], [now - DAY, NaN, '18:30'], [NaN, NaN, '22:00'],
    ] as [number, number, string][]) {
      same('pwIsMissed_', [sch, logged, now, cut], () => pwIsMissed_(sch, logged, now, cut), { nowMs: now }, `${sch}/${logged}/${cut}`)
    }
    for (const ms of [now, now - 7 * DAY, now + 3 * DAY, NaN, 0]) {
      same('pwDayLabel_', [ms], () => pwDayLabel_(ms), { nowMs: now }, `dl ${ms}`)
      same('pwWeekOf_', [ms], () => pwWeekOf_(ms), { nowMs: now }, `wo ${ms}`)
    }
  })

  it('pwNumOrNull_ / pwPct_ / pwPrevPeriod_ / pwParamRank_', () => {
    for (const v of ['', null, '0.912', 42, 'abc', 0]) {
      same('pwNumOrNull_', [v], () => pwNumOrNull_(v), {}, `nn ${v}`)
      same('pwPct_', [v], () => pwPct_(v), {}, `pc ${v}`)
    }
    same('pwPrevPeriod_', ['2025-11-01', '2025-11-15'], () => pwPrevPeriod_('2025-11-01', '2025-11-15'), {}, 'prev')
    const rows = [
      { email: 'a@x', prod: 90 }, { email: 'b@x', prod: 80 }, { email: 'c@x', prod: 80 }, { email: 'd@x', prod: null },
    ]
    for (const e of ['a@x', 'b@x', 'c@x', 'd@x', 'e@x']) {
      same('pwParamRank_', [rows, 'prod', e], () => pwParamRank_(rows as never, 'prod', e), {}, `rank ${e}`)
    }
  })

  it('pwProdSum_', () => {
    const rows = [
      { email: 'a@x', date: '2025-11-01', inb_achieved: 5, inb_target: 10, fcr_passed: 1, fcr_failed: 0 },
      { email: 'a@x', date: '2025-11-02', inb_achieved: 7, inb_target: 10, fcr_passed: 0, fcr_failed: 2 },
      { email: 'b@x', date: '2025-11-02', inb_achieved: 9, inb_target: 10 },
    ]
    same('pwProdSum_', [rows, 'a@x', '2025-11-01', '2025-11-30', true],
      () => pwProdSum_(rows as never, 'a@x', '2025-11-01', '2025-11-30', true), {}, 'a dated')
    same('pwProdSum_', [rows, 'a@x', '2025-11-01', '2025-11-30', false],
      () => pwProdSum_(rows as never, 'a@x', '2025-11-01', '2025-11-30', false), {}, 'a undated')
  })

  it('pwBuildSummary_', () => {
    const checked = [
      { def: { label: 'Productivity' }, outcome: 'Monitor', confidential: false },
      { def: { label: 'Career growth' }, outcome: 'Resolved', confidential: true },
    ]
    const open = [{ action_id: 'A1', title: 'Call calibration' }, { action_id: 'A2', title: 'Shadow shift' }]
    const reviews = [{ actionId: 'A1', outcome: 'carried' }, { actionId: 'A9', outcome: 'done' }]
    const actionRows = [{ title: 'New task', owner_email: 'sam@x.com', due_date: '2025-11-30' }]
    const dir = { name: '@@fn:pwTestDirName_' }
    const portDir = { name: (e: string) => String(e).split('@')[0] }
    same('pwBuildSummary_', [checked, actionRows, reviews, open, dir],
      () => pwBuildSummary_(checked as never, actionRows as never, reviews as never, open as never, portDir), {}, 'summary')
    same('pwBuildSummary_', [[], [], [], [], dir],
      () => pwBuildSummary_([], [], [], [], portDir), {}, 'summary empty')
  })

  it('pwSuggestTopics_', () => {
    const pair = { kind: 'agent', manager: 'tl@x.com', report: 'a@x.com' }
    const logs = [
      { log_id: 'L1', report_email: 'a@x.com', held_at: new Date(now - 10 * DAY).toISOString() },
      { log_id: 'L0', report_email: 'a@x.com', held_at: new Date(now - 100 * DAY).toISOString() },
    ]
    const topicsRows = [
      { log_id: 'L1', topic: 'quality', outcome: 'Monitor' },
      { log_id: 'L0', topic: 'career', outcome: 'Resolved' },
    ]
    const actions = [
      { owner_email: 'a@x.com', status: 'done', closed_at: new Date(now - 2 * DAY).toISOString(), title: 'Old fix' },
      { owner_email: 'a@x.com', status: 'open', title: 'Open' },
    ]
    const signals = [
      { email: 'a@x.com', topic: 'attendance', reason: 'Late twice', signal_date: new Date(now - DAY).toISOString() },
      { email: 'other@x.com', topic: 'quality', reason: 'Not theirs', signal_date: new Date(now - DAY).toISOString() },
    ]
    const sigTab = [
      ['signal_id', 'email', 'topic', 'reason', 'signal_date', 'source', 'submitted_by', 'submitted_at'],
      ...signals.map((s, i) => ['S' + i, s.email, s.topic, s.reason, s.signal_date, 'coaching', 'tl@x.com', s.signal_date]),
    ]
    const fx = baseFixtures({ nowMs: now, data: { people_signals: sigTab } })
    same('pwSuggestTopics_', [pair, logs, topicsRows, actions, now, null],
      () => pwSuggestTopics_(pair, logs as never, topicsRows as never, actions as never, now, null, signals as never), fx, 'suggest')
    const ctx = { floor: 75, agent: { score: { prod: 70, qual: 95, fcr: null, audits: 3 }, aging: { overTop: 2 } } }
    same('pwSuggestTopics_', [pair, logs, topicsRows, actions, now, ctx],
      () => pwSuggestTopics_(pair, logs as never, topicsRows as never, actions as never, now, ctx as never, signals as never), fx, 'suggest+ctx')
  })
})

describe('one-on-one reminders pure helpers', () => {
  it('pwOoUpcoming_ / pwOoEmailApplies_ / pwOoDue_', () => {
    const rows = [
      { schedule_id: 'S1', status: 'scheduled', manager_email: 'M@x.com', report_email: 'R@x.com',
        scheduled_at: new Date(now + 10 * 60000).toISOString(), duration_min: 30, submitted_at: new Date(now - DAY).toISOString() },
      { schedule_id: 'S2', status: 'held', manager_email: 'm@x.com', report_email: 'r@x.com',
        scheduled_at: new Date(now + 60000).toISOString(), duration_min: 30, submitted_at: '' },
      { schedule_id: 'S3', status: 'scheduled', manager_email: 'm@x.com', report_email: 'r@x.com',
        scheduled_at: new Date(now - 5 * 60000).toISOString(), duration_min: 15, submitted_at: 'not-a-date' },
      { schedule_id: 'S4', status: 'scheduled', manager_email: 'm@x.com', report_email: 'r@x.com',
        scheduled_at: new Date(now + 25 * 3600000).toISOString(), duration_min: 30, submitted_at: '' },
    ]
    same('pwOoUpcoming_', [now, rows], () => pwOoUpcoming(now, rows as never), { nowMs: now }, 'upcoming')
    const list = O().call('pwOoUpcoming_', [now, rows], { nowMs: now }) as never[]
    for (const b of list) {
      same('pwOoEmailApplies_', [b], () => pwOoEmailApplies(b), { nowMs: now }, `applies ${(b as { id: string }).id}`)
    }
    for (const t of [now, now + 10 * 60000, now - 5 * 60000, now + 20 * 60000]) {
      same('pwOoDue_', [list, t], () => pwOoDue(list, t), { nowMs: now }, `due ${t}`)
    }
  })
})

describe('scorecard parse pure helpers', () => {
  it('scPct100_ / scMonthOk_ / scDateOk_ / scSheetId_', () => {
    for (const v of [0.92, 92, '', null, 1, '0.5']) same('scPct100_', [v], () => scPct100_(v), {}, `pct ${v}`)
    for (const m of ['2025-11', '2025-13', 'x', 202511]) same('scMonthOk_', [m], () => scMonthOk_(m), {}, `mo ${m}`)
    for (const d of ['2025-11-01', '2025-1-1', 'x']) same('scDateOk_', [d], () => scDateOk_(d), {}, `dt ${d}`)
    for (const s of ['https://docs.google.com/spreadsheets/d/AbC123_xYz-4567890123/edit', 'AbC123_xYz-4567890123', 'short', '']) {
      same('scSheetId_', [s], () => scSheetId_(s), {}, `sid ${s}`)
    }
  })

  it('scParseMatrix_ / scParseFcr_ / scBuildDaily_', () => {
    const dateKey = (v: unknown) => {
      const s = String(v || '')
      return /^\d{4}-\d\d-\d\d$/.test(s) ? s : null
    }
    const matrix = [
      ['Name', 'Date', 'Email', 'x', 'inbT', 'inbA', 'x', 'x', 'x', 'x', 'txtT', 'txtA', 'x', 'x', 'x', 'waT', 'waA', 'x', 'x', 'x', 'audits', 'qual'],
      ['Sam', '2025-11-01', 'sam@x.com', '', 10, 8, '', '', '', '', 5, 4, '', '', '', 3, 2, '', '', '', 2, 0.9],
      ['Sam', '2025-11-01', 'sam@x.com', '', 1, 1, '', '', '', '', 1, 1, '', '', '', 1, 1, '', '', '', 1, 0.5],
      ['Kim', '2025-11-02', 'kim@x.com', '', 10, 9, '', '', '', '', 5, 5, '', '', '', 3, 3, '', '', '', 1, 88],
      ['', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', '', ''],
    ]
    // legacy indexes SC_MC columns on the row array as given; the dateKey seam
    // crosses into the vm through the '@@fn:' marker bound to pwTestDateKey_.
    const lMatrix = O().call('scParseMatrix_', [matrix.slice(1), '@@fn:pwTestDateKey_'] as never, {})
    const pMatrix = scParseMatrix_(matrix.slice(1) as never, dateKey)
    expect(diffPath(json(lMatrix), json(pMatrix))).toBeNull()

    const fcr = O().call('scParseFcr_', [['sam@x.com', '', 'kim@x.com'], ['2025-11-01', 'x', '2025-11-02'], ['Passed', 'bad', 'Failed'], '@@fn:pwTestDateKey_'], {})
    const pFcr = scParseFcr_(['sam@x.com', '', 'kim@x.com'], ['2025-11-01', 'x', '2025-11-02'], ['Passed', 'bad', 'Failed'], dateKey)
    expect(diffPath(json(fcr), json(pFcr))).toBeNull()

    const built = O().call('scBuildDaily_', ['2025-11', pMatrix, pFcr, true, null], {})
    const pBuilt = scBuildDaily_('2025-11', pMatrix as never, pFcr as never, true, null)
    expect(diffPath(json(built), json(pBuilt))).toBeNull()
  })
})
