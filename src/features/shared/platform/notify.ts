/**
 * Notification engine — port of original_deprecated/Notify.js, plus the in-app
 * 1:1 alerts poll of OneOnOneAlerts.js (there is no dedicated alerts file; this
 * module is "the ONE place that tells people something").
 *
 * notify() sends one email (through sendMail — dry-run, mail_log and quota rules
 * apply) and, when asked, opens login pop-ups (raisePopup — deduplicated per
 * recipient + kind + ref). A notification never breaks the action that caused
 * it: failures are logged and reported, not thrown.
 */

import 'server-only'

import { db, cacheGet, cachePut } from './repo'
import { pwMs } from './time'
import { sendMail, escapeHtml } from './mail'
import { raisePopup } from './popups'
import { normEmail, currentEmail, pwDirectory } from './identity'
import { assertWritable } from './viewas'
import { getConfig, appUrls, ccApp, remindersOn } from './settings'

export interface NotifyInput {
  to: string | string[]
  cc?: string | string[]
  subject: string
  /** Plain text, first paragraph. */
  intro: string
  /** Shown as a small table. */
  facts?: [string, unknown][]
  /** Plain text, last paragraph. */
  outro?: string
  /** Where to act in CX Helm, e.g. 'Quality > My audits'. */
  where?: string
  kind?: string
  ref?: string
  popups?: { recipient: string; kind: string; ref?: string; title: string; body?: string; link?: string }[]
}

export interface NotifyResult {
  mail: 'sent' | 'dry_run' | 'blocked' | 'failed' | 'skipped'
  popups: number
  error?: string
}

/** notify_ verbatim semantics. */
export async function notify(n: NotifyInput, actor: string): Promise<NotifyResult> {
  await assertWritable() // outside the try below: View as must refuse, not log a failed mail and carry on
  const out: NotifyResult = { mail: 'skipped', popups: 0 }
  try {
    const to = ([] as unknown[]).concat((n.to || []) as unknown[]).map(normEmail).filter(String)
    const cc = ([] as unknown[])
      .concat((n.cc || []) as unknown[])
      .map(normEmail)
      .filter((e) => e && to.indexOf(e) === -1)
    if (to.length && n.subject) {
      let url = ''
      try {
        url = String((await appUrls())[ccApp()] || '')
      } catch {
        /* no config */
      }
      const r = await sendMail(
        {
          to,
          cc: cc.length ? cc : undefined,
          subject: n.subject,
          htmlBody: notifyHtml(n, url),
          kind: n.kind || 'notify',
          ref: n.ref || '',
        },
        actor
      )
      out.mail = r.status
      if (r.error) out.error = r.error
    }
  } catch (e) {
    out.mail = 'failed'
    out.error = String((e as Error)?.message || e)
    console.log('notify mail failed (' + (n.kind || '') + '): ' + out.error)
  }
  for (const p of n.popups || []) {
    try {
      if (!p || !p.recipient) continue
      await raisePopup(p, actor)
      out.popups++
    } catch (e2) {
      console.log('notify pop-up failed (' + p.kind + '): ' + (e2 as Error).message)
    }
  }
  return out
}

/** The email body (notifyHtml_): short paragraphs and a fact table, every value escaped. */
export function notifyHtml(n: NotifyInput, appUrl = ''): string {
  const p = (t: string | undefined) => (t ? '<p style="margin:0 0 12px">' + escapeHtml(t) + '</p>' : '')
  const rows = (n.facts || [])
    .filter((f) => f && f[1] !== '' && f[1] !== null && f[1] !== undefined)
    .map(
      (f) =>
        '<tr><td style="padding:4px 12px 4px 0;color:#555">' +
        escapeHtml(f[0]) +
        '</td><td style="padding:4px 0">' +
        escapeHtml(f[1]) +
        '</td></tr>'
    )
    .join('')
  const where = n.where ? 'Open Dabdoob CX' + (appUrl ? ' (' + appUrl + ')' : '') + ', then ' + n.where + '.' : ''
  return (
    '<div style="font-family:Arial,sans-serif;font-size:14px;color:#1a1a1a">' +
    p(n.intro) +
    (rows ? '<table style="border-collapse:collapse;margin:0 0 12px">' + rows + '</table>' : '') +
    p(n.outro) +
    p(where) +
    '</div>'
  )
}

// ---------------------------------------------------------------- in-app 1:1 alerts (OneOnOneAlerts.js)

export const OO_REM_WINDOW_MS = 15 * 60000
/** How long after the start the start alert is still shown (a poll every minute catches it). */
export const OO_REM_START_GRACE_MS = 15 * 60000
const OO_REM_CACHE_KEY = 'pw:oo-upcoming'
const OO_SEEN_TTL_S = 6 * 3600

export interface OoBooking {
  id: string
  m: string
  r: string
  at: number
  dur: number
  bookedAt: number
}

export interface OoDue {
  type: 'email' | 'soon' | 'start'
  key: string
  email: string
  b: OoBooking
}

async function pwOoOn(key: string): Promise<boolean> {
  const v = await getConfig(key, true)
  return !(v === false || String(v).toLowerCase() === 'false')
}

/** Booked (status scheduled) 1:1s from now - grace to now + 24 h, compact (pwOoUpcoming_). */
export function pwOoUpcoming(nowMs: number, rows: Record<string, unknown>[]): OoBooking[] {
  return rows
    .filter((s) => {
      if (String(s.status) !== 'scheduled') return false
      const at = pwMs(s.scheduled_at)
      return !isNaN(at) && at >= nowMs - OO_REM_START_GRACE_MS && at <= nowMs + 24 * 3600000
    })
    .map((s) => ({
      id: String(s.schedule_id),
      m: normEmail(s.manager_email),
      r: normEmail(s.report_email),
      at: pwMs(s.scheduled_at),
      dur: Number(s.duration_min) || 30,
      bookedAt: pwMs(s.submitted_at || s.booked_at),
    }))
}

