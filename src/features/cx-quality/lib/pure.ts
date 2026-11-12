/**
 * Quality pure helpers (cont.) — port of Quality_deprecated/Quality.js:
 * queue time fields, submission scoring, queue rows, coverage and the
 * analytics payload / drill / range builders. Sheet reads become arguments;
 * settings come from a Cfg map.
 */

import 'server-only'
import {
  normEmail_,
  dqAddDays_,
} from '@/features/shared/lib/adapters'
import {
  qaQuestions_, qaScore_, qaPeriodOf_,
  qaIsNonTicket_, qaItemRef_, qaItemTag_, qaNameKey_, qaMatchAgent_, qaWhen_,
  qaCtlDue_,
  QA_ANSWERS, QA_FAIL_REASONS,
} from './core'
import { qeFmt_, qeQuotaFor_, qeCanonAgent_ } from './engine'
import { CX_AGENT_POSITION, dqTitleLevel_ } from '@/features/shared/platform/identity'

/** Engine Riyadh times ("yyyy-MM-dd HH:mm") stored as text with a leading apostrophe. */
export const QA_QUEUE_TIME_FIELDS = ['interaction_at', 'action_at']
export function qaTimesAsText_(row: Record<string, unknown>): Record<string, unknown> {
  QA_QUEUE_TIME_FIELDS.forEach((k) => {
    const v = String(row[k] === undefined || row[k] === null ? '' : row[k])
    if (v && v.charAt(0) !== "'") row[k] = "'" + v
  })
  return row
}

/** A queue time to store on another row: Riyadh text, "'"-prefixed; '' when there is none. */
export function qaTextTime_(v: unknown): string {
  const s = qaWhen_(v)
  return s ? "'" + s : ''
}

/**
 * The interaction date+time the auditor enters on every audit, Riyadh "yyyy-MM-dd HH:mm"
 * (a datetime-local "T" is accepted). Required, a real time, not in the future, within 180 days.
 */
export function qaCleanInteractionAt_(v: unknown, nowMs?: number): string {
  const s = String(v || '')
    .trim()
    .replace('T', ' ')
  if (!s) throw new Error('Enter the interaction date and time.')
  const d = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/.test(s) ? new Date(s.replace(' ', 'T') + ':00+03:00') : null
  if (!d || isNaN(d.getTime()) || qeFmt_(d, 'yyyy-MM-dd HH:mm') !== s) throw new Error('The interaction date and time is not valid (use yyyy-MM-dd HH:mm).')
  const now = nowMs === undefined ? Date.now() : nowMs
  if (d.getTime() > now + 5 * 60000) throw new Error('The interaction date and time is in the future.')
  if (d.getTime() < now - 180 * 864e5) throw new Error('The interaction date and time is more than 180 days ago.')
  return "'" + s
}

/** Offqueue audits enter only the interaction day: "yyyy-MM-dd" (a stray datetime degrades to its date). */
export function qaCleanInteractionDate_(v: unknown, nowMs?: number): string {
  const s = String(v || '')
    .trim()
    .replace('T', ' ')
    .split(' ')[0]
  if (!s) throw new Error('Enter the interaction date (yyyy-MM-dd).')
  const d = /^\d{4}-\d{2}-\d{2}$/.test(s) ? new Date(s + 'T00:00:00+03:00') : null
  if (!d || isNaN(d.getTime()) || qeFmt_(d, 'yyyy-MM-dd') !== s) throw new Error('The interaction date is not valid (use yyyy-MM-dd).')
  const now = nowMs === undefined ? Date.now() : nowMs
  if (d.getTime() > now + 5 * 60000) throw new Error('The interaction date is in the future.')
  if (d.getTime() < now - 180 * 864e5) throw new Error('The interaction date is more than 180 days ago.')
  return "'" + s
}

export const QA_QUEUE_ENGINE_FIELDS = [
  'channel', 'contact_type', 'tier', 'log_key', 'ticket_status', 'interaction_at', 'action_at', 'agent_status', 'agent_status_log',
]

/** Copies the engine-derived fields of a queue row (from the Queue Log) onto a qa_queue row. */
export function qaQueueFields_(row: Record<string, unknown>, f: Record<string, unknown>): Record<string, unknown> {
  QA_QUEUE_ENGINE_FIELDS.forEach((k) => {
    if (f[k] !== undefined) row[k] = f[k]
  })
  return row
}

