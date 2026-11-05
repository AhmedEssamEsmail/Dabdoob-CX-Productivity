/**
 * Quality analytics pure functions — port of Quality_deprecated/Quality.js
 * lines 2075-3217 (confidence intervals, sample basis, volume, repeat
 * failures, the analytics payload, drill-down, team scores over a range,
 * and coverage). Names keep the legacy trailing underscore for the oracle.
 */

import {
  normEmail_,
  dqAddDays_,
} from '@/features/shared/lib/adapters'
import {
  qaRound1_, qaFinalScore_, qaRollupAudits_, qaBool_, qaParse_, qaPeriodOf_,
  qaQuestions_, qaIsNonTicket_, qaItemId_, qaWhen_, qaScore_, qaCtlSla_, qaAuditorKpis_,
  QA_ANSWERS, QA_FAIL_REASONS,
} from './core'
import { qaDaysBetween_, qaRangeBucket_ } from './pure'

export const QA_Z95 = 1.96
/** No individual verdict (score colour, scorecard, PIP evidence) under this many audits in the period. */
export const QA_MIN_VERDICT_N = 16
/** Team score = mean of agent means, over agents with at least this many random audits in the period. */
export const QA_AGENT_MIN_N = 10
/** Contact-reason rows and questions under this many audits are listed after the rest, never ranked first. */
export const QA_ROW_MIN_N = 10

/** High: the range is within ±3 points; Medium: within ±5; Low: wider, unknown, or fewer than 10 audits. */
export function qaConfidenceBadge_(n: number, margin: number | null): string {
  if (n < 10 || margin === null || !isFinite(margin)) return 'low'
  return margin <= 3 ? 'high' : margin <= 5 ? 'medium' : 'low'
}

/** Wilson 95% interval of k in n, in %: { pct, lo, hi }; null when n is 0. */
export function qaWilson_(k: number, n: number): { pct: number; lo: number; hi: number } | null {
  if (!n) return null
  const z2 = QA_Z95 * QA_Z95
  const p = k / n
  const den = 1 + z2 / n
  const mid = (p + z2 / (2 * n)) / den
  const half = (QA_Z95 * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / den
  return { pct: qaRound1_(p * 100), lo: qaRound1_(Math.max(0, mid - half) * 100), hi: qaRound1_(Math.min(1, mid + half) * 100) }
}

/**
 * Pure: the range of a run of identical scores (SD 0): the normal formula says ±0, which
 * claims a certainty ten audits cannot give. Use the Wilson lower bound of "n of n" instead.
 */
export function qaFlatMargin_(n: number): number {
  return qaRound1_(100 - (qaWilson_(n, n) as { lo: number }).lo)
}

export interface QaCi {
  n: number
  mean: number | null
  sd: number | null
  margin: number | null
  badge: string
}

/** Pure: mean ± 1.96·s/√n of audit scores; N optional finite-population correction. */
export function qaMeanCi_(scores: number[], N?: number): QaCi {
  const n = scores.length
  if (!n) return { n: 0, mean: null, sd: null, margin: null, badge: 'low' }
  const mean = scores.reduce((t, x) => t + x, 0) / n
  const sd = n > 1 ? Math.sqrt(scores.reduce((t, x) => t + (x - mean) * (x - mean), 0) / (n - 1)) : null
  const fpc = N && N > n ? Math.sqrt((N - n) / (N - 1)) : 1
  const margin = sd === null ? null : sd === 0 ? qaFlatMargin_(n) : ((QA_Z95 * sd) / Math.sqrt(n)) * fpc
  return { n, mean: qaRound1_(mean), sd: sd === null ? null : qaRound1_(sd), margin: margin === null ? null : qaRound1_(margin), badge: qaConfidenceBadge_(n, margin) }
}

export interface QaAgentCi {
  n: number
  agents: number
  excluded: number
  mean: number | null
  auditMean: number | null
  margin: number | null
  badge: string
}

/** Pure: a group score with every agent weighted equally: the mean of agent means. */
export function qaAgentMeanCi_(items: { agent: string; score: number }[], minN?: number): QaAgentCi {
  const by: Record<string, number[]> = {}
  items.forEach((it) => {
    ;(by[it.agent] = by[it.agent] || []).push(it.score)
  })
  const all = Object.keys(by)
  const keys = all.filter((k) => by[k].length >= (minN || 1))
  let n = 0
  let sum = 0
  let ss = 0
  let df = 0
  let inv = 0
  let means = 0
  keys.forEach((k) => {
    const l = by[k]
    const m = l.reduce((t, x) => t + x, 0) / l.length
    means += m
    n += l.length
    inv += 1 / l.length
    df += l.length - 1
    l.forEach((x) => {
      sum += x
      ss += (x - m) * (x - m)
    })
  })
  const k = keys.length
  if (!k) return { n: 0, agents: 0, excluded: all.length, mean: null, auditMean: null, margin: null, badge: 'low' }
  let margin: number | null = null
  if (df > 0) margin = ss === 0 ? qaFlatMargin_(n) : (QA_Z95 * Math.sqrt((ss / df) * inv)) / k
  return {
    n, agents: k, excluded: all.length - k, mean: qaRound1_(means / k), auditMean: qaRound1_(sum / n),
    margin: margin === null ? null : qaRound1_(margin), badge: qaConfidenceBadge_(n, margin),
  }
}

/** Pure: 'up' | 'down' only when the change is larger than the combined range √(m1² + m2²); otherwise ''. */
export function qaTrend_(cur: { mean: number | null; margin: number | null } | null, prev: { mean: number | null; margin: number | null } | null): string {
  if (!cur || !prev || cur.margin === null || prev.margin === null || cur.mean === null || prev.mean === null) return ''
  const d = cur.mean - prev.mean
  return Math.abs(d) > Math.sqrt(cur.margin * cur.margin + prev.margin * prev.margin) ? (d > 0 ? 'up' : 'down') : ''
}

/** The period before a week (its start date, yyyy-MM-dd) or month (yyyy-MM) key. */
export function qaPrevPeriod_(period: string, grain: string): string {
  const p = String(period)
  if (grain === 'week') return dqAddDays_(p, -7)
  const d = new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7) - 2, 1))
  return d.toISOString().slice(0, 7)
}

/** The last day (yyyy-MM-dd) of a week or month period. */
export function qaPeriodEnd_(period: string, grain: string): string {
  const p = String(period)
  if (grain === 'week') return dqAddDays_(p, 6)
  return new Date(Date.UTC(+p.slice(0, 4), +p.slice(5, 7), 0)).toISOString().slice(0, 10)
}

/** The first day (yyyy-MM-dd) of a week or month period. */
export function qaPeriodStart_(period: string, grain: string): string {
  return grain === 'week' ? String(period) : String(period) + '-01'
}

// ---- Sample basis ----

/**
 * The date an audit counts on: basis 'interaction' (default) = the Riyadh date of interaction_at,
 * falling back to audit_date; basis 'audit' = audit_date.
 */
export function qaScoreDate_(a: Record<string, unknown>, basis: string): string {
  if (basis !== 'audit') {
    const m = /^(\d{4}-\d{2}-\d{2})/.exec(qaWhen_(a.interaction_at))
    if (m) return m[1]
  }
  return String(a.audit_date || '').slice(0, 10)
}

/** True when the audit carries its own interaction date. */
export function qaHasInteraction_(a: Record<string, unknown>): boolean {
  return /^\d{4}-\d{2}-\d{2}/.test(qaWhen_(a.interaction_at))
}

/** How an audit was chosen. Only 'random' (the engine's daily draw) feeds the headline and the ranges. */
export const QA_BASES = ['random', 'targeted', 'request', 'off-queue', 'non-ticket', 'historical', 'unknown']

