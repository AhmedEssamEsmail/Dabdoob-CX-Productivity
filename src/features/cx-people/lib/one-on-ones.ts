/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim OneOnOnes.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * OneOnOnes.js — topic-driven 1:1s (People app, route #/one-on-ones).
 *
 * Part 1 of the port: constants, the topic library, the pair/cutoff/missed
 * rules, the schedule/log output mappers, and the booking write path
 * (schedule / reschedule / mark-not-held). The page/context/suggest/submit
 * read side (oneOnOnesPage, oneOnOnesStart, oneOnOnesSubmit, pwSuggestTopics_)
 * and OneOnOneDelete.js follow in lib/one-on-ones-page.ts / one-on-ones-delete.ts.
 *
 * Booking rules (pwBookingRules_): one per manager+report pair per Kuwait
 * Sunday-Saturday week, never overlapping another 1:1 either person is in.
 * Live statuses: scheduled | missed | held | held_late; rescheduled /
 * cancelled / excused / deleted rows don't block.
 */

import {
  normEmail_, pwMs_, pwIso_, pwKwDate_, pwKwTime_, pwAt_, pwAddDays_, pwToday_, pwIsManagerOf_,
} from '@/features/shared/lib/adapters'
import { dqWeekStart_ } from '@/features/cx-queue/lib'
import { newId, findRow, updateRow, readRows, cacheRemove } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { getConfig } from '@/features/shared/platform/settings'
import { getWorkingCalendar, wcDay, pwAddWorkingDays } from '@/features/shared/platform/calendar'
import { resolvePopups } from '@/features/shared/platform/popups'
import { pwAppend_ } from './actions'
import type { Directory } from '@/features/shared/lib/adapters'

export const PW_PERFORMANCE_TOPICS = ['productivity', 'quality', 'attendance', 'incident']
export const PW_NO_ACTION_TOPICS = ['recognition', 'career', 'wellbeing', 'development']
export const PW_OUTCOMES = ['Resolved', 'Coaching given', 'Standard communicated', 'Monitor', 'Formal concern raised', 'Escalate to Mohamed']
export const PW_FAIRNESS_OUTCOMES = ['Coaching given', 'Standard communicated']

export interface PwTopicField { id: string; label: string; type: string; listKey?: string; required?: boolean }
export interface PwTopicDef {
  id: string
  label: string
  performance?: boolean
  noData?: boolean
  prompts: string[]
  fields: PwTopicField[]
}

/** The topic library (people-workflows 1.3 and 1.4). */
export const PW_TOPICS: Record<'agent' | 'tl', PwTopicDef[]> = {
  // Agent 1:1s are about the person's own work: their scorecard (productivity, quality, FCR,
  // behaviour - the V1 components), their tickets, attendance, growth and wellbeing.
  agent: [
    { id: 'scorecard', label: 'Scorecard review',
      prompts: ['Here are your productivity, quality and FCR this month and where each ranks: how do you read them?',
                'Which one do you want to move first?',
                'Where are customers coming back to us on the same issue (FCR)?', 'What would help you get there before month end?'],
      fields: [{ id: 'focus', label: 'Component to improve', type: 'text' }] },
    { id: 'productivity', label: 'Productivity below target', performance: true,
      prompts: ['What changed in your work or day since the last 1:1?', 'Walk me through a typical slow shift: where does the time go?',
                'Is anything in the queue, tools or routing slowing you?', 'What would get you back to the standard?'],
      fields: [{ id: 'cause', label: 'Suspected cause', type: 'dropdown', listKey: 'one_on_one.productivity_cause' }] },
    { id: 'quality', label: 'Quality finding', performance: true,
      prompts: ["Let's look at the ticket: what were you trying to do?", 'What does the SOP say here?',
                'What would you do differently?', 'Is this a one-off or something you see often?'],
      fields: [{ id: 'audit_ids', label: 'Audit IDs', type: 'text' }, { id: 'criterion', label: 'Criterion', type: 'text' },
               { id: 'sop_ref', label: 'SOP reference', type: 'text' }] },
    { id: 'fcr', label: 'First contact resolution', performance: true,
      prompts: ["Let's look at the customers who came back: what was left open the first time?",
                'What would have closed it on the first contact?', 'Which case types bring people back most?'],
      fields: [{ id: 'ticket_ids', label: 'Ticket IDs', type: 'text' }] },
    { id: 'behaviour', label: 'Business behaviour case', performance: true,
      prompts: ['Talk me through what happened on that date.', 'What does the policy expect in that situation?',
                'What will you do differently next time?'],
      fields: [{ id: 'event_dates', label: 'Case dates', type: 'text' }] },
    { id: 'backlog', label: 'Aged tickets',
      prompts: ['Walk me through your oldest open tickets: what is each one waiting on?',
                'Which ones need my help or another team (3PL, Ops)?', 'Which will you close before your next shift?'],
      fields: [{ id: 'ticket_ids', label: 'Ticket IDs', type: 'text' }] },
    { id: 'attendance', label: 'Attendance & adherence', performance: true,
      prompts: ['Talk me through these dates.', 'Is there something behind this we should know about?', 'What do you need to be on time?'],
      fields: [{ id: 'event_dates', label: 'Event dates', type: 'text' }] },
    { id: 'incident', label: 'Specific incident', performance: true,
      prompts: ['What happened, in your words?', 'What was the customer impact?', 'What would you do next time?'],
      fields: [{ id: 'ticket_ids', label: 'Ticket IDs', type: 'text', required: true }] },
    { id: 'recognition', label: 'Recognition',
      prompts: ['What did you do here that worked?', 'Could others learn from it?'],
      fields: [{ id: 'share_with_team', label: 'Share with the team', type: 'yes_no' }] },
    { id: 'career', label: 'Career & development',
      prompts: ['Where do you want to be in 6 to 12 months?', 'Which skill or channel next?',
                'What can I give you: shadowing, a project, training?'],
      fields: [{ id: 'goal', label: 'Development goal', type: 'text' }, { id: 'target_date', label: 'Target date', type: 'date' }] },
    { id: 'wellbeing', label: 'Wellbeing & workload', noData: true,
      prompts: ['How are you finding the workload and shift pattern?', 'Anything outside work affecting you that you want me to know?',
                'What would help?'],
      fields: [{ id: 'confidential', label: 'Confidential (you and Mohamed only)', type: 'yes_no' }] },
    { id: 'blocker', label: 'Process or tool blocker',
      prompts: ['What is blocking you, and on which case types?', 'How often?', 'What workaround are you using?'],
      fields: [{ id: 'blocker_type', label: 'Blocker type', type: 'dropdown', listKey: 'one_on_one.blocker_type' }] },
    { id: 'other', label: 'Other', prompts: ['Agenda'], fields: [] },
  ],
  // TL 1:1s are about what the lead delivers through others: their projects, their team's
  // numbers and queue, how they manage and coach their agents, and their own growth.
  tl: [
    { id: 'delivery', label: 'Projects & task delivery',
      prompts: ['Which project is at risk, and what would bring it back?', 'What is the next milestone on each, and when?',
                'What do you need from me or another team to unblock it?', 'Is your load realistic for the hours you have?'],
      fields: [] },
    { id: 'team_performance', label: 'Team performance',
      prompts: ["What moved in your team's numbers since we last met, and why?", 'Who are the outliers, and what is your plan for each?',
                'Who is improving, and have you told them?'],
      fields: [] },
    { id: 'escalations', label: 'Aged tickets & escalations',
      prompts: ["Which of your team's tickets are in the oldest band, and what is each waiting on?",
                'Which agents asked for help on aged tickets, and what did you do?', 'Which hard case needs my help?'],
      fields: [] },
    { id: 'coaching', label: 'People management & team 1:1s',
      prompts: ['Which agent needs the most from you this week, and what is your plan?', 'Which 1:1s slipped, and why?',
                'Which actions from your 1:1s are overdue?', 'Which suggested topics did you skip, and why?'],
      fields: [] },
    { id: 'operations', label: 'Shift operations & check-ins',
      prompts: ['How did the check-ins on your shifts go: anything missed or late, and why?', 'How was the shift handover?',
                'What would make the next shift run cleaner?'],
      fields: [] },
    { id: 'development', label: 'Development',
      prompts: ['What do you want to get better at as a lead?', 'What support do you need from me?'],
      fields: [{ id: 'goal', label: 'Development goal', type: 'text' }, { id: 'target_date', label: 'Target date', type: 'date' }] },
    { id: 'wellbeing', label: 'Wellbeing & workload', noData: true,
      prompts: ['How sustainable is your workload right now?', 'What would help?'],
      fields: [{ id: 'confidential', label: 'Confidential (you and Mohamed only)', type: 'yes_no' }] },
    { id: 'incident', label: 'Specific incident', performance: true,
      prompts: ['What happened, in your words?', 'What was the impact?', 'What would you do next time?'],
      fields: [{ id: 'ticket_ids', label: 'Ticket IDs', type: 'text', required: true }] },
    { id: 'other', label: 'Other', prompts: ['Agenda'], fields: [] },
  ],
}

export const PW_EVIDENCE_FIELDS = ['behaviour', 'evidence', 'standard', 'shownBefore', 'explanation']

/**
 * pwTopicLibrary_ — the topic library for a 1:1 kind. An optional
 * `one_on_one_topic_prompts` tab overrides prompt wording (missing reads as []).
 */
export async function pwTopicLibraryDb_(kind: string): Promise<Record<string, unknown>[]> {
  const overrides = await safeRows('one_on_one_topic_prompts')
  const active = overrides.filter(
    (r) => String(r.kind) === kind && !(r.active === false || String(r.active).toLowerCase() === 'false'),
  )
  return pwTopicLibrary_(kind).map((t) => {
    const mine = active
      .filter((r) => String(r.topic) === t.id)
      .sort((a, b) => Number(a.position) - Number(b.position))
      .map((r) => String(r.prompt_text))
      .filter(String)
    return {
      id: t.id, label: t.label, performance: !!t.performance, noData: !!t.noData,
      prompts: (mine.length ? mine : t.prompts.map((p) => p.text)),
      fields: t.fields, position: t.position,
    }
  })
}

/** The pure half of pwTopicLibrary_: base library with {id,text} prompts. */
export function pwTopicLibrary_(kind: string): { id: string; label: string; performance: boolean; noData: boolean; prompts: { id: string; text: string }[]; fields: PwTopicField[]; position: number }[] {
  const base = PW_TOPICS[(kind as 'agent' | 'tl')] || PW_TOPICS.agent
  return base.map((t, i) => ({
    id: t.id, label: t.label, performance: !!t.performance, noData: !!t.noData,
    prompts: t.prompts.map((p, j) => ({ id: t.id + '_' + (j + 1), text: p })),
    fields: t.fields, position: i,
  }))
}

export function pwTopicDef_(kind: string, id: string): PwTopicDef | null {
  return (PW_TOPICS[(kind as 'agent' | 'tl')] || []).filter((t) => t.id === id)[0] || null
}

export function pwSeriesKey_(managerEmail: unknown, reportEmail: unknown): string {
  return normEmail_(managerEmail) + '|' + normEmail_(reportEmail)
}

/** The manager who holds 1:1s with `email`, and the kind of 1:1 (pwPair_). */
export function pwPair_(
  user: { email: string; role: string },
  reportEmail: string,
  dir: Directory,
): { kind: 'agent' | 'tl'; manager: string; report: string; reportName: string } {
  const report = dir.person(normEmail_(reportEmail))
  if (!report || !report.active) throw new Error('That person is not on the active roster.')
  if (report.email === user.email) throw new Error('You cannot hold a 1:1 with yourself.')
  if (!pwIsManagerOf_(user as never, report.email, dir)) throw new Error('You can only hold 1:1s with people who report to you.')
  if (report.role !== 'agent' && report.role !== 'tl' && report.role !== 'specialist') {
    throw new Error('1:1s are held with agents, specialists and team leads.')
  }
  return { kind: report.role === 'tl' ? 'tl' : 'agent', manager: user.email, report: report.email, reportName: report.name }
}

// ---------------------------------------------------------------- missed rule

/** HH:mm Kuwait after which an unlogged 1:1 counts as missed. Lead decision: 22:00. */
export async function pwOneOnOneCutoff_(): Promise<string> {
  const v = String(await getConfig('one_on_one_cutoff', '22:00'))
  return /^\d{2}:\d{2}$/.test(v) ? v : '22:00'
}

/** The cutoff instant for a 1:1 scheduled at scheduledMs. */
export async function pwCutoffMs_(scheduledMs: number, cutoff?: string): Promise<number> {
  return pwAt_(pwKwDate_(scheduledMs), cutoff || (await pwOneOnOneCutoff_()))
}

/** Pure: missed when past 22:00 Kuwait on its day and no record was submitted by then. */
export function pwIsMissed_(scheduledMs: number, loggedMs: number, nowMs: number, cutoff: string): boolean {
  const c = pwAt_(pwKwDate_(scheduledMs), cutoff || '22:00')
  if (nowMs < c) return false
  return !(loggedMs && !isNaN(loggedMs) && loggedMs <= c)
}

// ---------------------------------------------------------------- reading

export function pwScheduleOut_(s: Record<string, any>, dir: { name: (e: string) => string }): Record<string, unknown> {
  return {
    scheduleId: String(s.schedule_id),
    kind: String(s.kind || 'agent'),
    managerEmail: normEmail_(s.manager_email),
    managerName: dir.name(String(s.manager_email)),
    reportEmail: normEmail_(s.report_email),
    reportName: dir.name(String(s.report_email)),
    scheduledAt: pwIso_(s.scheduled_at),
    durationMin: Number(s.duration_min) || 30,
    status: String(s.status),
    logId: String(s.log_id || ''),
    reason: String(s.reason || ''),
    missedAt: pwIso_(s.missed_at),
  }
}

/** A log as `user` may see it. Private notes and confidential topics only for their author and admins. */
export function pwLogOut_(
  log: Record<string, any>,
  topics: Record<string, any>[],
  privates: Record<string, any>[],
  user: { email: string; role: string },
  dir: { name: (e: string) => string },
): Record<string, unknown> {
  const author = normEmail_(log.submitted_by)
  const seesPrivate = user.role === 'admin' || author === user.email
  return {
    logId: String(log.log_id),
    kind: String(log.kind),
    managerEmail: normEmail_(log.manager_email),
    managerName: dir.name(String(log.manager_email)),
    reportEmail: normEmail_(log.report_email),
    reportName: dir.name(String(log.report_email)),
    heldAt: pwIso_(log.held_at),
    submittedAt: pwIso_(log.submitted_at),
    onTime: !(log.on_time === false || String(log.on_time).toLowerCase() === 'false'),
    summary: String(log.summary || ''),
    noActionReason: String(log.no_action_reason || ''),
    topics: topics
      .filter((t) => !t.skipped_reason)
      .map((t) => {
        const confidential = t.confidential === true || String(t.confidential).toLowerCase() === 'true'
        const hide = confidential && !seesPrivate
        return {
          topic: String(t.topic), raisedBy: String(t.raised_by || ''), outcome: String(t.outcome || ''),
          confidential,
          answers: hide ? {} : pwJson_(t.answers_json, {}),
          fields: hide ? {} : pwJson_(t.fields_json, {}),
          evidence: hide ? null : pwJson_(t.evidence_json, null),
        }
      }),
    skipped: topics
      .filter((t) => !!t.skipped_reason)
      .map((t) => ({ topic: String(t.topic), reason: String(t.skipped_reason) })),
    privateNotes: seesPrivate
      ? privates
          .map((p) => ({ kind: String(p.kind), note: String(p.note), author: normEmail_(p.author_email) }))
          .filter((p) => user.role === 'admin' || p.author === user.email)
      : [],
  }
}

export function pwJson_(v: unknown, dflt: unknown): unknown {
  if (v === '' || v === null || v === undefined) return dflt
  if (typeof v === 'object') return v
  try {
    return JSON.parse(String(v))
  } catch {
    return dflt
  }
}

export function pwCanReadLog_(log: Record<string, any>, user: { email: string; role: string }): boolean {
  if (user.role === 'admin') return true
  return normEmail_(log.manager_email) === user.email || normEmail_(log.report_email) === user.email
}

/**
 * Cadence in days: Config `one_on_one_cadence_days`. Mohamed's rule: weekly for
 * everyone (agents, new joiners, Mohamed with TLs), so the default is 7.
 */
export async function pwCadenceDays_(kind: string): Promise<number> {
  const c = await getConfig('one_on_one_cadence_days', 7)
  const n = c && typeof c === 'object' ? Number((c as Record<string, unknown>)[kind]) : Number(c)
  return n > 0 ? n : 7
}

/** The first working day for `email` on or after dateStr (from the working calendar). */
export async function pwNextWorkingOnOrAfter_(email: string, dateStr: string): Promise<string> {
  const days = await getWorkingCalendar(email, dateStr, pwAddDays_(dateStr, 21))
  const hit = days.filter((d) => d.working)[0]
  return hit ? hit.date : dateStr
}

/**
 * Why a 1:1 on this date is excused, or '' when it is not: a day off or a public
 * holiday (in their based-in country) for either person (pwExcuseFor_).
 */
export async function pwExcuseFor_(managerEmail: string, reportEmail: string, dateStr: string, dir: Directory): Promise<string> {
  const who: [string, string][] = [
    [reportEmail, dir ? dir.name(reportEmail) : reportEmail],
    [managerEmail, dir ? dir.name(managerEmail) : managerEmail],
  ]
  for (const [email, name] of who) {
    const day = await wcDay(email, dateStr)
    if (!day.working) return (day.reason === 'holiday' ? 'Public holiday for ' : 'Day off for ') + name
  }
  return ''
}

// ---------------------------------------------------------------- booking

export const PW_LIVE_BOOKING = ['scheduled', 'missed', 'held', 'held_late']

/** "Tue 6 Oct" for a Kuwait date or an instant. */
export function pwDayLabel_(v: unknown): string {
  const d = typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v) ? v : pwKwDate_(v)
  const x = new Date(d + 'T00:00:00Z')
  return (
    ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][x.getUTCDay()] +
    ' ' +
    x.getUTCDate() +
    ' ' +
    ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][x.getUTCMonth()]
  )
}