/** Shared queue: an item is someone else's only once they have started it. Admin can always continue. */
export function qaTakenByOther_(q: Record<string, unknown>, user: { email: string; role: string }): boolean {
  return user.role !== 'admin' && !!q.started_at && q.status !== 'done' && normEmail_(q.auditor_email) !== user.email
}

/** Pure: may this question be answered N/A? Not when critical, unless optional or Call Control. */
export function qaNaAllowed_(def: { scoring?: string } | null | undefined, q: { fatal: boolean; weight: number; optional: boolean; section: string }): boolean {
  const critical = q.fatal || (def && def.scoring === 'deduction' && q.weight >= 100)
  return !critical || q.optional || q.section === 'Call Control'
}

/** Validates answers against the form and scores them. Shared by audits and calibration audits. */
export function qaScoreSubmission_(
  forms: { byKey: Record<string, { formId?: string; version?: number; sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] }> },
  formId: unknown,
  version: unknown,
  answers?: Record<string, string>
): { form: Record<string, unknown>; answers: Record<string, string>; result: ReturnType<typeof qaScore_> } {
  const f = forms.byKey[String(formId) + '|' + Number(version)]
  if (!f) throw new Error('That form version is not available. Reload the page.')
  const clean: Record<string, string> = {}
  qaQuestions_(f).forEach((q) => {
    const a = (answers || {})[q.id]
    if (a === 'na' && !qaNaAllowed_(f as { scoring?: string }, q)) throw new Error('"' + q.text.slice(0, 80) + '" is critical: answer Pass or Fail (N/A is not allowed).')
    if (QA_ANSWERS.indexOf(a) !== -1) clean[q.id] = a
  })
  const s = qaScore_(f, clean)
  if (s.missing.length) throw new Error('Answer every question (' + s.missing.length + ' left).')
  if (s.score === null) throw new Error('Mark at least one scored question pass or fail.')
  return { form: f as unknown as Record<string, unknown>, answers: clean, result: s }
}

/** Pure: the reason tag of every failed question, required for each one. */
export function qaCleanFailReasons_(answers: Record<string, string>, reasons?: Record<string, unknown>): Record<string, string> {
  const out: Record<string, string> = {}
  let missing = 0
  Object.keys(answers || {}).forEach((id) => {
    if (answers[id] !== 'fail') return
    const r = String((reasons || {})[id] || '')
    if (QA_FAIL_REASONS.indexOf(r) === -1) missing++
    else out[id] = r
  })
  if (missing) throw new Error('Choose why each failed question failed (' + missing + ' left).')
  return out
}

/** A new open CTL row for an audit, due qa_ctl_days working days from `today` (more over a day off). */
export function qaNewCtl_(
  audit: Record<string, unknown>,
  tlEmail: string,
  today: string,
  now: string,
  by: string,
  ctlDays: number,
  ctlDaysOverWeekend: number,
  isWorking: (d: string) => boolean,
  newId: (p: string) => string
): Record<string, unknown> {
  return {
    ctl_id: newId('CTL'), audit_id: audit.audit_id, agent_email: normEmail_(audit.agent_email), tl_email: normEmail_(tlEmail), opened_date: today,
    due_date: qaCtlDue_(today, isWorking, ctlDays || 2, ctlDaysOverWeekend || 3),
    status: 'open', coaching_notes: '', action: '', submitted_at: '', submitted_date: '', sla_met: '', agent_confirmed_at: '', agent_note: '',
    reminded_date: '', updated_at: now, updated_by: by, outcome: '', dispute_id: '', reopened_at: '', reopen_count: 0,
  }
}

/** The TL's pop-up for an open CTL (kind 'qa_ctl_due', ref ctl_id). */
export function qaCtlPopup_(c: Record<string, unknown>, agentName: string, item: string): Record<string, unknown> {
  return {
    recipient: normEmail_(c.tl_email), kind: 'qa_ctl_due', ref: c.ctl_id, title: 'Open CTL: ' + agentName,
    body: 'Go through the audit of ' + item + ' with ' + agentName + ' and submit the CTL by ' + c.due_date + '.', link: '#/ctls',
  }
}

