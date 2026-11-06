/**
 * Golden tests, WP-23: the ASYNC / write paths of the People & Performance port —
 * the working calendar, the in-app 1:1 alert poll, the reminder/missed/digest cron
 * bodies, and the 1:1 lifecycle writes (schedule / reschedule / not-held / submit /
 * soft-delete / restore) — against the same People_deprecated functions run verbatim
 * in the oracle, on identical fixtures installed through deskInstall + hub-fakes.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () =>
  (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () =>
  (await import('./hub-fakes')).authModule())

import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createOracle } from '../../scripts/oracle.mjs'
import { LEGACY_FILES, diffPath, json, expectSame } from './helpers-oracle'
import { deskInstall, portCall, type DeskFx } from './desk-fakes'
import { hubDb } from './hub-fakes'
import { pwDirectory } from '@/features/shared/platform/identity'
import { updateRow } from '@/features/shared/platform/repo'
import {
  getWorkingCalendar, wcDay, pwIsWorkingDate, pwAddWorkingDays, pwWorkingDaysBetween,
  pwWorkingHours, pwFreeHours, dqDaysOffFor, dqIsOffDay, setTlScheduleSource,
} from '@/features/shared/platform/calendar'
import { oneOnOneAlerts, oneOnOneAlertsSeen } from '@/features/shared/platform/notify'
import { runOneOnOneReminders_ } from '@/features/cx-people/lib/one-on-one-reminders'
import {
  runMissedOneOnOneCheck_, pwDigestItems_, runTaskReminders_, runMeetingActionReminders_,
} from '@/features/cx-people/lib/reminders'
import {
  oneOnOnesSchedule, oneOnOnesReschedule, oneOnOnesMarkNotHeld,
} from '@/features/cx-people/lib/one-on-ones'
import { oneOnOnesSubmit } from '@/features/cx-people/lib/one-on-ones-page'
import {
  oneOnOnesDeletePreview, oneOnOnesDeleteLog, oneOnOnesDeleteBooking, oneOnOnesRestore, pwDeletedOut_,
} from '@/features/cx-people/lib/one-on-ones-delete'

const HERE = path.dirname(fileURLToPath(import.meta.url))
const FILES = LEGACY_FILES.concat([
  'Actions.js', 'OneOnOnes.js', 'OneOnOneAlerts.js', 'OneOnOneReminders.js', 'OneOnOneDelete.js',
  'Reminders.js', 'Mailer.js', 'Notify.js', 'Popups.js', 'ViewAs.js', 'Options.js', 'Health.js',
  'Scorecard.js', path.join(HERE, 'fixtures-people.js'),
])

let _o: ReturnType<typeof createOracle> | null = null
const O = () => {
  if (!_o) {
    _o = createOracle(FILES)
    // Same pinned stream as desk-fakes: newId_() ids match the port's pinned Math.random.
    _o.eval('Math.random = function () { return 0.123456; }')
  }
  return _o
}
const call = (fn: string, args: unknown[] = [], fx: unknown = {}) => {
  try {
    return { ok: json(O().call(fn, args, fx as object)) }
  } catch (e) {
    return { err: String((e as Error).message || e) }
  }
}
const install = (fx: DeskFx) => {
  setTlScheduleSource(null) // clears the cached wc state + restores the default source
  vi.setSystemTime(new Date(fx.nowMs === undefined ? NOW : fx.nowMs)) // the port clock = oracle nowMs
  return deskInstall(fx)
}
const sameJob = async (fn: string, args: unknown[], fx: DeskFx, portFn: () => unknown | Promise<unknown>, label?: string) => {
  const fixture = install(fx)
  const l = call(fn, args, fixture)
  const p = await portCall(portFn)
  expectSame(p, l, label || fn)
  return { legacy: l, port: p, fixture }
}

// ------------------------------------------------------------- fixture helpers

const NOW = Date.parse('2025-11-20T09:00:00Z') // Thursday 12:00 Kuwait
const D = 86400000
const H = 3600000
const iso = (ms: number) => new Date(ms).toISOString()

// Frozen clock: the oracle reads fixtures.nowMs; the port reads Date.now() —
// install() re-pins it to each fixture's nowMs (see desk.test.ts for the pattern).
beforeEach(() => {
  vi.useFakeTimers()
  vi.setSystemTime(NOW)
})
afterEach(() => vi.useRealTimers())

const ROSTER = [
  { email: 'tl@dabdoob.com', name: 'Team Lead', role: 'tl', tl_email: 'admin@dabdoob.com', active: true, position: 'TL', based_in_country: 'Kuwait', days_off: 'Fri,Sat' },
  { email: 'a@dabdoob.com', name: 'Agent A', role: 'agent', tl_email: 'tl@dabdoob.com', active: true, position: 'Agent', based_in_country: 'Kuwait', days_off: '' },
  { email: 'b@dabdoob.com', name: 'Agent B', role: 'agent', tl_email: 'tl@dabdoob.com', active: true, position: 'Agent', based_in_country: 'Egypt', days_off: 'Fri,Sat' },
  { email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', tl_email: '', active: true, position: 'Manager', based_in_country: 'Kuwait', days_off: '' },
]
const BASE_SETTINGS = {
  admin_emails: 'admin@dabdoob.com',
  allowed_domain: 'dabdoob.com',
  mail_dry_run: true,
  days_off_default: [],
  days_off_by_country: {},
  shift_break_hours: 1,
  shift_defs: { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } },
  tl_shifts: {},
  tl_overlap: { start: '13:00', end: '18:30' },
  one_on_one_cutoff: '22:00',
  one_on_one_cadence_days: 7,
  one_on_one_email_15min: true,
  one_on_one_inapp_15min: true,
  one_on_one_inapp_start: true,
}
/** Every known PW tab exists (empty) on both sides unless the fixture fills it —
 *  the legacy readTable_ throws 'Table does not exist' on a missing tab. */
const fxBase = (over: DeskFx = {}): DeskFx => {
  const empty: Record<string, Row[]> = {}
  Object.keys(EMPTY_HEADERS).forEach((t) => { empty[t] = [] })
  return {
    ...over, // pass-through keys (props, spreadsheets, gmailThreads, ...) first
    settings: { ...BASE_SETTINGS, ...(over.settings || {}) },
    tables: { ...empty, roster: ROSTER.map((r) => ({ ...r })), ...(over.tables || {}) },
    headers: { ...EMPTY_HEADERS, ...(over.headers || {}) },
    nowMs: over.nowMs === undefined ? NOW : over.nowMs,
    userEmail: over.userEmail === undefined ? 'admin@dabdoob.com' : over.userEmail,
  }
}

/** A schedule row as the port writes it (submitted_at = ISO, scheduled_at plain). */
const sched = (id: string, over: Record<string, unknown> = {}) => ({
  schedule_id: id, kind: 'agent', manager_email: 'tl@dabdoob.com', report_email: 'a@dabdoob.com',
  scheduled_at: iso(NOW + 2 * H), duration_min: 30, status: 'scheduled', log_id: '', rescheduled_to: '',
  reason: '', missed_at: '', deleted_at: '', deleted_by: '', delete_reason: '', prev_status: '',
  submitted_by: 'tl@dabdoob.com', submitted_at: iso(NOW - D), updated_by: '', updated_at: '',
  ...over,
})

