/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim Tasks.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * Tasks.js — TL tasks (people-workflows section 3). A task is an action with
 * track_as_task = true plus one action_task_details row. Its status is NOT a
 * second lifecycle:
 *   not_started / in_progress  -> actions.status = open, details.progress_state
 *   blocked                    -> actions.status = blocked
 *   done                       -> actions.status = done (delivery reference required)
 *   cancelled                  -> actions.status = dropped (manager only, via the guard)
 *
 * Datastore change: pwTxt_ date writes become plain ISO strings (typed columns
 * in Postgres), and the Drive file save (pwSaveTaskFile_) goes through a seam —
 * absent an adapter it refuses with the same "not configured" error, and the
 * update row still records the file's metadata.
 */

import 'server-only'

import {
  normEmail_,
  pwMs_,
  pwKwDate_,
  pwKwTime_,
  pwAt_,
  pwStr_,
  pwAddDays_,
  pwToday_,
  pwDateOnly_,
  pwIsManagerOf_,
  type Cfg,
  type Directory,
} from '@/features/shared/lib/adapters'
import { findRow, updateRow, newId } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { getWorkingCalendar, wcDay } from '@/features/shared/platform/calendar'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { configAll } from '@/features/shared/platform/settings'
import {
  pwFit_,
  pwFreeHours_,
  pwIsOpenStatus_,
  pwRound1_,
  pwShiftDefs_,
  pwWorkingHours_,
} from './scorecard/index'
import {
  pwActionGuard_,
  pwAppend_,
  pwBuildActions_,
  pwRag_,
  type PwUser,
} from './actions'
import { pwRows_, pwTaskContext_, pwTasksOut_, type TaskContext } from './work-core'

// ---------------------------------------------------------------- reading tasks

/** Committed estimate vs available hours per TL for the next 10 working days (pwLoad_). */
export function pwLoad_(
  email: string,
  tasks: Record<string, any>[],
  ctx: TaskContext,
  cal: Record<string, { date: string; working: boolean }[]>,
) {
  const startMs = ctx.now
  const cfg = ctx.cfg
  const calFor = (fromDate: string, toDate: string) =>
    (cal[email] || []).filter((d) => d.date >= fromDate && d.date <= toDate) as never
  const endDate = (cal[email] ? pwAddDaysSync_(email, pwToday_(ctx.now), 10, cal[email] as never) : pwToday_(ctx.now))
  const endMs = pwAt_(pwAddDays_(endDate, 1), '00:00')
  const capacity = pwWorkingHours_(calFor(pwKwDate_(startMs), pwKwDate_(endMs)), cfg, email, startMs, endMs).hours
  // Spread each open task's remaining effort earliest-first over its own window
  // (from now), deadline order; count what lands inside the next 10 working days.
  let committed = 0
  const used: Record<string, number> = {}
  tasks
    .filter((t) => t.ownerEmail === email && pwIsOpenStatus_(t.status))
    .sort((a, b) => pwMs_(a.deadlineAt) - pwMs_(b.deadlineAt))
    .forEach((t) => {
      let left = t.estHours * (1 - (t.percent || 0) / 100)
      const deadlineMs = pwMs_(t.deadlineAt)
      if (deadlineMs <= startMs) {
        committed += left
        return
      }
      pwWorkingHours_(calFor(pwKwDate_(Math.max(startMs, pwMs_(t.startAt))), pwKwDate_(deadlineMs)), cfg, email, Math.max(startMs, pwMs_(t.startAt)), deadlineMs).days.forEach((day) => {
        if (left <= 0) return
        const take = Math.min(left, Math.max(0, day.hours - (used[day.date] || 0)))
        used[day.date] = (used[day.date] || 0) + take
        left -= take
        if (day.date <= endDate) committed += take
      })
      if (left > 0 && pwKwDate_(deadlineMs) <= endDate) committed += left // does not fit, and due inside the window
    })
  return {
    capacity: pwRound1_(capacity),
    committed: pwRound1_(committed),
    pct: capacity > 0 ? Math.round((committed / capacity) * 100) : committed > 0 ? 999 : 0,
  }
}