/** A new CTL's pop-ups: the agent's own TL AND every TL on shift now (shift_tls), once each. */
export function qaCtlPopups_(
  c: Record<string, unknown>,
  agentName: string,
  item: string,
  dir: { name: (e: unknown) => string },
  onShift: string[]
): Record<string, unknown>[] {
  const own = qaCtlPopup_(c, agentName, item)
  return [own].concat(
    onShift
      .filter((e) => e !== own.recipient)
      .map((e) => ({
        recipient: e,
        kind: 'qa_ctl_due',
        ref: c.ctl_id,
        title: 'New CTL on your shift: ' + agentName,
        body: agentName + "'s audit of " + item + ' needs a CTL by ' + c.due_date + '. Owner: ' + dir.name(c.tl_email) + '; you can close it while on shift.',
        link: '#/ctls',
      }))
  )
}

/**
 * The audit-result email: to the agent, their team lead in copy. Returns { n: notify input, skip }.
 * Pure apart from dir lookups.
 */
export function qaAuditMail_(
  a: Record<string, unknown>,
  lost: string[],
  comment: string,
  auditorName: string,
  ctl: Record<string, unknown> | null,
  dir: { name: (e: unknown) => string },
  enabled: boolean
): { n: Record<string, unknown> | null; skip: string } {
  const agent = normEmail_(a.agent_email)
  const tl = normEmail_(a.tl_email)
  if (!enabled) return { skip: 'switched off', n: null }
  if (!agent && !tl) return { skip: 'no agent or team lead email', n: null }
  const who = agent ? dir.name(agent) : 'the agent'
  const n = {
    to: agent || tl,
    cc: agent && tl ? [tl] : [],
    kind: 'qa_audit',
    ref: a.audit_id,
    subject: 'Audit result: ' + qaItemTag_(a) + ' (' + a.score + '%)',
    intro: (agent ? who + ', ' : '') + auditorName + ' audited ' + (agent ? 'your' : who + "'s") + ' ' + qaItemRef_(a) + '.',
    facts: [
      [qaIsNonTicket_(a) ? 'Audited' : 'Ticket', qaItemTag_(a) + ', ' + a.channel],
      ['Audit date', a.audit_date],
      ['Auditor', auditorName],
      ['Score', a.score + '%' + (a.fatal ? ', a critical question failed' : '')],
      ['Lost marks on', lost.join('; ') || 'Nothing: full marks'],
      ['Auditor note', comment],
      ['CTL with the team lead by', ctl ? ctl.due_date : ''],
    ],
    outro: ctl
      ? 'The team lead' + (ctl.tl_email ? ' ' + dir.name(ctl.tl_email) : '') + ' will go through this audit with ' + (agent ? 'you' : who) + ' (CTL). If you disagree with it, say so in that session: the team lead can raise a dispute.'
      : 'Full marks: nothing to do.',
    where: 'Quality > My audits',
  }
  return { n: n as unknown as Record<string, unknown>, skip: !agent ? 'no agent email' : !tl ? 'no team lead' : '' }
}

// ---- Weekly audit quota ----

export const QA_QUOTA_WEEKS = 8

/**
 * Per agent, this quota week (weekStart = qeWeekKeyFor_, Sunday start): audits done, how many of
 * them were requested, requests still waiting, and what remains of the quota. Pure.
 */
export function qaWeekQuota_(
  agents: { email: string; name: string }[],
  audits: Record<string, unknown>[],
  queueRows: Record<string, unknown>[],
  weekStart: string,
  quotaOf: (n: string) => { perWeek: number; perDay: number }
): Record<string, unknown>[] {
  const weekEnd = dqAddDays_(weekStart, 6)
  const by: Record<string, { email: string; name: string; quota: number; perDay: number; done: number; requested: number; waiting: number; remaining: number; days: number[] }> = {}
  const start = Date.parse(weekStart)
  const out = agents.map((p) => {
    const q = quotaOf(p.name)
    const r = (by[p.email] = { email: p.email, name: p.name, quota: q.perWeek, perDay: q.perDay, done: 0, requested: 0, waiting: 0, remaining: 0, days: [0, 0, 0, 0, 0, 0, 0] })
    return r
  })
  audits.forEach((a) => {
    const r = by[normEmail_(a.agent_email)]
    const d = String(a.audit_date || '').slice(0, 10)
    if (!r || a.kind === 'calibration' || a.source === 'offqueue' || d < weekStart || d > weekEnd) return
    r.done++
    r.days[Math.round((Date.parse(d) - start) / 864e5)]++
    if (a.source === 'request') r.requested++
  })
  queueRows.forEach((q) => {
    const r = by[normEmail_(q.agent_email)]
    if (r && (q.source === 'request' || qaIsNonTicket_(q)) && (q.status === 'open' || q.status === 'in_progress')) r.waiting++
  })
  out.forEach((r) => {
    r.remaining = Math.max(0, r.quota - r.done)
  })
  return out.sort((a, b) => b.remaining - a.remaining || a.name.localeCompare(b.name))
}