/** The Kuwait work week (Sunday to Saturday) that holds an instant. */
export function pwWeekOf_(ms: number): { start: string; end: string } {
  const start = dqWeekStart_(pwKwDate_(ms))
  return { start, end: pwAddDays_(start, 6) }
}

async function safeRows(name: string, where?: (r: Record<string, unknown>) => boolean): Promise<Record<string, any>[]> {
  try {
    return (await readRows(name, { where })) as Record<string, any>[]
  } catch {
    return []
  }
}

/**
 * pwBookingRules_ — throws, in plain words, when a booking would break a rule:
 *   one per week   the pair already has a booked / missed / held 1:1, or a logged one, in that Sunday-Saturday week
 *   no overlap     the manager, or the report, is already in another 1:1 (either role) at an overlapping time
 * excludeIds: schedule ids being replaced (a reschedule or "not held" re-booking).
 */
export async function pwBookingRules_(
  managerEmail: string,
  reportEmail: string,
  whenMs: number,
  durationMin: number,
  excludeIds: string[],
  dir: Directory,
): Promise<void> {
  const m = normEmail_(managerEmail)
  const r = normEmail_(reportEmail)
  const skip: Record<string, boolean> = {}
  ;(excludeIds || []).forEach((id) => {
    skip[String(id)] = true
  })
  const rows = await safeRows('one_on_one_schedule', (s) => PW_LIVE_BOOKING.indexOf(String(s.status)) !== -1 && !skip[String(s.schedule_id)])
  const week = pwWeekOf_(whenMs)
  const inWeek = (ms: number) => {
    const d = pwKwDate_(ms)
    return d >= week.start && d <= week.end
  }
  const weekText = '(' + pwDayLabel_(week.start) + ' to ' + pwDayLabel_(week.end) + ')'
  const name = dir.name(r)

  const sameWeek = rows
    .filter((s) => normEmail_(s.manager_email) === m && normEmail_(s.report_email) === r && inWeek(pwMs_(s.scheduled_at)))
    .sort((a, b) => pwMs_(a.scheduled_at) - pwMs_(b.scheduled_at))[0]
  if (sameWeek) {
    const st = String(sameWeek.status)
    throw new Error(
      name +
        ' already has a 1:1 that week ' +
        weekText +
        ': ' +
        (st === 'scheduled' ? 'booked' : st === 'missed' ? 'booked and not logged yet' : 'held') +
        ' ' +
        pwDayLabel_(pwMs_(sameWeek.scheduled_at)) +
        ' at ' +
        pwKwTime_(sameWeek.scheduled_at) +
        '. Only one 1:1 a week: move that one instead of booking another.',
    )
  }
  const logged = (
    await safeRows('one_on_one_logs', (l) => {
      return (
        normEmail_(l.manager_email) === m &&
        normEmail_(l.report_email) === r &&
        inWeek(pwMs_(l.held_at)) &&
        !skip[String(l.schedule_id || '')]
      )
    })
  )[0]
  if (logged) {
    throw new Error(
      name +
        ' already has a 1:1 logged that week ' +
        weekText +
        ', held ' +
        pwDayLabel_(pwMs_(logged.held_at)) +
        ' at ' +
        pwKwTime_(logged.held_at) +
        '. Only one 1:1 a week: book the next one in another week.',
    )
  }

  const end = whenMs + durationMin * 60000
  rows.forEach((s) => {
    const a = pwMs_(s.scheduled_at)
    const b = a + (Number(s.duration_min) || 30) * 60000
    if (!(a < end && whenMs < b)) return
    const sm = normEmail_(s.manager_email)
    const sr = normEmail_(s.report_email)
    const when = pwDayLabel_(a) + ' ' + pwKwTime_(a) + ' to ' + pwKwTime_(b)
    if (sm === m || sr === m) {
      throw new Error(
        'That time clashes with ' +
          (sm === m ? 'your 1:1 with ' + dir.name(sr) : 'your own 1:1 with ' + dir.name(sm)) +
          ', ' +
          when +
          '. Pick a time that does not overlap.',
      )
    }
    if (sm === r || sr === r) {
      throw new Error(
        name +
          ' is already in a 1:1 at that time (' +
          (sr === r ? 'with ' + dir.name(sm) : 'holding one with ' + dir.name(sr)) +
          ', ' +
          when +
          '). Pick a time that does not overlap.',
      )
    }
  })
}

