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
import {
  pwIsMissed_, pwDayLabel_, pwWeekOf_, pwPair_, pwCanReadLog_, pwJson_, pwScheduleOut_,
  pwLogOut_, pwSeriesKey_, pwNewestLogFirst_,
} from '@/features/cx-people/lib/one-on-ones'
import {
  pwSuggestTopics_, pwParamRank_, pwPrevPeriod_, pwProdSum_, pwBuildSummary_, pwNumOrNull_, pwPct_,
  pwRefuseDuplicateLog_, pwValidateTopic_, pwDataSuggestions_, pwOneOnOneTaskOut_, pwProdOut_, pwAgingOut_,
} from '@/features/cx-people/lib/one-on-ones-page'
import { pwOoDue, pwOoEmailApplies, pwOoUpcoming } from '@/features/shared/platform/notify'
import { pwOoNextEmailMs_ } from '@/features/cx-people/lib/one-on-one-reminders'
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


describe('one-on-ones pure helpers — WP-23 extension', () => {
  const person = (email: string, role: string, manager: string | null = null, active = true) => ({
    email, name: email.split('@')[0], role, manager, active,
  })
  const PERSONS = {
    'tl@x.com': person('tl@x.com', 'tl'),
    'a@x.com': person('a@x.com', 'agent', 'tl@x.com'),
    'b@x.com': person('b@x.com', 'agent', 'other@x.com'),
    'other@x.com': person('other@x.com', 'tl'),
    'spec@x.com': person('spec@x.com', 'specialist', 'tl@x.com'),
    'admin@x.com': person('admin@x.com', 'admin'),
    'gone@x.com': person('gone@x.com', 'agent', 'tl@x.com', false),
  }
  const MANAGERS = { 'a@x.com': 'tl@x.com', 'b@x.com': 'other@x.com', 'spec@x.com': 'tl@x.com', 'gone@x.com': 'tl@x.com' }
  const DIR_SEAMS = { name: '@@fn:pwTestDirName_', person: '@@fn:pwTestDirPerson_', managerOf: '@@fn:pwTestDirManagerOf_' }
  const FX = { dirPersons: PERSONS, dirManagerOf: MANAGERS }
  const portDir = {
    name: (e: string) => String(e).split('@')[0],
    person: (e: string) => (PERSONS as never)[String(e).trim().toLowerCase()] || null,
    managerOf: (e: string) => (MANAGERS as never)[String(e).trim().toLowerCase()] || null,
  }

  it('pwPair_ — kind resolution and refusal messages', () => {
    const users = {
      tl: { email: 'tl@x.com', role: 'tl' }, admin: { email: 'admin@x.com', role: 'admin' },
      agent: { email: 'a@x.com', role: 'agent' }, other: { email: 'other@x.com', role: 'tl' },
    }
    const cases: [unknown, string][] = [
      [users.tl, 'a@x.com'], [users.tl, 'b@x.com'], [users.tl, 'tl@x.com'], [users.tl, 'spec@x.com'],
      [users.admin, 'a@x.com'], [users.admin, 'other@x.com'], [users.admin, 'gone@x.com'],
      [users.agent, 'a@x.com'], [users.agent, 'b@x.com'], [users.other, 'b@x.com'],
      [users.tl, 'ghost@x.com'], [users.tl, ' A@X.COM '], [users.tl, ''],
      [null, 'a@x.com'], [{}, 'a@x.com'], [{ email: 'x@x.com' }, 'a@x.com'],
    ]
    cases.forEach(([u, r], i) =>
      same('pwPair_', [u, r, DIR_SEAMS], () => pwPair_(u as never, r, portDir as never), FX, `pair ${i}`))
  })

  it('pwCanReadLog_ — viewer visibility matrix', () => {
    const log = { log_id: 'L1', manager_email: 'tl@x.com', report_email: 'a@x.com' }
    for (const [u, label] of [
      [{ email: 'tl@x.com', role: 'tl' }, 'manager'],
      [{ email: 'a@x.com', role: 'agent' }, 'report'],
      [{ email: 'admin@x.com', role: 'admin' }, 'admin'],
      [{ email: 'other@x.com', role: 'tl' }, 'other tl'],
      [{ email: ' TL@X.COM ', role: 'tl' }, 'padded manager'],
    ] as const) {
      same('pwCanReadLog_', [log, u], () => pwCanReadLog_(log as never, u as never), {}, `read ${label}`)
    }
  })

  it('pwSeriesKey_ / pwNewestLogFirst_', () => {
    for (const [m, r] of [['tl@x.com', 'a@x.com'], [' TL@X.COM ', 'A@X.COM'], ['', ''], [null, 'a'], [undefined, undefined]]) {
      same('pwSeriesKey_', [m, r], () => pwSeriesKey_(m, r), {}, `series ${m}/${r}`)
    }
    const logs = [
      { held_at: '2025-11-01T09:00:00Z', _row: 2 }, { held_at: '2025-11-03T09:00:00Z', _row: 4 },
      { held_at: 'x', _row: 9 }, { held_at: '', _row: 1 }, { held_at: '2025-11-03T09:00:00Z', _row: 3 },
    ]
    const sortedLegacy = json(O().eval('var a=' + JSON.stringify(logs) + ';a.sort(pwNewestLogFirst_);a'))
    const sortedPort = json(JSON.parse(JSON.stringify(logs)).sort(pwNewestLogFirst_ as never))
    expect(diffPath(sortedLegacy, sortedPort)).toBeNull()
  })

  it('pwJson_ — parse edges', () => {
    for (const v of ['{"a":1}', 'bad', '', null, 0, false, '[1,2]', 'null', '"s"', 42, NaN, { x: 1 }, undefined]) {
      same('pwJson_', [v, null], () => pwJson_(v, null), {}, `json ${String(v)}`)
      same('pwJson_', [v, 'FB'], () => pwJson_(v, 'FB'), {}, `json fb ${String(v)}`)
    }
  })

  it('pwScheduleOut_ — schedule row shaping', () => {
    const rows = [
      { schedule_id: 'SC-1', kind: '', manager_email: 'tl@x.com', report_email: 'a@x.com', scheduled_at: '2025-11-18T10:00:00Z', duration_min: '', status: 'scheduled', log_id: '', reason: '', missed_at: '' },
      { schedule_id: 'SC-2', kind: 'tl', manager_email: ' A@X.COM ', report_email: 'b@x.com', scheduled_at: 'bad', duration_min: 45, status: 'held', log_id: 'L9', reason: 'r', missed_at: '2025-11-10T00:00:00Z' },
      { schedule_id: 7, kind: 'agent', manager_email: 'tl@x.com', report_email: 'a@x.com', scheduled_at: '2025-11-18 10:00', duration_min: 0, status: 'missed', log_id: null, reason: null, missed_at: null },
    ]
    rows.forEach((s, i) =>
      same('pwScheduleOut_', [s, DIR_SEAMS], () => pwScheduleOut_(JSON.parse(JSON.stringify(s)) as never, portDir as never), FX, `sched ${i}`))
  })

  it('pwLogOut_ — role-gated topics, confidential hiding and private notes', () => {
    const log = {
      log_id: 'L1', kind: 'agent', manager_email: 'tl@x.com', report_email: 'a@x.com', held_at: '2025-11-18T10:30:00Z',
      submitted_at: '2025-11-18T11:00:00Z', on_time: 'true', summary: 'sum', no_action_reason: '', submitted_by: 'tl@x.com',
    }
    const topics = [
      { topic: 'quality', raised_by: 'report', outcome: 'o', confidential: false, answers_json: '{"a":1}', fields_json: '{}', evidence_json: '{"e":1}', skipped_reason: '' },
      { topic: 'wellbeing', raised_by: 'manager', outcome: '', confidential: 'true', answers_json: '{"s":1}', fields_json: '{"f":1}', evidence_json: '{"x":1}', skipped_reason: '' },
      { topic: 'fcr', raised_by: 'system', outcome: '', confidential: false, answers_json: '', fields_json: '', evidence_json: '', skipped_reason: 'no data' },
      { topic: 'incident', raised_by: 'manager', outcome: '', confidential: true, answers_json: 'bad', fields_json: 'bad', evidence_json: 'bad', skipped_reason: '' },
    ]
    const privates = [
      { kind: 'note', note: 'mgr secret', author_email: 'tl@x.com' },
      { kind: 'note', note: 'other secret', author_email: 'x@x.com' },
    ]
    const viewers: [unknown, string][] = [
      [{ email: 'tl@x.com', role: 'tl' }, 'author manager'],
      [{ email: 'a@x.com', role: 'agent' }, 'report'],
      [{ email: 'admin@x.com', role: 'admin' }, 'admin'],
      [{ email: 'other@x.com', role: 'tl' }, 'other tl'],
      [{ email: 'x@x.com', role: 'tl' }, 'private note author'],
    ]
    viewers.forEach(([u, label]) =>
      same('pwLogOut_', [log, topics, privates, u, DIR_SEAMS], () =>
        pwLogOut_(JSON.parse(JSON.stringify(log)) as never, JSON.parse(JSON.stringify(topics)) as never,
          JSON.parse(JSON.stringify(privates)) as never, u as never, portDir as never), FX, `log ${label}`))
    // on_time coercions
    for (const ot of [true, false, 'true', 'false', '', 0, 1, 'FALSE']) {
      same('pwLogOut_', [{ ...log, on_time: ot }, [], [], viewers[0][0], DIR_SEAMS], () =>
        pwLogOut_({ ...log, on_time: ot } as never, [], [], viewers[0][0] as never, portDir as never), FX, `ontime ${String(ot)}`)
    }
  })

  it('pwIsMissed_ — exact cutoff millisecond edges (22:00 Kuwait)', () => {
    const sched = Date.parse('2025-11-19T06:30:00Z') // 09:30 Kuwait
    const cutoff = Date.parse('2025-11-19T19:00:00Z') // 22:00 Kuwait
    for (const [log, at, label] of [
      [cutoff, cutoff, 'logged at cutoff'],
      [cutoff + 1, cutoff, 'logged 1ms late'],
      [NaN, cutoff - 1, '1ms before cutoff'],
      [NaN, cutoff, 'at cutoff'],
      [NaN, cutoff + 1, '1ms after'],
      [cutoff - 1000, cutoff + DAY, 'long after but logged in time'],
      [sched - 1, cutoff + DAY, 'logged before the session'],
    ] as const) {
      same('pwIsMissed_', [sched, log, at, '22:00'], () => pwIsMissed_(sched, log, at, '22:00'), {}, `missed ${label}`)
    }
    // non-default cutoff strings
    for (const c of ['23:30', '06:00', '24:00', 'bad']) {
      same('pwIsMissed_', [sched, NaN, cutoff, c], () => pwIsMissed_(sched, NaN, cutoff, c), {}, `missed cutoff ${c}`)
    }
  })

  it('pwRefuseDuplicateLog_ — dup log, same-week log and booked-week checks', () => {
    const pair = { manager: 'tl@x.com', report: 'a@x.com' }
    const mkSched = (id: string, at: number, status = 'scheduled') => ({
      schedule_id: id, manager_email: 'tl@x.com', report_email: 'a@x.com', scheduled_at: new Date(at).toISOString(), status,
    })
    const schedRows = [
      mkSched('SC-1', Date.parse('2025-11-18T07:00:00Z')),
      mkSched('SC-2', Date.parse('2025-11-25T07:00:00Z')),
      mkSched('SC-3', Date.parse('2025-11-19T07:00:00Z'), 'missed'),
      mkSched('SC-4', Date.parse('2025-11-20T07:00:00Z'), 'held'),
      mkSched('SC-5', Date.parse('2025-11-21T07:00:00Z'), 'cancelled'),
    ]
    const headers = ['schedule_id', 'manager_email', 'report_email', 'scheduled_at', 'status']
    const fx = { data: { one_on_one_schedule: [headers].concat(schedRows.map((s) => headers.map((h) => (s as never)[h]))) } }
    const logs = [
      { log_id: 'L1', manager_email: 'tl@x.com', report_email: 'a@x.com', schedule_id: 'SC-9', held_at: '2025-11-11T10:00:00Z' },
      { log_id: 'L2', manager_email: 'tl@x.com', report_email: 'b@x.com', schedule_id: 'SC-1', held_at: '2025-11-18T10:00:00Z' },
    ]
    const heldMs = Date.parse('2025-11-20T10:00:00Z')
    const cases: [unknown, number, unknown[]][] = [
      [{ schedule_id: 'SC-9', scheduled_at: '2025-11-19T08:00:00Z' }, heldMs, logs],
      [{ schedule_id: 'SC-1', scheduled_at: '2025-11-19T08:00:00Z' }, heldMs, logs],
      [{ schedule_id: 'NEW', scheduled_at: '2025-11-19T08:00:00Z' }, heldMs, logs],
      [null, heldMs, logs],
      [null, heldMs, logs.concat([{ log_id: 'L3', manager_email: 'tl@x.com', report_email: 'a@x.com', schedule_id: '', held_at: '2025-11-18T10:00:00Z' }])],
      [null, Date.parse('2025-11-12T10:00:00Z'), logs],
    ]
    cases.forEach(([schedule, ms, ls], i) =>
      same('pwRefuseDuplicateLog_', [pair, schedule, ms, ls, { name: '@@fn:pwTestDirName_' }], () =>
        pwRefuseDuplicateLog_(pair as never, schedule as never, ms, JSON.parse(JSON.stringify(ls)) as never,
          JSON.parse(JSON.stringify(schedRows)) as never, { name: (e: string) => String(e).split('@')[0] } as never), fx, `dup ${i}`))
  })

  it('pwValidateTopic_ — required answers + performance evidence rules', () => {
    const perf = { behaviour: 'polite', evidence: 'call #1', standard: 'script', shownBefore: 'yes', explanation: 'x' }
    const cases: [string, unknown][] = [
      ['agent', { topic: 'quality', discussed: true }],
      ['agent', { topic: 'productivity', discussed: true, evidence: { ...perf } }],
      ['agent', { topic: 'productivity', discussed: true, evidence: { ...perf, shownBefore: 'bad' } }],
      ['agent', { topic: 'productivity', discussed: true, evidence: { ...perf, behaviour: '' } }],
      ['agent', { topic: 'fcr', discussed: true, evidence: { ...perf, shownBefore: 'no' } }],
      ['agent', { topic: 'fcr', discussed: true, evidence: { ...perf, shownBefore: 'unsure', fairnessOutcome: 'disagree' } }],
      ['agent', { topic: 'incident', discussed: true, fields: { ticket_ids: '123' } }],
      ['agent', { topic: 'incident', discussed: true, fields: {} }],
      ['agent', { topic: 'wellbeing', discussed: true, confidential: true }],
      ['agent', { topic: 'not-a-topic', discussed: true }],
      ['tl', { topic: 'delivery', discussed: true }],
      ['tl', { topic: 'team_performance', discussed: true, evidence: perf }],
      ['agent', { topic: 'quality', discussed: false }],
      ['x-kind', { topic: 'quality', discussed: true }],
      ['agent', null], ['agent', {}],
    ]
    cases.forEach(([kind, t], i) =>
      same('pwValidateTopic_', [kind, t, i % 3], () => pwValidateTopic_(kind, t as never, i % 3), {}, `topic ${i}`))
  })
})