/** Sync walk over prefetched days for pwLoad_ (the 10-working-day end). */
function pwAddDaysSync_(email: string, dateStr: string, n: number, days: { date: string; working: boolean }[]): string {
  const byDate: Record<string, boolean> = {}
  ;(days || []).forEach((d) => {
    byDate[d.date] = !!d.working
  })
  let cur = dateStr
  let left = n
  for (let i = 0; i < 400 && left > 0; i++) {
    cur = pwAddDays_(cur, 1)
    if (byDate[cur]) left--
  }
  return cur
}

export function pwCanSeeTask_(t: Record<string, any>, user: { email: string; role: string }) {
  return user.role === 'admin' || t.ownerEmail === user.email || t.assignedBy === user.email
}

/** Everything the TL tasks page needs in one call (tasksPage). */
export async function tasksPage() {
  const user = await requireRole(['admin', 'tl'])
  const ctx = await pwTaskContext_()
  const cutoff = ctx.now - 30 * 24 * 3600 * 1000
  const all = pwTasksOut_(ctx)
  const tasks = all.filter(
    (t) => pwCanSeeTask_(t, user) && (pwIsOpenStatus_(t.status) || pwMs_(t.closedAt || t.deadlineAt) >= cutoff),
  )
  const owners =
    user.role === 'admin'
      ? ctx.dir.tls().map((p) => ({ email: p.email, name: p.name }))
      : [{ email: user.email, name: user.name }]
  if (user.role === 'admin' && !owners.some((o) => o.email === user.email))
    owners.push({ email: user.email, name: user.name })
  const calendar = await pwTimelineCalendars_(tasks, owners, ctx.now)
  return {
    me: { email: user.email, name: user.name, role: user.role },
    owners,
    // Each owner's working calendar for the timeline window (days off and holidays shaded per row).
    calendar,
    shifts: pwShiftDefs_(ctx.cfg),
    now: new Date(ctx.now).toISOString(),
    tasks: tasks.sort((a, b) => Number(b.atRisk) - Number(a.atRisk) || pwMs_(a.deadlineAt) - pwMs_(b.deadlineAt)),
    load: await Promise.all(
      owners.map(async (o) => {
        // The calendar must cover every open task window of this owner (pwLoad_
        // reads each task's days inside [start, deadline]).
        const ends = all
          .filter((t) => t.ownerEmail === o.email && pwIsOpenStatus_(t.status))
          .map((t) => pwKwDate_(pwMs_(t.deadlineAt)))
        const cal = await getWorkingCalendar(o.email, pwToday_(ctx.now), ends.reduce((m, d) => (d > m ? d : m), pwAddDays_(pwToday_(ctx.now), 30)))
        const l = pwLoad_(o.email, all, ctx, { [o.email]: cal as never })
        return { ...l, email: o.email, name: o.name }
      }),
    ),
  }
}

/** { email: [{ date, working, reason }] } covering every visible task's window, capped at ~105 days. */
async function pwTimelineCalendars_(tasks: Record<string, any>[], owners: { email: string }[], nowMs: number) {
  const today = pwToday_(nowMs)
  const from = pwAddDays_(today, -35)
  const to = pwAddDays_(today, 70)
  const emails: Record<string, boolean> = {}
  owners.forEach((o) => {
    emails[o.email] = true
  })
  tasks.forEach((t) => {
    emails[String(t.ownerEmail)] = true
  })
  const out: Record<string, { date: string; working: boolean; reason: string | null }[]> = {}
  await Promise.all(
    Object.keys(emails).map(async (e) => {
      out[e] = (await getWorkingCalendar(e, from, to)).map((d) => ({ date: d.date, working: d.working, reason: d.reason }))
    }),
  )
  return out
}