/** The auditor's own audits (calibrations not): this quota week and this calendar month of `today`. Pure. */
export function qaMyAuditCounts_(audits: Record<string, unknown>[], email: string, weekStart: string, today: string): { week: number; month: number } {
  const weekEnd = dqAddDays_(weekStart, 6)
  const month = String(today).slice(0, 7)
  const out = { week: 0, month: 0 }
  const e = normEmail_(email)
  audits.forEach((a) => {
    if (a.kind === 'calibration' || normEmail_(a.auditor_email) !== e) return
    const d = String(a.audit_date || '').slice(0, 10)
    if (d.slice(0, 7) === month) out.month++
    if (d >= weekStart && d <= weekEnd) out.week++
  })
  return out
}

// ---- Requests ----

export const QA_REQUEST_OPEN = ['open', 'in_progress']

export function qaCanWaive_(user: { email: string; role: string }, waiverEmails: string[]): boolean {
  return user.role === 'admin' || waiverEmails.indexOf(normEmail_(user.email)) !== -1
}

/** A request or waive reason: 5 to 500 characters after trimming. Throws otherwise. Pure. */
export function qaCleanReason_(reason: unknown, what: string): string {
  const r = String(reason === null || reason === undefined ? '' : reason)
    .replace(/\s+/g, ' ')
    .trim()
  if (r.length < 5) throw new Error('Say why you are ' + what + ' (at least 5 characters).')
  if (r.length > 500) throw new Error('Keep the reason under 500 characters.')
  return r
}

/** Request rows for the page: every open one, plus those done or waived since `from`. */
export function qaRequestRows_(
  all: Record<string, unknown>[],
  dir: { name: (e: unknown) => string },
  user: { email: string; role: string },
  from: string
): Record<string, unknown>[] {
  return all
    .filter((q) => q.source === 'request' && (QA_REQUEST_OPEN.indexOf(String(q.status)) !== -1 || String(q.queue_date) >= from))
    .map((q) => ({
      queueId: String(q.queue_id), date: String(q.queue_date), ticketId: String(q.ticket_id), agentEmail: String(q.agent_email),
      agentName: String(q.agent_name || dir.name(q.agent_email)), tlEmail: String(q.tl_email || ''), tlName: q.tl_email ? dir.name(q.tl_email) : '',
      channel: String(q.channel), contactType: String(q.contact_type || ''), ticketStatus: String(q.ticket_status || ''),
      status: String(q.status || 'open'), startedAt: String(q.started_at || ''), auditId: String(q.audit_id || ''),
      auditorName: q.started_at ? dir.name(q.auditor_email) : '', takenByOther: qaTakenByOther_(q, user),
      requestedByName: dir.name(q.requested_by), requestedAt: String(q.requested_at || ''), requestReason: String(q.request_reason || ''),
      waivedByName: q.waived_by ? dir.name(q.waived_by) : '', waivedAt: String(q.waived_at || ''), waiveReason: String(q.waive_reason || ''),
    }))
    .sort(
      (a, b) =>
        Number(QA_REQUEST_OPEN.indexOf(String(a.status)) === -1) - Number(QA_REQUEST_OPEN.indexOf(String(b.status)) === -1) ||
        String(a.requestedAt).localeCompare(String(b.requestedAt))
    )
}

/**
 * Requests of this quota week not waived, by the engine's agent key (qeCanonAgent_ of the roster name).
 * rows: qa_queue; weekStart: yyyy-MM-dd. Pure.
 */
export function qaRequestedTakenFor_(rows: Record<string, unknown>[], weekStart: string): Record<string, number> {
  const out: Record<string, number> = {}
  rows.forEach((q) => {
    if (!(q.source === 'request' || qaIsNonTicket_(q)) || q.status === 'waived' || q.status === 'passed' || String(q.queue_date) < weekStart) return
    const k = qeCanonAgent_(q.agent_name)
    if (k) out[k] = (out[k] || 0) + 1
  })
  return out
}

