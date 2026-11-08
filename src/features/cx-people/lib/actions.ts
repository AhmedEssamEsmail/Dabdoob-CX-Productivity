/**
 * Actions.js — the shared action engine under 1:1s, meetings and TL tasks
 * (specs/people-workflows.md section 0). An action is one commitment with a
 * lifecycle; meetings add rows with source_type 'meeting', 1:1s create them
 * from topic outcomes, TL tasks are actions with track_as_task = TRUE plus an
 * action_task_details row.
 *
 * Statuses (PW_ACTION_STATUSES): open | blocked | done | dropped.
 * Open = open or blocked (pwIsOpenStatus_, scorecard/index.ts).
 * Review outcomes (PW_REVIEW_OUTCOMES): carried | done | blocked | dropped.
 *
 * Write rules live in pwActionGuard_ which is passed to updateRows like the
 * legacy sheet lock guard; assertWritable() (View as) precedes every write.
 */

import 'server-only'
import { normEmail_, pwMs_, pwDateOnly_, pwToday_, pwIsManagerOf_ } from '@/features/shared/lib/adapters'
import { newId, findRow, appendRows, updateRows, updateRow } from '@/features/shared/platform/repo'
import { readRows } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole } from '@/features/shared/platform/identity'
import { pwDirectory } from '@/features/shared/platform/identity'
import { pwIsOpenStatus_, pwActionOut_, pwUpdateOut_ } from './scorecard'
import type { Directory } from '@/features/shared/lib/adapters'

