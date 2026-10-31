/**
 * Productivity validation layer, ported from original_deprecated/ProdValidation.js and the
 * view helpers of ProductivityApp.js. These are pure rules — no Supabase, no Next.js — so the
 * decision checks stay identical to the GAS implementation and are unit-tested directly.
 */

export interface ProdFlagRow {
  flag_id: string
  date: string
  agent_email: string
  agent_name: string | null
  tl_email: string | null
  raw_status: string
  interval_start: string
  interval_end: string
  interval_min: number | string | null
  spans_json: unknown
  flagged_min: number | string | null
  case_count: number | string | null
  distinct_cases: number | string | null
  case_ids_json: unknown
  channel_mix_json: unknown
  suggested_status: string
  decision: string
  validated_status: string | null
  decided_by: string | null
  decided_at: string | null
  reason: string | null
  due_date: string | null
  confidence_score?: number | string | null
  confidence_level?: string | null
  confidence_factors_json?: unknown
}

/** prodFlagView_ output: the camelCase shape the review page and my-status consume. */
export interface FlagView {
  flagId: string
  date: string
  agentEmail: string
  agentName: string
  tlEmail: string
  tlName: string
  rawStatus: string
  intervalStart: string
  intervalEnd: string
  intervalMin: number
  flaggedMin: number
  spans: [string, string][]
  caseCount: number
  distinctCases: number
  cases: { id: string; channel: string }[]
  channelMix: Record<string, number>
  suggestedStatus: string
  decision: string
  validatedStatus: string
  effectiveStatus: string
  decidedBy: string
  decidedAt: string
  reason: string
  dueDate: string
  confidenceScore: number
  confidenceLevel: string
  confidenceFactors: string[]
  /** Present when an agent dispute is attached (mechanism disabled upstream — never populated today). */
  dispute?: { disputeId: string; raisedAt: string; reason: string; status: string }
}

export interface DecisionInput {
  action?: string
  status?: string
  reason?: string
}

export interface DecisionPatch {
  decision: 'accepted' | 'reverted'
  validated_status: string
  reason: string
}

export interface DecisionContext {
  statuses: string[]
  reasonStatuses: string[]
}

export interface RuleView {
  x: number
  windowMin: number
  minIntervalMin: number
  flagStatuses: string[]
  channelStatus: Record<string, string>
  reviewDays: number
}

/** PROD_SETTINGS defaults that the review flow reads. */
export const PROD_DEFAULTS = {
  prod_flag_cases_x: 2,
  prod_flag_window_min: 10,
  prod_flag_min_interval_min: 5,
  prod_review_days: 7,
  prod_flag_statuses: ['IDLE'],
  prod_offline_statuses: ['Offline'],
  prod_channel_status: { chat: 'Chats', ticket: 'Available', wa: 'Waiting Address' } as Record<string, string>,
  prod_replacement_statuses: ['Available', 'Chats', 'Inbound Calls', 'Waiting Address', 'Busy'],
  prod_reason_statuses: ['Busy'],
  freshdesk_domain: 'dabdoobapp.freshdesk.com',
}

export const PROD_DIRTY_MAX = 31

/** zt in the legacy bundle: decision -> [label, chip tone]. */
export const DECISION_LABELS: Record<string, [string, string]> = {
  pending: ['Waiting for review', 'warn'],
  accepted: ['Accepted', 'ok'],
  reverted: ['Reverted to raw', 'neutral'],
  auto: ['Auto-accepted (not reviewed)', 'bad'],
  void: ['No longer applies', 'neutral'],
}

export function prodNorm(value: unknown): string {
  return String(value === null || value === undefined ? '' : value).trim().toLowerCase()
}

export function prodIn(value: unknown, list: unknown[]): boolean {
  const n = prodNorm(value)
  return list.some((x) => prodNorm(x) === n)
}

export function parseJson<T>(value: unknown, fallback: T): T {
  if (value === null || value === undefined || value === '') return fallback
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T
    } catch {
      return fallback
    }
  }
  return value as T
}

