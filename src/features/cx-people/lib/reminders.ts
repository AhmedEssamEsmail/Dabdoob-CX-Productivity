/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim Reminders.js port:
   sheet/JSON rows are dynamic records; `any` is the honest shape here. */
/**
 * Reminders.js — the trigger jobs (people-workflows 2.3, 2.4, 3.4, 4.3).
 *
 *   runMissedOneOnOneCheck_    after 22:00 Kuwait: scheduled 1:1s with no record
 *                              by 22:00 become "missed", raise a login pop-up
 *                              and email the holder.
 *   runTaskReminders_          morning digest per person: task nudges (not
 *                              started, no update, halfway, planned milestone
 *                              passed, due tomorrow / today, overdue) plus
 *                              outstanding missed 1:1s. Mohamed is copied from
 *                              the 2nd working day overdue / outstanding.
 *   runMeetingActionReminders_ 2 working days before the next instance:
 *                              open-action owners; morning of the meeting: the
 *                              chair's pre-read.
 *
 * All mail goes through sendMail (mail.ts), which stays dry-run until the
 * adapter is wired. pw_reminder_log keeps a dedupe key per send, so a re-run
 * never mails twice. The cron routes call these with Date.now() (they take
 * `nowMs` so tests can pin the clock).
 */
import 'server-only'

import {
  normEmail_, pwKwDate_, pwKwTime_, pwMs_, pwToday_, pwDateOnly_,
} from '@/features/shared/lib/adapters'
import { updateRows } from '@/features/shared/platform/repo'
import { pwDirectory, requireJobCaller } from '@/features/shared/platform/identity'
import { dqStep_ } from '@/features/shared/jobs/steps'
import type { JobEnv } from '@/features/shared/jobs/env'
import { pwIsWorkingDate, pwAddWorkingDays, pwWorkingDaysBetween } from '@/features/shared/platform/calendar'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { raisePopup } from '@/features/shared/platform/popups'
import { remindersOn } from '@/features/shared/platform/settings'
import { pwIsOpenStatus_, pwOpenSeriesActions_ } from './scorecard/index'
import { pwAppend_ } from './actions'
import { pwRows_, pwTaskContext_, pwTasksOut_, pwNextMeetings_ } from './work-core'
import { pwIsMissed_, pwOneOnOneCutoff_, pwExcuseFor_ } from './one-on-ones'
import { pwSentKeys_, pwSendOnce_ } from './one-on-one-reminders'

const JOB_ACTOR = 'system:trigger'

function pwFirstName_(dir: { name: (e: string) => string }, email: string) {
  return String(dir.name(email)).split(/[\s@.]/)[0]
}

function pwWhen_(iso: unknown) {
  return pwKwDate_(iso) + ', ' + pwKwTime_(iso)
}

// ---------------------------------------------------------------- missed 1:1s

/**
 * Option A (BRIEF: 1:1 rules and working days), run after 22:00 Kuwait:
 *  - a scheduled 1:1 with no record by 22:00 on its day is "missed", unless that day is
 *    a day off or a holiday for either person, which makes it "excused" (never missed);
 *  - a missed 1:1 raises a login pop-up (closable, back on every load until logged) and
 *    the holder is emailed that evening;
 *  - still not logged after 2 working days (the holder's calendar): emailed again with
 *    Mohamed in cc, once per item.
 * Returns counts.
 */
