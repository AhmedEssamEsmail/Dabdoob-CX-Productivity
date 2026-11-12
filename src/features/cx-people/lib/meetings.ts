/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim Meetings.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * Meetings.js — meetings and BRs (people-workflows section 4).
 *
 * A series (WBR, BR, team meeting, ad hoc) is set up once; each occurrence is
 * a meeting instance. Action items go to the shared `actions` table with
 * series_id = the series, so the next instance of the same series opens with
 * every still-open item. An instance cannot be closed while a carried item is
 * unreviewed. The summary email goes out only when the chair clicks Send.
 *
 * Datastore change: the attendance patch (a positional write in Sheets) keys on
 * meeting_attendees.id (its primary key); pwTxt_ date writes are plain ISO.
 */

import 'server-only'
import {
  normEmail_,
  pwIso_,
  pwKwDate_,
  pwKwTime_,
  pwMs_,
  pwStr_,
  pwAddDays_,
  pwToday_,
  pwDateOnly_,
  type Cfg,
  type Directory,
} from '@/features/shared/lib/adapters'
import { updateRow, updateRows, newId } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { pwAddWorkingDays } from '@/features/shared/platform/calendar'
import { configAll } from '@/features/shared/platform/settings'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { pwIsOpenStatus_, pwOpenSeriesActions_, pwActionOut_, pwUpdateOut_ } from './scorecard/index'
import { pwAppend_, pwApplyReviews_, pwBuildActions_, type PwUser } from './actions'
import { pwRows_ } from './work-core'
import { pwTaskHoursFor_, pwTaskWindow_ } from './tasks'

export const PW_MEETING_TYPES = ['WBR', 'BR', 'team', 'adhoc']

interface MeetingCtx {
  dir: Directory
  series: Record<string, any>[]
  members: Record<string, any>[]
  meetings: Record<string, any>[]
  attendees: Record<string, any>[]
}

async function pwMeetingCtx_(): Promise<MeetingCtx> {
  const [dir, series, members, meetings, attendees] = await Promise.all([
    pwDirectory(),
    pwRows_('meeting_series'),
    pwRows_('meeting_series_members'),
    pwRows_('meetings'),
    pwRows_('meeting_attendees'),
  ])
  return { dir, series, members, meetings, attendees }
}

function pwSeriesMembers_(ctx: MeetingCtx, seriesId: unknown) {
  return ctx.members.filter((m) => String(m.series_id) === String(seriesId))
}

function pwCanSeeSeries_(s: Record<string, any>, user: PwUser, ctx: MeetingCtx) {
  if (user.role === 'admin') return true
  if (normEmail_(s.chair_email) === user.email) return true
  return pwSeriesMembers_(ctx, s.series_id).some((m) => normEmail_(m.email) === user.email)
}

function pwCanChair_(s: Record<string, any>, user: PwUser) {
  return user.role === 'admin' || normEmail_(s.chair_email) === user.email
}