/** A new hand-added ticket qa_queue row from the ticket target. Pure apart from the id. */
export function qaTicketQueueRow_(
  t: { ticket: string; detail: Record<string, unknown>; agent: { email: string; name: string }; channel: string },
  dir: { managerOf: (e: string) => string | null },
  prefix: string,
  source: string,
  by: string,
  now: string,
  why: string,
  today: string,
  newId: (p: string) => string
): Record<string, unknown> {
  const d = t.detail
  return {
    queue_id: newId(prefix), queue_date: today, ticket_id: t.ticket, agent_email: normEmail_(t.agent.email), agent_name: t.agent.name,
    tl_email: normEmail_(dir.managerOf(t.agent.email) || ''), channel: t.channel, contact_type: d.l3 || d.l2 || d.l1 || '', tier: '',
    auditor_email: '', status: 'open', started_at: '', audit_id: '', imported_at: now, ticket_status: d.status || '',
    source, requested_by: by, requested_at: now, request_reason: why,
  }
}

/** A reference or note, whitespace collapsed. Pure. */
export function qaSquash_(v: unknown): string {
  return String(v === null || v === undefined ? '' : v)
    .replace(/\s+/g, ' ')
    .trim()
}

/** The open or audited non-ticket row with this type and reference, or null. Pure. */
export function qaNonTicketClash_(rows: Record<string, unknown>[], type: string, reference: string): Record<string, unknown> | null {
  const t = qaSquash_(type).toLowerCase()
  const ref = qaSquash_(reference).toLowerCase()
  return (
    rows.filter(
      (q) =>
        qaIsNonTicket_(q) &&
        qaSquash_(q.audit_type).toLowerCase() === t &&
        qaSquash_(q.reference).toLowerCase() === ref &&
        (QA_REQUEST_OPEN.indexOf(String(q.status)) !== -1 || q.status === 'done')
    )[0] || null
  )
}

/** A new non-ticket qa_queue row. agent { email, name }; by = who added it. Pure. */
export function qaNonTicketRow_(
  type: string,
  reference: string,
  agent: { email: string; name: string },
  tlEmail: string,
  note: string,
  by: string,
  source: string,
  now: string,
  today: string,
  newId: (p: string) => string
): Record<string, unknown> {
  return {
    queue_id: newId('QAM'), queue_date: today, ticket_id: '', agent_email: normEmail_(agent.email), agent_name: agent.name,
    tl_email: normEmail_(tlEmail || ''), channel: type, contact_type: '', tier: '', auditor_email: '', status: 'open', started_at: '', audit_id: '',
    imported_at: now, source, requested_by: by, requested_at: now, request_reason: note, audit_type: type, reference,
  }
}

export function qaQueueClosed_(status: string): number {
  return status === 'done' || status === 'passed' ? 1 : 0
}

export const QA_PASS_REASONS = [
  'Wrong agent: someone else handled it', 'Not a real interaction (spam, test, duplicate)',
  'Nothing to audit (no customer contact)', 'Ticket details incomplete',
]

/** A pass reason: 5 to 500 characters after trimming. Throws otherwise. Pure. */
export function qaCleanPassReason_(reason: unknown): string {
  const r = String(reason === null || reason === undefined ? '' : reason)
    .replace(/\s+/g, ' ')
    .trim()
  if (r.length < 5) throw new Error('Say why you are passing this ticket (at least 5 characters).')
  if (r.length > 500) throw new Error('Keep the reason under 500 characters.')
  return r
}

/** Today's queue items an auditor has started, by Queue Log Key. */
export function qaStartedLogKeys_(rows: Record<string, unknown>[], today: string): Record<string, boolean> {
  const keep: Record<string, boolean> = {}
  rows.forEach((q) => {
    if (q.status === 'in_progress' && q.log_key && q.queue_date === today) keep[String(q.log_key)] = true
  })
  return keep
}

/** Why an active roster person can audit: 'team lead', 'position "<keyword>"', 'granted', or ''. Pure. */
export function qaAuditorVia_(p: { email: string; role: string; position?: string }, keys: string[], granted: string[]): string {
  if (granted.indexOf(p.email) !== -1) return 'granted'
  if (dqTitleLevel_(p.position, p.role) === 'tl') return 'team lead'
  const pos = String(p.position || '').toLowerCase()
  const k = keys.filter((w) => pos.indexOf(w) !== -1)[0]
  return k ? 'position "' + k + '"' : ''
}

/** A KB gap's ticket_id holds the ticket number, or the non-ticket label (qaItemId_): prefix only the number. Pure. */
export function qaKbItem_(g: Record<string, unknown>, prefix: string): string {
  const t = String(g.ticket_id || '')
  return /^\d+$/.test(t) ? prefix + t : t
}