/** Pure, the write and backfill rule for sample_basis. */
export function qaDeriveBasis_(a: Record<string, unknown>): string {
  if (qaIsNonTicket_(a)) return 'non-ticket'
  const src = String(a.source || '')
  if (src === 'request') return 'request'
  if (src === 'offqueue') return 'off-queue'
  if (a.status === 'historical' || / form$/.test(src)) return 'historical'
  if (!src && String(a.queue_id || '')) return 'random'
  return 'unknown'
}

/** The stored basis; a blank row gets the backfill rule qaDeriveBasis_ at read time. */
export function qaSampleBasis_(a: Record<string, unknown>): string {
  if (qaIsNonTicket_(a)) return 'non-ticket'
  const b = String(a.sample_basis || '').trim()
  if (!b) return qaDeriveBasis_(a)
  return QA_BASES.indexOf(b) !== -1 ? b : 'unknown'
}

/**
 * Pure: the simple column charts: plain average of random + old-form history audits per week
 * (last 8) and per month (last 6), ending at anchor, for the team and each agent.
 */
export function qaColumnTrend_(
  known: Record<string, unknown>[],
  anchor: string,
  startsOn: number,
  nameOf: (e: string) => string,
  dateOf?: (a: Record<string, unknown>) => string
): Record<string, unknown> {
  const dof = dateOf || ((a) => String(a.audit_date).slice(0, 10))
  const list = known.filter((a) => {
    const b = qaSampleBasis_(a)
    return b === 'random' || b === 'historical'
  })
  const cell = (l: Record<string, unknown>[]) => ({
    avg: l.length ? qaRound1_(l.reduce((s, a) => s + qaFinalScore_(a), 0) / l.length) : null,
    audits: l.length,
    history: l.filter((a) => qaSampleBasis_(a) === 'historical').length,
  })
  const grainOf = (grain: string, n: number) => {
    const periods = [qaPeriodOf_(anchor, grain, startsOn)]
    while (periods.length < n) periods.unshift(qaPrevPeriod_(periods[0], grain))
    const at: Record<string, number> = {}
    const agents: Record<string, Record<string, unknown>[][]> = {}
    periods.forEach((p, i) => {
      at[p] = i
    })
    const team: Record<string, unknown>[][] = periods.map(() => [])
    list.forEach((a) => {
      const i = at[qaPeriodOf_(dof(a), grain, startsOn)]
      if (i === undefined) return
      const e = normEmail_(a.agent_email)
      team[i].push(a)
      if (e) (agents[e] = agents[e] || periods.map(() => []))[i].push(a)
    })
    return {
      periods,
      team: team.map(cell),
      agents: Object.keys(agents)
        .map((e) => ({ key: e, label: nameOf(e), cells: agents[e].map(cell) }))
        .sort((x, y) => String(x.label).localeCompare(String(y.label))),
    }
  }
  return { week: grainOf('week', 8), month: grainOf('month', 6) }
}

// ---- Flat export ----

export const QA_FLAT_LEAD = [
  'audit_id', 'kind', 'audit_date', 'interaction_at', 'channel', 'contact_type', 'ticket_id', 'agent_email', 'tl_email', 'auditor_email',
  'score', 'score_final', 'fatal', 'status', 'sample_basis', 'form_id', 'form_version',
]

/**
 * Pure: audits (qa_audits objects) + formsByKey -> { header, rows, noAnswers, noForm, unknownIds }.
 * One column per distinct "Section › question text", in form order.
 */
export function qaFlattenAudits_(
  audits: Record<string, unknown>[],
  formsByKey: Record<string, { sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] } | null>
): Record<string, unknown> {
  const cols: string[] = []
  const colIdx: Record<string, number> = {}
  const perForm: Record<string, Record<string, { col: number; label: string }> | null> = {}
  const noAnswers: string[] = []
  const noForm: string[] = []
  const unknownIds: string[] = []
  function formCols(key: string) {
    if (perForm[key] !== undefined) return perForm[key]
    const f = formsByKey[key]
    const map: Record<string, { col: number; label: string }> = {}
    if (f)
      qaQuestions_(f).forEach((q) => {
        const label = (q.section ? q.section + ' › ' : '') + q.text.replace(/\s+/g, ' ').trim()
        if (colIdx[label] === undefined) {
          colIdx[label] = cols.length
          cols.push(label)
        }
        map[q.id] = { col: colIdx[label], label }
      })
    return (perForm[key] = f ? map : null)
  }
  audits.forEach((a) => {
    formCols(String(a.form_id) + '|' + String(a.form_version))
  })
  const rows = audits.map((a) => {
    const id = String(a.audit_id)
    const map = formCols(String(a.form_id) + '|' + String(a.form_version))
    let answers = qaParse_(a.answers_json, null) as Record<string, unknown> | null
    const why = (qaParse_(a.fail_reasons_json, {}) || {}) as Record<string, unknown>
    if (!answers || typeof answers !== 'object' || !Object.keys(answers).length) {
      answers = {}
      noAnswers.push(id)
    }
    const hasForm = !!map
    if (!hasForm) {
      noForm.push(id)
    }
    const m2 = map || {}
    const qs = cols.map(() => '')
    const bad: string[] = []
    Object.keys(answers).forEach((qid) => {
      if (m2[qid]) qs[m2[qid].col] = String((answers as Record<string, unknown>)[qid])
      else bad.push(qid)
    })
    if (bad.length && hasForm) unknownIds.push(id + ': ' + bad.join(','))
    const reasons = Object.keys(why)
      .map((qid) => (m2[qid] ? m2[qid].label : qid) + ': ' + why[qid])
      .join('\n')
    return QA_FLAT_LEAD.map((h) => (a[h] === undefined || a[h] === null ? '' : h === 'interaction_at' ? qaWhen_(a[h]) : a[h])).concat(qs as unknown[] as string[], [
      String(a.comment || ''),
      reasons,
    ])
  })
  return { header: QA_FLAT_LEAD.concat(cols, ['comment', 'fail_reasons']), rows, noAnswers, noForm, unknownIds }
}

/** A score is known: blank score cells are left out of every average. */
export function qaScoreKnown_(a: Record<string, unknown>): boolean {
  return String(a.score_final === undefined ? '' : a.score_final).trim() !== '' || String(a.score === undefined ? '' : a.score).trim() !== ''
}

/** A critical fail that still stands (a re-scored audit's old flag is not trusted). */
export function qaIsCritical_(a: Record<string, unknown>): boolean {
  return qaBool_(a.fatal) && a.status !== 'rescored'
}

// ---- Contact-type volume ----

/**
 * Pure: post-stratified mean. scoresByType: { type: [scores] }; volume: { type: tickets }.
 * Returns { mean, coverage } or null when no audited type has a volume.
 */
export function qaPostStratify_(scoresByType: Record<string, number[]>, volume: Record<string, unknown>): { mean: number; coverage: number } | null {
  let all = 0
  let tot = 0
  let sum = 0
  Object.keys(volume || {}).forEach((t) => {
    all += Number(volume[t]) || 0
  })
  Object.keys(scoresByType).forEach((t) => {
    const v = Number((volume || {})[t]) || 0
    const l = scoresByType[t]
    if (!v || !l.length) return
    sum += (v * l.reduce((s, x) => s + x, 0)) / l.length
    tot += v
  })
  return tot ? { mean: qaRound1_(sum / tot), coverage: qaRound1_((tot / all) * 100) } : null
}

/** Pure: the engine pool as qa_volume rows, one per day x channel x contact type. */
export function qaVolumeRows_(pool: { day?: string; channel?: string; contactType?: string }[], nowIso: string): Record<string, unknown>[] {
  const by: Record<string, number> = {}
  ;(pool || []).forEach((p) => {
    const k = [p.day, p.channel, p.contactType || '(not set)'].join('|')
    by[k] = (by[k] || 0) + 1
  })
  return Object.keys(by).map((k) => {
    const x = k.split('|')
    return { date: x[0], channel: x[1], contact_type: x[2], tickets: by[k], updated_at: nowIso }
  })
}

