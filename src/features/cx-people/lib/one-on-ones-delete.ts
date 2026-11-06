/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim OneOnOneDelete.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * OneOnOneDelete.js — deleting a 1:1, admin only. SOFT delete: the row stays,
 * stamped deleted_at / deleted_by / delete_reason, and an admin can restore it.
 *
 * A logged record (oneOnOnesDeleteLog), and what happens with it:
 *   - the record, its topics and private notes are hidden everywhere (pwRows_
 *     skips a deleted log; topics and notes are only ever read through their log);
 *   - actions created in it: an open one with no update and no later review is
 *     dropped with it; any other is kept and flagged source_deleted_at;
 *   - outcomes it gave to earlier actions are reverted from prev_* on
 *     action_reviews; an action reviewed again later stays as that later
 *     review set it;
 *   - the booking it fulfilled goes back to booked, or to missed when its
 *     day's cutoff has passed (with the usual "not logged" pop-up);
 *   - "Escalate to Mohamed" pop-ups raised from it are withdrawn.
 * Everything it changed is kept in delete_cascade_json, which restore replays
 * in reverse.
 */

import {
  pwIso_,
  pwKwDate_,
  pwKwTime_,
  pwMs_,
  pwDateOnly_,
  type Directory,
} from '@/features/shared/lib/adapters'
import { findRow, updateRow, updateRows } from '@/features/shared/platform/repo'
import { assertWritable } from '@/features/shared/platform/viewas'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { raisePopup, resolvePopups } from '@/features/shared/platform/popups'
import { pwIsOpenStatus_ } from './scorecard/index'
import { pwRows_, pwRowsAll_ } from './work-core'
import {
  pwIsMissed_,
  pwOneOnOneCutoff_,
  pwBookingRules_,
  pwDayLabel_,
  pwJson_,
  pwOoRemindersChanged_,
} from './one-on-ones'

async function pwOoAdmin_() {
  const user = await requireRole(['admin'])
  if (user.role !== 'admin') throw new Error('Only an admin can delete or restore a 1:1.')
  return user
}


function pwWhen_(iso: unknown): string {
  return pwKwDate_(iso) + ', ' + pwKwTime_(iso)
}

interface Cascade {
  drop: Record<string, any>[]
  keep: Record<string, any>[]
  revert: { r: Record<string, any>; a: Record<string, any> }[]
  blocked: { r: Record<string, any>; a: Record<string, any> }[]
  schedule: Record<string, any> | null
  escalated: boolean
  topics: number
}

/** What deleting logId would do, without doing it (pwLogCascade_). */
async function pwLogCascade_(log: Record<string, any>): Promise<Cascade> {
  const logId = String(log.log_id)
  const actions = await pwRows_('actions')
  const byId: Record<string, Record<string, any>> = {}
  actions.forEach((a) => {
    byId[String(a.action_id)] = a
  })
  const updates: Record<string, boolean> = {}
  ;(await pwRows_('action_updates')).forEach((u) => {
    updates[String(u.action_id)] = true
  })
  const reviews = await pwRows_('action_reviews')
  const laterReviewed: Record<string, Record<string, any>> = {}
  reviews.forEach((r) => {
    if (!r.reverted_at && String(r.reviewed_in_id) !== logId) laterReviewed[String(r.action_id)] = r
  })

  const created = actions.filter(
    (a) => String(a.source_id) === logId && String(a.source_type).indexOf('one_on_one') === 0,
  )
  const drop = created.filter((a) => {
    const id = String(a.action_id)
    return pwIsOpenStatus_(String(a.status || 'open')) && !updates[id] && !laterReviewed[id]
  })
  const dropIds: Record<string, boolean> = {}
  drop.forEach((a) => {
    dropIds[String(a.action_id)] = true
  })
  const keep = created.filter((a) => !dropIds[String(a.action_id)])

  const mine = reviews.filter(
    (r) => String(r.reviewed_in_type) === 'one_on_one' && String(r.reviewed_in_id) === logId && !r.reverted_at,
  )
  const revert: { r: Record<string, any>; a: Record<string, any> }[] = []
  const blocked: { r: Record<string, any>; a: Record<string, any> }[] = []
  mine.forEach((r) => {
    const a = byId[String(r.action_id)]
    if (!a) return
    const after = reviews.filter(
      (x) =>
        String(x.action_id) === String(r.action_id) &&
        !x.reverted_at &&
        String(x.reviewed_in_id) !== logId &&
        pwMs_(x.submitted_at) > pwMs_(r.submitted_at),
    )
    ;(after.length ? blocked : revert).push({ r, a })
  })
  const sched = log.schedule_id
    ? await findRow('one_on_one_schedule', 'schedule_id', String(log.schedule_id))
    : null
  const escalated =
    (await pwRows_('one_on_one_topics', (t) => String(t.log_id) === logId && String(t.outcome) === 'Escalate to Mohamed'))
      .length > 0
  return {
    drop, keep, revert, blocked, schedule: sched, escalated,
    topics: (await pwRows_('one_on_one_topics', (t) => String(t.log_id) === logId)).length,
  }
}