type Row = Record<string, unknown>
const EMPTY_STAMPS = { submitted_by: '', submitted_at: '', updated_by: '', updated_at: '' }
/** Stamp-less PW tables (logs/topics/notes/reviews/updates/reminder_log/popups): only submitted_*. */
const SUB_STAMPS = { submitted_by: '', submitted_at: '' }
const EMPTY_HEADERS: Record<string, string[]> = {
  one_on_one_schedule: ['schedule_id', 'kind', 'manager_email', 'report_email', 'scheduled_at', 'duration_min', 'status', 'log_id', 'rescheduled_to', 'reason', 'missed_at', 'deleted_at', 'deleted_by', 'delete_reason', 'prev_status', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
  one_on_one_logs: ['log_id', 'schedule_id', 'kind', 'manager_email', 'report_email', 'held_at', 'summary', 'no_action_reason', 'on_time', 'deleted_at', 'deleted_by', 'delete_reason', 'delete_cascade_json', 'submitted_by', 'submitted_at'],
  one_on_one_topics: ['log_id', 'topic', 'position', 'raised_by', 'suggested', 'skipped_reason', 'outcome', 'confidential', 'answers_json', 'fields_json', 'evidence_json', 'submitted_by', 'submitted_at'],
  one_on_one_private_notes: ['log_id', 'kind', 'author_email', 'note', 'submitted_by', 'submitted_at'],
  actions: ['action_id', 'title', 'description', 'owner_email', 'assigned_by', 'due_date', 'source_type', 'source_id', 'series_id', 'topic', 'status', 'outcome_note', 'closed_at', 'closed_by', 'visibility', 'track_as_task', 'carry_count', 'source_deleted_at', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
  action_reviews: ['review_id', 'action_id', 'reviewed_in_type', 'reviewed_in_id', 'outcome', 'note', 'new_due_date', 'prev_status', 'prev_due_date', 'prev_outcome_note', 'reverted_at', 'submitted_by', 'submitted_at'],
  action_updates: ['update_id', 'action_id', 'kind', 'note', 'percent_complete', 'rag', 'next_step', 'drive_file_id', 'file_name', 'mime_type', 'planned_milestone_id', 'submitted_by', 'submitted_at'],
  action_task_details: ['action_id', 'priority', 'start_at', 'deadline_at', 'est_hours', 'available_hours', 'fit_status', 'progress_state', 'blocked_reason', 'rag_self', 'delivered_at', 'delivery_ref', 'actual_hours', 'source_label', 'assigned_anyway', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at', 'expectation', 'outcome_rating', 'outcome_note', 'rated_by', 'rated_at'],
  action_planned_milestones: ['milestone_id', 'action_id', 'label', 'target_date', 'done_by_update_id', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
  pw_reminder_log: ['dedupe_key', 'kind', 'recipient', 'ref', 'status', 'submitted_by', 'submitted_at'],
  people_signals: ['signal_id', 'email', 'topic', 'reason', 'signal_date', 'source', 'submitted_by', 'submitted_at'],
  meetings: ['meeting_id', 'series_id', 'held_at', 'next_meeting_at', 'notes', 'decisions', 'status', 'closed_at', 'summary_sent_at', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
  meeting_series: ['series_id', 'meeting_type', 'title', 'chair_email', 'cadence', 'active', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
  // Port `popups`/`mail_log` columns = legacy Popups/MailLog tab headers exactly.
  popups: ['popup_id', 'recipient', 'kind', 'title', 'body', 'link', 'ref', 'created_at', 'resolved_at', 'submitted_by', 'submitted_at'],
  mail_log: ['sent_at', 'to', 'cc', 'subject', 'kind', 'ref', 'status', 'error', 'quota_left', 'submitted_by', 'submitted_at'],
  holidays: ['holiday_id', 'country', 'date', 'name', 'deleted_at', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
}

/** Post-write read of a legacy data tab INSIDE the vm (no reset). */
const ltable = (name: string): Row[] =>
  JSON.parse(O().eval(`JSON.stringify(readTable_(${JSON.stringify(name)}))`)) as Row[]
const lprops = (): Record<string, string> =>
  JSON.parse(O().eval('JSON.stringify(__PROPS__)')) as Record<string, string>

/** Sheet-cell values vs Postgres values: drop serials, strip ' text markers, ISO-normalise, union keys. */
function normRows(...rowSets: Row[][]): { rows: Row[]; sets: Row[][] } {
  const keys: string[] = []
  const flat = rowSets.map((rows) =>
    rows.map((r) => {
      const rest = JSON.parse(JSON.stringify(r)) as Row
      delete rest.id
      delete rest._row
      Object.keys(rest).forEach((k) => {
        let v = rest[k]
        if (typeof v === 'string' && v[0] === "'") v = v.slice(1)
        if (typeof v === 'string' && /^\d{4}-\d\d-\d\d[T ]/.test(v)) {
          const m = Date.parse(v)
          if (!isNaN(m)) v = new Date(m).toISOString()
        }
        rest[k] = v === null || v === undefined ? '' : v
        if (keys.indexOf(k) === -1) keys.push(k)
      })
      return rest
    }),
  )
  const out = flat.map((set) =>
    set
      .map((r) => {
        const full: Row = {}
        keys.forEach((k) => {
          full[k] = r[k] === undefined || r[k] === null ? '' : r[k]
        })
        return full
      })
      .sort((a, b) => (JSON.stringify(a) < JSON.stringify(b) ? -1 : 1)),
  )
  return { rows: out[0] || [], sets: out }
}
function expectTableSame(portTable: string, legacyTab: string, label: string, drop: string[] = []) {
  const { sets } = normRows(hubDb.tables[portTable] || [], ltable(legacyTab))
  const strip = (rows: Row[]) => rows.map((r) => {
    const o = { ...r }
    drop.forEach((k) => delete o[k])
    return o
  })
  const d = diffPath(strip(sets[1]), strip(sets[0]))
  if (d) throw new Error(label + ': ' + d)
}
const TABLES_TO_CHECK = [
  ['one_on_one_schedule', 'one_on_one_schedule'],
  ['one_on_one_logs', 'one_on_one_logs'],
  ['one_on_one_topics', 'one_on_one_topics'],
  ['one_on_one_private_notes', 'one_on_one_private_notes'],
  ['actions', 'actions'],
  ['action_reviews', 'action_reviews'],
  ['pw_reminder_log', 'pw_reminder_log'],
  ['popups', 'Popups'],
  ['mail_log', 'MailLog'],
] as const
function expectAllTablesSame(label: string, dropMail: string[] = []) {
  TABLES_TO_CHECK.forEach(([p, l]) => {
    const drop = l === 'MailLog' ? dropMail : []
    expectTableSame(p, l, label + ' ' + p, drop)
  })
}

describe('working calendar — WP-23', () => {
  const calFx = (over: DeskFx = {}): DeskFx => fxBase({
    ...over,
    tables: {
      roster: [
        { email: 'tl@dabdoob.com', name: 'TL', role: 'tl', tl_email: '', active: 'true', position: 'TL', based_in_country: 'Kuwait', days_off: '' },
        { email: 'a@dabdoob.com', name: 'A', role: 'agent', tl_email: 'tl@dabdoob.com', active: 'true', position: 'Agent', based_in_country: 'Kuwait', days_off: 'Fri,Sat' },
        { email: 'b@dabdoob.com', name: 'B', role: 'agent', tl_email: 'tl@dabdoob.com', active: 'true', position: 'Agent', based_in_country: 'Egypt', days_off: '' },
        { email: 'c@dabdoob.com', name: 'C', role: 'agent', tl_email: 'tl@dabdoob.com', active: 'true', position: 'Agent', based_in_country: 'Egypt', days_off: 'Sat' },
      ],
      holidays: [
        { holiday_id: 'H1', country: 'Kuwait', date: '2025-11-24', name: 'Day', deleted_at: '' },
        { holiday_id: 'H2', country: 'Kuwait', date: '2025-11-25', name: 'Old', deleted_at: '2025-11-01T00:00:00Z' },
        { holiday_id: 'H3', country: 'Egypt', date: '2025-11-26', name: 'EG', deleted_at: '' },
      ],
      // The port's V1 tables mirror the oracle's V1 spreadsheet tabs below.
      team_leads: [{ name: 'Team Lead', email: 'tl@dabdoob.com' }],
      tl_shift_plan: [
        { month: '2025-11', date: '2025-11-21', tl: 'Team Lead', shift: 'PM' },
        { month: '2025-11', date: '2025-11-22', tl: 'Team Lead', shift: 'OFF' },
        { month: '2025-11', date: '2025-11-23', tl: 'Team Lead', shift: 'LEAVE' },
      ],
      tl_off_days: [
        { month: '2025-11', tl: 'Team Lead', off_days: '0,6' },
        { month: '', tl: 'Team Lead', off_days: '5' },
      ],
      ...(over.tables || {}),
    },
    settings: {
      days_off_by_country: { Egypt: ['Fri', 'Sat'] },
      v1_ops_spreadsheet_id: 'ops-db',
      tl_shifts: { 'tl@dabdoob.com': 'PM' },
      ...(over.settings || {}),
    },
    spreadsheets: {
      'ops-db': {
        TeamLeads: [['name', 'email'], ['Team Lead', 'tl@dabdoob.com']],
        ShiftPlan: [
          ['month', 'date', 'tl', 'shift'],
          ['2025-11', '2025-11-21', 'Team Lead', 'PM'],
          ['2025-11', '2025-11-22', 'Team Lead', 'OFF'],
          ['2025-11', '2025-11-23', 'Team Lead', 'LEAVE'],
        ],
        TLOffDays: [
          ['month', 'tl', 'offDays'],
          ['2025-11', 'Team Lead', '0,6'],
          ['', 'Team Lead', '5'],
        ],
      },
      ...(over.spreadsheets || {}),
    },
  })

  it('getWorkingCalendar_ — holiday/person/country/TL precedence over a fortnight', async () => {
    for (const [email, label] of [['a@dabdoob.com', 'own days_off'], ['b@dabdoob.com', 'country days_off'], ['c@dabdoob.com', 'own beats country'], ['tl@dabdoob.com', 'tl schedule'], ['', 'blank = default'], ['ghost@dabdoob.com', 'unknown = default']] as const) {
      const { legacy, port } = await sameJob('getWorkingCalendar_', [email, '2025-11-20', '2025-12-03'],
        calFx(), () => getWorkingCalendar(email, '2025-11-20', '2025-12-03'), `cal ${label}`)
      void legacy; void port
    }
    await sameJob('wcDay_', ['a@dabdoob.com', '2025-11-21'], calFx(), () => wcDay('a@dabdoob.com', '2025-11-21'))
    await sameJob('wcDay_', ['a@dabdoob.com', '2025-11-24'], calFx(), () => wcDay('a@dabdoob.com', '2025-11-24'))
    await sameJob('wcDay_', ['b@dabdoob.com', '2025-11-26'], calFx(), () => wcDay('b@dabdoob.com', '2025-11-26'))
  })

  it('working-day arithmetic: isWorkingDate / addWorkingDays / daysBetween', async () => {
    for (const [email, d] of [['a@dabdoob.com', '2025-11-21'], ['a@dabdoob.com', '2025-11-22'], ['a@dabdoob.com', '2025-11-24'], ['b@dabdoob.com', '2025-11-26'], ['tl@dabdoob.com', '2025-11-21'], ['tl@dabdoob.com', '2025-11-22'], ['tl@dabdoob.com', '2025-11-23'], ['', '2025-11-24']] as const) {
      await sameJob('pwIsWorkingDate_', [email, d], calFx(), () => pwIsWorkingDate(email, d), `isW ${email} ${d}`)
    }
    for (const [email, d, n] of [['a@dabdoob.com', '2025-11-20', 5], ['a@dabdoob.com', '2025-11-20', 0], ['a@dabdoob.com', '2025-11-20', -1], ['tl@dabdoob.com', '2025-11-20', 3], ['b@dabdoob.com', '2025-11-20', 8], ['', '2025-11-20', 4]] as const) {
      await sameJob('pwAddWorkingDays_', [email, d, n], calFx(), () => pwAddWorkingDays(email, d, n), `addW ${email} ${n}`)
    }
    for (const [email, f, t] of [['a@dabdoob.com', '2025-11-20', '2025-11-27'], ['a@dabdoob.com', '2025-11-20', '2025-11-20'], ['a@dabdoob.com', '2025-11-27', '2025-11-20'], ['tl@dabdoob.com', '2025-11-20', '2025-11-27'], ['b@dabdoob.com', '2025-11-20', '2025-12-04']] as const) {
      await sameJob('pwWorkingDaysBetween_', [email, f, t], calFx(), () => pwWorkingDaysBetween(email, f, t), `wdb ${email}`)
    }
  })

  it('dqDaysOffFor_ / dqIsOffDay_ — per-person days-off resolution', async () => {
    const fx = calFx()
    for (const p of [
      { days_off: 'Fri,Sat', based_in_country: 'Kuwait' }, { days_off: '', based_in_country: 'Egypt' },
      { days_off: 'sun, THU ', based_in_country: 'Kuwait' }, { days_off: 'X', based_in_country: 'Kuwait' },
      null, { days_off: ['Mon'], based_in_country: 'Egypt' },
    ] as const) {
      const l = call('dqDaysOffFor_', [p], install(fx))
      const p2 = await portCall(() => dqDaysOffFor(p as never))
      expectSame(p2, l, 'daysOff ' + JSON.stringify(p))
    }
    for (const [p, d] of [
      [{ days_off: 'Fri', based_in_country: 'Kuwait' }, '2025-11-21'],
      [{ days_off: '', based_in_country: 'Kuwait' }, '2025-11-24'],
      [{ days_off: '', based_in_country: 'Egypt' }, '2025-11-26'],
      [{ days_off: '', based_in_country: 'Egypt' }, '2025-11-21'],
    ] as const) {
      const l = call('dqIsOffDay_', [p, d, null], install(fx))
      const p2 = await portCall(() => dqIsOffDay(p as never, d, null as never))
      expectSame(p2, l, 'offDay ' + d)
    }
  })

  it('pwWorkingHours_ / pwFreeHours_ — shift hours minus break across days', async () => {
    const f = install(calFx())
    // agent a@ works Sun-Thu (Fri/Sat off), AM-shift default 09:30-18:30 -1h break = 8h/day
    const cases: [string, number, number][] = [
      ['a@dabdoob.com', Date.parse('2025-11-20T06:00:00Z'), Date.parse('2025-11-20T10:00:00Z')],       // part of a workday (09:00-13:00 KW)
      ['a@dabdoob.com', Date.parse('2025-11-20T06:00:00Z'), Date.parse('2025-11-23T19:00:00Z')],       // across Fri/Sat off
      ['a@dabdoob.com', Date.parse('2025-11-23T06:00:00Z'), Date.parse('2025-11-25T19:00:00Z')],       // incl. Kuwait holiday 11-24
      ['tl@dabdoob.com', Date.parse('2025-11-21T10:00:00Z'), Date.parse('2025-11-22T19:00:00Z')],      // TL: PM plan 21st, OFF 22nd
      ['b@dabdoob.com', Date.parse('2025-11-25T06:00:00Z'), Date.parse('2025-11-27T19:00:00Z')],       // Egypt: 11-26 holiday
      ['a@dabdoob.com', Date.parse('2025-11-20T10:00:00Z'), Date.parse('2025-11-20T06:00:00Z')],       // empty window
      ['', Date.parse('2025-11-20T06:00:00Z'), Date.parse('2025-11-21T19:00:00Z')],                    // blank email, default pattern
    ]
    for (const [email, s, e] of cases) {
      const l = call('pwWorkingHours_', [email, s, e], f)
      const p = await portCall(() => pwWorkingHours(email, s, e))
      expectSame(p, l, `wh ${email}`)
    }
    const others = [
      [{ startMs: Date.parse('2025-11-20T06:00:00Z'), endMs: Date.parse('2025-11-20T10:00:00Z'), remaining: 4 }],
      [{ startMs: Date.parse('2025-11-20T06:00:00Z'), endMs: Date.parse('2025-11-21T10:00:00Z'), remaining: 20 }],
      [
        { startMs: Date.parse('2025-11-20T06:00:00Z'), endMs: Date.parse('2025-11-20T10:00:00Z'), remaining: 2 },
        { startMs: Date.parse('2025-11-21T06:00:00Z'), endMs: Date.parse('2025-11-22T10:00:00Z'), remaining: 6 },
      ],
      [],
    ]
    for (const [i, o] of others.entries()) {
      const l = call('pwFreeHours_', ['a@dabdoob.com', Date.parse('2025-11-20T06:00:00Z'), Date.parse('2025-11-23T10:00:00Z'), o], f)
      const p = await portCall(() => pwFreeHours('a@dabdoob.com', Date.parse('2025-11-20T06:00:00Z'), Date.parse('2025-11-23T10:00:00Z'), o as never))
      expectSame(p, l, `fh ${i}`)
    }
  })
})

describe('one-on-one alerts poll — WP-23', () => {
  it('oneOnOneAlerts / oneOnOneAlertsSeen — per-person due alerts', async () => {
    const at = NOW + 10 * 60000 // in the 15-min window
    const far = NOW + 3 * H
    const rows = [
      sched('SC-1', { scheduled_at: iso(at), submitted_at: iso(NOW - 4 * H) }),
      sched('SC-2', { scheduled_at: iso(far), submitted_at: iso(NOW - 4 * H), report_email: 'b@dabdoob.com' }),
      sched('SC-3', { scheduled_at: iso(NOW + 20 * 60000), submitted_at: iso(at - 60000), report_email: 'b@dabdoob.com' }), // booked inside 15m
      sched('SC-4', { scheduled_at: iso(at), submitted_at: iso(NOW - 4 * H), status: 'held' }),
    ]
    for (const [who, label] of [['tl@dabdoob.com', 'manager'], ['a@dabdoob.com', 'report'], ['b@dabdoob.com', 'other'], ['nobody@dabdoob.com', 'unrelated']] as const) {
      await sameJob('oneOnOneAlerts', [], fxBase({
        userEmail: who,
        tables: { one_on_one_schedule: rows.map((r) => ({ ...r })) },
        headers: EMPTY_HEADERS,
      }), () => oneOnOneAlerts(), `alerts ${label}`)
    }
    // seen: mark the soon key for the manager, then poll again — both sides drop it.
    const seenFx = fxBase({
      userEmail: 'tl@dabdoob.com',
      tables: { one_on_one_schedule: rows.map((r) => ({ ...r })) },
      headers: EMPTY_HEADERS,
    })
    const fixture = install(seenFx)
    const lFirst = call('oneOnOneAlerts', [], fixture)
    const pFirst = await portCall(() => oneOnOneAlerts())
    expectSame(pFirst, lFirst, 'alerts first')
    const keys = ((pFirst.ok as { alerts: { key: string }[] }).alerts || []).map((a) => a.key)
    await portCall(() => oneOnOneAlertsSeen(keys))
    // The vm cache is wiped per call() — seen + poll must share one execution.
    const lSecond = { ok: json(O().eval(
      `(function () { oneOnOneAlertsSeen(${JSON.stringify(keys)}); return oneOnOneAlerts(); })()`,
    )) }
    const pSecond = await portCall(() => oneOnOneAlerts())
    expectSame(pSecond, lSecond, 'alerts after seen')
  })
})

describe('reminder + missed jobs — WP-23', () => {
  it('runOneOnOneReminders_ — gate, off-day skip, dedupe, next-ms write', async () => {
    const at = NOW + 12 * 60000
    const mkFx = (over: DeskFx = {}): DeskFx => fxBase({
      userEmail: '',
      tables: {
        one_on_one_schedule: [
          sched('SC-DUE', { scheduled_at: iso(at), submitted_at: iso(NOW - 4 * H) }),
          sched('SC-OFF', { scheduled_at: iso(at), submitted_at: iso(NOW - 4 * H), report_email: 'b@dabdoob.com' }), // b@ is off Fri? 2025-11-20 is Thu; both work
          sched('SC-LATE', { scheduled_at: iso(NOW + 10 * 60000), submitted_at: iso(NOW - 5 * 60000) }), // booked inside 15m
          sched('SC-DEDUPED', { scheduled_at: iso(at), submitted_at: iso(NOW - 4 * H), report_email: 'b@dabdoob.com', manager_email: 'admin@dabdoob.com' }),
        ],
        pw_reminder_log: [
          { dedupe_key: 'oo15|SC-DEDUPED|' + at + '|admin@dabdoob.com', kind: 'one_on_one_15min', recipient: 'admin@dabdoob.com', ref: 'SC-DEDUPED', status: 'sent', ...SUB_STAMPS },
          { dedupe_key: 'oo15|SC-DEDUPED|' + at + '|b@dabdoob.com', kind: 'one_on_one_15min', recipient: 'b@dabdoob.com', ref: 'SC-DEDUPED', status: 'sent', ...SUB_STAMPS },
        ],
        holidays: [],
        ...(over.tables || {}),
      },
      headers: EMPTY_HEADERS,
      ...over,
    })
    // run 1: sends for SC-DUE (manager + report), skips deduped + late
    const r1 = await sameJob('runOneOnOneReminders_', [NOW], mkFx(), () => runOneOnOneReminders_(NOW), 'rem run1')
    expectAllTablesSame('rem run1', ['html_body'])
    // config-key write parity (port writes config, legacy writes script props)
    expect(String((hubDb.tables.config || []).find((r) => r.key === 'pw_oo_reminder_next_ms')?.value))
      .toBe(String(lprops().PW_OO_REMINDER_NEXT_MS || ''))
    // run 2 at the same instant: everything deduped -> same counts on both sides
    const r2 = await sameJob('runOneOnOneReminders_', [NOW], mkFx({
      tables: {
        ...mkFx().tables,
        pw_reminder_log: [
          ...(mkFx().tables!.pw_reminder_log || []),
          ...(ltable('pw_reminder_log').filter((r) => String(r.dedupe_key).indexOf('oo15|') === 0)),
        ],
      } as DeskFx['tables'],
    }), () => runOneOnOneReminders_(NOW), 'rem run2')
    void r1; void r2
    // gate: config key in the future -> skipped on both sides
    await sameJob('runOneOnOneReminders_', [NOW], mkFx({ settings: { pw_oo_reminder_next_ms: String(NOW + 3600000) }, props: { PW_OO_REMINDER_NEXT_MS: String(NOW + 3600000) } }),
      () => runOneOnOneReminders_(NOW), 'rem gate')
    // disabled -> skipped off
    await sameJob('runOneOnOneReminders_', [NOW], mkFx({ settings: { one_on_one_email_15min: false } }),
      () => runOneOnOneReminders_(NOW), 'rem off')
    // off-day skip: b@ (Egypt, Fri/Sat off) booked Friday 2025-11-21; only the report's day decides for the report
    const fri = Date.parse('2025-11-21T09:00:00Z')
    await sameJob('runOneOnOneReminders_', [fri], mkFx({
      nowMs: fri,
      tables: {
        one_on_one_schedule: [
          sched('SC-FRI', { scheduled_at: iso(fri + 12 * 60000), submitted_at: iso(fri - 4 * H), report_email: 'b@dabdoob.com' }),
        ],
        pw_reminder_log: [],
        holidays: [{ holiday_id: 'H', country: 'Egypt', date: '2025-11-21', name: 'EG day', deleted_at: '' }],
      },
    }), () => runOneOnOneReminders_(fri), 'rem offday')
    expectAllTablesSame('rem offday', ['html_body'])
  })

  it('runMissedOneOnOneCheck_ — missed/excused/popup/mail/escalation', async () => {
    const day = '2025-11-20'
    const at = Date.parse(day + 'T07:00:00Z') // 10:00 Kuwait Thursday
    const afterCutoff = Date.parse(day + 'T20:00:00Z') // 23:00 Kuwait
    const mkFx = (over: DeskFx = {}): DeskFx => fxBase({
      userEmail: '',
      nowMs: afterCutoff,
      tables: {
        one_on_one_schedule: [
          sched('SC-MISS', { scheduled_at: iso(at), status: 'scheduled' }),
          sched('SC-EXCUSE', { scheduled_at: iso(at), status: 'scheduled', report_email: 'b@dabdoob.com' }), // b@ Egypt Fri/Sat; Thursday is working for both -> NOT excused; make holiday below
          sched('SC-FUTURE', { scheduled_at: iso(NOW + D), status: 'scheduled' }),
          sched('SC-HELD', { scheduled_at: iso(at), status: 'held' }),
          sched('SC-OLD', { scheduled_at: iso(Date.parse('2025-11-17T07:00:00Z')), status: 'missed' }),
          sched('SC-OLD2', { scheduled_at: iso(Date.parse('2025-11-15T07:00:00Z')), status: 'missed', report_email: 'b@dabdoob.com' }),
        ],
        pw_reminder_log: [
          { dedupe_key: 'missed-esc:SC-OLD2', kind: 'missed_1on1_escalated', recipient: 'tl@dabdoob.com', ref: 'SC-OLD2', status: 'sent', ...SUB_STAMPS },
        ],
        holidays: [{ holiday_id: 'H', country: 'Egypt', date: day, name: 'EG day', deleted_at: '' }],
        popups: [],
        ...(over.tables || {}),
      },
      headers: EMPTY_HEADERS,
      ...over,
    })
    // SC-EXCUSE: b@ is Egyptian; the holiday makes HER day a holiday -> excused for the pair.
    const r = await sameJob('runMissedOneOnOneCheck_', [afterCutoff], mkFx(), () => runMissedOneOnOneCheck_(afterCutoff), 'missed run')
    expectAllTablesSame('missed run', ['html_body'])
    void r
    // pre-cutoff: nothing is missed
    const before = Date.parse(day + 'T18:00:00Z') // 21:00 Kuwait < 22:00
    await sameJob('runMissedOneOnOneCheck_', [before], mkFx(), () => runMissedOneOnOneCheck_(before), 'missed before')
    // exactly at cutoff 22:00 Kuwait: missed
    await sameJob('runMissedOneOnOneCheck_', [Date.parse(day + 'T19:00:00Z')], mkFx(), () => runMissedOneOnOneCheck_(Date.parse(day + 'T19:00:00Z')), 'missed at cutoff')
  })

  it('pwDigestItems_ / runTaskReminders_ — task nudges + outstanding 1:1s', async () => {
    const day = '2025-11-20'
    const mkTask = (id: string, over: Record<string, unknown> = {}) => ({
      action_id: id, title: 'Task ' + id, description: '', owner_email: 'a@dabdoob.com', assigned_by: 'tl@dabdoob.com',
      due_date: '2025-11-25', source_type: 'task', source_id: '', series_id: '', topic: '', status: 'open',
      outcome_note: '', closed_at: '', closed_by: '', visibility: 'shared', track_as_task: true, carry_count: 0,
      source_deleted_at: '', ...EMPTY_STAMPS, ...over,
    })
    const det = (id: string, s: number, e: number, over: Record<string, unknown> = {}) => ({
      action_id: id, priority: 'P1', start_at: iso(s), deadline_at: iso(e), est_hours: 4, available_hours: '',
      fit_status: '', progress_state: '', blocked_reason: '', rag_self: '', delivered_at: '', delivery_ref: '',
      actual_hours: '', source_label: 'plan', assigned_anyway: '', expectation: '', outcome_rating: '',
      outcome_note: '', rated_by: '', rated_at: '', ...EMPTY_STAMPS, ...over,
    })
    const fx = fxBase({
      userEmail: '',
      tables: {
        actions: [
          mkTask('T-OD', { due_date: '2025-11-18' }),                            // overdue 2+ wd -> escalate
          mkTask('T-TODAY', { due_date: day }),
          mkTask('T-NEXT', { due_date: '2025-11-23' }),                          // next working day for a@ (Sun)
          mkTask('T-NOSTART'),
          mkTask('T-NOUPD'),
          mkTask('T-HALF'),
          mkTask('T-PM'),
          mkTask('T-OK'),
          mkTask('T-NOTTASK', { track_as_task: false, due_date: '2025-11-18' }), // not a task -> ignored
        ],
        action_task_details: [
          det('T-OD', NOW - 6 * D, Date.parse('2025-11-18T17:00:00Z')),
          det('T-TODAY', NOW - D, Date.parse(day + 'T15:00:00Z')),
          det('T-NEXT', NOW - D, Date.parse('2025-11-23T15:00:00Z')),
          det('T-NOSTART', NOW - 5 * D, NOW + 3 * D),
          det('T-NOUPD', NOW - 8 * D, NOW + 3 * D),
          det('T-HALF', NOW - D, NOW + D),
          det('T-PM', NOW - 5 * D, NOW + 4 * D),
          det('T-OK', NOW - D, NOW + 3 * D),
        ],
        action_updates: [
          { update_id: 'U1', action_id: 'T-NOUPD', kind: 'status', note: 'x', percent_complete: 30, rag: '', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '', ...SUB_STAMPS, submitted_at: iso(NOW - 6 * D) },
          { update_id: 'U2', action_id: 'T-OK', kind: 'status', note: 'y', percent_complete: 60, rag: 'on_track', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '', ...SUB_STAMPS, submitted_at: iso(NOW - H) },
        ],
        action_planned_milestones: [
          { milestone_id: 'PM1', action_id: 'T-PM', label: 'kickoff', target_date: '2025-11-19', done_by_update_id: '', ...EMPTY_STAMPS },
          { milestone_id: 'PM2', action_id: 'T-PM', label: 'done-one', target_date: '2025-11-18', done_by_update_id: 'UX', ...EMPTY_STAMPS },
        ],
        one_on_one_schedule: [sched('SC-MISSED', { scheduled_at: iso(NOW - 2 * D), status: 'missed' })],
        pw_reminder_log: [],
        holidays: [],
      },
      headers: EMPTY_HEADERS,
    })
    await sameJob('pwDigestItems_', [NOW], fx, () => pwDigestItems_(NOW), 'digest items')
    const r = await sameJob('runTaskReminders_', [NOW], fx, () => runTaskReminders_(NOW), 'digest job')
    expectAllTablesSame('digest job', ['html_body'])
    void r
    // non-working day for the only owner: no mail
    const fri = Date.parse('2025-11-21T09:00:00Z')
    await sameJob('runTaskReminders_', [fri], fxBase({
      userEmail: '', nowMs: fri,
      tables: {
        actions: [mkTask('T-OD', { due_date: '2025-11-18' })],
        action_task_details: [det('T-OD', NOW - 6 * D, Date.parse('2025-11-18T17:00:00Z'))],
        one_on_one_schedule: [], pw_reminder_log: [], holidays: [],
      }, headers: EMPTY_HEADERS,
    }), () => runTaskReminders_(fri), 'digest offday')
  })

  it('runMeetingActionReminders_ — owner nudge T-2wd, chair pre-read on the day', async () => {
    const mkMeeting = (id: string, held: string, over: Record<string, unknown> = {}) => ({
      meeting_id: id, series_id: 'MS-1', held_at: held, next_meeting_at: '', notes: '', decisions: '',
      status: 'open', closed_at: '', summary_sent_at: '', ...EMPTY_STAMPS, ...over,
    })
    const mkAction = (id: string, owner: string, due: string, over: Record<string, unknown> = {}) => ({
      action_id: id, title: 'Do ' + id, description: '', owner_email: owner, assigned_by: 'tl@dabdoob.com',
      due_date: due, source_type: 'meeting', source_id: '', series_id: 'MS-1', topic: '', status: 'open',
      outcome_note: '', closed_at: '', closed_by: '', visibility: 'shared', track_as_task: false, carry_count: 0,
      source_deleted_at: '', ...EMPTY_STAMPS, ...over,
    })
    const tables = (heldAt: string): DeskFx['tables'] => ({
      meeting_series: [{ series_id: 'MS-1', meeting_type: 'weekly', title: 'Ops sync', chair_email: 'admin@dabdoob.com', cadence: 'weekly', active: true, ...EMPTY_STAMPS }],
      meetings: [mkMeeting('M-1', heldAt)],
      actions: [
        mkAction('MA-1', 'a@dabdoob.com', '2025-11-24'),
        mkAction('MA-2', 'b@dabdoob.com', '2025-11-15'), // overdue -> 'overdue' state in the chair table
        mkAction('MA-3', 'a@dabdoob.com', '2025-11-24', { status: 'done', closed_at: iso(NOW - D), closed_by: 'a@dabdoob.com' }),
      ],
      action_updates: [
        { update_id: 'U1', action_id: 'MA-1', kind: 'status', note: 'n', percent_complete: 40, rag: '', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '', ...SUB_STAMPS, submitted_at: iso(NOW - 2 * H) },
      ],
      pw_reminder_log: [], holidays: [],
    })
    // Meeting Sunday 2025-11-23: from Thursday, a@ (Sun-Thu) has 2 working days -> nudge; b@ (Fri/Sat off) also 2.
    const sunAt = iso(Date.parse('2025-11-23T09:00:00Z'))
    const r = await sameJob('runMeetingActionReminders_', [NOW], fxBase({ userEmail: '', tables: tables(sunAt), headers: EMPTY_HEADERS }),
      () => runMeetingActionReminders_(NOW), 'meeting T-2')
    expectAllTablesSame('meeting T-2', ['html_body'])
    void r
    // On the day: chair pre-read
    const sunNow = Date.parse('2025-11-23T09:00:00Z')
    const r2 = await sameJob('runMeetingActionReminders_', [sunNow], fxBase({ userEmail: '', nowMs: sunNow, tables: tables(sunAt), headers: EMPTY_HEADERS }),
      () => runMeetingActionReminders_(sunNow), 'meeting day')
    expectAllTablesSame('meeting day', ['html_body'])
    void r2
    // Far future meeting + closed last-with-next: no mail
    const farAt = iso(NOW + 10 * D)
    await sameJob('runMeetingActionReminders_', [NOW], fxBase({ userEmail: '', tables: tables(farAt), headers: EMPTY_HEADERS }),
      () => runMeetingActionReminders_(NOW), 'meeting far')
  })
})

describe('one-on-one lifecycle writes — WP-23', () => {
  const life = (over: DeskFx = {}): DeskFx => fxBase({
    userEmail: 'tl@dabdoob.com', headers: EMPTY_HEADERS,
    tables: { one_on_one_schedule: [], one_on_one_logs: [], one_on_one_topics: [], one_on_one_private_notes: [], actions: [], action_reviews: [], popups: [], pw_reminder_log: [], people_signals: [], holidays: [], ...(over.tables || {}) },
    ...over,
  })
  const future = NOW + 26 * H // Friday 14:00 Kuwait (tl off Fri/Sat -> warning path exists too)
  const nextWk = NOW + 4 * D

  it('oneOnOnesSchedule — booking rules, warnings and the row written', async () => {
    // happy path: next week Thursday, both working (tl is off Fri/Sat, a is rotational)
    const ok = await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(nextWk), 45], life(), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(nextWk), 45), 'schedule ok')
    expectAllTablesSame('schedule ok')
    void ok
    // duration clamp + bad/past dates
    await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(nextWk + 5 * D), 5], life(), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(nextWk + 5 * D), 5), 'schedule dur clamp')
    for (const [w, d, label] of [
      ['bad', 30, 'bad when'], [iso(NOW - H), 30, 'past'], [iso(NOW - 6 * 60000), 30, 'inside 5min grace'],
      [null, 30, 'null when'], [iso(nextWk + 8 * D), 'x', 'bad dur'],
    ] as const) {
      await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', w, d], life(), () =>
        oneOnOnesSchedule('a@dabdoob.com', w as never, d), `schedule ${label}`)
    }
    // non-report / unknown report / self
    await sameJob('oneOnOnesSchedule', ['admin@dabdoob.com', iso(nextWk), 30], life(), () =>
      oneOnOnesSchedule('admin@dabdoob.com', iso(nextWk), 30), 'schedule non-report')
    await sameJob('oneOnOnesSchedule', ['ghost@dabdoob.com', iso(nextWk), 30], life(), () =>
      oneOnOnesSchedule('ghost@dabdoob.com', iso(nextWk), 30), 'schedule unknown')
    await sameJob('oneOnOnesSchedule', ['tl@dabdoob.com', iso(nextWk), 30], life(), () =>
      oneOnOnesSchedule('tl@dabdoob.com', iso(nextWk), 30), 'schedule self')
    // non-tl caller refused
    await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(nextWk), 30], life({ userEmail: 'b@dabdoob.com' }), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(nextWk), 30), 'schedule as agent')
    // same-week dup + overlap clash
    const seeds = [sched('SC-SAME', { scheduled_at: iso(nextWk + 2 * H), report_email: 'a@dabdoob.com' }),
      sched('SC-OTHER', { scheduled_at: iso(nextWk + 4 * H), report_email: 'b@dabdoob.com' })]
    await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(nextWk + 26 * H), 30], life({ tables: { one_on_one_schedule: seeds } }), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(nextWk + 26 * H), 30), 'schedule same week')
    await sameJob('oneOnOnesSchedule', ['b@dabdoob.com', iso(nextWk + H), 60], life({ tables: { one_on_one_schedule: seeds } }), () =>
      oneOnOnesSchedule('b@dabdoob.com', iso(nextWk + H), 60), 'schedule overlap')
    // warnings: booking on the manager's day off (Friday) + outside shift/overlap
    await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(future), 30], life(), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(future), 30), 'schedule warnings')
    await sameJob('oneOnOnesSchedule', ['a@dabdoob.com', iso(nextWk - 14 * H), 30], life(), () =>
      oneOnOnesSchedule('a@dabdoob.com', iso(nextWk - 14 * H), 30), 'schedule night slot')
  })

  it('oneOnOnesReschedule / oneOnOnesMarkNotHeld — moves and not-held', async () => {
    const booked = sched('SC-MOVE', { scheduled_at: iso(nextWk) })
    await sameJob('oneOnOnesReschedule', ['SC-MOVE', iso(nextWk + 5 * H), 'had to move'], life({ tables: { one_on_one_schedule: [booked] } }), () =>
      oneOnOnesReschedule('SC-MOVE', iso(nextWk + 5 * H), 'had to move'), 'reschedule')
    expectAllTablesSame('reschedule')
    // errors: missing reason, past booking, wrong status, someone else's
    for (const [id, w, r, extra, label] of [
      ['SC-MOVE', iso(nextWk + 5 * H), '  ', {}, 'no reason'],
      ['SC-PAST', iso(nextWk + 5 * H), 'r', { one_on_one_schedule: [sched('SC-PAST', { scheduled_at: iso(NOW - H) })] }, 'already started'],
      ['SC-MISS', iso(nextWk + 5 * H), 'r', { one_on_one_schedule: [sched('SC-MISS', { scheduled_at: iso(NOW - 2 * D), status: 'missed' })] }, 'missed not reschedulable'],
      ['SC-MOVE', iso(nextWk + 5 * H), 'r', { userEmail: 'b@dabdoob.com' }, 'not the holder'],
      ['SC-GONE', iso(nextWk + 5 * H), 'r', {}, 'missing'],
      ['SC-MOVE', 'bad', 'r', {}, 'bad new when'],
    ] as const) {
      await sameJob('oneOnOnesReschedule', [id, w, r], life({
        userEmail: (extra as { userEmail?: string }).userEmail,
        tables: { one_on_one_schedule: (extra as { one_on_one_schedule?: Row[] }).one_on_one_schedule || [booked] },
      }), () => oneOnOnesReschedule(id, w as never, r), `resched ${label}`)
    }
    // not held: missed booking + reason + replacement inside 5 working days
    const missed = sched('SC-M1', { scheduled_at: iso(NOW - 2 * H), status: 'missed', missed_at: iso(NOW - H) })
    const pop = { popup_id: 'P1', recipient: 'tl@dabdoob.com', kind: 'missed_1on1', ref: 'SC-M1', title: 't', body: '', link: '', created_at: iso(NOW - 3 * H), resolved_at: '', submitted_by: '', submitted_at: '' }
    await sameJob('oneOnOnesMarkNotHeld', ['SC-M1', 'report sick', iso(nextWk)], life({
      tables: { one_on_one_schedule: [missed], popups: [pop] },
    }), () => oneOnOnesMarkNotHeld('SC-M1', 'report sick', iso(nextWk)), 'notHeld')
    expectAllTablesSame('notHeld')
    // excused also works; scheduled-but-not-yet-missed refuses; too-far replacement refuses
    await sameJob('oneOnOnesMarkNotHeld', ['SC-M2', 'no show', iso(nextWk)], life({
      tables: { one_on_one_schedule: [sched('SC-M2', { scheduled_at: iso(NOW - 2 * H), status: 'excused', reason: 'day off' })] },
    }), () => oneOnOnesMarkNotHeld('SC-M2', 'no show', iso(nextWk)), 'notHeld excused')
    await sameJob('oneOnOnesMarkNotHeld', ['SC-M3', 'x', iso(nextWk)], life({
      tables: { one_on_one_schedule: [sched('SC-M3', { scheduled_at: iso(nextWk), status: 'scheduled' })] },
    }), () => oneOnOnesMarkNotHeld('SC-M3', 'x', iso(nextWk)), 'notHeld future')
    await sameJob('oneOnOnesMarkNotHeld', ['SC-M4', 'x', 'bad'], life({
      tables: { one_on_one_schedule: [sched('SC-M4', { scheduled_at: iso(NOW - 2 * H), status: 'missed' })] },
    }), () => oneOnOnesMarkNotHeld('SC-M4', 'x', 'bad' as never), 'notHeld bad when')
    await sameJob('oneOnOnesMarkNotHeld', ['SC-M5', 'x', iso(NOW + 30 * D)], life({
      tables: { one_on_one_schedule: [sched('SC-M5', { scheduled_at: iso(NOW - 2 * H), status: 'missed' })] },
    }), () => oneOnOnesMarkNotHeld('SC-M5', 'x', iso(NOW + 30 * D)), 'notHeld too far')
  })

  const submitBase = (schedOver: Record<string, unknown> = {}) => sched('SC-LOG', {
    scheduled_at: iso(NOW - 3 * H), status: 'scheduled', ...schedOver,
  })
  const goodTopics = [{ topic: 'recognition', outcome: 'Resolved', raisedBy: 'tl' }]
  const goodActions = [{ title: 'Follow up on the report', ownerEmail: 'a@dabdoob.com', dueDate: '2025-11-27', trackAsTask: true }]

  it('oneOnOnesSubmit — full write path: log, topics, actions, schedule, popups, escalation', async () => {
    // booked log: held on time -> 'held'
    const p1 = {
      reportEmail: 'a@dabdoob.com', scheduleId: 'SC-LOG', heldAt: iso(NOW - 3 * H),
      topics: goodTopics, reviews: [], skipped: [], actions: goodActions,
      privateNote: 'keep this between us',
    }
    const r = await sameJob('oneOnOnesSubmit', [p1], life({ tables: { one_on_one_schedule: [submitBase()] } }), () =>
      oneOnOnesSubmit(p1 as never), 'submit booked')
    expectAllTablesSame('submit booked')
    void r
    // a missed booking logged now -> 'held_late'
    const p2 = { ...p1, scheduleId: 'SC-LOG', heldAt: iso(NOW) }
    const missedPop = { popup_id: 'P1', recipient: 'tl@dabdoob.com', kind: 'missed_1on1', ref: 'SC-LOG', title: 't', body: '', link: '', created_at: iso(NOW - 3 * H), resolved_at: '', submitted_by: '', submitted_at: '' }
    await sameJob('oneOnOnesSubmit', [p2], life({
      tables: { one_on_one_schedule: [submitBase({ status: 'missed', missed_at: iso(NOW - 2 * H) })], popups: [missedPop] },
    }), () => oneOnOnesSubmit(p2 as never), 'submit late')
    expectAllTablesSame('submit late')
    // carry-forward: an open action in this series must be reviewed
    const carry = {
      action_id: 'ACT-1', title: 'Old task', description: '', owner_email: 'a@dabdoob.com', assigned_by: 'tl@dabdoob.com',
      due_date: '2025-11-19', source_type: 'one_on_one_agent', source_id: 'OOL-0', series_id: 'tl@dabdoob.com|a@dabdoob.com',
      topic: '', status: 'open', outcome_note: '', closed_at: '', closed_by: '', visibility: 'shared', track_as_task: false,
      carry_count: 1, source_deleted_at: '', ...EMPTY_STAMPS,
    }
    const p3 = { ...p1, reviews: [{ actionId: 'ACT-1', outcome: 'carried', newDueDate: '2025-11-30' }], topics: [{ topic: 'other', outcome: 'Monitor', raisedBy: 'agent' }] }
    await sameJob('oneOnOnesSubmit', [p3], life({
      tables: { one_on_one_schedule: [submitBase()], actions: [carry] },
    }), () => oneOnOnesSubmit(p3 as never), 'submit carry')
    expectAllTablesSame('submit carry')
    // unreviewed carry-forward -> refusal
    const p4 = { ...p3, reviews: [] }
    await sameJob('oneOnOnesSubmit', [p4], life({
      tables: { one_on_one_schedule: [submitBase()], actions: [carry] },
    }), () => oneOnOnesSubmit(p4 as never), 'submit carry missing')
    // review outcome 'done' needs a note
    const p5 = { ...p3, reviews: [{ actionId: 'ACT-1', outcome: 'done', note: 'shipped' }] }
    await sameJob('oneOnOnesSubmit', [p5], life({
      tables: { one_on_one_schedule: [submitBase()], actions: [carry] },
    }), () => oneOnOnesSubmit(p5 as never), 'submit done')
    // confidential wellbeing + no-action exception
    const p6 = {
      reportEmail: 'a@dabdoob.com', heldAt: iso(NOW - 3 * H), topics: [{ topic: 'wellbeing', outcome: 'Resolved', raisedBy: 'agent', fields: { confidential: 'yes' } }],
      reviews: [], skipped: [], actions: [], noActionReason: 'nothing new this week', privateNote: '',
    }
    await sameJob('oneOnOnesSubmit', [p6], life(), () => oneOnOnesSubmit(p6 as never), 'submit noaction')
    expectAllTablesSame('submit noaction')
    // no actions without the narrow exception -> error
    const p7 = { ...p6, topics: [{ topic: 'other', outcome: 'Monitor', raisedBy: 'tl' }] }
    await sameJob('oneOnOnesSubmit', [p7], life(), () => oneOnOnesSubmit(p7 as never), 'submit noaction refused')
    // escalation: outcome Escalate to Mohamed -> admin popups + mail
    const p8 = { ...p1, topics: [{ topic: 'incident', outcome: 'Escalate to Mohamed', raisedBy: 'tl', fields: { ticket_ids: '100' }, evidence: { behaviour: 'b', evidence: 'e', standard: 's', shownBefore: 'yes', explanation: 'x' } }] }
    await sameJob('oneOnOnesSubmit', [p8], life({
      tables: { one_on_one_schedule: [submitBase()], popups: [] },
    }), () => oneOnOnesSubmit(p8 as never), 'submit escalate')
    expectAllTablesSame('submit escalate', ['html_body'])
    // validation refusals
    const badPayloads: [Record<string, unknown>, string][] = [
      [{ ...p1, topics: [] }, 'no topics'],
      [{ ...p1, topics: goodTopics.concat(goodTopics, goodTopics, [{ topic: 'other', outcome: 'Monitor', raisedBy: 'tl' }]) }, '4 topics'],
      [{ ...p1, topics: goodTopics.concat([{ topic: 'recognition', outcome: 'Monitor', raisedBy: 'agent' }]) }, 'dup topic'],
      [{ ...p1, topics: [{ topic: 'nope', outcome: 'Resolved' }] }, 'bad topic'],
      [{ ...p1, topics: [{ topic: 'incident', outcome: 'Resolved', fields: { ticket_ids: '1' } }] }, 'evidence missing'],
      [{ ...p1, topics: [{ topic: 'incident', outcome: 'Resolved', fields: {}, evidence: { behaviour: 'b', evidence: 'e', standard: 's', shownBefore: 'yes', explanation: 'x' } }] }, 'required field'],
      [{ ...p1, heldAt: iso(NOW + H) }, 'future held'],
      [{ ...p1, reportEmail: 'ghost@dabdoob.com' }, 'unknown report'],
      [{ ...p1, scheduleId: 'SC-NOPE' }, 'wrong booking'],
    ]
    for (const [pl, label] of badPayloads) {
      await sameJob('oneOnOnesSubmit', [pl], life({ tables: { one_on_one_schedule: [submitBase()] } }), () =>
        oneOnOnesSubmit(pl as never), `submit ${label}`)
    }
  })

  it('soft-delete + restore — cascade both ways', async () => {
    const held = Date.parse('2025-11-19T10:00:00Z')
    const log = {
      log_id: 'OOL-1', schedule_id: 'SC-LOG', kind: 'agent', manager_email: 'tl@dabdoob.com', report_email: 'a@dabdoob.com',
      held_at: iso(held), summary: 'Recognition: Resolved', no_action_reason: '', on_time: true,
      deleted_at: '', deleted_by: '', delete_reason: '', delete_cascade_json: '',
      submitted_by: 'tl@dabdoob.com', submitted_at: iso(held),
    }
    const topics = [
      { log_id: 'OOL-1', topic: 'recognition', position: 1, raised_by: 'tl', suggested: false, skipped_reason: '', outcome: 'Resolved', confidential: false, answers_json: '{}', fields_json: '{}', evidence_json: '', ...SUB_STAMPS },
      { log_id: 'OOL-1', topic: 'wellbeing', position: 2, raised_by: 'agent', suggested: false, skipped_reason: '', outcome: 'Monitor', confidential: true, answers_json: '{}', fields_json: '{"confidential":"yes"}', evidence_json: '', ...SUB_STAMPS },
    ]
    const notes = [{ log_id: 'OOL-1', kind: 'private_note', author_email: 'tl@dabdoob.com', note: 'secret', ...SUB_STAMPS }]
    const createdAction = {
      action_id: 'ACT-NEW', title: 'from this 1:1', description: '', owner_email: 'a@dabdoob.com', assigned_by: 'tl@dabdoob.com',
      due_date: '2025-11-27', source_type: 'one_on_one_agent', source_id: 'OOL-1', series_id: 'tl@dabdoob.com|a@dabdoob.com',
      topic: '', status: 'open', outcome_note: '', closed_at: '', closed_by: '', visibility: 'shared', track_as_task: true,
      carry_count: 0, source_deleted_at: '', ...EMPTY_STAMPS,
    }
    const carryAction = {
      ...createdAction, action_id: 'ACT-OLD', title: 'carried action', source_id: 'OOL-0', status: 'open',
      due_date: '2025-11-30', carry_count: 2,
    }
    const reviewedLater = {
      ...createdAction, action_id: 'ACT-LATER', title: 'later reviewed', source_id: 'OOL-1', status: 'done',
      closed_at: iso(held + H), closed_by: 'a@dabdoob.com', outcome_note: 'done',
    }
    const reviews = [
      { review_id: 'REV-1', action_id: 'ACT-OLD', reviewed_in_type: 'one_on_one', reviewed_in_id: 'OOL-1', outcome: 'carried', note: '', new_due_date: '2025-11-30', prev_status: 'open', prev_due_date: '2025-11-19', prev_outcome_note: '', reverted_at: '', submitted_by: 'tl@dabdoob.com', submitted_at: iso(held) },
      { review_id: 'REV-2', action_id: 'ACT-LATER', reviewed_in_type: 'one_on_one', reviewed_in_id: 'OOL-1', outcome: 'done', note: 'ok', new_due_date: '', prev_status: 'open', prev_due_date: '2025-11-25', prev_outcome_note: '', reverted_at: '', submitted_by: 'tl@dabdoob.com', submitted_at: iso(held) },
      { review_id: 'REV-3', action_id: 'ACT-LATER', reviewed_in_type: 'one_on_one', reviewed_in_id: 'OOL-2', outcome: 'blocked', note: 'blocked later', new_due_date: '', prev_status: 'open', prev_due_date: '2025-11-25', prev_outcome_note: '', reverted_at: '', submitted_by: 'tl@dabdoob.com', submitted_at: iso(held + 2 * H) },
    ]
    const schedule = [submitBase({ schedule_id: 'SC-LOG', status: 'held', log_id: 'OOL-1' }), sched('SC-OTHER', { scheduled_at: iso(NOW + D) })]
    const delFx = (): DeskFx => life({
      userEmail: 'admin@dabdoob.com',
      tables: {
        one_on_one_schedule: schedule.map((s) => ({ ...s })),
        one_on_one_logs: [log],
        one_on_one_topics: topics,
        one_on_one_private_notes: notes,
        actions: [createdAction, carryAction, reviewedLater],
        action_reviews: reviews,
        popups: [{ popup_id: 'P-ESC', recipient: 'admin@dabdoob.com', kind: 'escalation_1on1', ref: 'OOL-1', title: 't', body: '', link: '', created_at: iso(NOW - 3 * H), resolved_at: '', submitted_by: '', submitted_at: '' }],
      },
    })
    await sameJob('oneOnOnesDeletePreview', ['OOL-1'], delFx(), () => oneOnOnesDeletePreview('OOL-1'), 'del preview')
    await sameJob('oneOnOnesDeletePreview', ['OOL-1'], life({ userEmail: 'tl@dabdoob.com', tables: { one_on_one_logs: [log] } }), () =>
      oneOnOnesDeletePreview('OOL-1'), 'del preview nonadmin')
    const del = await sameJob('oneOnOnesDeleteLog', ['OOL-1', 'logged twice'], delFx(), () => oneOnOnesDeleteLog('OOL-1', 'logged twice'), 'del log')
    expectAllTablesSame('del log', ['html_body', 'delete_cascade_json'])
    // the cascade itself must agree (row ids are the same on both sides)
    const lCascade = JSON.parse(String((ltable('one_on_one_logs')[0] || {}).delete_cascade_json || '{}')) as Record<string, unknown>
    const pCascade = JSON.parse(String(((hubDb.tables.one_on_one_logs || [])[0] || {}).delete_cascade_json || '{}')) as Record<string, unknown>
    expect(diffPath(pCascade, lCascade)).toBeNull()
    void del

    // --- restore the deleted record on both sides (one install -> delete -> restore) ---
    const rFx = install(delFx())
    call('oneOnOnesDeleteLog', ['OOL-1', 'logged twice'], rFx)
    await portCall(() => oneOnOnesDeleteLog('OOL-1', 'logged twice'))
    // The vm keeps its post-call state: run the restore in the SAME execution (no reset).
    const lRest = { ok: json(O().eval('oneOnOnesRestore("log", "OOL-1")')) }
    const pRest = await portCall(() => oneOnOnesRestore('log', 'OOL-1'))
    expectSame(pRest, lRest, 'restore log')
    expectAllTablesSame('restore log')
    // a second restore refuses on both sides
    const lRest2 = (() => { try { return { ok: json(O().eval('oneOnOnesRestore("log", "OOL-1")')) } } catch (e) { return { err: String((e as Error).message || e) } } })()
    const pRest2 = await portCall(() => oneOnOnesRestore('log', 'OOL-1'))
    expectSame(pRest2, lRest2, 'restore twice')

    // --- restore refused: the booking was logged again in between ---
    const rl = install(delFx())
    call('oneOnOnesDeleteLog', ['OOL-1', 'x'], rl)
    await portCall(() => oneOnOnesDeleteLog('OOL-1', 'x'))
    O().eval('updateRow_("one_on_one_schedule","schedule_id","SC-LOG",{ status: "held", log_id: "OOL-2" })')
    await portCall(() => updateRow('one_on_one_schedule', 'schedule_id', 'SC-LOG', { status: 'held', log_id: 'OOL-2' }, { actor: 'admin@dabdoob.com' }))
    const lRelog = (() => { try { return { ok: json(O().eval('oneOnOnesRestore("log", "OOL-1")')) } } catch (e) { return { err: String((e as Error).message || e) } } })()
    const pRelog = await portCall(() => oneOnOnesRestore('log', 'OOL-1'))
    expectSame(pRelog, lRelog, 'restore relogged')
    expectAllTablesSame('restore relogged')

    // --- the deleted-records list the restore page shows ---
    const dFx = install(delFx())
    call('oneOnOnesDeleteLog', ['OOL-1', 'why'], dFx)
    call('oneOnOnesDeleteBooking', ['SC-OTHER', 'dup'], dFx)
    await portCall(() => oneOnOnesDeleteLog('OOL-1', 'why'))
    await portCall(() => oneOnOnesDeleteBooking('SC-OTHER', 'dup'))
    const lOut = { ok: json(O().eval('pwDeletedOut_(pwDirectory_())')) }
    const pOut = await portCall(async () => pwDeletedOut_(await pwDirectory()))
    expectSame(pOut, lOut, 'deletedOut list')
  })

  it('oneOnOnesDeleteBooking + restore — booking-level cascade', async () => {
    const bookFx = (): DeskFx => life({
      userEmail: 'admin@dabdoob.com',
      tables: {
        one_on_one_schedule: [
          sched('SC-DEL', { scheduled_at: iso(NOW - 2 * H), status: 'missed', missed_at: iso(NOW - H) }),
          sched('SC-FUT', { scheduled_at: iso(NOW + 5 * D) }),
          sched('SC-WITHLOG', { scheduled_at: iso(NOW - 3 * H), status: 'held', log_id: 'OOL-9' }),
        ],
        one_on_one_logs: [{
          log_id: 'OOL-9', schedule_id: 'SC-WITHLOG', kind: 'agent', manager_email: 'tl@dabdoob.com', report_email: 'a@dabdoob.com',
          held_at: iso(NOW - 3 * H), summary: 'x', no_action_reason: '', on_time: true,
          deleted_at: '', deleted_by: '', delete_reason: '', delete_cascade_json: '', ...SUB_STAMPS,
        }],
        popups: [{ popup_id: 'P-M', recipient: 'tl@dabdoob.com', kind: 'missed_1on1', ref: 'SC-DEL', title: 't', body: '', link: '', created_at: iso(NOW - 2 * H), resolved_at: '', ...SUB_STAMPS }],
      },
    })
    await sameJob('oneOnOnesDeleteBooking', ['SC-DEL', 'duplicate booking'], bookFx(), () =>
      oneOnOnesDeleteBooking('SC-DEL', 'duplicate booking'), 'del missed booking')
    expectAllTablesSame('del missed booking')
    await sameJob('oneOnOnesDeleteBooking', ['SC-FUT', 'duplicate'], bookFx(), () =>
      oneOnOnesDeleteBooking('SC-FUT', 'duplicate'), 'del future booking')
    expectAllTablesSame('del future booking')
    for (const [id, why, label] of [
      ['SC-WITHLOG', 'x', 'logged'],
      ['SC-NOPE', 'x', 'missing'],
      ['SC-FUT', '', 'blank reason'],
    ] as const) {
      await sameJob('oneOnOnesDeleteBooking', [id, why], bookFx(), () =>
        oneOnOnesDeleteBooking(id, why), `del booking ${label}`)
    }
    await sameJob('oneOnOnesDeleteBooking', ['SC-FUT', 'x'], life({
      userEmail: 'b@dabdoob.com',
      tables: { one_on_one_schedule: [sched('SC-FUT', { scheduled_at: iso(NOW + 5 * D) })] },
    }), () => oneOnOnesDeleteBooking('SC-FUT', 'x'), 'del booking nonadmin')
    // restore both kinds of deleted bookings — vm state carries over inside one install
    for (const id of ['SC-DEL', 'SC-FUT'] as const) {
      const bf = install(bookFx())
      call('oneOnOnesDeleteBooking', [id, 'dup'], bf)
      await portCall(() => oneOnOnesDeleteBooking(id, 'dup'))
      const l = { ok: json(O().eval(`oneOnOnesRestore("booking", ${JSON.stringify(id)})`)) }
      const p = await portCall(() => oneOnOnesRestore('booking', id))
      expectSame(p, l, 'restore ' + id)
      expectAllTablesSame('restore ' + id)
    }
  })
})