/** The manager submits the exact date and time of a 1:1 with one person (oneOnOnesSchedule). */
export async function oneOnOnesSchedule(reportEmail: string, when: unknown, durationMin: unknown) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  return pwBook_(user, reportEmail, when, durationMin, [])
}

async function pwBook_(
  user: { email: string; role: string },
  reportEmail: string,
  when: unknown,
  durationMin: unknown,
  replacing: string[],
) {
  const dir = await pwDirectory()
  const pair = pwPair_(user, reportEmail, dir)
  const ms = pwMs_(when)
  if (isNaN(ms)) throw new Error('Choose the date and time of the 1:1.')
  if (ms < Date.now() - 5 * 60000) throw new Error('Choose a time from now on.')
  const dur = Math.max(10, Math.min(180, Number(durationMin) || 30))
  await pwBookingRules_(pair.manager, pair.report, ms, dur, replacing, dir)
  const rows = await pwAppend_(
    'one_on_one_schedule',
    [
      {
        schedule_id: newId('OOS'),
        kind: pair.kind,
        manager_email: pair.manager,
        report_email: pair.report,
        scheduled_at: new Date(ms).toISOString(),
        duration_min: dur,
        status: 'scheduled',
        log_id: '',
        rescheduled_to: '',
        reason: '',
        missed_at: '',
      },
    ],
    user.email,
  )
  pwOoRemindersChanged_()
  return { schedule: pwScheduleOut_(rows[0], dir), warnings: await pwScheduleWarnings_(pair.manager, pair.report, ms, dur, dir) }
}