export async function runMissedOneOnOneCheck_(nowMs?: number) {
  const now = nowMs === undefined ? Date.now() : nowMs
  const dir = await pwDirectory()
  const today = pwToday_(now)
  const cutoff = await pwOneOnOneCutoff_()
  const schedule = await pwRows_('one_on_one_schedule')
  const due = schedule.filter(
    (s) => String(s.status) === 'scheduled' && pwIsMissed_(pwMs_(s.scheduled_at), NaN, now, cutoff),
  )
  const excused: { s: Record<string, any>; why: string }[] = []
  const newlyMissed: Record<string, any>[] = []
  for (const s of due) {
    const why = await pwExcuseFor_(String(s.manager_email), String(s.report_email), pwKwDate_(s.scheduled_at), dir)
    if (why) excused.push({ s, why })
    else newlyMissed.push(s)
  }
  const stamp = new Date(now).toISOString()
  const patches = newlyMissed
    .map((s): { key: unknown; patch: Record<string, unknown> } => ({ key: s.schedule_id, patch: { status: 'missed', missed_at: stamp } }))
    .concat(excused.map((x) => ({ key: x.s.schedule_id, patch: { status: 'excused', reason: x.why } })))
  if (patches.length) {
    await updateRows('one_on_one_schedule', 'schedule_id', patches, {
      actor: JOB_ACTOR,
      guard(cur) {
        if (String(cur.status) !== 'scheduled') throw new Error('stale')
      },
    })
  }
  for (const s of newlyMissed) {
    await raisePopup(
      {
        recipient: String(s.manager_email), kind: 'missed_1on1', ref: String(s.schedule_id),
        title: '1:1 not logged: ' + dir.name(String(s.report_email)),
        body:
          'The 1:1 with ' + dir.name(String(s.report_email)) + ' planned for ' + pwWhen_(s.scheduled_at) +
          ' has no record. Submit the record, or mark it not held with a new date.',
        link: '#/one-on-ones?schedule=' + s.schedule_id,
      },
      JOB_ACTOR,
    )
  }

  const sent = await pwSentKeys_()
  const outstanding = await pwRows_('one_on_one_schedule', (s) => String(s.status) === 'missed')
  const byMgr: Record<string, Record<string, any>[]> = {}
  outstanding.forEach((s) => {
    const k = normEmail_(s.manager_email)
    ;(byMgr[k] = byMgr[k] || []).push(s)
  })
  let emailed = 0
  let escalated = 0
  const list = (items: Record<string, any>[]) =>
    '<ul>' +
    items
      .map((s) => '<li><b>' + escapeHtml(dir.name(s.report_email)) + '</b>, planned ' + pwWhen_(s.scheduled_at) + '</li>')
      .join('') +
    '</ul>'
  for (const mgr of Object.keys(byMgr)) {
    const items = byMgr[mgr]
    // 1. The same-evening email, when something new was missed today.
    const fresh = items.filter((s) => newlyMissed.some((n) => n.schedule_id === s.schedule_id))
    if (fresh.length) {
      const first = fresh[0]
      const html =
        '<p>Hi ' + escapeHtml(pwFirstName_(dir, mgr)) + ',</p>' +
        '<p>These 1:1s have no record yet:</p>' + list(items) +
        '<p>Please do one of these today:</p><ul>' +
        '<li><b>Held it?</b> Submit the record from One-to-ones.</li>' +
        '<li><b>Didn\'t hold it?</b> Mark it not held, with the reason and a new date.</li></ul>' +
        '<p>Items still open after 2 working days are copied to Mohamed.</p><p>CX Helm</p>'
      const st = await pwSendOnce_(sent, 'missed:' + mgr + ':' + today, {
        to: mgr, kind: 'missed_1on1', ref: first.schedule_id,
        subject: '1:1 record needed: ' + dir.name(first.report_email) + ', ' + pwKwDate_(first.scheduled_at),
        htmlBody: html,
      }, JOB_ACTOR)
      if (st !== 'skipped') emailed++
    }
    // 2. The escalation: 2+ working days (holder's calendar) since the planned day, once per item.
    const late: Record<string, any>[] = []
    for (const s of items) {
      if (sent['missed-esc:' + s.schedule_id]) continue
      if ((await pwWorkingDaysBetween(mgr, pwKwDate_(s.scheduled_at), today)) >= 2) late.push(s)
    }
    if (late.length) {
      const cc = dir.admins.filter((a) => a !== mgr)
      const res = (await remindersOn())
        ? await sendMail(
            {
              to: mgr, cc: cc.length ? cc : undefined, kind: 'missed_1on1_escalated', ref: String(late[0].schedule_id),
              subject: '[Escalated] 1:1 records outstanding 2+ working days: ' + dir.name(mgr),
              htmlBody:
                '<p>Hi ' + escapeHtml(pwFirstName_(dir, mgr)) + ',</p><p>This has been outstanding since ' +
                pwKwDate_(late[0].scheduled_at) + ':</p>' + list(late) +
                '<p>Submit each record, or mark it not held with a new date.</p><p>CX Helm</p>',
            },
            JOB_ACTOR,
          )
        : { status: 'skipped_off' }
      await pwAppend_(
        'pw_reminder_log',
        late.map((s) => {
          sent['missed-esc:' + s.schedule_id] = true
          return {
            dedupe_key: 'missed-esc:' + s.schedule_id, kind: 'missed_1on1_escalated',
            recipient: mgr, ref: s.schedule_id, status: res.status,
          }
        }),
        JOB_ACTOR,
      )
      escalated += late.length
      emailed++
    }
  }
  return { marked: newlyMissed.length, excused: excused.length, emailed, escalated }
}