// ---- Coverage (Quality.js 3053-3179) ----

export const QA_COVERAGE_DAYS = 30

/**
 * Why an agent-day is under the offer, in words. o: that day's outcome for the agent, or null;
 * day: that day's outcome record, or null; built: a build ran that day (null: unknown);
 * firstRec: the first day with outcomes; date: the day. Pure.
 */
export function qaQueuedReason_(
  o: Record<string, unknown> | null,
  day: { lb?: unknown; min?: unknown } | null,
  built: boolean | null,
  firstRec: string,
  date: string
): string {
  if (!day) {
    if (built === null) return 'Reason not recorded: the old Quality Queue app built the queue.'
    if (!built) return 'No queue build ran that day.'
    if (firstRec && date >= firstRec) return 'A build ran that day but its per-agent outcome was not recorded.'
    return 'Reason not recorded: per-agent build outcomes are kept from ' + (firstRec || 'the next build') + ' on.'
  }
  const win = day.lb ? 'the ' + day.lb + '-day window' : 'the build window'
  if (!o) return "Not in that day's build: no ticket touches by them in " + win + ' (or their Freshdesk name and email match no one on the roster).'
  const drops = Object.keys((o.d || {}) as Record<string, number>)
    .sort((a, b) => (o.d as Record<string, number>)[b] - (o.d as Record<string, number>)[a])
    .map((k) => k + ' ' + (o.d as Record<string, number>)[k])
  const nDrop = Object.keys((o.d || {}) as Record<string, number>).reduce((s, k) => s + (o.d as Record<string, number>)[k], 0)
  const detail =
    ' (touched ' + o.t + ' in ' + win + '; dropped ' + nDrop + (drops.length ? ': ' + drops.join(', ') : '') +
    '; already offered before: ' + Math.max(0, Number(o.p) - Number(o.f)) + ')'
  switch (o.r) {
    case 'none': return o.t ? 'No eligible ticket left' + detail + '.' : 'Touched no tickets in ' + win + '.'
    case 'min': return 'Only ' + o.f + ' fresh ticket' + (o.f === 1 ? '' : 's') + '; the minimum to be sampled is ' + day.min + detail + '.'
    case 'cf': return 'No customer-facing ticket among ' + o.f + ' fresh; one is required to be sampled' + detail + '.'
    case 'week': return 'Weekly offer cap reached: ' + o.w + ' of ' + o.c + ' already queued this week.'
    case 'capped': return 'Weekly offer cap: only ' + o.s + ' left this week (' + o.w + ' of ' + o.c + ' queued).'
    case 'today': return 'An earlier build that day had already queued ' + o.y + '.'
    case 'pool': return 'Queued ' + o.k + ' of ' + o.s + ': only ' + o.f + ' fresh ticket' + (o.f === 1 ? '' : 's') + detail + '.'
    case 'channel': return 'Queued ' + o.k + ' of ' + o.s + ': the channel weights left no eligible channel for the rest (' + o.f + ' fresh tickets).'
    default: return 'The build queued ' + (o.k || 0) + (o.y ? ' after ' + o.y + ' already queued' : '') + '; fewer are in the Queue Log now.'
  }
}

/**
 * Pure: per agent per day over the `days` dates ending todayKey (Quality.js qaCoverage_).
 * values: the Queue Log with its header row. Every active CX Agent on the roster appears;
 * a log agent not on that list is added. hist = { outcomes, builds } or null (old app).
 * dateFmt formats a Date cell as yyyy-MM-dd in the engine tz (qeFmt_ when not given).
 */