export function pwSeriesOut_(s: Record<string, any>, ctx: MeetingCtx) {
  return {
    seriesId: String(s.series_id),
    meetingType: String(s.meeting_type),
    title: String(s.title),
    chairEmail: normEmail_(s.chair_email),
    chairName: ctx.dir.name(s.chair_email),
    cadence: String(s.cadence || ''),
    members: pwSeriesMembers_(ctx, s.series_id).map((m) => ({
      email: normEmail_(m.email), name: ctx.dir.name(m.email), role: String(m.role || 'attendee'),
    })),
  }
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars -- legacy keeps the ctx arg verbatim
export function pwMeetingOut_(m: Record<string, any>, ctx: MeetingCtx) {
  return {
    meetingId: String(m.meeting_id),
    seriesId: String(m.series_id),
    heldAt: pwIso_(m.held_at),
    nextMeetingAt: pwIso_(m.next_meeting_at),
    notes: String(m.notes || ''),
    decisions: String(m.decisions || ''),
    status: String(m.status || 'draft'),
    closedAt: pwIso_(m.closed_at),
    summarySentAt: pwIso_(m.summary_sent_at),
  }
}

/** Everything the Meetings & BRs page needs in one call (meetingsPage). */
export async function meetingsPage() {
  const user = await requireRole(['admin', 'tl'])
  const ctx = await pwMeetingCtx_()
  const actions = await pwRows_('actions', (a) => a.source_type === 'meeting')
  const visible = ctx.series.filter(
    (s) => !(s.active === false || String(s.active).toLowerCase() === 'false') && pwCanSeeSeries_(s, user, ctx),
  )
  const ids: Record<string, boolean> = {}
  visible.forEach((s) => {
    ids[String(s.series_id)] = true
  })
  return {
    me: { email: user.email, name: user.name, role: user.role },
    people: Object.keys(ctx.dir.by)
      .map((k) => ctx.dir.by[k])
      .filter((p) => p.active)
      .map((p) => ({ email: p.email, name: p.name, role: p.role, titleLevel: p.titleLevel })),
    series: visible.map((s) => {
      const o = pwSeriesOut_(s, ctx) as Record<string, any>
      const inst = ctx.meetings
        .filter((m) => String(m.series_id) === String(s.series_id))
        .sort((a, b) => pwMs_(b.held_at) - pwMs_(a.held_at))
      o.meetings = inst.slice(0, 12).map((m) => pwMeetingOut_(m, ctx))
      o.openActions = pwOpenSeriesActions_(String(s.series_id), actions).length
      o.canChair = pwCanChair_(s, user)
      return o
    }),
    myActions: actions
      .filter(
        (a) => normEmail_(a.owner_email) === user.email && pwIsOpenStatus_(String(a.status || 'open')) && ids[String(a.series_id)],
      )
      .map((a) => pwActionOut_(a, ctx.dir)),
  }
}

/**
 * meetingsCreateSeries — admin: any type, any chair. TL: team meetings or ad
 * hoc series they chair. input: { meetingType, title, cadence, chairEmail,
 * attendees: [email] }
 */
export async function meetingsCreateSeries(input: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  input = input || {}
  const dir = await pwDirectory()
  const type = String(input.meetingType || '').trim()
  if (!type) throw new Error('Choose the meeting type.')
  if (user.role !== 'admin' && ['team', 'adhoc'].indexOf(type) === -1)
    throw new Error('Team leads can set up team meetings and ad hoc meetings.')
  if (type.length > 40) throw new Error('Keep the meeting type under 40 characters.')
  const title = String(input.title || '').trim()
  if (!title) throw new Error('Name the meeting.')
  const chair = user.role === 'admin' ? normEmail_(input.chairEmail) || user.email : user.email
  if (!dir.person(chair)) throw new Error('The chair must be on the roster.')
  const attendees = (input.attendees || [])
    .map(normEmail_)
    .filter((e: string, i: number, arr: string[]) => e && e !== chair && arr.indexOf(e) === i)
  attendees.forEach((e: string) => {
    if (!dir.person(e)) throw new Error(e + ' is not on the roster.')
  })
  const id = newId('MSR')
  await pwAppend_('meeting_series', [{ series_id: id, meeting_type: type, title, chair_email: chair, cadence: String(input.cadence || ''), active: true }], user.email)
  await pwAppend_(
    'meeting_series_members',
    [{ series_id: id, email: chair, role: 'chair' }].concat(
      attendees.map((e: string) => ({ series_id: id, email: e, role: 'attendee' })),
    ),
    user.email,
  )
  return meetingsPage()
}

function pwLoadMeeting_(meetingId: string, user: PwUser, ctx: MeetingCtx, needChair: boolean) {
  const m = ctx.meetings.filter((x) => String(x.meeting_id) === String(meetingId))[0]
  if (!m) throw new Error('That meeting no longer exists.')
  const s = ctx.series.filter((x) => String(x.series_id) === String(m.series_id))[0]
  if (!s || !pwCanSeeSeries_(s, user, ctx)) throw new Error('That meeting is not available to you.')
  if (needChair && !pwCanChair_(s, user)) throw new Error('Only the chair can change this meeting.')
  return { m, s }
}

/**
 * meetingsOpen — opens the next instance of a series (or returns the draft
 * that is already open). It starts with every still-open action of the series.
 */
export async function meetingsOpen(seriesId: string, heldAt: unknown, nextMeetingAt: unknown) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const s = ctx.series.filter((x) => String(x.series_id) === String(seriesId))[0]
  if (!s || !pwCanSeeSeries_(s, user, ctx)) throw new Error('That meeting series is not available to you.')
  if (!pwCanChair_(s, user)) throw new Error('Only the chair can open a meeting.')
  const draft = ctx.meetings.filter(
    (m) => String(m.series_id) === String(seriesId) && String(m.status) !== 'closed',
  )[0]
  if (draft) return meetingsGet(draft.meeting_id)
  const held = heldAt ? pwMs_(heldAt) : Date.now()
  if (isNaN(held)) throw new Error('Choose when the meeting is held.')
  const next = nextMeetingAt ? pwMs_(nextMeetingAt) : NaN
  if (!isNaN(next) && next <= held) throw new Error('The next meeting must be after this one.')
  const id = newId('MTG')
  await pwAppend_(
    'meetings',
    [{
      meeting_id: id, series_id: s.series_id, held_at: new Date(held).toISOString(),
      next_meeting_at: isNaN(next) ? '' : new Date(next).toISOString(), notes: '', decisions: '',
      status: 'draft', closed_at: '', summary_sent_at: '',
    }],
    user.email,
  )
  await pwAppend_(
    'meeting_attendees',
    pwSeriesMembers_(ctx, s.series_id).map((mb) => ({
      meeting_id: id, email: normEmail_(mb.email), role: String(mb.role || 'attendee'), attended: '',
    })),
    user.email,
  )
  return meetingsGet(id)
}

