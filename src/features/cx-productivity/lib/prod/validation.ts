/**
 * ProdValidation.js ported 1:1 — the pure flag/validation rules, verbatim function names
 * (trailing underscore kept) so the golden oracle tests map each port to the legacy function
 * it must byte-match. Sheet/config seams are injected (parse timestamps come from
 * ./adapters; settings arrive as args).
 *
 * This file EXTENDS src/lib/prod-validation.ts (the earlier port used by the app routes):
 * where that file already ports a rule with identical semantics (checkDecision,
 * effectiveStatus, prodNorm, prodIn) the legacy name is re-exported as an alias, and the
 * original module stays untouched.
 */

import 'server-only'

import { dqAddDays_, dqParseTs_, prodActivityKey_, prodDateKey_ } from '@/features/shared/lib/adapters'

// Re-export the existing module so this file is the single "validation" surface.
export * from '../prod-validation'
import {
  checkDecision,
  effectiveStatus,
  type ProdFlagRow,
} from '../prod-validation'

// ---------------------------------------------------------------- small helpers

/** ProdValidation.js:23 — djb2 base-36; flag ids stay stable when detection reruns. */
export function prodHash_(s: unknown): string {
  let h = 5381
  const str = String(s)
  for (let i = 0; i < str.length; i++) h = ((h * 33) ^ str.charCodeAt(i)) >>> 0
  return h.toString(36)
}

export function prodFlagId_(email: unknown, startMs: number, status: unknown): string {
  return (
    'PF' +
    prodHash_(String(email).toLowerCase() + '|' + startMs + '|' + String(status).toLowerCase()) +
    prodHash_(startMs + '|' + email)
  )
}

/** prodNorm_ / prodIn_ — identical to prodNorm/prodIn in prod-validation.ts. */
export function prodNorm_(s: unknown): string {
  return String(s === null || s === undefined ? '' : s).trim().toLowerCase()
}
export function prodIn_(v: unknown, list: unknown[] | null | undefined): boolean {
  const n = prodNorm_(v)
  return ([] as unknown[]).concat(list || []).some((x) => prodNorm_(x) === n)
}
export function prodRound2_(x: number): number {
  return Math.round(x * 100) / 100
}

interface HeaderColSpec {
  names: string[]
  fallback: number
}

/** prodHeaderCols_: header row -> column index per wanted header (case/spaces ignored). */
export function prodHeaderCols_(headerRow: unknown[] | null | undefined, wanted: Record<string, HeaderColSpec>): Record<string, number> {
  const idx: Record<string, number> = {}
  ;(headerRow || []).forEach((h, i) => {
    idx[prodNorm_(h).replace(/\s+/g, ' ')] = i
  })
  const out: Record<string, number> = {}
  Object.keys(wanted).forEach((k) => {
    const w = wanted[k]
    const hit = w.names.map((n) => idx[prodNorm_(n)]).filter((i) => i !== undefined)[0]
    out[k] = hit !== undefined ? hit : w.fallback
  })
  return out
}

// ---------------------------------------------------------------- intervals

export interface ProdIntervalCols {
  name: number
  status: number
  start: number
  end: number
  email?: number
}

export interface ProdIntervalsOpts {
  cols: ProdIntervalCols
  tz: string
  statusMap?: Record<string, string>
  nameToEmail?: Record<string, string>
  source?: string
  dateKey: (d: Date) => string | null
}

export interface ProdInterval {
  date: string | null
  agentEmail: string
  agentName: string
  status: string
  /** Only parsed intervals carry the raw source status — prodIntervalOf_ (stored rows) drops it. */
  sourceStatus?: string
  startMs: number
  endMs: number
  minutes: number
  source?: string
}

/**
 * prodIntervalsFromRows_: source rows -> intervals. Rows with no agent, no status or
 * unparseable/reversed times are counted in `unparsed`, never guessed.
 */