describe('one-on-one context helpers — WP-23', () => {
  const base = { floor: 90, today: '2025-11-20' }
  it('pwDataSuggestions_ — agent + tl context to suggestion list', () => {
    const agentCtx = (over: Record<string, unknown>) => ({
      ...base,
      agent: {
        score: { prod: 95, qual: 96, fcr: 94, audits: 5, fcrPassed: 9, fcrFailed: 1, ...(over.score as object || {}) },
        aging: { overTop: 0, oldestH: 10, oldest: [], ...(over.aging as object || {}) },
      },
    })
    const tlCtx = (over: Record<string, unknown>) => ({
      ...base,
      tasks: over.tasks || [],
      team: {
        headcount: 3, belowFloor: 0, aging: { overTop: 0, oldest: [] }, flags: [],
        slots: [], oneOnOnes: { cadenceDays: 14, overdue: 0, missed30: 0 }, ...(over.team as object || {}),
      },
    })
    const cases: [string, unknown][] = [
      ['agent', agentCtx({})],
      ['agent', agentCtx({ score: { prod: 85, qual: 88, fcr: 90, audits: 1, fcrPassed: 1, fcrFailed: 1 } })],
      ['agent', agentCtx({ score: { prod: null, qual: 80, fcr: null, audits: 0, fcrPassed: 0, fcrFailed: 0 }, aging: { overTop: 2 } })],
      ['agent', { ...base, agent: { score: null, aging: null } }],
      ['agent', { ...base }],
      ['tl', tlCtx({})],
      ['tl', tlCtx({ tasks: [{ overdue: true }, { progressState: 'blocked' }, { riskReasons: ['x'] }, { overdue: false, progressState: 'on_track', riskReasons: [] }] })],
      ['tl', tlCtx({ team: { headcount: 5, belowFloor: 2, aging: { overTop: 3, oldest: [] }, flags: [{}, {}], slots: [{ state: 'missed', slot: 'AM' }, { state: 'done', slot: 'PM' }], oneOnOnes: { cadenceDays: 14, overdue: 1, missed30: 2 } } })],
      ['tl', tlCtx({ team: { headcount: 1, belowFloor: 0, aging: { overTop: 0, oldest: [] }, flags: [], slots: [], oneOnOnes: { cadenceDays: 14, overdue: 0, missed30: 0 } }, tasks: [{}, {}] })],
      ['x-kind', tlCtx({})],
      ['agent', { ...base, agent: { score: { prod: 70, qual: null, fcr: 100, audits: 0, fcrPassed: 0, fcrFailed: 0 }, aging: { overTop: 1 } } }],
    ]
    cases.forEach(([kind, ctx], i) =>
      same('pwTestDataSug_', [kind, ctx], () => {
        const out: { topic: string; reason: string }[] = []
        pwDataSuggestions_(kind, JSON.parse(JSON.stringify(ctx)) as never, (t: string, r: string) => out.push({ topic: t, reason: r }))
        return out
      }, {}, `sug ${i}`))
  })

  it('pwOneOnOneTaskOut_ — TL task panel shaping', () => {
    const tasks = [
      { actionId: 'A1', title: 't', description: 'd', ownerEmail: 'a@x.com', status: 'open', priority: 'P1', startAt: 's', deadlineAt: 'd', estHours: 4, percent: 50, hours: { free: 10 }, fitStatus: 'fits', progressState: 'in_progress', ragSelf: 'on_track', blockedReason: '', overdue: false, riskReasons: [], expectation: 'e', milestones: [{ note: 'n', nextStep: 'ns', at: 'x', byName: 'b' }] },
      { actionId: 'A2', title: 't2', ownerEmail: 'a@x.com', status: 'open', percent: 0, hours: null, milestones: [], riskReasons: ['No update'] },
      { actionId: 'A3', title: 't3', milestones: [{}, {}] },
    ]
    tasks.forEach((t, i) => same('pwOneOnOneTaskOut_', [t], () => pwOneOnOneTaskOut_(JSON.parse(JSON.stringify(t)) as never), {}, `task ${i}`))
  })

  it('pwProdOut_ / pwAgingOut_', () => {
    const perfRows = [
      { email: 'a@x.com', period: '7d', from_date: '2025-11-14', to_date: '2025-11-20', days: 5, overall_pct: '92.4', inbound_pct: 90, texting_pct: '', wa_pct: 88, inbound_achieved: 40, inbound_missed: 2, texting_achieved: 9, wa_achieved: 8, productive_min: 1000, idle_min: 50, audits: 4, avg_score: 95.55 },
      { email: 'a@x.com', period: 'prev7d', from_date: '2025-11-07', to_date: '2025-11-13', days: 5, overall_pct: 80, audits: 0, avg_score: '' },
      { email: 'a@x.com', period: 'mtd', from_date: '2025-11-01', to_date: '2025-11-20', days: 14, overall_pct: 86, audits: 10, avg_score: 91.234 },
      { email: 'other@x.com', period: '7d', overall_pct: 50, days: 1 },
      { email: 'A@X.COM', period: 'other', overall_pct: 10 },
    ]
    for (const e of ['a@x.com', 'other@x.com', 'none@x.com', 'A@X.COM']) {
      same('pwProdOut_', [perfRows, e], () => pwProdOut_(JSON.parse(JSON.stringify(perfRows)) as never, e), {}, `prod ${e}`)
    }
    const agingRows = [
      { ticket_id: 1, queue: 'q1', status: 'open', age_h: 100, band: 5, agent_name: 'A' },
      { ticket_id: 2, queue: 'q1', status: 'open', age_h: 90, band: 4, agent_name: '' },
      { ticket_id: 3, queue: 'q2', status: 'open', age_h: 80, band: 5 },
      { ticket_id: 4, queue: 'q2', status: 'open', age_h: 'x', band: 'x' },
      { ticket_id: 5, queue: 'q2', status: 'open', age_h: 70, band: 5, agent_name: 'B' },
    ]
    for (const [top, n] of [[5, 3], [4, 1], [0, 0], [6, 10]] as const) {
      same('pwAgingOut_', [agingRows, top, n], () => pwAgingOut_(JSON.parse(JSON.stringify(agingRows)) as never, top, n), {}, `aging ${top}/${n}`)
      same('pwAgingOut_', [[], top, n], () => pwAgingOut_([] as never, top, n), {}, `aging empty ${top}/${n}`)
    }
  })
})