async function pwFindLog_(logId: string): Promise<Record<string, any>> {
  const log = (await pwRowsAll_('one_on_one_logs', (l) => String(l.log_id) === String(logId)))[0]
  if (!log) throw new Error('That 1:1 record does not exist.')
  return log
}

/** The confirm dialog's text: exactly what goes and what comes back (oneOnOnesDeletePreview). */
export async function oneOnOnesDeletePreview(logId: string) {
  await pwOoAdmin_()
  const dir = await pwDirectory()
  const log = await pwFindLog_(logId)
  if (log.deleted_at) throw new Error('That 1:1 record is already deleted.')
  const c = await pwLogCascade_(log)
  const cutoff = await pwOneOnOneCutoff_()
  const lines = [
    'The record of the 1:1 ' +
      dir.name(String(log.manager_email)) +
      ' held with ' +
      dir.name(String(log.report_email)) +
      ' on ' +
      pwDayLabel_(pwMs_(log.held_at)) +
      ' at ' +
      pwKwTime_(log.held_at) +
      ', its ' +
      c.topics +
      ' topic' +
      (c.topics === 1 ? '' : 's') +
      ' and any private notes are hidden.',
  ]
  c.drop.forEach((a) => {
    lines.push('Action removed (open, no update yet): "' + a.title + '".')
  })
  c.keep.forEach((a) => {
    lines.push('Action kept and marked "created in a deleted 1:1" (it has updates or is closed): "' + a.title + '".')
  })
  c.revert.forEach((x) => {
    lines.push('"' + x.a.title + '" goes back to ' + (x.r.prev_status || 'open') + ' (this 1:1 had marked it ' + x.r.outcome + ').')
  })
  c.blocked.forEach((x) => {
    lines.push('"' + x.a.title + '" stays as a later 1:1 set it (reviewed again since).')
  })
  if (c.schedule && String(c.schedule.status) !== 'deleted') {
    lines.push(
      'The booking for ' +
        pwDayLabel_(pwMs_(c.schedule.scheduled_at)) +
        ' at ' +
        pwKwTime_(c.schedule.scheduled_at) +
        ' goes back to ' +
        (pwIsMissed_(pwMs_(c.schedule.scheduled_at), NaN, Date.now(), cutoff) ? 'missed (not logged)' : 'booked') +
        '.',
    )
  }
  if (c.escalated) lines.push('The escalation to Mohamed raised from it is withdrawn.')
  lines.push('An admin can restore it later.')
  return { logId: String(log.log_id), lines }
}