export function prodIntervalsFromRows_(
  rows: unknown[][],
  opts: ProdIntervalsOpts
): { intervals: ProdInterval[]; unparsed: number; unmatched: string[]; statuses: Record<string, number> } {
  const c = opts.cols
  const map: Record<string, string> = {}
  Object.keys(opts.statusMap || {}).forEach((k) => {
    map[prodNorm_(k)] = String(opts.statusMap![k])
  })
  const out: ProdInterval[] = []
  let unparsed = 0
  const unmatched: Record<string, boolean> = {}
  const statuses: Record<string, number> = {}
  rows.forEach((r) => {
    const name = String(r[c.name] === undefined ? '' : r[c.name]).trim()
    const srcStatus = String(r[c.status] === undefined ? '' : r[c.status]).trim()
    if (!name && !srcStatus) return // blank line
    const s = dqParseTs_(r[c.start], opts.tz)
    const e = dqParseTs_(r[c.end], opts.tz)
    if (!name || !srcStatus || !s || !e || e.getTime() < s.getTime()) {
      unparsed++
      return
    }
    const status = map[prodNorm_(srcStatus)] || srcStatus
    statuses[status] = (statuses[status] || 0) + 1
    let email = c.email !== undefined ? prodNorm_(r[c.email]) : ''
    if (!email || email.indexOf('@') === -1) email = (opts.nameToEmail || {})[name.toLowerCase()] || ''
    if (!email) unmatched[name] = true
    const startMs = s.getTime()
    const endMs = e.getTime()
    out.push({
      date: opts.dateKey(s),
      agentEmail: email,
      agentName: name,
      status,
      sourceStatus: srcStatus,
      startMs,
      endMs,
      minutes: prodRound2_((endMs - startMs) / 60000),
      source: opts.source,
    })
  })
  return { intervals: out, unparsed, unmatched: Object.keys(unmatched).sort(), statuses }
}

/** prodIntervalKey_: stable key of an interval row (prod_intervals.interval_key). */
export function prodIntervalKey_(iv: {
  date: string | null
  agentName: string
  status: string
  startMs: number
}): string {
  return [iv.date, prodNorm_(iv.agentName), prodNorm_(iv.status), new Date(iv.startMs).toISOString()].join('|')
}

/** prodRuns_: sorted sheet row numbers -> contiguous runs, last run first. */
export function prodRuns_(rowNums: number[]): { first: number; count: number }[] {
  const nums = rowNums.slice().sort((a, b) => a - b)
  const runs: { first: number; count: number }[] = []
  nums.forEach((n) => {
    const last = runs[runs.length - 1]
    if (last && n === last.first + last.count) last.count++
    else runs.push({ first: n, count: 1 })
  })
  return runs.reverse()
}

// ---------------------------------------------------------------- cases

export interface ProdCase {
  email: string
  ms: number
  id: string
  channel: string
  date: string | null
}

/**
 * prodCasesFromActivityRows_: Activities rows (A..J) -> cases. A case is a status change
 * (F = status) or any row on a ticket in a chat group. Same de-dup and date rule as the
 * engine (prodActivityKey_, J else A). groups: { chat: [...], wa: [...] }.
 */
export function prodCasesFromActivityRows_(
  rows: unknown[][],
  dates: string[],
  nameToEmail: Record<string, string>,
  localTz: string,
  groups: { chat: string[]; wa: string[] }
): ProdCase[] {
  const want: Record<string, boolean> = {}
  dates.forEach((d) => {
    want[d] = true
  })
  const seen: Record<string, boolean> = {}
  const out: ProdCase[] = []
  rows.forEach((r) => {
    const date = prodDateKey_(r[9] || r[0])
    if (date === null || !want[date]) return
    const group = String(r[8] || '').trim()
    const channel = prodIn_(group, groups.chat) ? 'chat' : prodIn_(group, groups.wa) ? 'wa' : 'ticket'
    if (prodNorm_(r[5]) !== 'status' && channel !== 'chat') return
    const k = prodActivityKey_(r, localTz)
    if (seen[k]) return
    seen[k] = true
    const t = dqParseTs_(r[0], localTz)
    const email = nameToEmail[prodNorm_(r[2])] || ''
    if (!t || !email || !r[1]) return
    out.push({ email, ms: t.getTime(), id: String(r[1]), channel, date })
  })
  return out
}

/** prodCasesByEmail_: cases grouped by agent email, each list sorted by time. */
export function prodCasesByEmail_(cases: ProdCase[]): Record<string, ProdCase[]> {
  const by: Record<string, ProdCase[]> = {}
  cases.forEach((c) => {
    ;(by[c.email] = by[c.email] || []).push(c)
  })
  Object.keys(by).forEach((e) => {
    by[e].sort((a, b) => a.ms - b.ms)
  })
  return by
}