/** Pure: qa_volume rows of one period as { 'channel|type': tickets }. */
export function qaVolumeFor_(rows: Record<string, unknown>[], grain: string, period: string, startsOn: number): Record<string, number> {
  const out: Record<string, number> = {}
  ;(rows || []).forEach((r) => {
    if (qaPeriodOf_(String(r.date).slice(0, 10), grain, startsOn) !== period) return
    const k = String(r.channel) + '|' + String(r.contact_type || '(not set)')
    out[k] = (out[k] || 0) + (Number(r.tickets) || 0)
  })
  return out
}

// ---- Repeat failures ----

export const QA_REPEAT_DAYS = 30
export const QA_REPEAT_LOOKBACK_DAYS = 90

export interface QaFailMemCell {
  text: string
  fails: number
  asked: number
  last: string
  coachedOn: string
  afterCtl: string
  afterAsked: number
  afterFails: number
  reason: string
  repeat: boolean
  tlEmail: string
}

/**
 * Pure: per agent, the questions they failed recently, up to `todayKey`.
 * { agentEmail: { 'formId|questionId': { text, fails, asked, last, coachedOn, afterCtl,
 *   afterAsked, afterFails, reason, repeat, tlEmail } } }.
 */
export function qaFailMemory_(
  audits: Record<string, unknown>[],
  ctls: Record<string, unknown>[],
  forms: { byKey: Record<string, { formId?: string; sections?: { title?: unknown; questions?: unknown[]; optional?: unknown }[] }> },
  todayKey: string,
  handledOf?: (a: Record<string, unknown>) => string
): Record<string, Record<string, QaFailMemCell>> {
  const from = dqAddDays_(todayKey, -QA_REPEAT_LOOKBACK_DAYS)
  const recent = dqAddDays_(todayKey, -(QA_REPEAT_DAYS - 1))
  const coached: Record<string, string> = {}
  ctls.forEach((c) => {
    if (c.status !== 'cancelled' && c.submitted_date) coached[String(c.audit_id)] = String(c.submitted_date).slice(0, 10)
  })
  interface Ev {
    agent: string
    key: string
    text: string
    list: { date: string; fail: boolean; ctl: string; tl: string; why: string }[]
  }
  const ev: Record<string, Ev> = {}
  qaRollupAudits_(audits).forEach((a) => {
    if (a.status === 'rescored') return
    const d = (handledOf && handledOf(a)) || String(a.audit_date).slice(0, 10)
    if (d < from || d > todayKey) return
    const f = forms.byKey[String(a.form_id) + '|' + String(a.form_version)]
    if (!f) return
    const ans = qaParse_(a.answers_json, {}) as Record<string, string>
    const why = (qaParse_(a.fail_reasons_json, {}) || {}) as Record<string, string>
    qaQuestions_(f).forEach((q) => {
      const v = ans[q.id]
      if (v !== 'fail' && v !== 'pass') return
      const agent = normEmail_(a.agent_email)
      const key = String(f.formId) + '|' + q.id
      const e = (ev[agent + '|' + key] = ev[agent + '|' + key] || { agent, key, text: q.text, list: [] })
      e.list.push({ date: d, fail: v === 'fail', ctl: v === 'fail' ? coached[String(a.audit_id)] || '' : '', tl: normEmail_(a.tl_email), why: why[q.id] || '' })
    })
  })
  const out: Record<string, Record<string, QaFailMemCell>> = {}
  Object.keys(ev).forEach((k) => {
    const e = ev[k]
    const list = e.list.sort((a, b) => a.date.localeCompare(b.date))
    const fails = list.filter((x) => x.fail)
    if (!fails.length) return
    const inWin = fails.filter((x) => x.date >= recent)
    const coachedOn = fails.reduce((m, x) => (x.ctl > m ? x.ctl : m), '')
    if (!inWin.length && !coachedOn) return
    let afterCtl = ''
    inWin.forEach((x) => {
      fails.forEach((p) => {
        if (p.ctl && p.ctl < x.date && p.ctl > afterCtl) afterCtl = p.ctl
      })
    })
    const after = coachedOn ? list.filter((x) => x.date > coachedOn) : []
    const tags: Record<string, number> = {}
    inWin.forEach((x) => {
      if (x.why) tags[x.why] = (tags[x.why] || 0) + 1
    })
    const reason = Object.keys(tags).sort((a, b) => tags[b] - tags[a])[0] || ''
    const last = fails[fails.length - 1]
    ;(out[e.agent] = out[e.agent] || {})[e.key] = {
      text: e.text,
      fails: inWin.length,
      asked: list.filter((x) => x.date >= recent).length,
      last: last.date,
      coachedOn,
      afterCtl,
      afterAsked: after.length,
      afterFails: after.filter((x) => x.fail).length,
      reason,
      repeat: inWin.length >= 2 || !!afterCtl,
      tlEmail: last.tl,
    }
  })
  return out
}

/** Pure: the repeat failures of a fail memory as rows for team leads, most fails first. */
export function qaRepeatList_(memory: Record<string, Record<string, QaFailMemCell>>, nameOf: (e: string) => string): Record<string, unknown>[] {
  const out: Record<string, unknown>[] = []
  Object.keys(memory).forEach((agent) => {
    Object.keys(memory[agent]).forEach((key) => {
      const m = memory[agent][key]
      if (!m.repeat) return
      out.push({
        agentEmail: agent,
        agentName: nameOf(agent),
        tlName: m.tlEmail ? nameOf(m.tlEmail) : '',
        key,
        text: m.text,
        fails: m.fails,
        asked: m.asked,
        last: m.last,
        afterCtl: m.afterCtl,
        afterAsked: m.afterAsked,
        afterFails: m.afterFails,
        reason: m.reason,
      })
    })
  })
  return out.sort(
    (a, b) => Number(b.fails) - Number(a.fails) || (b.afterCtl ? 1 : 0) - (a.afterCtl ? 1 : 0) || String(b.last).localeCompare(String(a.last))
  )
}

export function qaReasonCounts_(): Record<string, number> {
  return { agent: 0, process: 0, product: 0, kb: 0, untagged: 0 }
}

/** Pure: rows with n ≥ gate (verdict rows) first, lowest score first; the rest after them. */
export function qaGateSort_<T extends { audits: number; avg: number | null }>(rows: T[], gate: number): T[] {
  return rows.sort((a, b) => {
    const va = a.audits >= gate ? 0 : 1
    const vb = b.audits >= gate ? 0 : 1
    return va - vb || Number(a.avg === null) - Number(b.avg === null) || (a.avg as number) - (b.avg as number) || b.audits - a.audits
  })
}

/**
 * Pure: points one failed question costs an audit, on the audit's own scale. possible:
 * qaScore_().possible of that audit.
 */
export function qaPointsLost_(def: { scoring?: string }, q: { fatal: boolean; weight: number }, possible: number): number {
  if (def.scoring === 'deduction') return Math.min(100, q.weight)
  if (q.fatal) return 100
  return possible > 0 ? (q.weight / possible) * 100 : 0
}

// ---- The analytics payload (Quality.js 2518-2791) ----

export interface QaAnalyticsOpts {
  weekStartsOn?: unknown
  basis?: string
  volume?: Record<string, unknown>[]
  quota?: Record<string, { name: string; perWeek: number; perDay: number }>
  handledOf?: (a: Record<string, unknown>) => string
}

/**
 * Pure: the whole quality-analytics payload for one period (week first day yyyy-MM-dd or month yyyy-MM).
 * audits/ctls/disputes/cals/kb: the qa_* rows; forms: qaForms_(); nameOf: email -> display name.
 */