// ---------------------------------------------------------------- daily digest (tasks + outstanding 1:1s)

/** The digest lines for each recipient: { email: { lines: [], escalate: bool } }. Exposed for tests. */
export async function pwDigestItems_(nowMs: number) {
  const ctx = await pwTaskContext_()
  ctx.now = nowMs
  const today = pwToday_(nowMs)
  const out: Record<string, { lines: string[]; escalate: boolean }> = {}
  const add = (email: string, line: string, escalate?: boolean) => {
    const o = (out[email] = out[email] || { lines: [], escalate: false })
    o.lines.push(line)
    if (escalate) o.escalate = true
  }
  const tasks = pwTasksOut_(ctx).filter((t) => pwIsOpenStatus_(t.status))
  for (const t of tasks) {
    const dl = pwKwDate_(t.deadlineAt)
    const label = '"' + String(t.title) + '"'
    if (t.overdue) {
      const late = await pwWorkingDaysBetween(String(t.ownerEmail), dl, today)
      add(String(t.ownerEmail), label + ' is overdue since ' + dl + '.', late >= 2)
      continue
    }
    if (dl === today) add(String(t.ownerEmail), label + ' is due today at ' + pwKwTime_(t.deadlineAt) + '.')
    else if (dl === (await pwAddWorkingDays(String(t.ownerEmail), today, 1)))
      add(String(t.ownerEmail), label + ' is due on ' + dl + ', the next working day.')
    const started = pwKwDate_(t.startAt)
    const tt = t as Record<string, any>
    if (t.progressState === 'not_started' && (await pwWorkingDaysBetween(String(t.ownerEmail), started, today)) >= 2) {
      add(String(t.ownerEmail), label + ' has not started after 2 working days. Post where you stand.')
    } else if (
      tt.milestones.length &&
      (await pwWorkingDaysBetween(String(t.ownerEmail), pwKwDate_(t.lastUpdateAt), today)) >= 3
    ) {
      add(String(t.ownerEmail), label + ' has had no update in 3 working days. Post where you stand.')
    }
    if (!tt.milestones.length && tt.hours.available > 0 && tt.hours.elapsed >= tt.hours.available / 2) {
      add(String(t.ownerEmail), label + ' is past the halfway point of its hours with no update.')
    }
    ;(t.planned as Record<string, any>[]).forEach((p) => {
      if (!p.doneByUpdateId && p.targetDate < today)
        add(String(t.ownerEmail), label + ': planned milestone "' + String(p.label) + '" (' + String(p.targetDate) + ') has passed.')
    })
  }
  const dir = ctx.dir
  const missed = await pwRows_('one_on_one_schedule', (s) => String(s.status) === 'missed')
  missed.forEach((s) => {
    // The cc to Mohamed for these is sent by runMissedOneOnOneCheck_, so no escalation here.
    add(
      normEmail_(s.manager_email),
      '1:1 with ' + dir.name(String(s.report_email)) + ' planned for ' + pwWhen_(s.scheduled_at) + ' still has no record.',
      false,
    )
  })
  return out
}

/** runTaskReminders_ — morning digest: one email per person. Skips non-working days. */
export async function runTaskReminders_(nowMs?: number) {
  const now = nowMs === undefined ? Date.now() : nowMs
  const today = pwToday_(now)
  const dir = await pwDirectory()
  const sent = await pwSentKeys_()
  const items = await pwDigestItems_(now)
  let emailed = 0
  for (const email of Object.keys(items)) {
    const it = items[email]
    if (!(await pwIsWorkingDate(email, today))) continue // their day off or a holiday: the digest waits
    const cc = it.escalate ? dir.admins.filter((a) => a !== email) : []
    const st = await pwSendOnce_(sent, 'digest:' + email + ':' + today, {
      to: email, cc: cc.length ? cc : undefined, kind: 'daily_digest', ref: today,
      subject: (it.escalate ? '[Escalated] ' : '') + 'Your CX follow-ups for ' + today + ' (' + it.lines.length + ')',
      htmlBody:
        '<p>Hi ' + escapeHtml(pwFirstName_(dir, email)) + ',</p><ul>' +
        it.lines.map((l) => '<li>' + escapeHtml(l) + '</li>').join('') +
        '</ul>' + (it.escalate ? '<p>Mohamed is copied because at least one item is 2 or more working days late.</p>' : '') +
        '<p>CX Helm</p>',
    }, JOB_ACTOR)
    if (st !== 'skipped') emailed++
  }
  return { emailed }
}

