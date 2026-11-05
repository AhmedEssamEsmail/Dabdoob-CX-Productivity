/**
 * Quality pure rules — port of Quality_deprecated/Quality.js lines 34-493
 * (QA_HEADERS, QA_SETTINGS, QA_CHOICES, and every pure function down to
 * qaCleanForm_). Sheet reads become plain array/map arguments; settings become
 * the caller-supplied config map (Cfg). Names keep the legacy trailing
 * underscore so the golden oracle maps 1:1.
 */

import type { Cfg } from '@/features/shared/lib/adapters'
import {
  normEmail_,
  dqAddDays_,
  getConfig_,
} from '@/features/shared/lib/adapters'
import { qeFmt_ } from './engine'

// ---------------------------------------------------------------- constants (verbatim)

export const QA_HEADERS: Record<string, string[]> = {
  qa_forms: ['form_id', 'version', 'channel', 'title', 'placeholder', 'active', 'definition_json', 'created_by', 'created_at'],
  qa_queue: [
    'queue_id', 'queue_date', 'ticket_id', 'agent_email', 'agent_name', 'tl_email', 'channel', 'contact_type', 'tier',
    'auditor_email', 'status', 'started_at', 'audit_id', 'imported_at', 'log_key',
    'interaction_at', 'agent_status', 'passed_to', 'passed_by', 'passed_at', 'pass_note',
    'action_at', 'agent_status_log', 'ticket_status', 'pass_reason',
    'expire_reason',
    'source', 'requested_by', 'requested_at', 'request_reason', 'waived_by', 'waived_at', 'waive_reason',
    'audit_type', 'reference',
  ],
  qa_audits: [
    'audit_id', 'kind', 'queue_id', 'calibration_id', 'ticket_id', 'agent_email', 'tl_email', 'auditor_email', 'channel',
    'contact_type', 'form_id', 'form_version', 'answers_json', 'comment', 'score', 'fatal', 'score_final', 'started_at', 'submitted_at',
    'audit_date', 'status', 'ack_due_date', 'acknowledged_at', 'ack_by', 'updated_at', 'updated_by', 'source', 'source_agent',
    'fail_reasons_json',
    'audit_type', 'reference',
    'sample_basis',
    'interaction_at',
  ],
  qa_ctls: [
    'ctl_id', 'audit_id', 'agent_email', 'tl_email', 'opened_date', 'due_date', 'status', 'coaching_notes', 'action',
    'submitted_at', 'submitted_date', 'sla_met', 'agent_confirmed_at', 'agent_note', 'reminded_date', 'updated_at', 'updated_by',
    'outcome', 'dispute_id', 'reopened_at', 'reopen_count', 'closed_by', 'shift_tls',
  ],
  qa_disputes: [
    'dispute_id', 'audit_id', 'agent_email', 'auditor_email', 'tl_email', 'reason', 'raised_at', 'status', 'decision',
    'decision_note', 'old_score', 'new_score', 'decided_by', 'decided_at', 'audit_month',
    'raised_by', 'raised_date', 'escalated_by', 'escalated_at', 'escalation_note',
  ],
  qa_calibrations: [
    'calibration_id', 'ticket_id', 'channel', 'agent_email', 'form_id', 'form_version', 'auditor_email', 'tl_email',
    'created_by', 'created_at', 'status', 'auditor_audit_id', 'tl_audit_id', 'alignment_pct', 'month', 'completed_at',
  ],
  qa_kb_gaps: [
    'gap_id', 'audit_id', 'ticket_id', 'auditor_email', 'topic', 'description', 'suggestion', 'created_at', 'created_date',
    'audit_date', 'same_day', 'status', 'added_by', 'added_at',
  ],
  qa_volume: ['date', 'channel', 'contact_type', 'tickets', 'updated_at'],
}