export function qaAnalytics_(
  audits: Record<string, unknown>[],
  forms: { list: Record<string, unknown>[]; byKey: Record<string, Record<string, unknown>> },
  disputes: Record<string, unknown>[],
  ctls: Record<string, unknown>[],
  cals: Record<string, unknown>[],
  kb: Record<string, unknown>[],
  grain: string,
  period: string,
  todayKey: string,
  nameOf: (e: string) => string,
  opts?: QaAnalyticsOpts
): Record<string, unknown> {
  opts = opts || {}
  const startsOn = Number(opts.weekStartsOn) === 1 ? 1 : 0
  const per = (d: unknown) => qaPeriodOf_(String(d).slice(0, 10), grain, startsOn)
  const basis = opts.basis === 'audit' ? 'audit' : 'interaction'
  const dateOf = (a: Record<string, unknown>) => qaScoreDate_(a, basis)
  const prevP = qaPrevPeriod_(period, grain)
  const prev2P = qaPrevPeriod_(prevP, grain)
  const pStart = qaPeriodStart_(period, grain)
  const pEnd = qaPeriodEnd_(period, grain)
  const anchor = pEnd < todayKey ? pEnd : todayKey
  const rolled = qaRollupAudits_(audits)
  let blankScores = 0
  const known = rolled.filter((a) => {
    if (qaScoreKnown_(a)) return true
    if (per(dateOf(a)) === period) blankScores++
    return false
  })
  const inP = (p: string) => known.filter((a) => per(dateOf(a)) === p)
  const isRandom = (a: Record<string, unknown>) => qaSampleBasis_(a) === 'random'
  const cur = inP(period)
  const rnd = cur.filter(isRandom)
  const rndPrev = inP(prevP).filter(isRandom)
  const rndPrev2 = inP(prev2P).filter(isRandom)
  const item = (a: Record<string, unknown>) => ({ agent: normEmail_(a.agent_email), score: qaFinalScore_(a) })
  const by = (list: Record<string, unknown>[], keyOf: (a: Record<string, unknown>) => string) => {
    const o: Record<string, Record<string, unknown>[]> = {}
    list.forEach((a) => {
      const k = keyOf(a)
      if (k) (o[k] = o[k] || []).push(a)
    })
    return o
  }
  const agentOf = (a: Record<string, unknown>) => normEmail_(a.agent_email)
  const scores = (l: Record<string, unknown>[]) => l.map(qaFinalScore_)
  const meanOf = (l: Record<string, unknown>[]) => (l.length ? qaRound1_(l.reduce((s, a) => s + qaFinalScore_(a), 0) / l.length) : null)

  // Block 2 (health strip): team score with every agent equal, random audits only.
  const team = qaAgentMeanCi_(rnd.map(item), QA_AGENT_MIN_N)
  const teamPrev = qaAgentMeanCi_(rndPrev.map(item), QA_AGENT_MIN_N)
  const critical = rnd.filter(qaIsCritical_).length
  const vol = qaVolumeFor_(opts.volume || [], grain, period, startsOn)
  const typeKey = (a: Record<string, unknown>) => String(a.channel || '') + '|' + (String(a.contact_type || '').trim() || '(not set)')
  const typeScores = (list: Record<string, unknown>[]) => {
    const o = by(list, typeKey)
    const out: Record<string, number[]> = {}
    Object.keys(o).forEach((k) => {
      out[k] = scores(o[k])
    })
    return out
  }
  const agentsAll = by(rnd, agentOf)
  const quota = opts.quota || {}
  const elapsed = anchor < pStart ? 0 : Math.round((Date.parse(anchor) - Date.parse(pStart)) / 864e5) + 1
  const doneBy: Record<string, number> = {}
  audits.forEach((a) => {
    if (a.kind === 'calibration' || a.status === 'voided' || a.source === 'offqueue' || per(a.audit_date) !== period) return
    const e = agentOf(a)
    doneBy[e] = (doneBy[e] || 0) + 1
  })
  const expectedOf = (q: { perWeek: number }) => Math.floor((q.perWeek * elapsed) / 7)
  let quotaDone = 0
  let quotaExpected = 0
  Object.keys(quota).forEach((e) => {
    quotaExpected += expectedOf(quota[e])
    quotaDone += Math.min(doneBy[e] || 0, expectedOf(quota[e]))
  })
  const pending = audits.filter((a) => String(a.kind || 'audit') === 'audit' && a.status === 'disputed' && per(dateOf(a)) === period).length
  const health = {
    score: team.mean, margin: team.margin, badge: team.badge, agents: team.agents, agentsExcluded: team.excluded, auditMean: team.auditMean,
    prevScore: teamPrev.mean, trend: qaTrend_(team, teamPrev),
    scoreNoCritical: qaAgentMeanCi_(rnd.filter((a) => !qaIsCritical_(a)).map(item), QA_AGENT_MIN_N).mean,
    critical, criticalRate: qaWilson_(critical, rnd.length),
    weighted: qaPostStratify_(typeScores(rnd), vol),
    agentsAudited: Object.keys(agentsAll).length,
    agentsVerdict: Object.keys(agentsAll).filter((k) => agentsAll[k].length >= QA_MIN_VERDICT_N).length,
    pendingDisputes: pending, notFinal: pending > 0,
    quotaDone, quotaExpected, quotaPct: quotaExpected ? qaRound1_((quotaDone / quotaExpected) * 100) : null,
  }

  // Samples that are not in the score, with their n (D1).
  const bases = QA_BASES.map((b) => {
    const l = cur.filter((a) => qaSampleBasis_(a) === b)
    return { basis: b, audits: l.length, avg: meanOf(l), critical: l.filter(qaIsCritical_).length }
  }).filter((x) => x.audits)

  // Block 7: agents (random ticket audits), with their channels apart (D5) and agent / other reason split (D11).
  const prevBy = by(rndPrev, agentOf)
  const prev2By = by(rndPrev2, agentOf)
  const tlOf: Record<string, string> = {}
  cur.concat(rndPrev).forEach((a) => {
    if (a.tl_email && !tlOf[agentOf(a)]) tlOf[agentOf(a)] = normEmail_(a.tl_email)
  })
  const byAgent = Object.keys(agentsAll).map((k) => {
    const list = agentsAll[k]
    const ci = qaMeanCi_(scores(list))
    const pci = prevBy[k] ? qaMeanCi_(scores(prevBy[k])) : null
    const p2 = prev2By[k] ? qaMeanCi_(scores(prev2By[k])) : null
    const fatal = list.filter(qaIsCritical_).length
    const chans = by(list, (a) => String(a.channel || ''))
    const row: Record<string, unknown> = {
      key: k, label: nameOf(k), tlName: tlOf[k] ? nameOf(tlOf[k]) : '', audits: list.length, avg: ci.mean, fatal, sd: ci.sd, margin: ci.margin,
      badge: ci.badge, verdict: list.length >= QA_MIN_VERDICT_N, prevAvg: pci ? pci.mean : null, trend: qaTrend_(ci, pci),
      falling: qaTrend_(ci, pci) === 'down' && qaTrend_(pci, p2) === 'down',
      channels: Object.keys(chans)
        .sort()
        .map((c) => ({ channel: c, audits: chans[c].length, avg: meanOf(chans[c]) })),
      reasons: { agent: 0, other: 0, untagged: 0 },
    }
    if (grain === 'month') {
      row.fullMarks = qaWilson_(list.filter((a) => qaFinalScore_(a) >= 100).length, list.length)
      row.fatalRate = qaWilson_(fatal, list.length)
    }
    return row
  })
  const agentRow: Record<string, Record<string, unknown>> = {}
  byAgent.forEach((r) => {
    agentRow[r.key as string] = r
  })

  // Trend: the team score (same rule as the health strip) and each agent's random-audit average.
  const histP = [period]
  while (histP.length < (grain === 'week' ? 8 : 6)) histP.unshift(qaPrevPeriod_(histP[0], grain))
  const rndBy = by(known.filter(isRandom), (a) => per(dateOf(a)))
  const history = histP.map((p) => {
    const l = rndBy[p] || []
    const t = qaAgentMeanCi_(l.map(item), QA_AGENT_MIN_N)
    return { period: p, score: t.mean, margin: t.margin, badge: t.badge, agents: t.agents, audits: l.length, critical: l.filter(qaIsCritical_).length }
  })
  const histBy = histP.map((p) => by(rndBy[p] || [], agentOf))
  byAgent.forEach((r) => {
    r.history = histBy.map((o) => {
      const l = o[r.key as string] || []
      return { audits: l.length, avg: meanOf(l) }
    })
  })
  const columns = qaColumnTrend_(known, anchor, startsOn, nameOf, dateOf)

  // Block 3 (points lost map, D10) and reasons (D11), random ticket audits; re-scored ones skipped (D7).
  const gapsByAudit: Record<string, number> = {}
  ;(kb || []).forEach((g) => {
    gapsByAudit[String(g.audit_id)] = (gapsByAudit[String(g.audit_id)] || 0) + 1
  })
  const qStats: Record<string, Record<string, unknown>> = {}
  const reasonTotals = qaReasonCounts_()
  let rescoredSkipped = 0
  rnd.forEach((a) => {
    if (a.status === 'rescored') {
      rescoredSkipped++
      return
    }
    const f = forms.byKey[String(a.form_id) + '|' + String(a.form_version)]
    if (!f) return
    const ans = qaParse_(a.answers_json, {}) as Record<string, string>
    const why = (qaParse_(a.fail_reasons_json, {}) || {}) as Record<string, string>
    const possible = qaScore_(f as never, ans).possible
    const ar = agentRow[agentOf(a)]
    qaQuestions_(f as never).forEach((q) => {
      const v = ans[q.id]
      if (!v) return
      const k = String(f.formId) + '|' + q.id
      const s = (qStats[k] =
        qStats[k] || {
          key: k, text: q.text, section: q.section, channel: f.channel === '*' ? String(a.channel || '') : f.channel,
          fatal: q.fatal || (f.scoring === 'deduction' && q.weight >= 100), asked: 0, failed: 0, na: 0, lost: 0, kbGaps: 0,
          reasons: qaReasonCounts_(), agents: {} as Record<string, number>,
        })
      if (v === 'na') {
        s.na = (s.na as number) + 1
        return
      }
      s.asked = (s.asked as number) + 1
      if (v !== 'fail') return
      s.failed = (s.failed as number) + 1
      s.lost = (s.lost as number) + qaPointsLost_(f as { scoring?: string }, q, possible)
      s.kbGaps = (s.kbGaps as number) + (gapsByAudit[String(a.audit_id)] || 0)
      const ags = s.agents as Record<string, number>
      ags[agentOf(a)] = (ags[agentOf(a)] || 0) + 1
      const r = QA_FAIL_REASONS.indexOf(why[q.id]) !== -1 ? why[q.id] : 'untagged'
      ;(s.reasons as Record<string, number>)[r]++
      reasonTotals[r]++
      if (ar) {
        const arReasons = ar.reasons as Record<string, number>
        arReasons[r === 'agent' ? 'agent' : r === 'untagged' ? 'untagged' : 'other']++
      }
    })
  })
  const questions = Object.keys(qStats)
    .map((k) => {
      const s = qStats[k]
      const base = (s.asked as number) + (s.na as number)
      s.failPct = (s.asked as number) ? qaRound1_(((s.failed as number) / (s.asked as number)) * 100) : null
      s.naPct = base ? qaRound1_(((s.na as number) / base) * 100) : null
      s.lossPer100 = base ? qaRound1_(((s.lost as number) / base) * 100) : 0
      s.lost = qaRound1_(s.lost as number)
      s.gated = (s.asked as number) < QA_ROW_MIN_N
      s.agentsFailed = Object.keys(s.agents as Record<string, number>).length
      delete s.agents
      return s
    })
    .filter((s) => (s.failed as number) > 0)
    .sort(
      (a, b) =>
        Number(a.gated ? 1 : 0) - Number(b.gated ? 1 : 0) ||
        (b.lossPer100 as number) - (a.lossPer100 as number) ||
        (b.failed as number) - (a.failed as number)
    )
  const tagged = reasonTotals.agent + reasonTotals.process + reasonTotals.product + reasonTotals.kb
  const failedTotal = tagged + reasonTotals.untagged

  // Block 4: questions most often failed for a reason outside the agent (tagged share >= 60%, n >= 10 tagged).
  const outside = questions
    .map((q) => {
      const qr = q.reasons as Record<string, number>
      const t = qr.agent + qr.process + qr.product + qr.kb
      const o = t - qr.agent
      return {
        key: q.key, text: q.text, channel: q.channel, tagged: t, outside: o,
        sharePct: t ? qaRound1_((o / t) * 100) : 0, process: qr.process, product: qr.product, kb: qr.kb, kbGaps: q.kbGaps,
      }
    })
    .filter((x) => x.tagged >= QA_ROW_MIN_N && x.sharePct >= 60)
    .sort((a, b) => b.outside - a.outside)

  // Block 5: the coaching loop, anchored to the period's end (D9).
  const memory = qaFailMemory_(audits, ctls, forms as never, anchor, opts.handledOf)
  const repeats = qaRepeatList_(memory, nameOf)
  let postFails = 0
  let postAsked = 0
  Object.keys(memory).forEach((ag) => {
    Object.keys(memory[ag]).forEach((k) => {
      const m = memory[ag][k]
      if (m.coachedOn) {
        postFails += m.afterFails
        postAsked += m.afterAsked
      }
    })
  })
  const ctlOpen: Record<string, number> = {}
  const ctlOver: Record<string, number> = {}
  let openTotal = 0
  let overTotal = 0
  ;(ctls || []).forEach((c) => {
    if (c.status !== 'open') return
    const tl = normEmail_(c.tl_email)
    ctlOpen[tl] = (ctlOpen[tl] || 0) + 1
    openTotal++
    if (String(c.due_date || '') && String(c.due_date).slice(0, 10) < todayKey) {
      ctlOver[tl] = (ctlOver[tl] || 0) + 1
      overTotal++
    }
  })
  const coaching = { ctlOpen: openTotal, ctlOverdue: overTotal, postCtl: qaWilson_(postFails, postAsked), postCtlFails: postFails, postCtlAsked: postAsked }

  // Block 6: segments. Channel and contact reason within channel, every agent equal, with the ticket-mix weighted score (D3).
  const seg = (keyOf: (a: Record<string, unknown>) => string, labelOf: (k: string) => string, gate: number) => {
    const g = by(rnd, keyOf)
    const pg = by(rndPrev, keyOf)
    return qaGateSort_(
      Object.keys(g).map((k) => {
        const ci = qaAgentMeanCi_(g[k].map(item), 1)
        const pci = pg[k] ? qaAgentMeanCi_(pg[k].map(item), 1) : null
        return {
          key: k, label: labelOf(k), audits: g[k].length, agents: ci.agents, avg: ci.mean, auditAvg: ci.auditMean, margin: ci.margin, badge: ci.badge,
          verdict: g[k].length >= gate, trend: qaTrend_(ci, pci), prevAvg: pci ? pci.mean : null, fatal: g[k].filter(qaIsCritical_).length,
        }
      }),
      gate
    ) as Record<string, unknown>[]
  }
  const byChannel = seg((a) => String(a.channel || ''), (k) => k, QA_MIN_VERDICT_N)
  byChannel.forEach((r) => {
    const sub: Record<string, number[]> = {}
    const v: Record<string, unknown> = {}
    Object.keys(vol).forEach((k) => {
      if (k.indexOf(String(r.key) + '|') === 0) v[k] = vol[k]
    })
    rnd.forEach((a) => {
      if (String(a.channel || '') === r.key) (sub[typeKey(a)] = sub[typeKey(a)] || []).push(qaFinalScore_(a))
    })
    r.weighted = qaPostStratify_(sub, v)
  })
  const types = seg(typeKey, (k) => k.split('|').slice(1).join('|'), QA_ROW_MIN_N)
  const byContactType: Record<string, unknown>[] = []
  const tails: Record<string, Record<string, unknown>> = {}
  types.forEach((r) => {
    r.channel = String(r.key).split('|')[0]
    if ((r.audits as number) >= QA_ROW_MIN_N) {
      byContactType.push(r)
      return
    }
    const t = (tails[r.channel as string] =
      tails[r.channel as string] || {
        key: String(r.channel) + '|other', label: 'Other (under ' + QA_ROW_MIN_N + ' audits each)', channel: r.channel, audits: 0, reasons: 0,
        avg: null, margin: null, badge: 'low', verdict: false, trend: '', other: true, sum: 0, fatal: 0,
      })
    t.audits = (t.audits as number) + (r.audits as number)
    t.reasons = (t.reasons as number) + 1
    t.sum = (t.sum as number) + (r.auditAvg as number) * (r.audits as number)
    t.fatal = (t.fatal as number) + (r.fatal as number)
  })
  Object.keys(tails).forEach((c) => {
    const t = tails[c]
    t.avg = qaRound1_((t.sum as number) / (t.audits as number))
    delete t.sum
    byContactType.push(t)
  })

  // Block 1: the attention list, one row per agent with every rule that fired (deterministic; the row says why).
  const verdictMeans = byAgent
    .filter((r) => r.verdict)
    .map((r) => r.avg as number)
    .sort((a, b) => a - b)
  const median = verdictMeans.length
    ? verdictMeans.length % 2
      ? verdictMeans[(verdictMeans.length - 1) / 2]
      : (verdictMeans[verdictMeans.length / 2 - 1] + verdictMeans[verdictMeans.length / 2]) / 2
    : null
  const att: Record<string, Record<string, unknown>> = {}
  const flag = (email: string, rule: string, text: string) => {
    const r = (att[email] =
      att[email] || {
        email, name: nameOf(email), tlEmail: tlOf[email] || '', tlName: tlOf[email] ? nameOf(tlOf[email]) : '',
        avg: agentRow[email] ? agentRow[email].avg : null, audits: agentRow[email] ? agentRow[email].audits : 0, reasons: [] as Record<string, unknown>[],
      })
    ;(r.reasons as Record<string, unknown>[]).push({ rule, text })
  }
  const critBy: Record<string, number> = {}
  cur.forEach((a) => {
    if (qaIsCritical_(a) && qaSampleBasis_(a) !== 'historical') critBy[agentOf(a)] = (critBy[agentOf(a)] || 0) + 1
  })
  Object.keys(critBy).forEach((e) => {
    flag(e, 'critical', critBy[e] === 1 ? 'A critical fail' : critBy[e] + ' critical fails')
  })
  const again = by(
    repeats.filter((r) => r.afterCtl) as Record<string, unknown>[],
    (r) => String(r.agentEmail)
  )
  Object.keys(again).forEach((e) => {
    const l = again[e]
    flag(
      e,
      'repeat',
      'Failed "' + String(l[0].text).slice(0, 60) + '" again after the CTL of ' + l[0].afterCtl +
        (l.length > 1 ? ', and ' + (l.length - 1) + ' more ' + (l.length === 2 ? 'question' : 'questions') : '')
    )
  })
  byAgent.forEach((r) => {
    if (median !== null && r.verdict && r.margin !== null && (r.avg as number) + (r.margin as number) < median)
      flag(r.key as string, 'below', 'Below the team: ' + r.avg + '% ±' + r.margin + ', the middle agent ' + qaRound1_(median) + '%')
    if (r.falling) flag(r.key as string, 'falling', 'Down two periods running, each beyond its range')
  })
  Object.keys(quota).forEach((e) => {
    const q = quota[e]
    const exp = expectedOf(q)
    const done = doneBy[e] || 0
    if (exp > 0 && done < exp - (q.perDay || 0)) flag(e, 'under', 'Under-audited: ' + done + ' of ' + exp + ' audits so far')
  })
  const RULE_ORDER: Record<string, number> = { critical: 0, repeat: 1, below: 2, falling: 3, under: 4 }
  const attention = Object.keys(att)
    .map((k) => {
      const r = att[k]
      ;(r.reasons as { rule: string }[]).sort((a, b) => RULE_ORDER[a.rule] - RULE_ORDER[b.rule])
      return r
    })
    .sort(
      (a, b) =>
        RULE_ORDER[(a.reasons as { rule: string }[])[0].rule] - RULE_ORDER[(b.reasons as { rule: string }[])[0].rule] ||
        (b.reasons as unknown[]).length - (a.reasons as unknown[]).length ||
        String(a.name).localeCompare(String(b.name))
    )

  // Team leads: share of their agents needing attention and their CTLs, not an average ranking.
  const month = grain === 'month' ? period : null
  const sla = month ? (qaCtlSla_(ctls, month, todayKey) as Record<string, Record<string, unknown>>) : {}
  const tlAgents: Record<string, Record<string, boolean>> = {}
  Object.keys(agentsAll)
    .concat(Object.keys(quota))
    .forEach((e) => {
      const tl = tlOf[e]
      if (tl) (tlAgents[tl] = tlAgents[tl] || {})[e] = true
    })
  Object.keys(ctlOpen).forEach((tl) => {
    tlAgents[tl] = tlAgents[tl] || {}
  })
  const byTl = Object.keys(tlAgents)
    .map((tl) => {
      const ags = Object.keys(tlAgents[tl])
      const flagged = ags.filter((e) => att[e]).length
      return {
        tlEmail: tl, tlName: nameOf(tl), agents: ags.length, attention: flagged,
        attentionPct: ags.length ? qaRound1_((flagged / ags.length) * 100) : null,
        ctlOpen: ctlOpen[tl] || 0, ctlOverdue: ctlOver[tl] || 0, slaPct: sla[tl] ? sla[tl].slaPct : null,
      }
    })
    .sort((a, b) => b.attention - a.attention || b.ctlOverdue - a.ctlOverdue || a.tlName.localeCompare(b.tlName))

  // Non-ticket audits (Cash refund...): their own block, never blended into agent scores (D5).
  const ntBy = by(
    cur.filter((a) => qaSampleBasis_(a) === 'non-ticket'),
    (a) => String(a.audit_type || a.channel || '')
  )
  const nonTicket = Object.keys(ntBy)
    .sort()
    .map((t) => {
      const list = ntBy[t]
      const ci = qaAgentMeanCi_(list.map(item), 1)
      const ags = by(list, agentOf)
      return {
        type: t, audits: list.length, avg: ci.mean, margin: ci.margin, badge: ci.badge, fatal: list.filter(qaIsCritical_).length,
        agents: Object.keys(ags)
          .map((e) => ({ email: e, name: nameOf(e), audits: ags[e].length, avg: meanOf(ags[e]), fatal: ags[e].filter(qaIsCritical_).length }))
          .sort((a, b) => (a.avg as number) - (b.avg as number)),
      }
    })

  // What a critical fail does on each active form (checklist 5).
  const formRules = forms.list
    ? forms.list
        .filter((f) => f.active)
        .map((f) => {
          const crit = qaQuestions_(f as never).filter((q) => q.fatal || (f.scoring === 'deduction' && q.weight >= 100))
          return {
            formId: f.formId, title: f.title, channel: f.channel, scoring: f.scoring, critical: crit.length,
            zeroes: f.scoring !== 'deduction' || crit.every((q) => q.weight >= 100),
          }
        })
    : []

  let auditors: Record<string, Record<string, unknown>> = {}
  if (month) {
    auditors = qaAuditorKpis_(audits, disputes, cals, kb, month) as Record<string, Record<string, unknown>>
    Object.keys(auditors).forEach((k) => {
      auditors[k].name = nameOf(k)
    })
  }
  return {
    grain, period, periodStart: pStart, periodEnd: pEnd, weekStartsOn: startsOn,
    basis, fallbackDates: basis === 'audit' ? 0 : cur.filter((a) => !qaHasInteraction_(a)).length,
    audits: rnd.length, excludedDisputed: pending, blankScores, rescoredSkipped,
    health, history, columns, bases, attention,
    questions, outside,
    reasonTotals, reasonTagged: tagged, reasonCoveragePct: failedTotal ? qaRound1_((tagged / failedTotal) * 100) : null,
    repeats, coaching,
    byChannel, byContactType,
    byAgent: qaGateSort_(byAgent as { audits: number; avg: number | null }[], QA_MIN_VERDICT_N), byTl,
    nonTicket, formRules,
    auditors: Object.keys(auditors).map((k) => auditors[k]),
    ctlSla: Object.keys(sla).map((k) => {
      const s = sla[k]
      return { tlEmail: k, tlName: nameOf(k), due: s.due, onTime: s.onTime, done: s.done, total: s.total, slaPct: s.slaPct, donePct: s.donePct }
    }),
  }
}