/** meetingsGet — one instance: the review list (carried items), notes, new actions and attendance. */
export async function meetingsGet(meetingId: string) {
  const user = await requireRole(['admin', 'tl'])
  const ctx = await pwMeetingCtx_()
  const got = pwLoadMeeting_(meetingId, user, ctx, false)
  const m = got.m
  const [actions, reviews, updates] = await Promise.all([
    pwRows_('actions', (a) => String(a.series_id) === String(m.series_id)),
    pwRows_('action_reviews', (r) => String(r.reviewed_in_id) === String(m.meeting_id)),
    pwRows_('action_updates'),
  ])
  const reviewBy: Record<string, Record<string, any>> = {}
  reviews.forEach((r) => {
    reviewBy[String(r.action_id)] = r
  })
  const heldMs = pwMs_(m.held_at)
  const carried = actions
    .filter((a) => {
      if (String(a.source_id) === String(m.meeting_id)) return false
      if (reviewBy[String(a.action_id)]) return true
      return (
        String(m.status) !== 'closed' &&
        pwIsOpenStatus_(String(a.status || 'open')) &&
        pwMs_(a.submitted_at) <= Math.max(heldMs, Date.now())
      )
    })
    .map((a) => {
      const o = pwActionOut_(a, ctx.dir) as Record<string, any>
      const r = reviewBy[String(a.action_id)]
      o.review = r ? { outcome: String(r.outcome), note: String(r.note || ''), newDueDate: pwDateOnly_(r.new_due_date) } : null
      const u = updates
        .filter((x) => String(x.action_id) === String(a.action_id))
        .sort((x, y) => pwMs_(y.submitted_at) - pwMs_(x.submitted_at))[0]
      o.latestUpdate = u ? pwUpdateOut_(u, ctx.dir) : null
      return o
    })
  return {
    meeting: pwMeetingOut_(m, ctx),
    series: pwSeriesOut_(got.s, ctx),
    canChair: pwCanChair_(got.s, user),
    attendees: ctx.attendees
      .filter((a) => String(a.meeting_id) === String(m.meeting_id))
      .map((a) => ({
        email: normEmail_(a.email), name: ctx.dir.name(a.email), role: String(a.role || 'attendee'),
        attended: a.attended === '' ? null : a.attended === true || String(a.attended).toLowerCase() === 'true',
      })),
    carried,
    unreviewed: carried.filter((c) => !c.review).length,
    newActions: actions
      .filter((a) => String(a.source_id) === String(m.meeting_id))
      .map((a) => pwActionOut_(a, ctx.dir)),
    defaultDueDate: m.next_meeting_at
      ? pwAddDays_(pwKwDate_(m.next_meeting_at), -1)
      : await pwAddWorkingDays(normEmail_(got.s.chair_email), pwToday_(), 5),
  }
}