async function pwOwnSchedule_(scheduleId: string, user: { email: string; role: string }): Promise<Record<string, any>> {
  const s = await findRow('one_on_one_schedule', 'schedule_id', String(scheduleId))
  if (!s || String(s.status) === 'deleted') throw new Error('That scheduled 1:1 no longer exists.')
  if (normEmail_(s.manager_email) !== user.email && user.role !== 'admin') {
    throw new Error('Only the person holding this 1:1 can change it.')
  }
  return s
}

/** Free before the planned start: a new time and a reason (oneOnOnesReschedule). */
export async function oneOnOnesReschedule(scheduleId: string, when: unknown, reason: string) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const s = await pwOwnSchedule_(scheduleId, user)
  if (String(s.status) !== 'scheduled') {
    throw new Error('Only a scheduled 1:1 can be moved. A missed one is resolved from the pop-up.')
  }
  if (Date.now() >= pwMs_(s.scheduled_at)) {
    throw new Error('This 1:1 has started. Log it, or mark it not held after ' + (await pwOneOnOneCutoff_()) + '.')
  }
  if (!String(reason || '').trim()) throw new Error('Give a reason for moving the 1:1.')
  const res = await pwBook_(user, String(s.report_email), when, s.duration_min, [String(s.schedule_id)])
  await updateRow(
    'one_on_one_schedule',
    'schedule_id',
    s.schedule_id,
    { status: 'rescheduled', rescheduled_to: res.schedule.scheduleId, reason: String(reason).trim() },
    { actor: user.email },
  )
  pwOoRemindersChanged_()
  return res
}

