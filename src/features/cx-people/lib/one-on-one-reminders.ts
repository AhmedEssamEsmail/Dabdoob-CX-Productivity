/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim OneOnOneReminders.js
   port: sheet/JSON rows are dynamic records. */
/**
 * OneOnOneReminders.js — the 15-min reminder emails for booked 1:1s, sent to
 * BOTH people (manager and report). The in-app alert half (OneOnOneAlerts.js)
 * lives in shared/platform/notify.ts, which owns pwOoDue/pwOoUpcoming and the
 * poll; this file only keeps the cron job and the reminder-log dedupe helper
 * shared with reminders.ts.
 *
 * Clock: the email needs a clock that runs when nobody has the app open, so the
 * oo_reminders cron calls runOneOnOneReminders_. Locked cadence decision: the
 * legacy 1-minute tick becomes the platform 15-minute cron — any interval
 * below 15 minutes is treated as 15. It stays cheap: a config key holds the
 * next instant anything is due, and until then the tick returns after reading
 * only that property.
 */

import 'server-only'

import { pwKwDate_, pwKwTime_ } from '@/features/shared/lib/adapters'
import { getConfig, setConfig, remindersOn } from '@/features/shared/platform/settings'
import { pwDirectory, requireJobCaller } from '@/features/shared/platform/identity'
import { dqStep_ } from '@/features/shared/jobs/steps'
import type { JobEnv } from '@/features/shared/jobs/env'
import { sendMail, escapeHtml } from '@/features/shared/platform/mail'
import { wcDay } from '@/features/shared/platform/calendar'
import {
  pwOoUpcoming, pwOoDue, pwOoEmailApplies, type OoBooking,
} from '@/features/shared/platform/notify'
import { pwRows_ } from './work-core'
import { pwAppend_ } from './actions'
import { pwOneOnOneCutoff_ } from './one-on-ones'

const OO_REM_NEXT_CONFIG = 'pw_oo_reminder_next_ms'

async function pwOoOn_(key: string): Promise<boolean> {
  const v = await getConfig(key, true)
  return !(v === false || String(v).toLowerCase() === 'false')
}

/** pwSentKeys_ (Reminders.js): the dedupe set of sent reminders. */
export async function pwSentKeys_(): Promise<Record<string, boolean>> {
  const set: Record<string, boolean> = {}
  ;(await pwRows_('pw_reminder_log')).forEach((r) => {
    set[String(r.dedupe_key)] = true
  })
  return set
}

/** pwSendOnce_ — sends once per dedupe key. Returns the Mailer status, or 'skipped'. */
export async function pwSendOnce_(
  sent: Record<string, boolean>,
  key: string,
  msg: Record<string, any>,
  actor: string,
): Promise<string> {
  if (sent[key]) return 'skipped'
  if (!(await remindersOn())) {
    await pwAppend_('pw_reminder_log', [
      {
        dedupe_key: key, kind: msg.kind, ref: msg.ref || '',
        recipient: ([] as unknown[]).concat(msg.to).join(','), status: 'skipped_off',
      },
    ], actor)
    sent[key] = true
    return 'skipped'
  }
  const res = await sendMail(msg as never, actor)
  await pwAppend_('pw_reminder_log', [
    {
      dedupe_key: key, kind: msg.kind, ref: msg.ref || '',
      recipient: ([] as unknown[]).concat(msg.to).join(','), status: res.status,
    },
  ], actor)
  sent[key] = true
  return res.status
}

/** Pure: the next instant an email becomes due after nowMs (Infinity when none). */
export function pwOoNextEmailMs_(
  list: OoBooking[], nowMs: number, sent: Record<string, boolean>,
): number {
  let next = Infinity
  list.forEach((b) => {
    if (b.at <= nowMs || !pwOoEmailApplies(b)) return
    const all = [b.m, b.r].every((e) => sent['oo15|' + b.id + '|' + b.at + '|' + e])
    if (!all) next = Math.min(next, Math.max(nowMs, b.at - 15 * 60000))
  })
  return next
}

/**
 * runOneOnOneReminders_ — the cron's work. Returns { skipped } when nothing can
 * be due yet (config gate), else { emailed, next }. nowMs pins the clock for tests.
 */
export async function runOneOnOneReminders_(nowMs?: number) {
  const now = nowMs === undefined ? Date.now() : nowMs
  if (!(await pwOoOn_('one_on_one_email_15min'))) return { skipped: 'off' }
  const gate = Number(await getConfig(OO_REM_NEXT_CONFIG, 0))
  if (gate && now < gate) return { skipped: 'not due' }
  const list = pwOoUpcoming(now, await pwRows_('one_on_one_schedule'))
  const sent = await pwSentKeys_()
  const actor = 'system:trigger'
  let dir: Awaited<ReturnType<typeof pwDirectory>> | null = null
  let emailed = 0
  const cutoff = await pwOneOnOneCutoff_()
  for (const d of pwOoDue(list, now).filter((d) => d.type === 'email' && !sent[d.key])) {
    dir = dir || (await pwDirectory())
    const day = pwKwDate_(d.b.at)
    let working = true
    try {
      working = (await wcDay(d.email, day)).working
    } catch {
      working = true
    }
    if (!working) {
      // Off or on a holiday: no email, but marked so it is not retried every minute.
      await pwAppend_('pw_reminder_log', [
        { dedupe_key: d.key, kind: 'one_on_one_15min', recipient: d.email, ref: d.b.id, status: 'skipped_off' },
      ], actor)
      sent[d.key] = true
      continue
    }
    const other = d.email === d.b.m ? d.b.r : d.b.m
    const time = pwKwTime_(d.b.at)
    const link = d.email === d.b.m ? '#/one-on-ones?schedule=' + encodeURIComponent(d.b.id) : ''
    await pwSendOnce_(sent, d.key, {
      to: d.email, kind: 'one_on_one_15min', ref: d.b.id,
      subject: '1:1 with ' + dir.name(other) + ' at ' + time + ' Kuwait (in 15 min)',
      htmlBody:
        '<p>Your 1:1 with <b>' + escapeHtml(dir.name(other)) + '</b> starts at <b>' + time + ' Kuwait</b> today (' + day +
        '), ' + d.b.dur + ' minutes.</p>' +
        (d.email === d.b.m
          ? '<p>Open actions from earlier 1:1s come first; the record is due by ' + cutoff + ' Kuwait.</p>'
          : '<p>Bring where your open actions stand.</p>') +
        (link ? '<p>Open Dabdoob CX: ' + link + '</p>' : ''),
    }, actor)
    emailed++
  }
  const next = pwOoNextEmailMs_(list, now, sent)
  // Nothing in the next 24 h: look again in an hour (a booking made by hand in the sheet still gets seen).
  await setConfig(OO_REM_NEXT_CONFIG, String(isFinite(next) ? next : now + 3600000), undefined, actor)
  return { emailed, next: isFinite(next) ? new Date(next).toISOString() : '' }
}

// ------------------------------------------------- trigger entry (OneOnOneReminders.js)

/**
 * jobOneOnOneReminders (OneOnOneReminders.js), verbatim: requireJobCaller_ +
 * hbRun_('oo_reminders', runOneOnOneReminders_) — the /api/cron/oo-reminders
 * route runs the identical step inline; this is the verbatim-named entry for
 * callers that already hold a JobEnv.
 */
export async function jobOneOnOneReminders(env: JobEnv) {
  await requireJobCaller()
  return dqStep_(env, 'oo_reminders', () => runOneOnOneReminders_(Date.now()))
}