/** meetingsSave — notes, decisions and dates on a draft. */
export async function meetingsSave(meetingId: string, patch: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const got = pwLoadMeeting_(meetingId, user, ctx, true)
  if (String(got.m.status) === 'closed') throw new Error('This meeting is closed. Its notes are locked.')
  patch = patch || {}
  const p: Record<string, unknown> = {}
  if ('notes' in patch) p.notes = String(patch.notes || '')
  if ('decisions' in patch) p.decisions = String(patch.decisions || '')
  if ('heldAt' in patch) {
    const h = pwMs_(patch.heldAt)
    if (isNaN(h)) throw new Error('Choose when the meeting is held.')
    p.held_at = new Date(h).toISOString()
  }
  if ('nextMeetingAt' in patch) {
    const n = patch.nextMeetingAt ? pwMs_(patch.nextMeetingAt) : NaN
    p.next_meeting_at = isNaN(n) ? '' : new Date(n).toISOString()
  }
  await updateRow('meetings', 'meeting_id', got.m.meeting_id, p, { actor: user.email })
  return meetingsGet(meetingId)
}

/** meetingsReview — the chair reviews carried items: [{ actionId, outcome, note, newDueDate }]. */
export async function meetingsReview(meetingId: string, reviews: Record<string, any>[]) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const got = pwLoadMeeting_(meetingId, user, ctx, true)
  if (String(got.m.status) === 'closed') throw new Error('This meeting is closed.')
  const done: Record<string, boolean> = {}
  ;(await pwRows_('action_reviews', (r) => String(r.reviewed_in_id) === String(meetingId))).forEach((r) => {
    done[String(r.action_id)] = true
  })
  const fresh = (reviews || []).filter((r) => {
    if (done[String(r.actionId)]) throw new Error('That action has already been reviewed in this meeting.')
    return true
  })
  await pwApplyReviews_(fresh as never[], 'meeting', got.m.meeting_id, String(got.s.series_id), user, ctx.dir)
  return meetingsGet(meetingId)
}

/**
 * meetingsAddActions — new action items: [{ title, ownerEmail, dueDate,
 * trackAsTask, estHours }]. Default due date is the day before the next
 * instance. "Track as task" also creates the task details (owner must be a TL
 * or admin, estimate required).
 */
export async function meetingsAddActions(meetingId: string, list: Record<string, any>[]) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const got = pwLoadMeeting_(meetingId, user, ctx, true)
  if (String(got.m.status) === 'closed') throw new Error('This meeting is closed. Add the action to the next one.')
  await pwAddMeetingActions_(
    got,
    list,
    user,
    ctx,
    got.m.next_meeting_at ? pwAddDays_(pwKwDate_(got.m.next_meeting_at), -1) : '',
  )
  return meetingsGet(meetingId)
}

/**
 * meetingsLogActions — logs the actions given at a meeting that already
 * happened in one go, without opening a draft or reviewing carried items
 * first. heldOn: 'YYYY-MM-DD' (Kuwait). list: as meetingsAddActions.
 */