/**
 * Resolves a missed 1:1 the second allowed way: not held, with a reason and a
 * new date within 5 working days. Clears the login pop-up (oneOnOnesMarkNotHeld).
 */
export async function oneOnOnesMarkNotHeld(scheduleId: string, reason: string, newWhen: unknown) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const s = await pwOwnSchedule_(scheduleId, user)
  const st = String(s.status)
  const cutoff = await pwOneOnOneCutoff_()
  if (
    st !== 'missed' &&
    st !== 'excused' &&
    !(st === 'scheduled' && pwIsMissed_(pwMs_(s.scheduled_at), NaN, Date.now(), cutoff))
  ) {
    throw new Error('Only a missed 1:1 can be marked not held. Move a future one instead.')
  }
  if (!String(reason || '').trim()) throw new Error('Choose why the 1:1 was not held.')
  const ms = pwMs_(newWhen)
  if (isNaN(ms)) throw new Error('Choose a new date and time.')
  const limit = await pwAddWorkingDays(normEmail_(s.manager_email), pwToday_(), 5)
  if (pwKwDate_(ms) > limit) throw new Error('The new date must be within 5 working days (by ' + limit + ').')
  const res = await pwBook_(user, String(s.report_email), newWhen, s.duration_min, [String(s.schedule_id)])
  await updateRow(
    'one_on_one_schedule',
    'schedule_id',
    s.schedule_id,
    { status: 'cancelled', reason: String(reason).trim(), rescheduled_to: res.schedule.scheduleId },
    { actor: user.email },
  )
  pwOoRemindersChanged_()
  await resolvePopups('missed_1on1', String(s.schedule_id), user.email)
  return res
}

/** Newest held first; same instant -> the later-written row first. */
export function pwNewestLogFirst_(a: Record<string, any>, b: Record<string, any>): number {
  return pwMs_(b.held_at) - pwMs_(a.held_at) || Number(b._row || 0) - Number(a._row || 0)
}

/** Shift-clash warnings only (pwScheduleWarnings_): off day / holiday for either person. */
async function pwScheduleWarnings_(
  managerEmail: string,
  reportEmail: string,
  whenMs: number,
  durationMin: number,
  dir: Directory,
): Promise<string[]> {
  const out: string[] = []
  const excuse = await pwExcuseFor_(managerEmail, reportEmail, pwKwDate_(whenMs), dir)
  if (excuse) out.push(excuse + ' on ' + pwDayLabel_(whenMs) + '.')
  return out
}

/** Cache bust for the alerts/reminder poll after any booking write (pwOoRemindersChanged_). */
export function pwOoRemindersChanged_(): void {
  cacheRemove('pw:oo-upcoming')
}