export async function pwTaskById_(actionId: string) {
  const ctx = await pwTaskContext_()
  const mine = ctx.actions.filter((a) => String(a.action_id) === String(actionId))
  // Other tasks of the same owner still matter for free hours.
  const owner = mine[0] ? normEmail_(mine[0].owner_email) : ''
  ctx.actions = await pwRows_(
    'actions',
    (a) => (a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true') && normEmail_(a.owner_email) === owner,
  )
  return pwTasksOut_(ctx).filter((t) => t.actionId === String(actionId))[0] || null
}

// ---------------------------------------------------------------- assigning

/** Start/deadline from client values. A date-only deadline means the owner's shift end that day. */
export async function pwTaskWindow_(owner: string, startAt: unknown, deadlineAt: unknown, cfg: Cfg) {
  const startMs = startAt ? pwMs_(startAt) : Date.now()
  const dl = pwStr_(deadlineAt).trim()
  let endMs: number
  if (/^\d{4}-\d{2}-\d{2}$/.test(dl)) {
    const def = pwShiftDefs_(cfg)[(await wcDay(owner, dl)).shift || 'AM']
    endMs = pwAt_(dl, def.end)
  } else {
    endMs = pwMs_(dl)
  }
  if (isNaN(startMs)) throw new Error('Choose when the task starts.')
  if (isNaN(endMs)) throw new Error('Choose the deadline.')
  if (endMs <= startMs) throw new Error('The deadline must be after the start.')
  return { startMs, endMs }
}

export async function pwTaskHoursFor_(owner: string, startMs: number, endMs: number, est: number, excludeId: string) {
  const ctx = await pwTaskContext_()
  const tasks = pwTasksOut_(ctx).filter(
    (t) =>
      t.ownerEmail === owner &&
      t.actionId !== excludeId &&
      pwIsOpenStatus_(t.status) &&
      pwMs_(t.startAt) < endMs &&
      pwMs_(t.deadlineAt) > startMs,
  )
  const others = tasks.map((t) => ({
    startMs: pwMs_(t.startAt),
    endMs: pwMs_(t.deadlineAt),
    remaining: Number(t.estHours) * (1 - (Number(t.percent) || 0) / 100),
  }))
  const cal = await getWorkingCalendar(owner, pwKwDate_(startMs), pwKwDate_(endMs))
  const calFor = (fromDate: string, toDate: string) => cal.filter((d) => d.date >= fromDate && d.date <= toDate)
  const wh = pwWorkingHours_(cal, ctx.cfg, owner, startMs, endMs)
  const free = pwFreeHours_(calFor, ctx.cfg, owner, startMs, endMs, others)
  return {
    available: pwRound1_(wh.hours), free: pwRound1_(free), estimated: wh.estimated,
    fitStatus: pwFit_(est, free), otherTasks: tasks.length, ctx,
  }
}

/** Hours check for the assign form, before saving (tasksPreview). */
export async function tasksPreview(ownerEmail: string, startAt: unknown, deadlineAt: unknown, estHours: unknown) {
  const user = await requireRole(['admin', 'tl'])
  const owner = normEmail_(ownerEmail) || user.email
  const w = await pwTaskWindow_(owner, startAt, deadlineAt, (await configAll()) as Cfg)
  const h = await pwTaskHoursFor_(owner, w.startMs, w.endMs, Number(estHours) || 0, '')
  const out: Record<string, unknown> = { ...h }
  delete out.ctx
  out.startAt = new Date(w.startMs).toISOString()
  out.deadlineAt = new Date(w.endMs).toISOString()
  return out
}

/**
 * tasksCreate — assigns a task. Admin: to any TL or self. TL: to self only.
 * input: { title, description, ownerEmail, priority, startAt, deadlineAt, estHours,
 *          sourceLabel, expectation, planned: [{ label, targetDate }], assignAnyway }
 * When the estimate does not fit, the call fails with a message starting
 * "DOES_NOT_FIT:" unless assignAnyway is true; that confirmation is stored.
 */
export async function tasksCreate(input: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  input = input || {}
  const dir = await pwDirectory()
  const owner = normEmail_(input.ownerEmail) || user.email
  const person = dir.person(owner)
  if (!person || (person.role !== 'tl' && person.role !== 'admin'))
    throw new Error('Tasks are assigned to team leads or Mohamed.')
  if (user.role !== 'admin' && owner !== user.email)
    throw new Error('Team leads can assign tasks to themselves only.')
  const est = Number(input.estHours)
  if (!(est > 0) || est > 500) throw new Error('Enter the estimated effort in hours.')
  const expectation = String(input.expectation || '').trim().slice(0, 2000)
  // A task given to someone else carries the expectation it is rated against in the 1:1 (Mohamed 2026-10-11).
  if (owner !== user.email && expectation.length < 10)
    throw new Error('Write what you expect from this task: the result it will be rated Below, Meets or Exceeds against.')
  const priority = ['P1', 'P2', 'P3'].indexOf(input.priority) !== -1 ? input.priority : 'P2'
  const w = await pwTaskWindow_(owner, input.startAt, input.deadlineAt, (await configAll()) as Cfg)
  const h = await pwTaskHoursFor_(owner, w.startMs, w.endMs, est, '')
  if (h.fitStatus === 'does_not_fit' && !input.assignAnyway) {
    throw new Error(
      'DOES_NOT_FIT: ' + h.free + ' task hours free of ' + h.available + ' working hours; estimate ' + est +
        ' h. Move the deadline, reduce the scope, or assign anyway.',
    )
  }
  const planned = (input.planned || []).filter((p: Record<string, any>) => String(p.label || '').trim())
  planned.forEach((p: Record<string, any>) => {
    const d = pwDateOnly_(p.targetDate)
    if (!d || d > pwKwDate_(w.endMs))
      throw new Error('Planned milestone "' + String(p.label) + '" needs a date on or before the deadline.')
  })
  const row = pwBuildActions_(
    [{ title: input.title, description: input.description, ownerEmail: owner, dueDate: pwKwDate_(w.endMs), trackAsTask: true }],
    { sourceType: 'task', topic: String(input.sourceLabel || ''), minDueDate: pwKwDate_(Math.min(w.startMs, Date.now())) },
    user,
    dir,
  )[0]
  await pwAppend_('actions', [row], user.email)
  await pwAppend_(
    'action_task_details',
    [{
      action_id: row.action_id, priority, start_at: new Date(w.startMs).toISOString(),
      deadline_at: new Date(w.endMs).toISOString(), est_hours: est, available_hours: h.free, fit_status: h.fitStatus,
      progress_state: 'not_started', blocked_reason: '', rag_self: '', delivered_at: '', delivery_ref: '',
      actual_hours: '', source_label: String(input.sourceLabel || 'ad hoc'),
      assigned_anyway: h.fitStatus === 'does_not_fit',
      expectation, outcome_rating: '', outcome_note: '', rated_by: '', rated_at: '',
    }],
    user.email,
  )
  await pwAppend_(
    'action_planned_milestones',
    planned.map((p: Record<string, any>) => ({
      milestone_id: newId('APM'), action_id: row.action_id, label: String(p.label).trim(),
      target_date: pwDateOnly_(p.targetDate), done_by_update_id: '',
    })),
    user.email,
  )
  if (owner !== user.email) {
    await sendMail(
      {
        to: owner, kind: 'task_assigned', ref: String(row.action_id),
        subject: 'New task: ' + String(row.title) + ', due ' + pwKwDate_(w.endMs),
        htmlBody:
          '<p>Hi ' + escapeHtml(dir.name(owner).split(' ')[0]) + ',</p><p>' + escapeHtml(dir.name(user.email)) +
          ' assigned you <b>' + escapeHtml(row.title) + '</b>.</p><ul><li>Deadline: ' + pwKwDate_(w.endMs) + ' ' +
          pwKwTime_(w.endMs) + '</li><li>Estimate: ' + est + ' h</li><li>Task hours free in the window: ' + h.free +
          ' of ' + h.available + ' (' + String(h.fitStatus).replace(/_/g, ' ') + ')</li>' +
          (expectation ? '<li>Expectation: ' + escapeHtml(expectation) + '</li>' : '') + '</ul><p>CX Helm</p>',
      },
      user.email,
    )
  }
  return pwTaskById_(String(row.action_id))
}

// ---------------------------------------------------------------- milestones and status

async function pwRequireTaskEditor_(actionId: string, user: PwUser, dir: Directory) {
  const a = await findRow('actions', 'action_id', String(actionId))
  if (!a || !(a.track_as_task === true || String(a.track_as_task).toLowerCase() === 'true'))
    throw new Error('That task no longer exists.')
  const owner = normEmail_(a.owner_email)
  if (owner !== user.email && !pwIsManagerOf_(user as never, owner, dir))
    throw new Error('Only the task owner or their manager can update it.')
  return a
}

export const PW_MAX_FILE_BYTES = 10 * 1024 * 1024

/**
 * pwSaveTaskFile_ — saves an uploaded milestone file and returns { id, name,
 * mime }. Legacy wrote it to the CC2 Drive folder; here it goes through the
 * files adapter. Absent one, it refuses — the same "not configured" error the
 * legacy threw when files_folder_id was unset.
 */
export async function pwSaveTaskFile_(actionId: string, file: Record<string, any>): Promise<Record<string, any>> {
  await assertWritable() // writes to Drive
  if (!file || !file.base64 || !file.name) throw new Error('Choose a file to upload.')
  if ((file.base64.length * 3) / 4 > PW_MAX_FILE_BYTES) throw new Error('Files are limited to 10 MB.')
  // No files adapter is wired on this stack yet (BLOCKED_TASKS: Drive attachments).
  throw new Error('The file store for task files is not set. Ask the admin to set files_folder_id.')
}

/**
 * tasksPostMilestone — { kind: 'status', note, percent, rag, nextStep,
 * plannedMilestoneId } or { kind: 'file', file: { name, mimeType, base64 },
 * note?, plannedMilestoneId }. A status needs text; a file needs no note.
 */
export async function tasksPostMilestone(actionId: string, m: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  m = m || {}
  const a = await pwRequireTaskEditor_(actionId, user, dir)
  if (!pwIsOpenStatus_(String(a.status || 'open'))) throw new Error('This task is closed.')
  const kind = m.kind === 'file' ? 'file' : 'status'
  const note = String(m.note || '').trim()
  if (kind === 'status' && !note) throw new Error('Write where the task stands before posting.')
  let planned: Record<string, any> | null = null
  if (m.plannedMilestoneId) {
    planned = await findRow('action_planned_milestones', 'milestone_id', String(m.plannedMilestoneId))
    if (!planned || String(planned.action_id) !== String(a.action_id))
      throw new Error('That planned milestone is not on this task.')
  }
  const file = kind === 'file' ? await pwSaveTaskFile_(String(a.action_id), m.file) : null
  const rag = pwRag_(m.rag)
  const upd = (
    await pwAppend_(
      'action_updates',
      [{
        update_id: newId('AUP'), action_id: a.action_id, kind, note,
        percent_complete:
          m.percent === undefined || m.percent === '' || m.percent === null
            ? ''
            : Math.max(0, Math.min(100, Number(m.percent) || 0)),
        rag, next_step: String(m.nextStep || ''), drive_file_id: file ? file.id : '',
        file_name: file ? file.name : '', mime_type: file ? file.mime : '',
        planned_milestone_id: planned ? planned.milestone_id : '',
      }],
      user.email,
    )
  )[0]
  const patch: Record<string, unknown> = { progress_state: 'in_progress' }
  if (rag) patch.rag_self = rag
  await updateRow('action_task_details', 'action_id', a.action_id, patch, { actor: user.email })
  if (planned)
    await updateRow('action_planned_milestones', 'milestone_id', planned.milestone_id, { done_by_update_id: upd.update_id }, { actor: user.email })
  return pwTaskById_(String(a.action_id))
}

/**
 * tasksSetStatus — moves a task: status in not_started | in_progress | blocked
 * | done | cancelled. info: { note, blockedReason, deliveryRef, actualHours }.
 * Permission is the shared action guard (owner or manager; cancelling is
 * manager only).
 */
export async function tasksSetStatus(actionId: string, status: string, info: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  info = info || {}
  const a = await pwRequireTaskEditor_(actionId, user, dir)
  const patch: Record<string, unknown> = {}
  const details: Record<string, unknown> = {}
  if (status === 'not_started' || status === 'in_progress') {
    patch.status = 'open'
    details.progress_state = status
    details.blocked_reason = ''
    if (!pwIsOpenStatus_(String(a.status || 'open'))) {
      details.delivered_at = ''
      details.delivery_ref = ''
    } // re-opened by the manager
  } else if (status === 'blocked') {
    const reason = String(info.blockedReason || info.note || '').trim()
    if (!reason) throw new Error('Say what is blocking the task.')
    patch.status = 'blocked'
    patch.outcome_note = reason
    details.blocked_reason = reason
  } else if (status === 'done') {
    const ref = String(info.deliveryRef || '').trim()
    if (!ref) throw new Error('Add the delivery link or file name before marking the task done.')
    patch.status = 'done'
    patch.outcome_note = 'Delivered: ' + ref + (info.note ? '. ' + String(info.note).trim() : '')
    details.delivered_at = new Date().toISOString()
    details.delivery_ref = ref
    if (info.actualHours !== undefined && info.actualHours !== '') details.actual_hours = Number(info.actualHours) || 0
  } else if (status === 'cancelled') {
    patch.status = 'dropped'
    patch.outcome_note = String(info.note || '').trim()
  } else {
    throw new Error('Unknown task status.')
  }
  const row = await updateRow('actions', 'action_id', a.action_id, patch, { actor: user.email, guard: pwActionGuard_(user, dir) })
  if (!row) throw new Error('That task no longer exists.')
  if (Object.keys(details).length)
    await updateRow('action_task_details', 'action_id', a.action_id, details, { actor: user.email })
  return pwTaskById_(String(a.action_id))
}

/**
 * tasksSetDeadline — moves an open task's deadline. deadlineAt: yyyy-MM-dd (end
 * of the owner's shift that day) or a datetime. Owner's manager or admin only;
 * a reason is required. The change is posted to the task's history as an update.
 */
export async function tasksSetDeadline(actionId: string, deadlineAt: unknown, reason: string) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  const a = await pwRequireTaskEditor_(actionId, user, dir)
  const owner = normEmail_(a.owner_email)
  if (!pwIsManagerOf_(user as never, owner, dir)) throw new Error("Only the owner's manager can change the deadline.")
  if (!pwIsOpenStatus_(String(a.status || 'open')))
    throw new Error('This task is closed. Re-open it before changing the deadline.')
  reason = String(reason || '').trim()
  if (!reason) throw new Error('Say why the deadline is changing.')
  const d = await findRow('action_task_details', 'action_id', String(a.action_id))
  if (!d) throw new Error('That task no longer exists.')
  const w = await pwTaskWindow_(owner, d.start_at, deadlineAt, (await configAll()) as Cfg)
  const oldDay = pwKwDate_(pwMs_(d.deadline_at))
  const newDay = pwKwDate_(w.endMs)
  await updateRow('action_task_details', 'action_id', a.action_id, { deadline_at: new Date(w.endMs).toISOString() }, { actor: user.email })
  await updateRow('actions', 'action_id', a.action_id, { due_date: newDay }, { actor: user.email })
  await pwAppend_(
    'action_updates',
    [{
      update_id: newId('AUP'), action_id: a.action_id, kind: 'status',
      note: 'Deadline moved from ' + (oldDay || 'none') + ' to ' + newDay + ': ' + reason,
      percent_complete: '', rag: '', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '',
    }],
    user.email,
  )
  return pwTaskById_(String(a.action_id))
}