/** The same list for the poll: from the process cache when fresh (2 min), else one read. */
export async function pwOoUpcomingCached(nowMs: number): Promise<OoBooking[]> {
  const hit = cacheGet(OO_REM_CACHE_KEY)
  if (hit) {
    const c = JSON.parse(hit) as { from: number; rows: OoBooking[] }
    if (c.from <= nowMs && nowMs - c.from < 3600000) return c.rows
  }
  const { data, error } = await db()
    .from('one_on_one_schedule')
    .select('schedule_id, manager_email, report_email, scheduled_at, duration_min, status, submitted_at, booked_at')
    .eq('status', 'scheduled')
  const rows = pwOoUpcoming(nowMs, error ? [] : (data as Record<string, unknown>[]))
  cachePut(OO_REM_CACHE_KEY, JSON.stringify({ from: nowMs, rows }), 120)
  return rows
}

/** True when the 15-min email applies: booked at least 15 min before the start. */
export function pwOoEmailApplies(b: OoBooking): boolean {
  return isNaN(b.bookedAt) || b.bookedAt <= b.at - OO_REM_WINDOW_MS
}

/**
 * Pure (pwOoDue_): the reminders due at nowMs for the bookings list.
 *   email  when at - 15 min <= now < at, and it was booked at least 15 min ahead
 *   soon   in-app, same window
 *   start  in-app, at <= now < at + 15 min
 * One entry per person (manager and report), keyed so it fires once per 1:1 per person.
 */
export function pwOoDue(list: OoBooking[], nowMs: number): OoDue[] {
  const out: OoDue[] = []
  list.forEach((b) => {
    ;[b.m, b.r].forEach((email) => {
      const base = b.id + '|' + b.at + '|' + email
      if (nowMs >= b.at - OO_REM_WINDOW_MS && nowMs < b.at) {
        if (pwOoEmailApplies(b)) out.push({ type: 'email', key: 'oo15|' + base, email, b })
        out.push({ type: 'soon', key: 'oosoon|' + base, email, b })
      }
      if (nowMs >= b.at && nowMs < b.at + OO_REM_START_GRACE_MS) {
        out.push({ type: 'start', key: 'oostart|' + base, email, b })
      }
    })
  })
  return out
}

function pwOoSeenKey(email: string): string {
  return 'pw:oo-seen:' + email
}

export function pwOoSeen(email: string): Record<string, number> {
  const hit = cacheGet(pwOoSeenKey(email))
  return hit ? (JSON.parse(hit) as Record<string, number>) : {}
}

export interface OoAlert {
  key: string
  type: 'soon' | 'start'
  scheduleId: string
  startAt: string
  durationMin: number
  withName: string
  holder: boolean
  link: string
}

/** The poll (oneOnOneAlerts): in-app 1:1 alerts due now for the signed-in person only. */
export async function oneOnOneAlerts(): Promise<{ now: string; alerts: OoAlert[] }> {
  return oneOnOneAlertsFor(await currentEmail())
}

/** oneOnOneAlertsFor: the same due-alerts computation for a known email (merged /api/popups poll). */
export async function oneOnOneAlertsFor(email: string): Promise<{ now: string; alerts: OoAlert[] }> {
  const now = Date.now()
  if (!(await remindersOn())) return { now: new Date(now).toISOString(), alerts: [] }
  const soonOn = await pwOoOn('one_on_one_inapp_15min')
  const startOn = await pwOoOn('one_on_one_inapp_start')
  if (!soonOn && !startOn) return { now: new Date(now).toISOString(), alerts: [] }
  const seen = pwOoSeen(email)
  const upcoming = (await pwOoUpcomingCached(now)).filter((b) => b.m === email || b.r === email)
  const due = pwOoDue(upcoming, now).filter(
    (d) => d.email === email && !seen[d.key] && ((d.type === 'soon' && soonOn) || (d.type === 'start' && startOn))
  )
  const dir = due.length ? await pwDirectory() : null
  return {
    now: new Date(now).toISOString(),
    alerts: due.map((d) => {
      const holder = d.email === d.b.m
      const other = dir ? dir.name(holder ? d.b.r : d.b.m) : ''
      return {
        key: d.key,
        type: d.type as 'soon' | 'start',
        scheduleId: d.b.id,
        startAt: new Date(d.b.at).toISOString(),
        durationMin: d.b.dur,
        withName: other,
        holder,
        link: holder ? '#/one-on-ones?schedule=' + encodeURIComponent(d.b.id) : '',
      }
    }),
  }
}

/** The person dismissed these alerts: they do not come back (oneOnOneAlertsSeen). */
export async function oneOnOneAlertsSeen(keys: unknown): Promise<{ ok: boolean }> {
  const email = await currentEmail()
  const seen = pwOoSeen(email)
  ;([] as unknown[])
    .concat((keys || []) as unknown[])
    .slice(0, 20)
    .forEach((k) => {
      const key = String(k)
      if (key.split('|')[3] === email) seen[key] = Date.now() // only their own keys
    })
  cachePut(pwOoSeenKey(email), JSON.stringify(seen), OO_SEEN_TTL_S)
  return { ok: true }
}