/**
 * Pure: the drill-down behind the analytics page (agent -> questions -> audits; question -> agents -> audits).
 */
export function qaDrill_(
  audits: Record<string, unknown>[],
  forms: { byKey: Record<string, Record<string, unknown>> },
  grain: string,
  period: string,
  startsOn: number,
  agent: string,
  qkey: string,
  nameOf: (e: string) => string,
  ticketUrl: string,
  basis: string
): Record<string, unknown> {
  const rows: Record<string, unknown>[] = []
  const qs: Record<string, Record<string, unknown>> = {}
  const ags: Record<string, Record<string, unknown>> = {}
  const rng = grain === 'range' ? String(period).split('..') : null
  const inPeriod = (a: Record<string, unknown>) => {
    const d = qaScoreDate_(a, basis)
    return rng ? d >= rng[0] && d <= rng[1] : qaPeriodOf_(d, grain, startsOn) === period
  }
  qaRollupAudits_(audits).forEach((a) => {
    if (!qaScoreKnown_(a) || !inPeriod(a)) return
    const email = normEmail_(a.agent_email)
    if (agent && email !== agent) return
    const f = forms.byKey[String(a.form_id) + '|' + String(a.form_version)]
    const ans = qaParse_(a.answers_json, {}) as Record<string, string>
    const why = (qaParse_(a.fail_reasons_json, {}) || {}) as Record<string, string>
    const stale = a.status === 'rescored'
    if (qkey) {
      if (stale || !f || f.formId !== qkey.split('|')[0] || ans[qkey.split('|')[1]] !== 'fail') return
      const g = (ags[email] = ags[email] || { email, name: nameOf(email), fails: 0 })
      ;(g.fails as number)++
    }
    if (f && !stale && !qkey)
      qaQuestions_(f as never).forEach((q) => {
        const v = ans[q.id]
        if (v !== 'fail' && v !== 'pass') return
        const k = String(f.formId) + '|' + q.id
        const s = (qs[k] = qs[k] || { key: k, text: q.text, channel: f.channel === '*' ? String(a.channel || '') : f.channel, fails: 0, asked: 0 })
        ;(s.asked as number)++
        if (v === 'fail') (s.fails as number)++
      })
    const lost =
      f && !stale
        ? qaQuestions_(f as never)
            .filter((q) => ans[q.id] === 'fail')
            .map((q) => ({ key: String(f.formId) + '|' + q.id, text: q.text, reason: why[q.id] || '' }))
        : []
    rows.push({
      auditId: String(a.audit_id), ticketId: qaItemId_(a), ticketUrl: qaIsNonTicket_(a) ? '' : ticketUrl + String(a.ticket_id || ''),
      date: String(a.audit_date).slice(0, 10), agentEmail: email, agentName: nameOf(email), auditorName: nameOf(normEmail_(a.auditor_email)),
      channel: String(a.channel || ''), basis: qaSampleBasis_(a), score: qaFinalScore_(a), critical: qaIsCritical_(a), rescored: stale,
      comment: String(a.comment || '').slice(0, 500), failed: lost,
    })
  })
  return {
    audits: rows.sort((a, b) => (a.score as number) - (b.score as number) || String(b.date).localeCompare(String(a.date))),
    questions: Object.keys(qs)
      .map((k) => qs[k])
      .filter((s) => s.fails)
      .sort((a, b) => (b.fails as number) - (a.fails as number)),
    agents: Object.keys(ags)
      .map((k) => ags[k])
      .sort((a, b) => (b.fails as number) - (a.fails as number)),
  }
}