/** PW_TABLES verbatim — drives supabase/migrations/008_people.sql. */
export const PW_TABLES: Record<string, string[]> = {
  actions: [
    'action_id', 'title', 'description', 'owner_email', 'assigned_by', 'due_date', 'source_type', 'source_id',
    'series_id', 'topic', 'status', 'outcome_note', 'closed_at', 'closed_by', 'visibility', 'track_as_task', 'carry_count',
    // Set when the 1:1 that created it was deleted (OneOnOneDelete.js).
    'source_deleted_at', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  action_reviews: [
    'review_id', 'action_id', 'reviewed_in_type', 'reviewed_in_id', 'outcome', 'note', 'new_due_date',
    // What the action was before this review, so deleting the 1:1 can put it back (OneOnOneDelete.js).
    'prev_status', 'prev_due_date', 'prev_outcome_note', 'reverted_at', 'submitted_by', 'submitted_at',
  ],
  action_updates: [
    'update_id', 'action_id', 'kind', 'note', 'percent_complete', 'rag', 'next_step', 'drive_file_id',
    'file_name', 'mime_type', 'planned_milestone_id', 'submitted_by', 'submitted_at',
  ],
  action_task_details: [
    'action_id', 'priority', 'start_at', 'deadline_at', 'est_hours', 'available_hours', 'fit_status',
    'progress_state', 'blocked_reason', 'rag_self', 'delivered_at', 'delivery_ref', 'actual_hours', 'source_label',
    'assigned_anyway', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
    // TL performance (Mohamed 2026-10-11): his expectation when he assigns, and the rating decided in the 1:1.
    'expectation', 'outcome_rating', 'outcome_note', 'rated_by', 'rated_at',
  ],
  action_planned_milestones: [
    'milestone_id', 'action_id', 'label', 'target_date', 'done_by_update_id',
    'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  one_on_one_schedule: [
    'schedule_id', 'kind', 'manager_email', 'report_email', 'scheduled_at', 'duration_min', 'status',
    'log_id', 'rescheduled_to', 'reason', 'missed_at', 'deleted_at', 'deleted_by', 'delete_reason', 'prev_status',
    'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  one_on_one_logs: [
    'log_id', 'schedule_id', 'kind', 'manager_email', 'report_email', 'held_at', 'summary',
    'no_action_reason', 'on_time', 'deleted_at', 'deleted_by', 'delete_reason', 'delete_cascade_json',
    'submitted_by', 'submitted_at',
  ],
  one_on_one_topics: [
    'log_id', 'topic', 'position', 'raised_by', 'suggested', 'skipped_reason', 'outcome',
    'confidential', 'answers_json', 'fields_json', 'evidence_json', 'submitted_by', 'submitted_at',
  ],
  one_on_one_private_notes: ['log_id', 'kind', 'author_email', 'note', 'submitted_by', 'submitted_at'],
  meeting_series: [
    'series_id', 'meeting_type', 'title', 'chair_email', 'cadence', 'active',
    'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  meeting_series_members: ['series_id', 'email', 'role', 'submitted_by', 'submitted_at'],
  meetings: [
    'meeting_id', 'series_id', 'held_at', 'next_meeting_at', 'notes', 'decisions', 'status', 'closed_at',
    'summary_sent_at', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  meeting_attendees: [
    'meeting_id', 'email', 'role', 'attended', 'submitted_by', 'submitted_at', 'updated_by', 'updated_at',
  ],
  pw_reminder_log: ['dedupe_key', 'kind', 'recipient', 'ref', 'status', 'submitted_by', 'submitted_at'],
  // A suggested 1:1 topic for one person (e.g. an Enablement QA finding); pwSuggestTopics_ reads it.
  people_signals: ['signal_id', 'email', 'topic', 'reason', 'signal_date', 'source', 'submitted_by', 'submitted_at'],
}

// ---------------------------------------------------------------- actions: rules

export const PW_ACTION_STATUSES = ['open', 'blocked', 'done', 'dropped']
export const PW_SOURCE_TYPES = ['one_on_one_agent', 'one_on_one_tl', 'meeting', 'task', 'adhoc']
export const PW_REVIEW_OUTCOMES = ['carried', 'done', 'blocked', 'dropped']

export type PwUser = { email: string; role: string }

/**
 * The guard passed to updateRows for every write to `actions`. It runs against
 * the row as it is now.
 *   opts.reviewerFor  series_id the caller has been verified to review (1:1 manager or meeting chair)
 *   opts.carryIds     { action_id: true } - bump carry_count from the current value
 */
export function pwActionGuard_(user: PwUser, dir: Directory, opts?: { reviewerFor?: string; carryIds?: Record<string, boolean> }) {
  const o = opts || {}
  return function (cur: Record<string, unknown>, patch: Record<string, unknown>): void {
    const owner = normEmail_(cur.owner_email)
    const isOwner = owner === user.email
    const isMgr = pwIsManagerOf_(user as never, owner, dir)
    const isReviewer = !!o.reviewerFor && String(cur.series_id) === String(o.reviewerFor)
    const from = String(cur.status || 'open')

    if ('status' in patch && patch.status !== from) {
      const to = String(patch.status)
      if (PW_ACTION_STATUSES.indexOf(to) === -1) throw new Error('Unknown action status "' + to + '".')
      if (!(isOwner || isMgr || isReviewer)) {
        throw new Error('Only the action owner or their manager can change "' + String(cur.title) + '".')
      }
      if ((from === 'done' || from === 'dropped') && !(isMgr || isReviewer)) {
        throw new Error('"' + String(cur.title) + '" is ' + from + ". Only the owner's manager can re-open it.")
      }
      if (to === 'dropped' && !(isMgr || isReviewer)) {
        throw new Error('Only the owner\'s manager, or the 1:1 or meeting reviewing it, can drop "' + String(cur.title) + '".')
      }
      if (to !== 'open' && !String(patch.outcome_note || '').trim()) {
        throw new Error('Add an outcome note before marking "' + String(cur.title) + '" ' + to + '.')
      }
      if (to === 'open') {
        patch.closed_at = ''
        patch.closed_by = ''
      } else if (to === 'done' || to === 'dropped') {
        patch.closed_at = new Date().toISOString()
        patch.closed_by = user.email
      }
    }
    if (('due_date' in patch || 'title' in patch) && !(isOwner || isMgr || isReviewer)) {
      throw new Error('Only the action owner or their manager can edit "' + String(cur.title) + '".')
    }
    if ('owner_email' in patch && normEmail_(patch.owner_email) !== owner && !(isMgr || isReviewer)) {
      throw new Error('Only the owner\'s manager can reassign "' + String(cur.title) + '".')
    }
    if (o.carryIds && o.carryIds[String(cur.action_id)]) {
      patch.carry_count = (Number(cur.carry_count) || 0) + 1
    }
  }
}

/** Can `user` see this action? Private actions: author and admin only. */
export function pwCanSeeAction_(
  a: Record<string, unknown>,
  user: PwUser,
  dir: Directory,
  extra?: { seriesIds?: Record<string, boolean> },
): boolean {
  if (user.role === 'admin') return true
  const author = normEmail_(a.assigned_by || a.submitted_by)
  if (a.visibility === 'private') return author === user.email
  const owner = normEmail_(a.owner_email)
  if (owner === user.email || author === user.email) return true
  if (dir.managerOf(owner) === user.email) return true
  const series = String(a.series_id || '')
  if (series.indexOf('|') !== -1 && series.split('|').indexOf(user.email) !== -1) return true
  return !!(extra && extra.seriesIds && extra.seriesIds[series])
}

export interface PwBuildCtx {
  sourceType?: string
  sourceId?: string
  seriesId?: string
  topic?: string
  visibility?: string
  allowedOwners?: string[] | null
  minDueDate?: string
}

/** Validates and builds action rows (does not write). */
export function pwBuildActions_(
  list: Record<string, unknown>[],
  ctx: PwBuildCtx,
  user: PwUser,
  dir: Directory,
): Record<string, unknown>[] {
  const today = pwToday_()
  return (list || []).map((a, i) => {
    const title = String(a.title || '').trim()
    if (!title) throw new Error('Action ' + (i + 1) + ' needs a title.')
    if (title.length > 300) throw new Error('Keep action titles under 300 characters.')
    const owner = normEmail_(a.ownerEmail || a.owner_email)
    if (!owner || !dir.person(owner)) throw new Error('Choose an owner from the roster for "' + title + '".')
    if (ctx.allowedOwners && ctx.allowedOwners.indexOf(owner) === -1) {
      throw new Error('"' + title + '" must be owned by someone in this conversation.')
    }
    const due = pwDateOnly_(a.dueDate || a.due_date)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) throw new Error('"' + title + '" needs a due date.')
    if (due < (ctx.minDueDate || today)) throw new Error('The due date for "' + title + '" is in the past.')
    const sourceType = ctx.sourceType || 'adhoc'
    if (PW_SOURCE_TYPES.indexOf(sourceType) === -1) throw new Error('Unknown action source.')
    const visibility = (a.visibility || ctx.visibility) === 'private' ? 'private' : 'shared'
    return {
      action_id: newId('ACT'),
      title,
      description: String(a.description || ''),
      owner_email: owner,
      assigned_by: user.email,
      due_date: String(due),
      source_type: sourceType,
      source_id: ctx.sourceId || '',
      series_id: ctx.seriesId || '',
      topic: String(a.topic || ctx.topic || ''),
      status: 'open',
      outcome_note: '',
      closed_at: '',
      closed_by: '',
      visibility,
      track_as_task: !!a.trackAsTask,
      carry_count: 0,
    }
  })
}

export interface PwReview {
  actionId: string
  outcome: string
  note?: string
  newDueDate?: string
}

/**
 * Applies the carry-forward review a 1:1 or meeting makes. The caller has
 * already checked that `user` reviews this series. reviews: [{ actionId,
 * outcome (carried|done|blocked|dropped), note, newDueDate }].
 * Writes action_reviews rows and patches actions in one batch.
 */
export async function pwApplyReviews_(
  reviews: PwReview[],
  reviewedInType: string,
  reviewedInId: string,
  seriesId: string,
  user: PwUser,
  dir: Directory,
): Promise<(Record<string, unknown> | null)[]> {
  if (!reviews || !reviews.length) return []
  await assertWritable()
  const today = pwToday_()
  const carryIds: Record<string, boolean> = {}
  const updates: { key: unknown; patch: Record<string, unknown> }[] = []
  const reviewRows: Record<string, unknown>[] = []
  reviews.forEach((r) => {
    const outcome = String(r.outcome || '')
    if (PW_REVIEW_OUTCOMES.indexOf(outcome) === -1) throw new Error('Choose an outcome for every action under review.')
    const note = String(r.note || '').trim()
    const patch: Record<string, unknown> = {}
    if (outcome === 'carried') {
      const due = pwDateOnly_(r.newDueDate)
      if (!/^\d{4}-\d{2}-\d{2}$/.test(due) || due < today) {
        throw new Error('A carried action needs a new due date from today on.')
      }
      patch.status = 'open'
      patch.due_date = String(due)
      carryIds[r.actionId] = true
    } else {
      if (!note) throw new Error('Add a note for every action marked ' + outcome + '.')
      patch.status = outcome
      patch.outcome_note = note
    }
    updates.push({ key: r.actionId, patch })
    reviewRows.push({
      review_id: newId('REV'),
      action_id: r.actionId,
      reviewed_in_type: reviewedInType,
      reviewed_in_id: reviewedInId,
      outcome,
      note,
      new_due_date: outcome === 'carried' ? String(pwDateOnly_(r.newDueDate)) : '',
    })
  })
  const prev: Record<string, { status: string; due: string; note: string }> = {}
  const res = await updateRows('actions', 'action_id', updates, {
    actor: user.email,
    guard(cur, patch) {
      if (String(cur.series_id) !== String(seriesId)) throw new Error('"' + String(cur.title) + '" does not belong to this series.')
      prev[String(cur.action_id)] = {
        status: String(cur.status || 'open'),
        due: pwDateOnly_(cur.due_date),
        note: String(cur.outcome_note || ''),
      }
      pwActionGuard_(user, dir, { reviewerFor: seriesId, carryIds })(cur, patch)
    },
  })
  res.forEach((r, i) => {
    if (!r) throw new Error('Action ' + updates[i].key + ' was not found.')
  })
  reviewRows.forEach((r) => {
    const p = prev[String(r.action_id)]
    if (!p) return
    r.prev_status = p.status
    r.prev_due_date = p.due ? String(p.due) : ''
    r.prev_outcome_note = p.note
  })
  await pwAppend_('action_reviews', reviewRows, user.email)
  return res
}

/** pwAppend_: appends rows (the table exists from migration 008). */
export async function pwAppend_(
  name: string,
  rows: Record<string, unknown>[],
  actor: string,
): Promise<Record<string, unknown>[]> {
  if (!rows.length) return []
  return appendRows(name, rows, actor)
}

// ---------------------------------------------------------------- actions: public API

/** The caller's own open actions, from every source (Home and the 1:1 opener use this). */
export async function actionsMine(user: PwUser, dir: Directory): Promise<Record<string, unknown>[]> {
  const mine = (await pwRowsSafe_('actions')).filter(
    (a) => normEmail_(a.owner_email) === user.email && pwIsOpenStatus_(String(a.status || 'open')),
  )
  const ids: Record<string, boolean> = {}
  mine.forEach((a) => {
    ids[String(a.action_id)] = true
  })
  const latest: Record<string, Record<string, unknown>> = {}
  ;(await pwRowsSafe_('action_updates')).forEach((u) => {
    if (!ids[String(u.action_id)]) return
    const k = String(u.action_id)
    if (!latest[k] || pwMs_(u.submitted_at) > pwMs_(latest[k].submitted_at)) latest[k] = u
  })
  return mine
    .map((a) => {
      const out = pwActionOut_(a, dir)
      out.latestUpdate = latest[String(a.action_id)] ? pwUpdateOut_(latest[String(a.action_id)], dir) : null
      return out
    })
    .sort((a, b) => (String(a.dueDate) < String(b.dueDate) ? -1 : 1))
}

/** Missing-table reads behave as [] (dqReadObjects_ missingOk semantics). */
async function pwRowsSafe_(name: string): Promise<Record<string, unknown>[]> {
  try {
    return await readRows(name)
  } catch {
    return []
  }
}

/** An action not tied to a 1:1, meeting or task. TLs may assign to themselves or their agents. */
export async function actionsCreate(input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl'])
  await assertWritable()
  const dir = await pwDirectory()
  const owner = normEmail_(input && input.ownerEmail)
  if (owner !== user.email && !pwIsManagerOf_(user as never, owner, dir)) {
    throw new Error('You can create actions for yourself or for people you manage.')
  }
  const rows = pwBuildActions_([input], { sourceType: 'adhoc', visibility: input && (input.visibility as string) }, user, dir)
  const stored = await pwAppend_('actions', rows, user.email)
  return pwActionOut_(stored[0], dir)
}

/**
 * Owner or manager changes an action's status. note is required unless the
 * action goes back to open.
 */
export async function actionsSetStatus(actionId: string, status: string, note?: string): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl', 'agent'])
  await assertWritable()
  const dir = await pwDirectory()
  const patch: Record<string, unknown> = { status: String(status || '') }
  if (note !== undefined) patch.outcome_note = String(note || '').trim()
  const row = await updateRow('actions', 'action_id', String(actionId), patch, {
    guard: pwActionGuard_(user, dir),
    actor: user.email,
  })
  if (!row) throw new Error('That action no longer exists.')
  return pwActionOut_(row, dir)
}

/**
 * A status note on any action ("where I stand", or the owner's update before a
 * meeting). It does not close the action; the review does.
 */
export async function actionsPostUpdate(actionId: string, input: Record<string, unknown>): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin', 'tl', 'agent'])
  await assertWritable()
  const dir = await pwDirectory()
  const a = await findRow('actions', 'action_id', String(actionId))
  if (!a) throw new Error('That action no longer exists.')
  const owner = normEmail_(a.owner_email)
  if (owner !== user.email && !pwIsManagerOf_(user as never, owner, dir)) {
    throw new Error('Only the action owner or their manager can post an update.')
  }
  const note = String((input && input.note) || '').trim()
  if (!note) throw new Error('Write where it stands before posting.')
  const rows = await pwAppend_(
    'action_updates',
    [
      {
        update_id: newId('AUP'),
        action_id: a.action_id,
        kind: 'status',
        note,
        percent_complete:
          input.percent === undefined || input.percent === '' ? '' : Math.max(0, Math.min(100, Number(input.percent) || 0)),
        rag: pwRag_(input.rag),
        next_step: String(input.nextStep || ''),
        drive_file_id: '',
        file_name: '',
        mime_type: '',
        planned_milestone_id: '',
      },
    ],
    user.email,
  )
  return pwUpdateOut_(rows[0], dir)
}

export function pwRag_(v: unknown): string {
  const s = String(v || '').toLowerCase().replace(/[\s-]+/g, '_')
  return s === 'on_track' || s === 'at_risk' || s === 'off_track' ? s : ''
}