export async function meetingsLogActions(seriesId: string, heldOn: unknown, list: Record<string, any>[]) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const s = ctx.series.filter((x) => String(x.series_id) === String(seriesId))[0]
  if (!s || !pwCanSeeSeries_(s, user, ctx)) throw new Error('That meeting series is not available to you.')
  if (!pwCanChair_(s, user)) throw new Error('Only the chair can log actions for this meeting.')
  const day = pwDateOnly_(heldOn)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) throw new Error('Choose the day the meeting was held.')
  if (day > pwToday_()) throw new Error('That meeting has not happened yet. Open it on the day instead.')
  if (!(list || []).length) throw new Error('Add at least one action.')
  let m = ctx.meetings.filter(
    (x) => String(x.series_id) === String(s.series_id) && pwKwDate_(x.held_at) === day,
  )[0]
  if (!m) {
    m = {
      meeting_id: newId('MTG'), series_id: s.series_id,
      held_at: new Date(pwMs_(day + 'T10:00')).toISOString(), next_meeting_at: '', notes: '', decisions: '',
      status: 'closed', closed_at: new Date().toISOString(), summary_sent_at: '',
    }
    await pwAppend_('meetings', [m], user.email)
    await pwAppend_(
      'meeting_attendees',
      pwSeriesMembers_(ctx, s.series_id).map((mb) => ({
        meeting_id: m.meeting_id, email: normEmail_(mb.email), role: String(mb.role || 'attendee'), attended: '',
      })),
      user.email,
    )
  }
  await pwAddMeetingActions_(
    { m, s },
    list,
    user,
    ctx,
    m.next_meeting_at
      ? pwAddDays_(pwKwDate_(m.next_meeting_at), -1)
      : await pwAddWorkingDays(normEmail_(s.chair_email), pwToday_(), 5),
  )
  return meetingsGet(m.meeting_id)
}

async function pwAddMeetingActions_(
  got: { m: Record<string, any>; s: Record<string, any> },
  list: Record<string, any>[],
  user: PwUser,
  ctx: MeetingCtx,
  dflt: string,
) {
  const input = (list || []).map((a) => ({
    title: a.title, ownerEmail: a.ownerEmail, dueDate: a.dueDate || dflt, trackAsTask: !!a.trackAsTask,
  }))
  const rows = pwBuildActions_(
    input,
    { sourceType: 'meeting', sourceId: got.m.meeting_id, seriesId: String(got.s.series_id), topic: String(got.s.meeting_type) },
    user,
    ctx.dir,
  )
  const details: Record<string, unknown>[] = []
  const cfg = (await configAll()) as Cfg
  for (let i = 0; i < rows.length; i++) {
    const r = rows[i]
    if (!r.track_as_task) continue
    const p = ctx.dir.person(String(r.owner_email))
    if (!p || p.titleLevel === 'agent')
      throw new Error('"' + String(r.title) + '": only team leads\' actions can be tracked as tasks.')
    const est = Number(list[i].estHours)
    if (!(est > 0)) throw new Error('"' + String(r.title) + '": enter the estimated hours to track it as a task.')
    const w = await pwTaskWindow_(String(r.owner_email), null, pwStr_(r.due_date), cfg)
    const h = await pwTaskHoursFor_(String(r.owner_email), w.startMs, w.endMs, est, '')
    details.push({
      action_id: r.action_id, priority: 'P2', start_at: new Date(w.startMs).toISOString(),
      deadline_at: new Date(w.endMs).toISOString(), est_hours: est, available_hours: h.free,
      fit_status: h.fitStatus, progress_state: 'not_started', blocked_reason: '', rag_self: '', delivered_at: '',
      delivery_ref: '', actual_hours: '', source_label: String(got.s.meeting_type),
      assigned_anyway: h.fitStatus === 'does_not_fit',
    })
  }
  await pwAppend_('actions', rows, user.email)
  await pwAppend_('action_task_details', details, user.email)
}

/**
 * meetingsClose — closes the instance: records attendance ({ email:
 * true|false }) and locks the notes. Refused while any carried action has no
 * review in this meeting.
 */