/**
 * Pure: team scores for from..to inclusive, against the same-length range just before (Quality.js 2921-3028).
 */
export function qaScoresRange_(
  audits: Record<string, unknown>[],
  from: string,
  to: string,
  opts?: { basis?: string; weekStartsOn?: unknown; nameOf?: (e: string) => string }
): Record<string, unknown> {
  opts = opts || {}
  const basis = opts.basis === 'audit' ? 'audit' : 'interaction'
  const startsOn = Number(opts.weekStartsOn) === 1 ? 1 : 0
  const nameOf = opts.nameOf || ((e: string) => e)
  const days = qaDaysBetween_(from, to) + 1
  const bucket = qaRangeBucket_(days)
  const prevTo = dqAddDays_(from, -1)
  const prevFrom = dqAddDays_(from, -days)
  const dateOf = (a: Record<string, unknown>) => qaScoreDate_(a, basis)
  const inR = (a: Record<string, unknown>, f: string, t: string) => {
    const d = dateOf(a)
    return d >= f && d <= t
  }
  const counted = qaRollupAudits_(audits).filter(qaScoreKnown_)
  const cur = counted.filter((a) => inR(a, from, to))
  const isRandom = (a: Record<string, unknown>) => qaSampleBasis_(a) === 'random'
  const rnd = cur.filter(isRandom)
  const rndPrev = counted.filter((a) => isRandom(a) && inR(a, prevFrom, prevTo))
  const item = (a: Record<string, unknown>) => ({ agent: normEmail_(a.agent_email), score: qaFinalScore_(a) })
  const by = (list: Record<string, unknown>[], keyOf: (a: Record<string, unknown>) => string) => {
    const o: Record<string, Record<string, unknown>[]> = {}
    list.forEach((a) => {
      const k = keyOf(a)
      if (k) (o[k] = o[k] || []).push(a)
    })
    return o
  }
  const agentOf = (a: Record<string, unknown>) => normEmail_(a.agent_email)
  const meanOf = (l: Record<string, unknown>[]) => (l.length ? qaRound1_(l.reduce((s, a) => s + qaFinalScore_(a), 0) / l.length) : null)

  const t = qaAgentMeanCi_(rnd.map(item), QA_AGENT_MIN_N)
  const tp = qaAgentMeanCi_(rndPrev.map(item), QA_AGENT_MIN_N)
  const critical = rnd.filter(qaIsCritical_).length
  const all = audits.filter((a) => String(a.kind || 'audit') === 'audit' && a.status !== 'voided' && inR(a, from, to))
  const disputed = all.filter((a) => ['disputed', 'dispute_rejected', 'rescored'].indexOf(String(a.status)) !== -1).length
  const team = {
    score: t.mean, margin: t.margin, badge: t.badge, audits: rnd.length, agents: t.agents, agentsExcluded: t.excluded,
    prevScore: tp.mean, prevMargin: tp.margin, prevAudits: rndPrev.length,
    delta: t.mean !== null && tp.mean !== null ? qaRound1_(t.mean - tp.mean) : null,
    trend: qaTrend_(t, tp), critical, fatalRate: qaWilson_(critical, rnd.length),
    scoreNoCritical: qaAgentMeanCi_(rnd.filter((a) => !qaIsCritical_(a)).map(item), QA_AGENT_MIN_N).mean,
    disputes: disputed, disputeRate: qaWilson_(disputed, all.length),
    allScore: qaAgentMeanCi_(cur.map(item), 1).mean, allAudits: cur.length,
    pendingDisputes: all.filter((a) => a.status === 'disputed').length,
  }

  // Chart: one point per bucket, the previous range's points aligned by position.
  const keyOf = (d: string) => (bucket === 'day' ? d : bucket === 'week' ? qaPeriodOf_(d, 'week', startsOn) : d.slice(0, 7))
  const keys: string[] = []
  const seen: Record<string, number> = {}
  for (let d = from; d <= to; d = dqAddDays_(d, 1)) {
    const k = keyOf(d)
    if (!seen[k]) {
      seen[k] = 1
      keys.push(k)
    }
  }
  const pkeys: string[] = []
  const pseen: Record<string, number> = {}
  for (let e = prevFrom; e <= prevTo; e = dqAddDays_(e, 1)) {
    const pk = keyOf(e)
    if (!pseen[pk]) {
      pseen[pk] = 1
      pkeys.push(pk)
    }
  }
  const point = (l: Record<string, unknown>[]) => {
    if (l.length < QA_ROW_MIN_N) return { score: null, margin: null, audits: l.length }
    const c = qaAgentMeanCi_(l.map(item), 1)
    return { score: c.mean, margin: c.margin, audits: l.length }
  }
  const curBy = by(rnd, (a) => keyOf(dateOf(a)))
  const prevBy = by(rndPrev, (a) => keyOf(dateOf(a)))
  const series = keys.map((k, i) => {
    const p = point(curBy[k] || [])
    const q = pkeys[i] ? point(prevBy[pkeys[i]] || []) : null
    return { key: k, score: p.score, margin: p.margin, audits: p.audits, prevScore: q ? q.score : null, prevAudits: q ? q.audits : 0 }
  })

  // Rows: every counted audit of the range whatever its basis, no minimum n.
  const curPrev = counted.filter((a) => inR(a, prevFrom, prevTo))
  const randomOf = (l: Record<string, unknown>[]) => {
    const r = l.filter(isRandom)
    return { randomScore: r.length ? qaAgentMeanCi_(r.map(item), 1).mean : null, randomAudits: r.length }
  }
  const group = (list: Record<string, unknown>[], prevList: Record<string, unknown>[]) => {
    const c = qaAgentMeanCi_(list.map(item), 1)
    const pc = prevList.length ? qaAgentMeanCi_(prevList.map(item), 1) : null
    const rr = randomOf(list)
    return {
      audits: list.length, agents: c.agents, score: c.mean, margin: c.margin, badge: c.badge, lowSample: list.length < QA_ROW_MIN_N,
      verdict: list.length >= QA_MIN_VERDICT_N, prevScore: pc ? pc.mean : null, trend: qaTrend_(c, pc),
      critical: list.filter(qaIsCritical_).length, randomScore: rr.randomScore, randomAudits: rr.randomAudits,
    }
  }
  const tlOfA = (a: Record<string, unknown>) => normEmail_(a.tl_email) || '(no lead)'
  const tlBy = by(cur, tlOfA)
  const tlPrev = by(curPrev, tlOfA)
  const byTl = Object.keys(tlBy).map((k) => {
    const r = group(tlBy[k], tlPrev[k] || []) as Record<string, unknown>
    r.key = k
    r.label = k === '(no lead)' ? 'No lead on the audit' : nameOf(k)
    return r
  })
  const chOf = (a: Record<string, unknown>) => String(a.channel || '') || '(not set)'
  const chBy = by(cur, chOf)
  const chPrev = by(curPrev, chOf)
  const byChannel = Object.keys(chBy).map((k) => {
    const r = group(chBy[k], chPrev[k] || []) as Record<string, unknown>
    r.key = k
    r.label = k
    return r
  })

  // Agents: every audit of the range (any basis), own mean and range.
  const agBy = by(cur, agentOf)
  const agPrev = by(curPrev, agentOf)
  const byAgent = Object.keys(agBy).map((k) => {
    const l = agBy[k]
    const ci = qaMeanCi_(l.map(qaFinalScore_))
    const p = agPrev[k] || []
    const pci = p.length ? qaMeanCi_(p.map(qaFinalScore_)) : null
    const rr = randomOf(l)
    const latest = l.reduce((m, a) => (dateOf(a) >= dateOf(m) ? a : m), l[0])
    const reasons = qaReasonCounts_()
    l.forEach((a) => {
      if (a.status === 'rescored') return
      const why = (qaParse_(a.fail_reasons_json, {}) || {}) as Record<string, string>
      Object.keys(why).forEach((q) => {
        if (QA_FAIL_REASONS.indexOf(why[q]) !== -1) reasons[why[q]]++
      })
    })
    const top = QA_FAIL_REASONS.filter((r) => reasons[r]).sort((x, y) => reasons[y] - reasons[x])[0] || ''
    return {
      key: k, label: nameOf(k), tlEmail: tlOfA(latest), tlName: tlOfA(latest) === '(no lead)' ? '' : nameOf(tlOfA(latest)),
      audits: l.length, score: ci.mean, margin: ci.margin, badge: ci.badge, lowSample: l.length < QA_AGENT_MIN_N,
      verdict: l.length >= QA_MIN_VERDICT_N, prevScore: pci ? pci.mean : null, delta: pci ? qaRound1_((ci.mean as number) - (pci.mean as number)) : null,
      trend: qaTrend_(ci, pci), critical: l.filter(qaIsCritical_).length, topReason: top, reasons,
      randomScore: rr.randomScore, randomAudits: rr.randomAudits,
    }
  })
  const rank = (rows: Record<string, unknown>[]) =>
    rows.sort(
      (a, b) =>
        Number(a.score === null) - Number(b.score === null) ||
        (a.score as number) - (b.score as number) ||
        (b.audits as number) - (a.audits as number) ||
        String(a.label).localeCompare(String(b.label))
    )

  const reasonTotals = qaReasonCounts_()
  byAgent.forEach((r) => {
    QA_FAIL_REASONS.forEach((x) => {
      reasonTotals[x] += (r.reasons as Record<string, number>)[x]
    })
  })

  const others = QA_BASES.filter((b) => b !== 'random')
    .map((b) => {
      const l = cur.filter((a) => qaSampleBasis_(a) === b)
      return { basis: b, audits: l.length, avg: meanOf(l), critical: l.filter(qaIsCritical_).length }
    })
    .filter((x) => x.audits)

  return {
    from, to, days, bucket, prevFrom, prevTo, basis, weekStartsOn: startsOn,
    fallbackDates: basis === 'audit' ? 0 : cur.filter((a) => !qaHasInteraction_(a)).length,
    team, series, byTl: rank(byTl), byAgent: rank(byAgent), byChannel: rank(byChannel), reasons: reasonTotals, others,
    minN: QA_AGENT_MIN_N, verdictN: QA_MIN_VERDICT_N,
  }
}