/** prodMergeSpans_: merges [start, end) spans that overlap or touch. */
export function prodMergeSpans_(spans: [number, number][]): [number, number][] {
  const s = spans.slice().sort((a, b) => a[0] - b[0])
  const out: [number, number][] = []
  s.forEach((x) => {
    const last = out[out.length - 1]
    if (last && x[0] <= last[1]) last[1] = Math.max(last[1], x[1])
    else out.push([x[0], x[1]])
  })
  return out
}

/**
 * prodQualifyingSpans_: for every case inside [startMs, endMs), the window [t, t+windowMs)
 * qualifies when it holds at least x distinct ticket ids among the cases inside the interval.
 * Returns the union of qualifying windows clipped to the interval, as [start, end) ms.
 */
export function prodQualifyingSpans_(
  cases: { ms: number; id: string }[],
  startMs: number,
  endMs: number,
  x: number,
  windowMs: number
): [number, number][] {
  const inside = cases.filter((c) => c.ms >= startMs && c.ms < endMs)
  const spans: [number, number][] = []
  for (let i = 0; i < inside.length; i++) {
    const anchor = inside[i].ms
    const ids: Record<string, boolean> = {}
    let n = 0
    for (let j = i; j < inside.length && inside[j].ms < anchor + windowMs; j++) {
      if (!ids[inside[j].id]) {
        ids[inside[j].id] = true
        n++
      }
    }
    if (n >= x) spans.push([anchor, Math.min(anchor + windowMs, endMs)])
  }
  return prodMergeSpans_(spans)
}

export function prodSpansMs_(spans: [number, number][]): number {
  return spans.reduce((s, x) => s + (x[1] - x[0]), 0)
}

const PROD_CHANNEL_ORDER = ['ticket', 'chat', 'wa'] // tie-break for the suggested status

/** prodSuggestStatus_: channel with most distinct cases; ties by PROD_CHANNEL_ORDER. */
export function prodSuggestStatus_(mix: Record<string, number>, channelStatus: Record<string, string> | undefined): string {
  let best: string | null = null
  PROD_CHANNEL_ORDER.forEach((ch) => {
    if ((mix[ch] || 0) > 0 && (best === null || mix[ch] > mix[best])) best = ch
  })
  return String((channelStatus || {})[best || 'ticket'] || '')
}

export interface ProdFlagRule {
  x: number
  windowMin: number
  minIntervalMin: number
  statuses: string[]
  channelStatus: Record<string, string>
}

/**
 * prodDetectFlags_: intervals + casesByEmail + rule -> flag objects shaped like prod_flags
 * rows (without decision/review fields). Field order matches the legacy literal exactly.
 */
export function prodDetectFlags_(
  intervals: ProdInterval[],
  casesByEmail: Record<string, ProdCase[]>,
  rule: ProdFlagRule
): Record<string, unknown>[] {
  const windowMs = rule.windowMin * 60000
  const out: Record<string, unknown>[] = []
  intervals.forEach((iv) => {
    if (!iv.agentEmail || !prodIn_(iv.status, rule.statuses)) return
    if (iv.endMs - iv.startMs < rule.minIntervalMin * 60000) return
    const cases = casesByEmail[iv.agentEmail] || []
    const spans = prodQualifyingSpans_(cases, iv.startMs, iv.endMs, rule.x, windowMs)
    if (!spans.length) return
    const inSpan = cases.filter((c) => spans.some((sp) => c.ms >= sp[0] && c.ms < sp[1]))
    const firstCh: Record<string, string> = {}
    inSpan.forEach((c) => {
      if (!firstCh[c.id]) firstCh[c.id] = c.channel
    })
    const ids = Object.keys(firstCh)
    const mix: Record<string, number> = {}
    ids.forEach((id) => {
      mix[firstCh[id]] = (mix[firstCh[id]] || 0) + 1
    })
    out.push({
      flag_id: prodFlagId_(iv.agentEmail, iv.startMs, iv.status),
      date: iv.date,
      agent_email: iv.agentEmail,
      agent_name: iv.agentName,
      raw_status: iv.status,
      interval_start: new Date(iv.startMs).toISOString(),
      interval_end: new Date(iv.endMs).toISOString(),
      interval_min: prodRound2_((iv.endMs - iv.startMs) / 60000),
      spans_json: JSON.stringify(
        spans.map((s) => [new Date(s[0]).toISOString(), new Date(s[1]).toISOString()])
      ),
      flagged_min: prodRound2_(prodSpansMs_(spans) / 60000),
      case_count: inSpan.length,
      distinct_cases: ids.length,
      case_ids_json: JSON.stringify(ids.slice(0, 60).map((id) => [id, firstCh[id]])),
      channel_mix_json: JSON.stringify(mix),
      suggested_status: prodSuggestStatus_(mix, rule.channelStatus),
      rule_json: JSON.stringify({ x: rule.x, windowMin: rule.windowMin, minIntervalMin: rule.minIntervalMin }),
      confidence_score: 0,
      confidence_level: '',
      confidence_factors_json: '',
    })
  })
  return out
}