export function qaCoverage_(
  values: unknown[][],
  people: { email: string; name: string; role: string; tlEmail?: string | null; position?: string }[],
  headcount: { email: string; fdId?: string; fdName?: string }[],
  S: Record<string, unknown>,
  todayKey: string,
  days: number,
  hist: { outcomes: { date: string; ranAt: string; outcomes: Record<string, unknown> }[]; builds: Record<string, boolean> } | null,
  dateFmt?: (d: Date) => string
): Record<string, unknown> {
  let hi = -1
  for (let h = 0; h < Math.min(values.length, 4); h++) {
    const line = (values[h] || []).map((v) => String(v).trim())
    if (line.indexOf('Agent') !== -1 && line.indexOf('State') !== -1) {
      hi = h
      break
    }
  }
  if (values.length && hi === -1) throw new Error('The Queue Log has no header row with "Agent" and "State".')
  const head = hi === -1 ? [] : (values[hi] || []).map((v) => String(v).trim())
  const col = (n: string) => head.indexOf(n)
  const cAgent = col('Agent')
  const cState = col('State')
  const cQd = col('Queued Date')
  const cAt = col('Audited At')
  const cEmail = col('Agent Email')
  const cFd = col('Agent FD ID')
  const fmt = dateFmt || ((d: Date) => qeFmt_(d, 'yyyy-MM-dd'))
  const ymd = (x: unknown) => {
    if (x instanceof Date) return fmt(x)
    const m = String(x || '').match(/\d{4}-\d{2}-\d{2}/)
    return m ? m[0] : ''
  }
  const dates: string[] = []
  const pos: Record<string, number> = {}
  for (let i = days - 1; i >= 0; i--) {
    pos[dqAddDays_(todayKey, -i)] = dates.length
    dates.push(dqAddDays_(todayKey, -i))
  }
  const zeros = () => dates.map(() => 0)
  const excluded = ((S.excludeAgents || []) as unknown[]).map(qeCanonAgent_)
  const by: Record<string, Record<string, unknown>> = {}
  const list: Record<string, unknown>[] = []
  const add = (key: string, name: string, tlEmail: string, expected: boolean) => {
    if (by[key]) return by[key]
    const q = qeQuotaFor_(name, S)
    const rec = (by[key] = {
      key, name, tlEmail: tlEmail || '', expected, perDay: q.perDay, perWeek: q.perWeek, offerPerDay: q.offerPerDay, actionPlan: q.actionPlan,
      audited: zeros(), queued: zeros(), pending: 0, passed: 0, expired: 0,
    })
    list.push(rec)
    return rec
  }
  people.forEach((p) => {
    if (String(p.position || '').trim() === CX_AGENT_POSITION && excluded.indexOf(qeCanonAgent_(p.name)) === -1) add(normEmail_(p.email), p.name, p.tlEmail || '', true)
  })
  const idx = { people, byEmail: {} as Record<string, (typeof people)[number]>, byFdId: {} as Record<string, (typeof people)[number]>, byFdName: {} as Record<string, (typeof people)[number][]>, byName: {} as Record<string, (typeof people)[number][]> }
  // qaAgentIndex_ built inline to keep the people type
  people.forEach((p) => {
    idx.byEmail[normEmail_(p.email)] = p
    const k = qaNameKey_(p.name)
    if (k) {
      idx.byName[k] = idx.byName[k] || []
      if (idx.byName[k].indexOf(p) === -1) idx.byName[k].push(p)
    }
  })
  headcount.forEach((h) => {
    const p = idx.byEmail[normEmail_(h.email)]
    if (!p) return
    if (h.fdId) idx.byFdId[String(h.fdId).trim()] = p
    const k = qaNameKey_(h.fdName)
    if (k) {
      idx.byFdName[k] = idx.byFdName[k] || []
      if (idx.byFdName[k].indexOf(p) === -1) idx.byFdName[k].push(p)
    }
  })
  let rows = 0
  const rowDays: Record<string, boolean> = {}
  for (let r = hi + 1; r < values.length; r++) {
    const v = (values[r] || []) as unknown[]
    const name = String(v[cAgent] || '').trim()
    if (!name) continue
    const qd = cQd === -1 ? '' : ymd(v[cQd])
    const state = String(v[cState] || '').trim()
    const auditDay = state === 'audited' ? (cAt === -1 ? '' : ymd(v[cAt])) || qd : ''
    if (pos[qd] === undefined && pos[auditDay] === undefined) continue
    rows++
    const p = qaMatchAgent_(name, cEmail === -1 ? '' : v[cEmail], cFd === -1 ? '' : v[cFd], idx as unknown as Parameters<typeof qaMatchAgent_>[3])
    const rec = p ? add(normEmail_(p.email), p.name, p.tlEmail || '', false) : add('name:' + qaNameKey_(name), name, '', false)
    if (pos[qd] !== undefined) {
      rowDays[qd] = true
      ;(rec.queued as number[])[pos[qd]]++
      if (state === 'pending' || state === 'passed' || state === 'expired') (rec[state] as number)++
    }
    if (pos[auditDay] !== undefined) (rec.audited as number[])[pos[auditDay]]++
  }
  const outByDay: Record<string, { ranAt: string; m: Record<string, Record<string, unknown>>; min?: unknown; lb?: unknown }> = {}
  let firstRec = ''
  ;(((hist && hist.outcomes) || []) as { date: string; ranAt: string; outcomes: { a?: Record<string, { e?: unknown; i?: unknown }>; m?: unknown; lb?: unknown } }[]).forEach((b) => {
    if (pos[b.date] === undefined) return
    if (!firstRec || b.date < firstRec) firstRec = b.date
    if (outByDay[b.date] && outByDay[b.date].ranAt > b.ranAt) return
    const m: Record<string, Record<string, unknown>> = {}
    Object.keys(b.outcomes.a || {}).forEach((n) => {
      const o = (b.outcomes.a as Record<string, Record<string, unknown>>)[n]
      const p = qaMatchAgent_(n, o.e, o.i, idx as unknown as Parameters<typeof qaMatchAgent_>[3])
      const key = p ? normEmail_(p.email) : 'name:' + qaNameKey_(n)
      m[key] = o
    })
    outByDay[b.date] = { ranAt: b.ranAt, m, min: b.outcomes.m, lb: b.outcomes.lb }
  })
  list.forEach((a) => {
    a.reasons = (a.queued as number[]).map((n, j) => {
      if (n >= (a.offerPerDay as number)) return ''
      const d = dates[j]
      const day = outByDay[d]
      const why = qaQueuedReason_(day ? day.m[a.key as string] : null, day, hist ? !!(hist.builds[d] || rowDays[d]) : null, firstRec, d)
      return a.expected ? why : 'Not on the active agent roster. ' + why
    })
  })
  const sum = (a: number[]) => a.reduce((s, x) => s + x, 0)
  list.forEach((a) => {
    a.auditedTotal = sum(a.audited as number[])
    a.queuedTotal = sum(a.queued as number[])
  })
  list.sort((a, b) => (a.auditedTotal as number) - (b.auditedTotal as number) || (a.queuedTotal as number) - (b.queuedTotal as number) || String(a.name).localeCompare(String(b.name)))
  const target = sum(list.filter((a) => a.expected).map((a) => a.perDay as number))
  return {
    days: dates,
    agents: list,
    logRows: rows,
    totals: {
      audited: dates.map((d, j) => sum(list.map((a) => (a.audited as number[])[j]))),
      queued: dates.map((d, j) => sum(list.map((a) => (a.queued as number[])[j]))),
      target: dates.map(() => target),
    },
  }
}