export async function meetingsClose(meetingId: string, attendance: Record<string, boolean>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const ctx = await pwMeetingCtx_()
  const got = pwLoadMeeting_(meetingId, user, ctx, true)
  if (String(got.m.status) === 'closed') throw new Error('This meeting is already closed.')
  const view = await meetingsGet(meetingId)
  if (view.unreviewed > 0) {
    throw new Error(
      view.unreviewed + ' carried action' + (view.unreviewed > 1 ? 's are' : ' is') +
        ' not reviewed yet. Give each one an outcome before closing.',
    )
  }
  attendance = attendance || {}
  const ups = view.attendees.map((a) => ({ email: a.email, attended: attendance[a.email] === true }))
  // meeting_attendees' key is its serial id: patch each row it belongs to.
  if (ups.length) {
    const mine = ctx.attendees.filter((a) => String(a.meeting_id) === String(meetingId))
    await updateRows(
      'meeting_attendees',
      'id',
      mine
        .map((row) => {
          const hit = ups.filter((u) => u.email === normEmail_(row.email))[0]
          return hit ? { key: row.id, patch: { attended: hit.attended } } : null
        })
        .filter(Boolean) as { key: unknown; patch: Record<string, unknown> }[],
      { actor: user.email },
    )
  }
  await updateRow('meetings', 'meeting_id', got.m.meeting_id, { status: 'closed', closed_at: new Date().toISOString() }, { actor: user.email })
  return meetingsGet(meetingId)
}

/** meetingsSendSummary — emails the summary to the attendees. Only on the chair's click, only once closed. */
export async function meetingsSendSummary(meetingId: string) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const view = await meetingsGet(meetingId)
  if (!view.canChair) throw new Error('Only the chair can send the summary.')
  if (view.meeting.status !== 'closed') throw new Error('Close the meeting before sending the summary.')
  const to = view.attendees.map((a) => a.email).filter((e) => e !== user.email)
  if (!to.length) throw new Error('This meeting has no other attendees to send to.')
  const li = (a: Record<string, any>) =>
    '<li>' + escapeHtml(a.title) + ', ' + escapeHtml(a.ownerName) + ', due ' + escapeHtml(a.dueDate) + '</li>'
  const html =
    '<p><b>' + escapeHtml(view.series.title) + '</b>, ' + pwKwDate_(view.meeting.heldAt) + '</p>' +
    (view.meeting.decisions ? '<p><b>Decisions</b></p><p>' + escapeHtml(view.meeting.decisions).replace(/\n/g, '<br>') + '</p>' : '') +
    (view.meeting.notes ? '<p><b>Notes</b></p><p>' + escapeHtml(view.meeting.notes).replace(/\n/g, '<br>') + '</p>' : '') +
    (view.newActions.length ? '<p><b>New actions</b></p><ul>' + view.newActions.map(li).join('') + '</ul>' : '') +
    (view.carried.length
      ? '<p><b>Reviewed</b></p><ul>' +
        view.carried
          .map((a) => '<li>' + escapeHtml(a.title) + ': ' + escapeHtml(a.review ? a.review.outcome : 'not reviewed') + '</li>')
          .join('') +
        '</ul>'
      : '') +
    (view.meeting.nextMeetingAt ? '<p>Next meeting: ' + pwKwDate_(view.meeting.nextMeetingAt) + ' ' + pwKwTime_(view.meeting.nextMeetingAt) + '</p>' : '') +
    '<p>Dabdoob CX</p>'
  const res = await sendMail(
    {
      to, subject: 'Summary: ' + String(view.series.title) + ', ' + pwKwDate_(view.meeting.heldAt),
      htmlBody: html, kind: 'meeting_summary', ref: view.meeting.meetingId,
    },
    user.email,
  )
  await updateRow('meetings', 'meeting_id', view.meeting.meetingId, { summary_sent_at: new Date().toISOString() }, { actor: user.email })
  const out = (await meetingsGet(meetingId)) as Record<string, any>
  out.mailStatus = res.status
  return out
}