export const QA_SETTINGS: Record<string, { value: unknown; description: string }> = {
  qa_engine_live: { value: false, description: 'false: the audit queue is imported every morning from the old Quality Queue app (its Queue Log). true: Quality builds the queue itself (QaEngine.js). Flip only after migrateQualityQueueHistory says done and the old app\'s triggers are deleted.' },
  qa_engine_source_ss_id: { value: '1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s', description: 'The Freshdesk Database spreadsheet the audit queue reads (read-only): agent touches, the status they set and when from tab "New Tickets Daily"; contact types, group and current status from "Freshdesk Current State"; names from "Users List". Columns are found by header name.' },
  qa_engine_fd_api_fallback: { value: false, description: 'true: tickets missing from "Freshdesk Current State" are looked up in the Freshdesk API during the queue build. Off by default: it spends the account\'s shared daily UrlFetch quota (it ran out on 2026-10-11). The Hub\'s own ticket snapshot is used first either way.' },
  qa_engine_settings: { value: {}, description: 'JSON: sampling rules of the audit queue engine, overrides over its defaults (the old app\'s Settings, same keys: auditsPerDay, auditsPerWeek, offerMultiplier, channelWeights, tierByL2, ...). Paste the old project\'s Script Property QQ_SETTINGS here. Checked on every build; checkQaEngineSettings shows the result.' },
  qa_history_since: { value: '2026-06-01', description: 'yyyy-MM-dd: audits from the Voice and Texting QA forms with an interaction date from this day on are imported as history (the old scorecard\'s scoresStartDate).' },
  qa_auditor_emails: { value: [], description: 'Extra people Mohamed assigns to audit, added to team leads + qa_auditor_positions from the HCT roster.' },
  qa_auditor_positions: { value: ['enablement'], description: 'HCT Position keywords (case-insensitive, contains) that give audit access. Team leads always have it.' },
  qa_auditor_map: { value: {}, description: 'JSON: agent email -> auditor email. Agents not listed are shared out evenly between the auditors.' },
  qa_ctl_days: { value: 2, description: 'Working days a TL has to submit the CTL for an audit.' },
  qa_ctl_days_over_weekend: { value: 3, description: 'Working days for the CTL when the window crosses one of the TL\'s days off.' },
  qa_dispute_owner_email: { value: '', description: 'Who decides disputes. Empty: the owner (assistant_owner_email, else the first admin).' },
  qa_alignment_target: { value: 90, description: 'Calibration target: auditor agreement with the TL reference, %.' },
  qa_dispute_pass_target: { value: 10, description: 'Auditor target: disputes raised in the month against that auditor\'s audits (every dispute, whatever the decision), % of their audits in the month, below this.' },
  qa_ctl_sla_target: { value: 95, description: 'TL target: CTLs submitted by their due date, %.' },
  qa_audit_email_enabled: { value: true, description: 'true: when an audit is submitted, the agent is emailed the result with their team lead in copy (Quality > My audits). false: no audit-result email (pop-ups for the CTL still open). Mail also obeys mail_dry_run.' },
  qa_request_waiver_emails: { value: [], description: 'Who may waive an audit request besides admins (Mohamed 2026-10-21: Noha). JSON list of emails. Auditors can never refuse a request.' },
  qa_kb_notify_emails: { value: '', description: 'Comma-separated emails: who is emailed about every new KB gap and marks it "added to KB" (admins can too).' },
}

export const QA_RETIRED_SETTINGS: Record<string, string> = {
  qa_ack_window_days: 'Retired 2026-10-10: agents no longer acknowledge or dispute an audit; the TL\'s CTL outcome settles it. Agents confirm or deny the CTL itself (2026-10-11). Not read.',
  qa_ctl_score_below: 'Retired 2026-10-10: a CTL opens for every audit under 100% (a question lost marks, or a critical fail; 2026-10-11). Not read.',
}
export const QA_REWORDED_SETTINGS = ['qa_dispute_pass_target']

export const QA_KB_TYPES = ['Incomplete information', 'Inaccurate', 'Missing data']

export const QA_CHOICES: Record<string, string[]> = {
  'qa.channel': ['Inbound Calls', 'Waiting Address', 'Chats', 'Internal Tickets'],
  'qa.ctl_action': ['Coaching session held', 'Side-by-side listening', 'Process refresher', 'Written feedback shared', 'Escalated to Mohamed'],
  'qa.kb_gap_type': QA_KB_TYPES,
  'qa.audit_type': ['Cash refund'],
}

export const QA_ANSWERS = ['pass', 'fail', 'na']
export const QA_FAIL_REASONS = ['agent', 'process', 'product', 'kb']

/** qaSetting_ against a Cfg map (getConfig_ verbatim). */
export function qaSetting_(cfg: Cfg, key: string): unknown {
  const d = QA_SETTINGS[key]
  return getConfig_(cfg, key, d ? d.value : '')
}

// ---------------------------------------------------------------- pure rules (verbatim)

export function qaRound1_(x: number): number {
  return Math.round(x * 10) / 10
}

export interface QaQuestion {
  id: string
  text: string
  weight: number
  fatal: boolean
  section: string
  optional: boolean
}