export async function oneOnOnesDeleteLog(logId: string, reason: string) {
  const user = await pwOoAdmin_()
  await assertWritable()
  const dir = await pwDirectory()
  const why = String(reason || '').trim()
  if (!why) throw new Error('Say why this 1:1 record is being deleted (for example: logged twice).')
  const log = await pwFindLog_(logId)
  if (log.deleted_at) throw new Error('That 1:1 record is already deleted.')
  const c = await pwLogCascade_(log)
  const now = new Date().toISOString()
  const cascade: Record<string, any> = { dropped: [], flagged: [], reverted: [], schedule: null }

  if (c.drop.length || c.keep.length) {
    await updateRows(
      'actions',
      'action_id',
      c.drop
        .map((a): { key: unknown; patch: Record<string, unknown> } => {
          cascade.dropped.push(String(a.action_id))
          return {
            key: a.action_id,
            patch: {
              status: 'dropped', outcome_note: 'Removed with a deleted 1:1 record', closed_at: now,
              closed_by: user.email, source_deleted_at: now,
            },
          }
        })
        .concat(
          c.keep.map((a) => {
            cascade.flagged.push(String(a.action_id))
            return { key: a.action_id, patch: { source_deleted_at: now } }
          }),
        ),
      { actor: user.email },
    )
  }
  if (c.revert.length) {
    await updateRows(
      'actions',
      'action_id',
      c.revert.map((x) => {
        const r = x.r
        const a = x.a
        const patch: Record<string, unknown> = {
          status: String(r.prev_status || 'open'), outcome_note: String(r.prev_outcome_note || ''),
          closed_at: '', closed_by: '',
        }
        if (patch.status === 'done' || patch.status === 'dropped') patch.status = 'open' // it was in carry-forward, so it was open
        if (String(r.outcome) === 'carried') {
          patch.carry_count = Math.max(0, (Number(a.carry_count) || 0) - 1)
          if (r.prev_due_date) patch.due_date = pwDateOnly_(r.prev_due_date)
        }
        cascade.reverted.push({
          reviewId: String(r.review_id), actionId: String(a.action_id), outcome: String(r.outcome),
          note: String(r.note || ''), newDue: pwDateOnly_(r.new_due_date),
        })
        return { key: a.action_id, patch }
      }),
      { actor: user.email },
    )
    await updateRows(
      'action_reviews',
      'review_id',
      c.revert.map((x) => ({ key: x.r.review_id, patch: { reverted_at: now } })),
      { actor: user.email, stampUpdates: false }, // action_reviews has no updated_* columns
    )
  }
  if (
    c.schedule &&
    ['held', 'held_late'].indexOf(String(c.schedule.status)) !== -1 &&
    String(c.schedule.log_id) === String(log.log_id)
  ) {
    const s = c.schedule
    const missed = pwIsMissed_(pwMs_(s.scheduled_at), NaN, Date.now(), await pwOneOnOneCutoff_())
    cascade.schedule = { id: String(s.schedule_id), status: String(s.status) }
    await updateRow(
      'one_on_one_schedule',
      'schedule_id',
      s.schedule_id,
      missed ? { status: 'missed', log_id: '', missed_at: now } : { status: 'scheduled', log_id: '' },
      { actor: user.email },
    )
    if (missed) {
      await raisePopup(
        {
          recipient: String(s.manager_email), kind: 'missed_1on1', ref: String(s.schedule_id),
          title: '1:1 not logged: ' + dir.name(String(s.report_email)),
          body:
            'The record of the 1:1 with ' + dir.name(String(s.report_email)) + ' planned for ' + pwWhen_(s.scheduled_at) +
            ' was deleted by an admin. Submit the record again, or mark it not held with a new date.',
          link: '#/one-on-ones?schedule=' + s.schedule_id,
        },
        user.email,
      )
    }
  }
  await resolvePopups('escalation_1on1', String(log.log_id), user.email)
  await updateRow(
    'one_on_one_logs',
    'log_id',
    log.log_id,
    { deleted_at: now, deleted_by: user.email, delete_reason: why, delete_cascade_json: JSON.stringify(cascade) },
    { actor: user.email, stampUpdates: false }, // one_on_one_logs has no updated_* columns
  )
  pwOoRemindersChanged_()
  return {
    logId: String(log.log_id), dropped: cascade.dropped.length, flagged: cascade.flagged.length,
    reverted: cascade.reverted.length,
    schedule: cascade.schedule
      ? pwIsMissed_(pwMs_((c.schedule as Record<string, any>).scheduled_at), NaN, Date.now(), await pwOneOnOneCutoff_())
        ? 'missed'
        : 'scheduled'
      : '',
  }
}

export async function oneOnOnesDeleteBooking(scheduleId: string, reason: string) {
  const user = await pwOoAdmin_()
  await assertWritable()
  const why = String(reason || '').trim()
  if (!why) throw new Error('Say why this booked 1:1 is being deleted.')
  const s = await findRow('one_on_one_schedule', 'schedule_id', String(scheduleId))
  if (!s || String(s.status) === 'deleted') throw new Error('That booked 1:1 does not exist.')
  const log = s.log_id
    ? (await pwRows_('one_on_one_logs', (l) => String(l.log_id) === String(s.log_id)))[0]
    : null
  if (log)
    throw new Error('This booking has a logged record. Delete the record under Records first; the booking then goes back to booked.')
  await updateRow(
    'one_on_one_schedule',
    'schedule_id',
    s.schedule_id,
    {
      status: 'deleted', prev_status: String(s.status), deleted_at: new Date().toISOString(),
      deleted_by: user.email, delete_reason: why,
    },
    { actor: user.email },
  )
  await resolvePopups('missed_1on1', String(s.schedule_id), user.email)
  pwOoRemindersChanged_()
  return { scheduleId: String(s.schedule_id) }
}