// ---------------------------------------------------------------- meetings

export async function runMeetingActionReminders_(nowMs?: number) {
  const now = nowMs === undefined ? Date.now() : nowMs
  const today = pwToday_(now)
  const dir = await pwDirectory()
  const sent = await pwSentKeys_()
  const actions = await pwRows_('actions', (a) => a.source_type === 'meeting')
  const updates = await pwRows_('action_updates')
  let emailed = 0
  const next = await pwNextMeetings_(now)
  for (const n of next) {
    const date = pwKwDate_(n.at)
    const open = pwOpenSeriesActions_(String(n.series.series_id), actions)
    if (!open.length) continue
    const title = String(n.series.title)
    const byOwner: Record<string, Record<string, any>[]> = {}
    open.forEach((a) => {
      const k = normEmail_(a.owner_email)
      ;(byOwner[k] = byOwner[k] || []).push(a)
    })
    for (const owner of Object.keys(byOwner)) {
      const wd = await pwWorkingDaysBetween(owner, today, date) // the owner's own working days
      if (wd > 0 && wd <= 2) {
        const st = await pwSendOnce_(sent, 'mtg-pre:' + n.series.series_id + ':' + date + ':' + owner, {
          to: owner, kind: 'meeting_action', ref: n.series.series_id,
          subject: 'Update before ' + title + ', ' + date,
          htmlBody:
            '<p>Hi ' + escapeHtml(pwFirstName_(dir, owner)) + ',</p><p>' + escapeHtml(title) + ' is on ' + pwWhen_(n.at) +
            '. Post a status note on each open action so the review takes seconds:</p><ul>' +
            byOwner[owner]
              .map((a) => '<li>' + escapeHtml(a.title) + ', due ' + pwDateOnly_(a.due_date) + '</li>')
              .join('') +
            '</ul><p>CX Helm</p>',
        }, JOB_ACTOR)
        if (st !== 'skipped') emailed++
      }
    }
    if (date === today) {
      const chair = normEmail_(n.series.chair_email)
      const rows = open
        .map((a) => {
          const ups = updates.filter((u) => String(u.action_id) === String(a.action_id))
          const state = pwDateOnly_(a.due_date) < today ? 'overdue' : ups.length ? 'updated' : 'not updated'
          return (
            '<tr><td>' + escapeHtml(a.title) + '</td><td>' + escapeHtml(dir.name(String(a.owner_email))) + '</td><td>' +
            pwDateOnly_(a.due_date) + '</td><td>' + state + '</td></tr>'
          )
        })
        .join('')
      const st2 = await pwSendOnce_(sent, 'mtg-chair:' + n.series.series_id + ':' + date, {
        to: chair, kind: 'meeting_preread', ref: n.series.series_id,
        subject: 'Pre-read: ' + title + ' today',
        htmlBody:
          '<p>Open actions for today\'s ' + escapeHtml(title) + ':</p><table border="1" cellpadding="4" cellspacing="0">' +
          '<tr><th>Action</th><th>Owner</th><th>Due</th><th>Status</th></tr>' + rows + '</table><p>CX Helm</p>',
      }, JOB_ACTOR)
      if (st2 !== 'skipped') emailed++
    }
  }
  return { emailed }
}

// ------------------------------------------------ trigger entries (PeopleTriggers.js)

/**
 * PeopleTriggers.js job entries, verbatim: requireJobCaller_ + hbRun_('<job>',
 * run*_) — here requireJobCaller() + dqStep_(env, '<job>', run*_). The
 * /api/cron/* routes run the identical step inline; these are the
 * verbatim-named public surface for callers that already hold a JobEnv.
 */
export async function jobMissedOneOnOneCheck(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'missed_1on1_check', () => runMissedOneOnOneCheck_(Date.now()))
}

export async function jobTaskReminders(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'task_reminders', () => runTaskReminders_(Date.now()))
}

export async function jobMeetingActionReminders(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'meeting_reminders', () => runMeetingActionReminders_(Date.now()))
}