// ---- Range checks (Quality.js 2897-2911) ----

export const QA_RANGE_MAX_DAYS = 366

/** Pure: whole days from a to b, both yyyy-MM-dd (b - a). */
export function qaDaysBetween_(a: string, b: string): number {
  return Math.round((Date.parse(b + 'T00:00:00Z') - Date.parse(a + 'T00:00:00Z')) / 864e5)
}

/** Pure: the chart bucket for a range length in days: day up to 31, week up to 120, month beyond. */
export function qaRangeBucket_(days: number): string {
  return days <= 31 ? 'day' : days <= 120 ? 'week' : 'month'
}

/** Pure: validates a from/to pair (yyyy-MM-dd, real dates, from <= to, at most 366 days). Throws a plain message. */
export function qaCheckRange_(from: string, to: string): void {
  const ok = (d: string) => /^\d{4}-\d{2}-\d{2}$/.test(d) && new Date(d + 'T00:00:00Z').toISOString().slice(0, 10) === d
  if (!ok(from) || !ok(to)) throw new Error('Pick a from and to date (yyyy-MM-dd).')
  if (from > to) throw new Error('The from date is after the to date.')
  if (qaDaysBetween_(from, to) + 1 > QA_RANGE_MAX_DAYS) throw new Error('Pick a range of ' + QA_RANGE_MAX_DAYS + ' days or less.')
}

/** The analytics periods to offer: the last 10 quota weeks (first day) or 6 months, newest first. */
export function qaPeriods_(grain: string, today: string, startsOn: number): string[] {
  const periods: string[] = []
  for (let i = 0; i < (grain === 'week' ? 10 : 6); i++) {
    const p =
      grain === 'week'
        ? qaPeriodOf_(dqAddDays_(today, -7 * i), 'week', startsOn)
        : new Date(Date.UTC(+today.slice(0, 4), +today.slice(5, 7) - 1 - i, 1)).toISOString().slice(0, 7)
    if (periods.indexOf(p) === -1) periods.push(p)
  }
  return periods
}