/** Every question of a form definition, in order, with its section. */
export function qaQuestions_(def: { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined): QaQuestion[] {
  const out: QaQuestion[] = []
  ;((def && def.sections) || []).forEach((s) => {
    ;((s.questions || []) as Record<string, unknown>[]).forEach((q) => {
      out.push({
        id: String(q.id),
        text: String(q.text || ''),
        weight: Number(q.weight) || 0,
        fatal: !!q.fatal,
        section: String(s.title || ''),
        optional: !!s.optional,
      })
    })
  })
  return out
}

export interface QaScore {
  score: number | null
  fatal: boolean
  earned: number
  possible: number
  missing: string[]
  failed: string[]
}

/**
 * Score of one audit. answers: { questionId: 'pass' | 'fail' | 'na' }.
 * Weighted forms: a fatal question answered 'fail' zeroes the audit; fatal questions carry no
 * weight otherwise. Score = passed weight / applicable weight x 100, one decimal.
 * Deduction forms (def.scoring 'deduction'): each failed question deducts its weight in %;
 * score = max(0, 100 - deductions); a question deducting 100 is fatal. N/A deducts nothing.
 */
export function qaScore_(
  def: { scoring?: string; sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined,
  answers?: Record<string, string>
): QaScore {
  answers = answers || {}
  let earned = 0
  let possible = 0
  let fatal = false
  const missing: string[] = []
  const failed: string[] = []
  if (def && def.scoring === 'deduction') {
    let ded = 0
    qaQuestions_(def).forEach((q) => {
      const a = answers![q.id]
      if (QA_ANSWERS.indexOf(a) === -1) {
        missing.push(q.id)
        return
      }
      if (a !== 'fail') return
      failed.push(q.id)
      ded += q.weight
      if (q.fatal || q.weight >= 100) fatal = true
    })
    const ds = qaRound1_(Math.max(0, 100 - ded))
    return { score: ds, fatal, earned: ds, possible: 100, missing, failed }
  }
  qaQuestions_(def).forEach((q) => {
    const a = answers![q.id]
    if (QA_ANSWERS.indexOf(a) === -1) {
      missing.push(q.id)
      return
    }
    if (a === 'fail') failed.push(q.id)
    if (q.fatal) {
      if (a === 'fail') fatal = true
      return
    }
    if (a === 'na') return
    possible += q.weight
    if (a === 'pass') earned += q.weight
  })
  const score = fatal ? 0 : possible > 0 ? qaRound1_((earned / possible) * 100) : null
  return { score, fatal, earned, possible, missing, failed }
}

/**
 * Calibration alignment: the auditor's agreement with the TL reference, per
 * question, weighted by the question's weight. A fatal question weighs as much
 * as the heaviest question in the form. Returns a % with one decimal, or null.
 */
export function qaAlignment_(
  def: { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined,
  auditor?: Record<string, string>,
  reference?: Record<string, string>
): number | null {
  const qs = qaQuestions_(def)
  const heaviest = qs.reduce((m, q) => Math.max(m, q.weight), 0) || 1
  let total = 0
  let agree = 0
  qs.forEach((q) => {
    const w = q.fatal ? heaviest : q.weight
    if (w <= 0) return
    total += w
    if ((auditor || {})[q.id] === (reference || {})[q.id]) agree += w
  })
  return total ? qaRound1_((agree / total) * 100) : null
}

/** The date key n working days after fromKey (fromKey itself not counted). isWorking(dateKey) -> bool. */
export function qaAddWorkingDays_(fromKey: string, n: number, isWorking: (d: string) => boolean): string {
  let d = fromKey
  let count = 0
  let guard = 0
  while (count < n && guard++ < 120) {
    d = dqAddDays_(d, 1)
    if (isWorking(d)) count++
  }
  return d
}

/**
 * CTL due date: `base` working days after the audit date; when that window
 * crosses a day off (weekend, day off, holiday), `overWeekend` working days instead.
 */
export function qaCtlDue_(fromKey: string, isWorking: (d: string) => boolean, base: number, overWeekend: number): string {
  const due = qaAddWorkingDays_(fromKey, base, isWorking)
  for (let d = dqAddDays_(fromKey, 1); d <= due; d = dqAddDays_(d, 1)) {
    if (!isWorking(d)) return qaAddWorkingDays_(fromKey, overWeekend, isWorking)
  }
  return due
}

/** True when the value is a sheet boolean or its text. */
export function qaBool_(v: unknown): boolean {
  return v === true || String(v).toLowerCase() === 'true'
}

/** The score an audit counts with: the re-score when there is one. */
export function qaFinalScore_(a: Record<string, unknown>): number {
  const f = a.score_final
  return f !== '' && f !== null && f !== undefined && isFinite(Number(f)) ? Number(f) : Number(a.score)
}

/**
 * Audits that count in any score rollup: real audits (not calibration), not
 * voided, and not under an open dispute.
 */
export function qaRollupAudits_(audits: Record<string, unknown>[]): Record<string, unknown>[] {
  return audits.filter((a) => {
    return String(a.kind || 'audit') === 'audit' && a.status !== 'voided' && a.status !== 'disputed'
  })
}

/**
 * Settled = final: full marks at submit, acknowledged through the TL's CTL, or decided after a
 * dispute. No window any more (Mohamed 2026-10-10): a 'submitted' audit waits for its CTL.
 */
export function qaIsSettled_(a: Record<string, unknown>): boolean {
  return a.status === 'acknowledged' || a.status === 'dispute_rejected' || a.status === 'rescored' || a.status === 'historical'
}

/** The questions an audit lost marks on: answered fail and either critical or carrying weight. */
export function qaLostQuestions_(
  def: { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined,
  answers?: Record<string, string>
): QaQuestion[] {
  answers = answers || {}
  return qaQuestions_(def).filter((q) => answers![q.id] === 'fail' && (q.fatal || q.weight > 0))
}

/** An audit has a markdown when any question lost marks or a critical question failed; it then needs a CTL. */
export function qaHasMarkdown_(
  def: { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined,
  answers?: Record<string, string>
): boolean {
  return qaLostQuestions_(def, answers).length > 0
}

/** A CTL opens for every audit under 100% (Mohamed 2026-10-11). */
export function qaNeedsCtl_(
  def: { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null | undefined,
  answers: Record<string, string> | undefined,
  score: unknown
): boolean {
  return qaHasMarkdown_(def, answers) || Number(score) < 100
}

/** Who hears that an agent denied a CTL: the dispute owner (Mohamed) and every active team lead, once each. */
export function qaCtlDenyRecipients_(owner: string, tlEmails?: string[]): string[] {
  return qaEmailList_([owner].concat(tlEmails || []))
}

/** qaHasMarkdown_ for a stored audit; without its form version, any score under 100 or a fatal counts. */
export function qaAuditHasMarkdown_(
  a: Record<string, unknown>,
  forms: { byKey: Record<string, { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] }> }
): boolean {
  const f = forms.byKey[String(a.form_id) + '|' + String(a.form_version)]
  if (f) return qaNeedsCtl_(f, qaParse_(a.answers_json, {}) as Record<string, string>, a.score)
  return qaBool_(a.fatal) || Number(a.score) < 100
}

/**
 * Who may close a CTL (Mohamed 2026-10-11): an admin, the agent's TL, or any TL on shift now.
 * onShift: emails on shift now (tlsOnShift_). Pure.
 */
export function qaCanCloseCtl_(c: Record<string, unknown>, user: { email: string; role: string }, onShift: string[]): boolean {
  return user.role === 'admin' || normEmail_(c.tl_email) === user.email || (user.role === 'tl' && onShift.indexOf(user.email) !== -1)
}

/** A TL sees their own CTLs and every CTL they were popped up for as on shift (shift_tls). Pure. */
export function qaCtlVisibleTo_(c: Record<string, unknown>, user: { email: string; role: string }): boolean {
  return user.role === 'admin' || normEmail_(c.tl_email) === user.email || qaEmailList_(c.shift_tls).indexOf(user.email) !== -1
}

/**
 * The open CTLs a person may submit that match `ref`: a Freshdesk ticket number (digits, '#' allowed)
 * or an audit ID / CTL ID. Team leads match their own; admins any. auditsBy: audit_id -> audit row.
 */
export function qaFindOpenCtls_(
  ctls: Record<string, unknown>[],
  auditsBy: Record<string, Record<string, unknown>>,
  ref: unknown,
  user: { email: string; role: string },
  onShift?: string[]
): Record<string, unknown>[] {
  const r = String(ref || '').trim()
  if (!r) return []
  const ticket = /^#?\s*\d+$/.test(r) ? r.replace(/[^0-9]/g, '') : ''
  const low = r.toLowerCase()
  return ctls.filter((c) => {
    if (c.status !== 'open') return false
    if (!qaCanCloseCtl_(c, user, onShift || []) && !(user.role === 'tl' && qaCtlVisibleTo_(c, user))) return false
    const a = auditsBy[String(c.audit_id)]
    if (ticket) return !!a && String(a.ticket_id) === ticket
    return String(c.audit_id).toLowerCase() === low || String(c.ctl_id).toLowerCase() === low
  })
}

/** A list of emails from a setting: an array, or text separated by commas, semicolons or spaces. */
export function qaEmailList_(v: unknown): string[] {
  const out: string[] = []
  ;([] as unknown[]).concat((v || []) as unknown[]).forEach((x) => {
    String(x || '')
      .split(/[,;\s]+/)
      .map((s) => normEmail_(s))
      .forEach((e) => {
        if (e && out.indexOf(e) === -1) out.push(e)
      })
  })
  return out
}

/**
 * The analytics period of a yyyy-MM-dd date: its quota week's first day (yyyy-MM-dd; startsOn 0 = Sunday,
 * 1 = Monday, the engine's weekStartsOn) or its month (yyyy-MM).
 */
export function qaPeriodOf_(dateKey: string, grain: string, startsOn: unknown): string {
  const k = String(dateKey).slice(0, 10)
  if (grain !== 'week') return k.slice(0, 7)
  const back = (new Date(k + 'T00:00:00Z').getUTCDay() - (Number(startsOn) === 1 ? 1 : 0) + 7) % 7
  return dqAddDays_(k, -back)
}

/**
 * CTL SLA per TL for CTLs due in `month` (yyyy-MM). A CTL counts once it is due
 * (due date passed) or done; on-hold and cancelled CTLs are left out.
 */
export function qaCtlSla_(ctls: Record<string, unknown>[], month: string, todayKey: string): Record<string, unknown> {
  const by: Record<string, { total: number; due: number; onTime: number; done: number; slaPct?: number | null; donePct?: number | null }> = {}
  ctls.forEach((c) => {
    if (String(c.due_date).slice(0, 7) !== month || c.status === 'on_hold' || c.status === 'cancelled') return
    const done = c.status === 'submitted' || c.status === 'confirmed' || c.status === 'not_confirmed'
    const tl = normEmail_(done && c.closed_by ? c.closed_by : c.tl_email)
    const s = (by[tl] = by[tl] || { total: 0, due: 0, onTime: 0, done: 0 })
    s.total++
    if (done) s.done++
    if (done || String(c.due_date) < todayKey) s.due++
    if (done && String(c.submitted_date) <= String(c.due_date)) s.onTime++
  })
  Object.keys(by).forEach((k) => {
    const s = by[k]
    s.slaPct = s.due ? qaRound1_((s.onTime / s.due) * 100) : null
    s.donePct = s.total ? qaRound1_((s.done / s.total) * 100) : null
  })
  return by
}

/** The month (yyyy-MM) a dispute was raised in: raised_date, else raised_at, else (oldest rows) the audit's month. */
export function qaDisputeMonth_(d: Record<string, unknown>): string {
  return String(d.raised_date || '').slice(0, 7) || String(d.raised_at || '').slice(0, 7) || String(d.audit_month || '')
}

/**
 * Auditor dispute KPI (Mohamed 2026-10-10): disputes RAISED in `month` against that auditor's
 * audits, every dispute whatever the decision, / the auditor's audits dated in the month x 100.
 */
export function qaDisputeStats_(audits: Record<string, unknown>[], disputes: Record<string, unknown>[], month: string): Record<string, unknown> {
  const by: Record<string, { audits: number; disputes: number; upheld: number; open: number; disputePct?: number | null }> = {}
  const blank = () => ({ audits: 0, disputes: 0, upheld: 0, open: 0 })
  audits.forEach((a) => {
    if (String(a.kind || 'audit') !== 'audit' || String(a.audit_date).slice(0, 7) !== month) return
    const k = normEmail_(a.auditor_email)
    ;(by[k] = by[k] || blank()).audits++
  })
  disputes.forEach((d) => {
    if (qaDisputeMonth_(d) !== month) return
    const k = normEmail_(d.auditor_email)
    const s = (by[k] = by[k] || blank())
    s.disputes++
    if (d.status === 'upheld') s.upheld++
    if (d.status === 'open' || d.status === 'escalated') s.open++
  })
  Object.keys(by).forEach((k) => {
    by[k].disputePct = by[k].audits ? qaRound1_((by[k].disputes / by[k].audits) * 100) : null
  })
  return by
}

/**
 * The auditor KPIs of one month, per auditor email: audits dated in the month,
 * disputes raised in the month against their audits and that as % of the audits (qaDisputeStats_),
 * calibration alignment (mean of their done calibrations of the month), KB gaps logged in the month and
 * how many the same day as the audit. Pure.
 */
export function qaAuditorKpis_(
  audits: Record<string, unknown>[],
  disputes: Record<string, unknown>[],
  cals: Record<string, unknown>[],
  kb: Record<string, unknown>[],
  month: string
): Record<string, unknown> {
  const out: Record<string, { email: string; audits: number; disputes: number; upheld: number; open: number; disputePct: unknown; alignmentPct: number | null; calibrations: number; kbGaps: number; kbSameDay: number }> = {}
  const row = (k: string) =>
    (out[k] =
      out[k] || { email: k, audits: 0, disputes: 0, upheld: 0, open: 0, disputePct: null, alignmentPct: null, calibrations: 0, kbGaps: 0, kbSameDay: 0 })
  const ds = qaDisputeStats_(audits, disputes, month) as Record<string, { audits: number; disputes: number; upheld: number; open: number; disputePct?: number | null }>
  Object.keys(ds).forEach((k) => {
    const r = row(k)
    r.audits = ds[k].audits
    r.disputes = ds[k].disputes
    r.upheld = ds[k].upheld
    r.open = ds[k].open
    r.disputePct = ds[k].disputePct
  })
  const al: Record<string, number[]> = {}
  cals.forEach((c) => {
    if (c.status === 'done' && c.month === month && c.alignment_pct !== '') {
      const k = normEmail_(c.auditor_email)
      ;(al[k] = al[k] || []).push(Number(c.alignment_pct))
    }
  })
  Object.keys(al).forEach((k) => {
    const r = row(k)
    r.calibrations = al[k].length
    r.alignmentPct = qaRound1_(al[k].reduce((s, x) => s + x, 0) / al[k].length)
  })
  kb.forEach((g) => {
    if (String(g.created_date).slice(0, 7) !== month) return
    const r = row(normEmail_(g.auditor_email))
    r.kbGaps++
    if (qaBool_(g.same_day)) r.kbSameDay++
  })
  return out
}

// ---------------------------------------------------------------- queue sheet parsing + agent matching (verbatim)

export interface QaQueueCtx {
  today: string
  auditors: string[]
  people: { email: string; name: string; tlEmail?: string }[]
  headcount?: { email: string; fdId?: string; fdName?: string }[]
  map?: Record<string, unknown>
}

/** Name key: accents dropped, lower case, words of letters and digits only ("Abd-El Samad" -> "abd el samad"). */
export function qaNameKey_(s: unknown): string {
  return String(s || '')
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9؀-ۿ]+/g, ' ')
    .trim()
}

export interface QaAgentIdx {
  people: QaQueueCtx['people']
  byEmail: Record<string, QaQueueCtx['people'][number]>
  byFdId: Record<string, QaQueueCtx['people'][number]>
  byFdName: Record<string, QaQueueCtx['people'][number][]>
  byName: Record<string, QaQueueCtx['people'][number][]>
}

/** Lookups for qaMatchAgent_. people: the active roster; headcount: dqHeadcount_ rows (fdId, fdName). */
export function qaAgentIndex_(
  people: QaQueueCtx['people'],
  headcount: { email: string; fdId?: string; fdName?: string }[]
): QaAgentIdx {
  const byEmail: QaAgentIdx['byEmail'] = {}
  const byFdId: QaAgentIdx['byFdId'] = {}
  const byFdName: QaAgentIdx['byFdName'] = {}
  const byName: QaAgentIdx['byName'] = {}
  const add = (m: Record<string, QaQueueCtx['people'][number][]>, k: string, p: QaQueueCtx['people'][number]) => {
    if (!k) return
    m[k] = m[k] || []
    if (m[k].indexOf(p) === -1) m[k].push(p)
  }
  people.forEach((p) => {
    byEmail[normEmail_(p.email)] = p
    add(byName, qaNameKey_(p.name), p)
  })
  headcount.forEach((h) => {
    const p = byEmail[normEmail_(h.email)]
    if (!p) return
    if (h.fdId) byFdId[String(h.fdId).trim()] = p
    add(byFdName, qaNameKey_(h.fdName), p)
  })
  return { people, byEmail, byFdId, byFdName, byName }
}

/**
 * The roster person for a queue row's agent (Mohamed 2026-10-13). In order: the Freshdesk id
 * (Queue Log "Agent FD ID" = Roster freshdesk_id), the Users List email, the Roster's Freshdesk
 * name, the name with case/accents/punctuation ignored, then loosely: the same first name with
 * every word of the shorter name in the longer one, or the names equal once the spaces are taken
 * out. Only a single match counts. Pure.
 */
export function qaMatchAgent_(name: unknown, email: unknown, fdId: unknown, idx: QaAgentIdx): QaQueueCtx['people'][number] | null {
  const id = String(fdId || '').trim()
  if (id && idx.byFdId[id]) return idx.byFdId[id]
  const e = normEmail_(email)
  if (e && idx.byEmail[e]) return idx.byEmail[e]
  const k = qaNameKey_(name)
  if (!k) return null
  const one = (list?: QaQueueCtx['people'][number][]) => (list && list.length === 1 ? list[0] : null)
  const exact = one(idx.byFdName[k]) || one(idx.byName[k])
  if (exact) return exact
  const a = k.split(' ')
  const joinedA = a.join('')
  const hits = idx.people.filter((p) => {
    const b = qaNameKey_(p.name).split(' ')
    const joinedB = b.join('')
    if (joinedA.length >= 8 && joinedA === joinedB) return true
    const short = a.length <= b.length ? a : b
    const long = short === a ? b : a
    return short.length >= 2 && short[0] === long[0] && short.every((w) => long.indexOf(w) !== -1)
  })
  return one(hits)
}

/**
 * Turns the live QA queue tab (all values, title row first) into qa_queue rows (Quality.js 503-561).
 * Agents matched by qaMatchAgent_; auditor: the sheet's Auditor cell when it names an auditor, else
 * qa_auditor_map, else the auditors in turn by agent. Returns { date, rows, unmatched }.
 * The Sheets Date cell is passed through cellMs: (v) -> 'yyyy-MM-dd HH:mm' in the engine tz.
 */
export function qaQueueFromSheet_(values: unknown[][], ctx: QaQueueCtx, cellFmt?: (d: Date) => string): Record<string, unknown> {
  let hi = -1
  for (let i = 0; i < Math.min(values.length, 4); i++) {
    const line = (values[i] || []).map((v) => String(v).trim())
    if (line.indexOf('Ticket ID') !== -1 && line.indexOf('Agent') !== -1) {
      hi = i
      break
    }
  }
  if (hi === -1) throw new Error('The QA queue tab has no header row with "Ticket ID" and "Agent".')
  const head = (values[hi] || []).map((v) => String(v).trim())
  const col = (n: string) => head.indexOf(n)
  const m = String(((values[0] || []) as unknown[]).join(' ')).match(/\d{4}-\d{2}-\d{2}/)
  let date = m ? m[0] : ctx.today
  const cQd = col('Queued Date')
  const cState = col('State')
  if (cState !== -1) date = ctx.today
  const ymd = (x: unknown) => {
    if (x instanceof Date) return x.getFullYear() + '-' + ('0' + (x.getMonth() + 1)).slice(-2) + '-' + ('0' + x.getDate()).slice(-2)
    const s = String(x || '').match(/\d{4}-\d{2}-\d{2}/)
    return s ? s[0] : ''
  }
  const norm = (s: unknown) =>
    String(s || '')
      .toLowerCase()
      .replace(/\s+/g, ' ')
      .trim()
  const auditors = ctx.auditors.slice().sort()
  const auditorByName: Record<string, string> = {}
  ctx.people.forEach((p) => {
    if (auditors.indexOf(p.email) !== -1) auditorByName[norm(p.name)] = p.email
  })
  const rows: Record<string, unknown>[] = []
  const unmatched: Record<string, number> = {}
  const idx = qaAgentIndex_(ctx.people, ctx.headcount || [])
  const cEmail = col('Agent Email')
  const cFd = col('Agent FD ID')
  let v: unknown[] = []
  const cell = (name: string) => {
    const c = col(name)
    const x = c === -1 ? '' : v[c]
    return x instanceof Date ? (cellFmt ? cellFmt(x) : x.toISOString().slice(0, 16).replace('T', ' ')) : String(x === null || x === undefined ? '' : x).trim()
  }
  for (let r = hi + 1; r < values.length; r++) {
    v = (values[r] || []) as unknown[]
    const ticket = String(v[col('Ticket ID')] || '').replace(/[^0-9]/g, '')
    const name = String(v[col('Agent')] || '').trim()
    if (!ticket || !name) continue
    if (cState !== -1 && String(v[cState]).trim() !== 'pending') continue
    const rowDate = (cQd !== -1 && ymd(v[cQd])) || date
    const agent = qaMatchAgent_(name, cEmail === -1 ? '' : v[cEmail], cFd === -1 ? '' : v[cFd], idx)
    if (!agent) {
      unmatched[name] = (unmatched[name] || 0) + 1
      continue
    }
    rows.push({
      queue_id: rowDate + '|' + ticket + '|' + agent.email,
      queue_date: rowDate,
      ticket_id: ticket,
      agent_email: agent.email,
      agent_name: agent.name,
      tl_email: agent.tlEmail || '',
      channel: String(v[col('Channel')] || ''),
      contact_type: String(v[col('Contact Type')] || ''),
      tier: String(col('Tier') === -1 ? '' : v[col('Tier')]),
      log_key: col('Key') === -1 ? '' : String(v[col('Key')] || ''),
      interaction_at: cell('Interaction'),
      action_at: cell('Action Time'),
      agent_status: cell('Agent Status'),
      agent_status_log: cell('Agent Status Log'),
      ticket_status: cell('Status'),
      auditorCell: col('Auditor') === -1 ? '' : String(v[col('Auditor')] || '').trim(),
    })
  }
  const agents = rows.map((x) => String(x.agent_email)).filter((e, i, a) => a.indexOf(e) === i).sort()
  rows.forEach((x) => {
    const c = String(x.auditorCell).toLowerCase()
    const fromCell = auditors.indexOf(c) !== -1 ? c : auditorByName[norm(c)] || ''
    const mapped = normEmail_((ctx.map || {})[String(x.agent_email)] || '')
    x.auditor_email = fromCell || (auditors.indexOf(mapped) !== -1 ? mapped : '') || (auditors.length ? auditors[agents.indexOf(String(x.agent_email)) % auditors.length] : '')
    delete x.auditorCell
  })
  return { date, rows, unmatched: Object.keys(unmatched), unmatchedCounts: unmatched }
}

// ---- What an audit is about (Quality.js 764-775) ----

/** A non-ticket queue row or audit: audit_type set (its ticket_id is empty). Pure. */
export function qaIsNonTicket_(r: { audit_type?: unknown } | null | undefined): boolean {
  return !!String((r && r.audit_type) || '').trim()
}
/** For lists: the ticket number, or "Cash refund: <reference>". Pure. */
export function qaItemId_(r: Record<string, unknown>): string {
  return qaIsNonTicket_(r) ? String(r.audit_type).trim() + ': ' + String(r.reference || '') : String(r.ticket_id || '')
}
/** In a sentence: "ticket #123", or "Cash refund: <reference>". Pure. */
export function qaItemRef_(r: Record<string, unknown>): string {
  return qaIsNonTicket_(r) ? qaItemId_(r) : 'ticket #' + String(r.ticket_id || '')
}
/** In a subject: "#123", or "Cash refund: <reference>". Pure. */
export function qaItemTag_(r: Record<string, unknown>): string {
  return qaIsNonTicket_(r) ? qaItemId_(r) : '#' + String(r.ticket_id || '')
}

/** A stored queue/audit time as display text (Quality.js 1271): ISO Z -> Riyadh 'yyyy-MM-dd HH:mm'; strips the leading '. */
export function qaWhen_(v: unknown): string {
  const s = String(v === undefined || v === null ? '' : v).replace(/^'/, '')
  if (/^\d{4}-\d{2}-\d{2}T[\d:.]+Z$/.test(s)) return qeFmt_(new Date(s), 'yyyy-MM-dd HH:mm')
  return s
}

/** qaParse_ (Quality.js line 747): JSON.parse with a fallback. */
export function qaParse_(s: unknown, fallback: unknown): unknown {
  try {
    return JSON.parse(String(s || ''))
  } catch {
    return fallback
  }
}

/** Latest active version of every form, and a lookup by form_id + version (Quality.js 729-745). Pure given the qa_forms rows. */
export function qaForms_(rows: Record<string, unknown>[]): {
  list: Record<string, unknown>[]
  byKey: Record<string, Record<string, unknown>>
  forChannel: (ch: string) => Record<string, unknown> | null
} {
  const latest: Record<string, Record<string, unknown>> = {}
  const byKey: Record<string, Record<string, unknown>> = {}
  rows.forEach((r) => {
    let def: Record<string, unknown>
    try {
      def = JSON.parse(String(r.definition_json || '{}'))
    } catch {
      return
    }
    const f: Record<string, unknown> = {
      formId: String(r.form_id), version: Number(r.version) || 1, channel: String(r.channel), title: String(r.title),
      placeholder: qaBool_(r.placeholder), active: qaBool_(r.active), scoring: def.scoring === 'deduction' ? 'deduction' : 'weighted', sections: def.sections || [],
    }
    byKey[String(f.formId) + '|' + String(f.version)] = f
    if (!latest[String(f.formId)] || Number(latest[String(f.formId)].version) < Number(f.version)) latest[String(f.formId)] = f
  })
  const list = Object.keys(latest).map((k) => latest[k])
  return {
    list,
    byKey,
    forChannel(ch: string) {
      const act = list.filter((f) => f.active)
      return act.filter((f) => f.channel === ch)[0] || act.filter((f) => f.channel === '*')[0] || null
    },
  }
}

/** A client view of an audit (Quality.js 750-760): the markdown questions, the score that counts. */
export function qaAuditView_(
  a: Record<string, unknown>,
  forms: { byKey: Record<string, Record<string, unknown>> },
  dir: { name: (e: unknown) => string }
): Record<string, unknown> {
  const f = forms.byKey[String(a.form_id) + '|' + String(a.form_version)]
  const answers = qaParse_(a.answers_json, {}) as Record<string, string>
  const failed = f
    ? qaLostQuestions_(f as never, answers).map((q) => ({ id: q.id, text: q.text, fatal: q.fatal || q.weight >= 100, section: q.section, weight: q.weight }))
    : []
  return {
    auditId: String(a.audit_id), ticketId: qaItemId_(a), agentEmail: String(a.agent_email), agentName: dir.name(a.agent_email),
    tlEmail: String(a.tl_email || ''), tlName: a.tl_email ? dir.name(a.tl_email) : '', auditorEmail: String(a.auditor_email), auditorName: dir.name(a.auditor_email),
    channel: String(a.channel), contactType: String(a.contact_type || ''), score: Number(a.score), finalScore: qaFinalScore_(a), fatal: qaBool_(a.fatal),
    status: String(a.status), auditDate: String(a.audit_date), submittedAt: String(a.submitted_at), startedAt: String(a.started_at || ''),
    interactionAt: qaWhen_(a.interaction_at), comment: String(a.comment || ''), failed, formTitle: f ? f.title : '', scoring: f ? f.scoring : 'weighted',
    answers, formId: String(a.form_id), formVersion: Number(a.form_version),
  }
}

/** Validates and normalises a form definition from the builder. Throws a readable error. */
export function qaCleanForm_(input: Record<string, unknown> | null | undefined): Record<string, unknown> {
  input = input || {}
  const title = String(input.title || '').trim().slice(0, 120)
  if (!title) throw new Error('Give the form a title.')
  const channel = String(input.channel || '').trim().slice(0, 60)
  if (!channel) throw new Error('Choose the channel this form is for, or "*" for every channel.')
  const deduction = input.scoring === 'deduction'
  const seen: Record<string, boolean> = {}
  let n = 0
  const sections = ((input.sections || []) as Record<string, unknown>[]).map((s, si) => {
    const st = String(s.title || '').trim().slice(0, 120)
    if (!st) throw new Error('Section ' + (si + 1) + ' needs a title.')
    const qs = ((s.questions || []) as Record<string, unknown>[]).map((q, qi) => {
      const text = String(q.text || '').trim().slice(0, 300)
      if (!text) throw new Error('Question ' + (qi + 1) + ' in "' + st + '" needs text.')
      let fatal = !!q.fatal
      const w = Number(q.weight)
      if (deduction) {
        if (!isFinite(w) || w < 0 || w > 100) throw new Error('"' + text.slice(0, 40) + '" needs a deduction between 0 and 100%.')
        fatal = w >= 100
      } else if (!fatal && (!isFinite(w) || w <= 0 || w > 100)) throw new Error('"' + text.slice(0, 40) + '" needs a weight between 1 and 100.')
      let id = String(q.id || '').replace(/[^a-zA-Z0-9_-]/g, '').slice(0, 24) || 'q' + ++n
      while (seen[id]) id = 'q' + ++n
      seen[id] = true
      return { id, text, weight: fatal && !deduction ? 0 : w, fatal, hint: String(q.hint || '').trim().slice(0, 300) }
    })
    if (!qs.length) throw new Error('Section "' + st + '" has no questions.')
    const sec: Record<string, unknown> = { id: String(s.id || 's' + (si + 1)).slice(0, 24), title: st, questions: qs }
    if (s.optional) sec.optional = true // skippable: the audit form opens it all N/A
    return sec
  })
  if (!sections.length) throw new Error('Add at least one section.')
  if (!deduction && !qaQuestions_({ sections } as Parameters<typeof qaQuestions_>[0]).some((q) => !q.fatal)) throw new Error('Add at least one scored (non-fatal) question.')
  return { title, channel, placeholder: !!input.placeholder, scoring: deduction ? 'deduction' : 'weighted', sections }
}