// ---------------------------------------------------------------- editing details (the 1:1 projects panel)

/**
 * tasksEditDetails — edits a task's details in place: { title, description,
 * priority, startAt, deadlineAt, estHours, ownerEmail, reason, assignAnyway }.
 * Only the fields sent are changed. The owner's manager or an admin only (as
 * for the deadline on the Tasks page); the owner posts progress instead.
 *   - Same rules as assigning (tasksCreate): title 1-300 characters, estimate
 *     1-500 h, priority P1-P3, owner a team lead or admin, start before deadline.
 *   - A change of window, estimate or owner re-runs the free-hours check; when
 *     the estimate does not fit, it fails with "DOES_NOT_FIT:" unless assignAnyway.
 *   - A deadline change needs a reason, as tasksSetDeadline does.
 *   - Every change is written to the task's history as one update row (old -> new).
 */
export async function tasksEditDetails(actionId: string, input: Record<string, any>) {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  input = input || {}
  const a = await pwRequireTaskEditor_(actionId, user, dir)
  const owner = normEmail_(a.owner_email)
  if (!pwIsManagerOf_(user as never, owner, dir))
    throw new Error("Only the owner's manager can change the task details. The owner posts progress.")
  if (!pwIsOpenStatus_(String(a.status || 'open')))
    throw new Error('This task is closed. Re-open it before changing its details.')
  const d = await findRow('action_task_details', 'action_id', String(a.action_id))
  if (!d) throw new Error('That task no longer exists.')
  const has = (k: string) => Object.prototype.hasOwnProperty.call(input, k) && input[k] !== undefined
  const changes: string[] = []
  const act: Record<string, unknown> = {}
  const det: Record<string, unknown> = {}

  if (has('title')) {
    const title = String(input.title).trim()
    if (!title) throw new Error('The task needs a title.')
    if (title.length > 300) throw new Error('Keep task titles under 300 characters.')
    if (title !== String(a.title)) {
      act.title = title
      changes.push('title "' + String(a.title) + '" -> "' + title + '"')
    }
  }
  if (has('description')) {
    const desc = String(input.description).trim().slice(0, 4000)
    if (desc !== String(a.description || '')) {
      act.description = desc
      changes.push('description updated')
    }
  }
  if (has('expectation')) {
    const exp = String(input.expectation).trim().slice(0, 2000)
    if (exp !== String(d.expectation || '')) {
      det.expectation = exp
      changes.push('expectation "' + (d.expectation || '') + '" -> "' + exp + '"')
    }
  }
  if (has('priority')) {
    if (['P1', 'P2', 'P3'].indexOf(input.priority) === -1) throw new Error('Priority is P1, P2 or P3.')
    if (input.priority !== String(d.priority || 'P2')) {
      det.priority = input.priority
      changes.push('priority ' + (d.priority || 'P2') + ' -> ' + input.priority)
    }
  }
  let newOwner = owner
  if (has('ownerEmail') && normEmail_(input.ownerEmail) && normEmail_(input.ownerEmail) !== owner) {
    newOwner = normEmail_(input.ownerEmail)
    const p = dir.person(newOwner)
    if (!p || !p.active || (p.role !== 'tl' && p.role !== 'admin'))
      throw new Error('Tasks are assigned to team leads or Mohamed.')
    if (user.role !== 'admin') throw new Error('Only an admin can give a task to someone else.')
    act.owner_email = newOwner
    changes.push('owner ' + dir.name(owner) + ' -> ' + dir.name(newOwner))
  }
  let est = Number(d.est_hours) || 0
  if (has('estHours') && input.estHours !== '') {
    const e = Number(input.estHours)
    if (!(e > 0) || e > 500) throw new Error('Enter the estimated effort in hours.')
    if (e !== est) {
      changes.push('estimate ' + est + ' h -> ' + e + ' h')
      est = e
      det.est_hours = e
    }
  }
  const oldStart = pwMs_(d.start_at)
  const oldEnd = pwMs_(d.deadline_at)
  const w = await pwTaskWindow_(
    newOwner,
    has('startAt') && input.startAt ? input.startAt : d.start_at,
    has('deadlineAt') && input.deadlineAt ? input.deadlineAt : d.deadline_at,
    (await configAll()) as Cfg,
  )
  const deadlineMoved = Math.abs(w.endMs - oldEnd) >= 60000
  const startMoved = Math.abs(w.startMs - oldStart) >= 60000
  if (deadlineMoved) {
    const reason = String(input.reason || '').trim()
    if (!reason) throw new Error('Say why the deadline is changing.')
    det.deadline_at = new Date(w.endMs).toISOString()
    act.due_date = pwKwDate_(w.endMs)
    changes.push('deadline ' + (pwKwDate_(oldEnd) || 'none') + ' -> ' + pwKwDate_(w.endMs) + ' (' + reason + ')')
  }
  if (startMoved) {
    det.start_at = new Date(w.startMs).toISOString()
    changes.push('start ' + pwKwDate_(oldStart) + ' -> ' + pwKwDate_(w.startMs))
  }
  if (!changes.length) return pwTaskById_(String(a.action_id))

  if (deadlineMoved || startMoved || 'est_hours' in det || newOwner !== owner) {
    const h = await pwTaskHoursFor_(newOwner, w.startMs, w.endMs, est, String(a.action_id))
    if (h.fitStatus === 'does_not_fit' && !input.assignAnyway) {
      throw new Error(
        'DOES_NOT_FIT: ' + h.free + ' task hours free of ' + h.available + ' working hours; estimate ' + est +
          ' h. Move the deadline, reduce the scope, or save anyway.',
      )
    }
    det.available_hours = h.free
    det.fit_status = h.fitStatus
    if (h.fitStatus === 'does_not_fit') det.assigned_anyway = true
  }
  if (Object.keys(act).length) {
    const row = await updateRow('actions', 'action_id', a.action_id, act, { actor: user.email, guard: pwActionGuard_(user, dir) })
    if (!row) throw new Error('That task no longer exists.')
  }
  if (Object.keys(det).length) {
    await updateRow('action_task_details', 'action_id', a.action_id, det, { actor: user.email })
  }
  await pwAppend_(
    'action_updates',
    [{
      update_id: newId('AUP'), action_id: a.action_id, kind: 'status',
      note: 'Edited by ' + dir.name(user.email) + ': ' + changes.join('; '),
      percent_complete: '', rag: '', next_step: '', drive_file_id: '', file_name: '', mime_type: '', planned_milestone_id: '',
    }],
    user.email,
  )
  if (newOwner !== owner) {
    await sendMail(
      {
        to: newOwner, kind: 'task_assigned', ref: String(a.action_id),
        subject: 'Task handed to you: ' + (act.title || a.title) + ', due ' + pwKwDate_(w.endMs),
        htmlBody:
          '<p>' + escapeHtml(dir.name(user.email)) + ' handed you <b>' + escapeHtml(act.title || a.title) + '</b> (was ' +
          escapeHtml(dir.name(owner)) + '). Deadline ' + pwKwDate_(w.endMs) + ' ' + pwKwTime_(w.endMs) + ', estimate ' +
          est + ' h.</p><p>CX Helm</p>',
      },
      user.email,
    )
  }
  return pwTaskById_(String(a.action_id))
}