/**
 * prodWindowHist_ (A9 calibration): each interval of a class cut into consecutive full
 * windows from its start; distinct cases per window counted. classes: { idle, working }.
 */
export function prodWindowHist_(
  intervals: ProdInterval[],
  casesByEmail: Record<string, ProdCase[]>,
  windowMin: number,
  classes: { idle: string[]; working: string[] }
): { idle: Record<number, number>; working: Record<number, number> } {
  const w = windowMin * 60000
  const out: { idle: Record<number, number>; working: Record<number, number> } = { idle: {}, working: {} }
  intervals.forEach((iv) => {
    const cls = prodIn_(iv.status, classes.idle)
      ? 'idle'
      : prodIn_(iv.status, classes.working)
        ? 'working'
        : ''
    if (!cls || !iv.agentEmail) return
    const cases = casesByEmail[iv.agentEmail] || []
    for (let t = iv.startMs; t + w <= iv.endMs; t += w) {
      const ids: Record<string, boolean> = {}
      cases.forEach((c) => {
        if (c.ms >= t && c.ms < t + w) ids[c.id] = true
      })
      const n = Object.keys(ids).length
      out[cls][n] = (out[cls][n] || 0) + 1
    }
  })
  return out
}

// ---------------------------------------------------------------- layers

/** prodEffectiveStatus_ — alias of effectiveStatus (identical semantics). */
export const prodEffectiveStatus_ = effectiveStatus

export interface FdAuxRow {
  agentName?: unknown
  email: string
  status: string
  minutes: number
  date: string
}

/**
 * prodAdjustAux_: FD_AUX rows for the effective layer — each flag's minutes moved from raw
 * to effective status as a negative + positive row. Never moves more than FD_AUX holds for
 * that agent/day/status; the rest is reported clipped.
 */
export function prodAdjustAux_(
  fdAux: FdAuxRow[],
  flags: ProdFlagRow[] | Record<string, unknown>[]
): { rows: FdAuxRow[]; moved: Record<string, unknown>[]; clippedMin: number } {
  const avail: Record<string, number> = {}
  fdAux.forEach((f) => {
    const k = f.email + '|' + f.date + '|' + f.status
    avail[k] = (avail[k] || 0) + (Number(f.minutes) || 0)
  })
  const extra: FdAuxRow[] = []
  const moved: Record<string, unknown>[] = []
  let clipped = 0
  flags
    .slice()
    .sort((a, b) => String(a.interval_start).localeCompare(String(b.interval_start)))
    .forEach((f) => {
      const eff = prodEffectiveStatus_(f as ProdFlagRow)
      const raw = String(f.raw_status)
      if (!eff || eff === raw) return
      const email = prodNorm_(f.agent_email)
      const k = email + '|' + f.date + '|' + raw
      const want = Number(f.flagged_min) || 0
      const m = Math.max(0, Math.min(want, avail[k] || 0))
      clipped += want - m
      if (m <= 0) return
      avail[k] -= m
      extra.push({ agentName: f.agent_name, email, status: raw, minutes: -m, date: String(f.date) })
      extra.push({ agentName: f.agent_name, email, status: eff, minutes: m, date: String(f.date) })
      moved.push({ flagId: f.flag_id, email, date: f.date, from: raw, to: eff, minutes: m })
    })
  return { rows: fdAux.concat(extra), moved, clippedMin: prodRound2_(clipped) }
}

// ---------------------------------------------------------------- review rules