/** A config value may be a JSON array or a comma-separated list. */
export function settingList(value: unknown, fallback: string[]): string[] {
  if (value === null || value === undefined || value === '') return fallback
  if (Array.isArray(value)) return value.map(String)
  const parsed = parseJson<unknown>(value, null)
  if (Array.isArray(parsed)) return parsed.map(String)
  return String(value)
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

export function settingNumber(value: unknown, fallback: number): number {
  const n = Number(value)
  return Number.isFinite(n) && value !== null && value !== undefined && value !== '' ? n : fallback
}

/**
 * prodCheckDecision_: checks a TL decision on a pending flag and returns the row patch.
 * Revert keeps the raw status and always needs a reason; accept needs a status from the
 * replacement list (the canonical casing is returned), never the raw status itself.
 */
export function checkDecision(
  flag: Pick<ProdFlagRow, 'decision' | 'raw_status'>,
  input: DecisionInput,
  ctx: DecisionContext
): DecisionPatch {
  if (!flag) throw new Error('That flag does not exist.')
  if (flag.decision !== 'pending') throw new Error(`This flag was already decided (${flag.decision}).`)
  const reason = String(input.reason || '').trim()
  if (input.action === 'revert') {
    if (reason.length < 5) throw new Error('Reverting to the raw status needs a reason.')
    return { decision: 'reverted', validated_status: String(flag.raw_status), reason }
  }
  if (input.action !== 'accept') throw new Error('Choose accept or revert.')
  const status = String(input.status || '').trim()
  if (!status) throw new Error('Choose the status this time counts as.')
  if (!prodIn(status, ctx.statuses)) {
    throw new Error(`"${status}" is not on the status list (prod_replacement_statuses).`)
  }
  if (prodNorm(status) === prodNorm(flag.raw_status)) {
    throw new Error('That is the raw status: use Revert, with a reason.')
  }
  if (prodIn(status, ctx.reasonStatuses) && reason.length < 5) {
    throw new Error(`"${status}" needs a reason.`)
  }
  const canonical = ctx.statuses.filter((s) => prodNorm(s) === prodNorm(status))[0] ?? status
  return { decision: 'accepted', validated_status: canonical, reason }
}

/** prodEffectiveStatus_: the status a flag's minutes count as now. null = no effect. */
export function effectiveStatus(
  flag: Pick<ProdFlagRow, 'decision' | 'validated_status' | 'suggested_status'>
): string | null {
  if (!flag || flag.decision === 'void') return null
  if (!flag.decision || flag.decision === 'pending') return String(flag.suggested_status || '') || null
  return String(flag.validated_status || flag.suggested_status || '') || null
}

function pairList(value: unknown): [string, string][] {
  const parsed = parseJson<unknown>(value, [])
  if (!Array.isArray(parsed)) return []
  return parsed
    .filter((p): p is unknown[] => Array.isArray(p) && p.length >= 2)
    .map((p) => [String(p[0]), String(p[1])])
}

/** prodFlagView_: a prod_flags row plus its parsed JSON fields and display names. */
export function flagView(row: ProdFlagRow, nameOf?: (email: string) => string): FlagView {
  const spans = pairList(row.spans_json)
  const ids = pairList(row.case_ids_json)
  const mix = parseJson<Record<string, number>>(row.channel_mix_json, {})
  const factors = parseJson<unknown>(row.confidence_factors_json, [])
  const name = (email: string | null | undefined) => (email ? nameOf?.(email) || '' : '')
  const eff = effectiveStatus(row)
  return {
    flagId: String(row.flag_id),
    date: String(row.date),
    agentEmail: String(row.agent_email),
    agentName: name(row.agent_email) || String(row.agent_name || ''),
    tlEmail: String(row.tl_email || ''),
    tlName: name(row.tl_email),
    rawStatus: String(row.raw_status),
    intervalStart: String(row.interval_start),
    intervalEnd: String(row.interval_end),
    intervalMin: Number(row.interval_min) || 0,
    flaggedMin: Number(row.flagged_min) || 0,
    spans,
    caseCount: Number(row.case_count) || 0,
    distinctCases: Number(row.distinct_cases) || 0,
    cases: ids.map((x) => ({ id: String(x[0]), channel: String(x[1]) })),
    channelMix: mix,
    suggestedStatus: String(row.suggested_status),
    decision: String(row.decision),
    validatedStatus: String(row.validated_status || ''),
    effectiveStatus: eff || String(row.raw_status),
    decidedBy: row.decided_by === 'auto' ? 'auto' : name(row.decided_by) || String(row.decided_by || ''),
    decidedAt: String(row.decided_at || ''),
    reason: String(row.reason || ''),
    dueDate: String(row.due_date || ''),
    confidenceScore: Number(row.confidence_score) || 0,
    confidenceLevel: String(row.confidence_level || ''),
    confidenceFactors: Array.isArray(factors) ? factors.map(String) : [],
  }
}

/**
 * prodStatusChoices_: the replacement list from config, then statuses seen in the interval
 * data that are not flaggable (IDLE) or offline — so a TL can also accept a flag as, say,
 * a break status that exists in the import.
 */
export function statusChoices(
  replacementStatuses: string[],
  flagStatuses: string[],
  offlineStatuses: string[],
  seenStatuses: string[]
): string[] {
  const list = replacementStatuses.slice()
  const skip = flagStatuses.concat(offlineStatuses)
  seenStatuses.forEach((s) => {
    if (!prodIn(s, list) && !prodIn(s, skip)) list.push(String(s))
  })
  return list
}

/** prodRuleView_: the detection rule as the page explains it. */
export function ruleView(cfg: Record<string, string>): RuleView {
  return {
    x: Math.max(1, Math.round(settingNumber(cfg.prod_flag_cases_x, PROD_DEFAULTS.prod_flag_cases_x))),
    windowMin: Math.max(1, settingNumber(cfg.prod_flag_window_min, PROD_DEFAULTS.prod_flag_window_min)),
    minIntervalMin: Math.max(
      0,
      settingNumber(cfg.prod_flag_min_interval_min, PROD_DEFAULTS.prod_flag_min_interval_min)
    ),
    flagStatuses: settingList(cfg.prod_flag_statuses, PROD_DEFAULTS.prod_flag_statuses),
    channelStatus: parseJson<Record<string, string>>(cfg.prod_channel_status, PROD_DEFAULTS.prod_channel_status),
    reviewDays: settingNumber(cfg.prod_review_days, PROD_DEFAULTS.prod_review_days),
  }
}

/** Ea in the bundle: whole days between a yyyy-MM-dd key and today. */
export function daysUntil(dateKey: string, todayKey: string): number {
  return Math.round((Date.parse(dateKey) - Date.parse(todayKey)) / 86400000)
}

/** prodToday_ equivalent: the business date key in Kuwait time. */
export function todayKey(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kuwait',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now)
}

/** dqAddDays_: shifts a yyyy-MM-dd key by whole days. */
export function addDays(dateKey: string, days: number): string {
  const d = new Date(`${dateKey}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + days)
  return d.toISOString().slice(0, 10)
}