describe('one-on-one reminder pure helpers — WP-23 edges', () => {
  const at = Date.parse('2025-11-20T10:00:00Z')
  const mkRow = (id: string, atMs: number, status = 'scheduled', submitted = '2025-11-19T10:00:00Z') => ({
    schedule_id: id, manager_email: 'm@x.com', report_email: 'r@x.com', scheduled_at: new Date(atMs).toISOString(),
    duration_min: 45, status, submitted_at: submitted,
  })
  it('pwOoUpcoming_ — 15-min-grace/24h window edges, status and field mapping', () => {
    const rows = [
      mkRow('in-low', at - 900000), mkRow('before-low', at - 900001), mkRow('at-now', at),
      mkRow('at-24h', at + 86400000), mkRow('past-24h', at + 86400001), mkRow('lower', at + 1000, 'scheduled'),
      mkRow('held', at + 1000, 'held'), mkRow('missed', at + 1000, 'missed'), mkRow('caps', at + 1000, 'Scheduled'),
      { ...mkRow('garbage', at + 1000), scheduled_at: 'bad' },
      { ...mkRow('dur0', at + 1000), duration_min: 0 }, { ...mkRow('durX', at + 1000), duration_min: 'x' },
    ]
    same('pwOoUpcoming_', [now, rows], () => pwOoUpcoming(now, JSON.parse(JSON.stringify(rows)) as never), {}, 'upcoming window')
  })
  it('pwOoDue_ — email/soon/start windows per recipient', () => {
    const b = { id: 'BK', m: 'm@x.com', r: 'r@x.com', at, dur: 30, bookedAt: Date.parse('2025-11-19T10:00:00Z') }
    const late = { ...b, bookedAt: at - 14 * 60000 }
    for (const [list, nowMs, label] of [
      [[b], at - 900000, 'email window open'],
      [[b], at - 900001, '1ms before'],
      [[b], at - 1, '1ms before start'],
      [[b], at, 'at start'],
      [[b], at + 899999, 'in start window'],
      [[b], at + 900000, 'start window end'],
      [[b], at + 900001, 'past end'],
      [[late], at - 600000, 'late booking: no email, still soon'],
      [[b, { ...b, id: 'BK2', at: at + 5000 }], at, 'two bookings'],
    ] as const) {
      same('pwOoDue_', [list, nowMs], () => pwOoDue(JSON.parse(JSON.stringify(list)) as never, nowMs), {}, `due ${label}`)
    }
  })
  it('pwOoEmailApplies_ — 15-minute booked-ahead rule', () => {
    for (const [bookedAt, label] of [
      [at - 900000, 'exactly 15m ahead'], [at - 900001, '15m+1 ahead'], [at - 899999, '14m59s ahead'],
      [at, 'at start'], [at - 24 * 3600000, 'day before'],
    ] as const) {
      const b = { id: 'B', m: 'm@x.com', r: 'r@x.com', at, dur: 30, bookedAt }
      same('pwOoEmailApplies_', [b], () => pwOoEmailApplies(b), {}, `applies ${label}`)
    }
  })
  it('pwOoNextEmailMs_ — earliest email-able pending start', () => {
    const mk = (id: string, atMs: number, bookedAt = atMs - 3600000) => ({ id, m: 'm@x.com', r: 'r@x.com', at: atMs, dur: 30, bookedAt })
    const K = (id: string, atMs: number, e: string) => 'oo15|' + id + '|' + atMs + '|' + e
    for (const [list, sent, label] of [
      [[mk('B1', at + DAY), mk('B2', at + 2 * DAY)], {}, 'two pending'],
      [[mk('B1', at - DAY), mk('B2', at + 2 * DAY)], {}, 'past ignored'],
      [[mk('B1', at + DAY, at + DAY - 600000)], {}, 'booked inside 15m'],
      [[mk('B1', at + DAY)], { [K('B1', at + DAY, 'm@x.com')]: true, [K('B1', at + DAY, 'r@x.com')]: true }, 'both sent'],
      [[mk('B1', at + DAY)], { [K('B1', at + DAY, 'm@x.com')]: true }, 'one sent'],
      [[mk('B1', at + 300000)], {}, 'inside window already'],
      [[], {}, 'empty'],
    ] as const) {
      same('pwOoNextEmailMs_', [list, now, sent], () =>
        pwOoNextEmailMs_(JSON.parse(JSON.stringify(list)) as never, now, sent as never), {}, `next ${label}`)
    }
  })
})