/** prodCheckDecision_ — alias of checkDecision (identical semantics and errors). */
export const prodCheckDecision_ = checkDecision

/** prodDueDate_: the creation day + reviewDays. */
export function prodDueDate_(createdKey: string, reviewDays: unknown): string {
  return dqAddDays_(createdKey, Number(reviewDays) || 0)
}

export function prodIsAutoDue_(flag: { decision?: unknown; due_date?: unknown }, todayKey: string): boolean {
  return flag.decision === 'pending' && !!flag.due_date && String(todayKey) >= String(flag.due_date)
}

/** prodCheckDispute_: DISABLED in legacy (ProdValidation.js:309-311). Throws verbatim. */
export function prodCheckDispute_(
  _flag?: unknown,
  _disputes?: unknown,
  _userEmail?: unknown,
  _todayKey?: unknown,
  _decidedKey?: unknown,
  _disputeDays?: unknown,
  _reason?: unknown
): never {
  // Params kept for legacy signature parity; the mechanism is disabled.
  String(_reason)
  throw new Error('Dispute mechanism is disabled.')
}

/** prodCheckDisputeDecision_: DISABLED in legacy (ProdValidation.js:317-319). */
export function prodCheckDisputeDecision_(
  _dispute?: unknown,
  _flag?: unknown,
  _input?: unknown,
  _statuses?: unknown
): never {
  // Params kept for legacy signature parity; the mechanism is disabled.
  String(_statuses)
  throw new Error('Dispute mechanism is disabled.')
}

// ---------------------------------------------------------------- confidence scoring

/**
 * prodConfidenceScore_ (Enhancement 3): base 50 plus the five factors; clamped 0-100.
 * cases / interval / agentHistory are accepted but unused (legacy placeholders).
 */
export function prodConfidenceScore_(
  flag: { distinct_cases?: unknown; interval_min?: unknown; channel_mix_json?: unknown },
  _cases?: unknown,
  _interval?: unknown,
  _agentHistory?: unknown
): { score: number; level: string; factors: string[] } {
  // cases / interval / agentHistory: legacy placeholder args kept for arity (see docstring).
  String(_agentHistory)
  let score = 50 // Base score
  const factors: string[] = []

  // Factor 1: Distinct cases count
  const caseCount = Number(flag.distinct_cases) || 0
  if (caseCount >= 10) {
    score += 20
    factors.push('10+ cases: +20')
  } else if (caseCount >= 5) {
    score += 15
    factors.push('5-9 cases: +15')
  } else if (caseCount >= 3) {
    score += 10
    factors.push('3-4 cases: +10')
  } else if (caseCount >= 2) {
    score += 5
    factors.push('2 cases: +5')
  } else {
    score -= 10
    factors.push('1 case: -10')
  }

  // Factor 2: Flag duration
  const duration = Number(flag.interval_min) || 0
  if (duration >= 30) {
    score += 15
    factors.push('30+ min: +15')
  } else if (duration >= 15) {
    score += 10
    factors.push('15-29 min: +10')
  } else if (duration >= 5) {
    score += 5
    factors.push('5-14 min: +5')
  } else {
    score -= 5
    factors.push('<5 min: -5')
  }

  // Factor 3: Case density (cases per minute)
  const density = duration > 0 ? caseCount / duration : 0
  if (density >= 0.5) {
    score += 10
    factors.push('High density: +10')
  } else if (density >= 0.3) {
    score += 5
    factors.push('Medium density: +5')
  } else if (density > 0) {
    score -= 5
    factors.push('Low density: -5')
  }

  // Factor 4: Channel consistency
  const mix = JSON.parse(String(flag.channel_mix_json || '{}')) as Record<string, number>
  const channels = Object.keys(mix).length
  if (channels === 1) {
    score += 10
    factors.push('Single channel: +10')
  } else if (channels === 2) {
    score += 0
    factors.push('2 channels: 0')
  } else {
    score -= 10
    factors.push('3+ channels: -10')
  }

  // Factor 5: Agent history (placeholder - can be expanded later)
  factors.push('Agent history: 0 (neutral)')

  score = Math.max(0, Math.min(100, score))
  const level = score >= 70 ? 'high' : score >= 50 ? 'medium' : score >= 30 ? 'low' : 'very_low'
  return { score, level, factors }
}