/** Admin: the deleted records and bookings, newest first, for the Restore list (pwDeletedOut_). */
export async function pwDeletedOut_(dir: Directory) {
  const logs = (await pwRowsAll_('one_on_one_logs', (l) => !!l.deleted_at)).map((l) => ({
    type: 'log', id: String(l.log_id),
    label:
      'Record: ' + dir.name(String(l.manager_email)) + ' with ' + dir.name(String(l.report_email)) + ', held ' +
      pwDayLabel_(pwMs_(l.held_at)) + ' ' + pwKwTime_(l.held_at),
    deletedAt: pwIso_(l.deleted_at), deletedBy: dir.name(String(l.deleted_by)),
    reason: String(l.delete_reason || ''),
  }))
  const books = (await pwRowsAll_('one_on_one_schedule', (s) => String(s.status) === 'deleted')).map((s) => ({
    type: 'booking', id: String(s.schedule_id),
    label:
      'Booking: ' + dir.name(String(s.manager_email)) + ' with ' + dir.name(String(s.report_email)) + ', ' +
      pwDayLabel_(pwMs_(s.scheduled_at)) + ' ' + pwKwTime_(s.scheduled_at),
    deletedAt: pwIso_(s.deleted_at), deletedBy: dir.name(String(s.deleted_by)),
    reason: String(s.delete_reason || ''),
  }))
  return logs.concat(books).sort((a, b) => (a.deletedAt < b.deletedAt ? 1 : -1)).slice(0, 30)
}

/** Admin: puts a deleted record or booking back, undoing what the delete did (oneOnOnesRestore). */
export async function oneOnOnesRestore(type: string, id: string) {
  const user = await pwOoAdmin_()
  await assertWritable()
  const dir = await pwDirectory()
  if (type === 'booking') {
    const s = await findRow('one_on_one_schedule', 'schedule_id', String(id))
    if (!s || String(s.status) !== 'deleted') throw new Error('That booking is not deleted.')
    const prev = String(s.prev_status || 'scheduled')
    if (prev === 'scheduled' && pwMs_(s.scheduled_at) > Date.now()) {
      await pwBookingRules_(String(s.manager_email), String(s.report_email), pwMs_(s.scheduled_at), Number(s.duration_min) || 30, [String(s.schedule_id)], dir)
    }
    await updateRow(
      'one_on_one_schedule', 'schedule_id', s.schedule_id,
      { status: prev, prev_status: '', deleted_at: '', deleted_by: '', delete_reason: '' },
      { actor: user.email },
    )
    pwOoRemindersChanged_()
    return { type, id: String(id) }
  }
  const log = await pwFindLog_(id)
  if (!log.deleted_at) throw new Error('That 1:1 record is not deleted.')
  const c = pwJson_(log.delete_cascade_json, { dropped: [], flagged: [], reverted: [], schedule: null }) as Record<string, any>
  if (c.schedule) {
    const sc = await findRow('one_on_one_schedule', 'schedule_id', c.schedule.id)
    if (sc && sc.log_id && String(sc.log_id) !== String(log.log_id)) {
      throw new Error('Its booking has been logged again since. Delete that record first, then restore this one.')
    }
    if (sc && ['scheduled', 'missed'].indexOf(String(sc.status)) !== -1) {
      await updateRow('one_on_one_schedule', 'schedule_id', sc.schedule_id, { status: c.schedule.status, log_id: String(log.log_id) }, { actor: user.email })
      await resolvePopups('missed_1on1', String(sc.schedule_id), user.email)
    }
  }
  const actions: Record<string, Record<string, any>> = {}
  ;(await pwRows_('actions')).forEach((a) => {
    actions[String(a.action_id)] = a
  })
  const patches: { key: unknown; patch: Record<string, unknown> }[] = []
  ;(c.dropped || []).forEach((aid: string) => {
    const a = actions[aid]
    if (a && String(a.status) === 'dropped')
      patches.push({ key: aid, patch: { status: 'open', outcome_note: '', closed_at: '', closed_by: '', source_deleted_at: '' } })
  })
  ;(c.flagged || []).forEach((aid: string) => {
    if (actions[aid]) patches.push({ key: aid, patch: { source_deleted_at: '' } })
  })
  ;(c.reverted || []).forEach((r: Record<string, any>) => {
    const a = actions[String(r.actionId)]
    if (!a) return
    const patch =
      r.outcome === 'carried'
        ? { status: 'open', due_date: r.newDue ? String(r.newDue) : a.due_date, carry_count: (Number(a.carry_count) || 0) + 1 }
        : { status: r.outcome, outcome_note: r.note, closed_at: new Date().toISOString() }
    patches.push({ key: r.actionId, patch })
  })
  if (patches.length) await updateRows('actions', 'action_id', patches, { actor: user.email })
  if ((c.reverted || []).length) {
    await updateRows(
      'action_reviews', 'review_id',
      c.reverted.map((r: Record<string, any>) => ({ key: r.reviewId, patch: { reverted_at: '' } })),
      { actor: user.email, stampUpdates: false }, // action_reviews has no updated_* columns
    )
  }
  await updateRow(
    'one_on_one_logs', 'log_id', log.log_id,
    { deleted_at: '', deleted_by: '', delete_reason: '', delete_cascade_json: '' },
    { actor: user.email, stampUpdates: false }, // one_on_one_logs has no updated_* columns
  )
  pwOoRemindersChanged_()
  return { type: 'log', id: String(id) }
}
