/**
 * The analytics half of ProdValidation.js ported 1:1 (spec section 1 of the legacy header):
 * week buckets, bands, medians, the idle-remaining math and prodAnalytics_ itself.
 * All data arrives as arguments (intervals, flags, layers, hist rows, people, offsetMs).
 */

import 'server-only'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import {
  prodIn_,
  prodNorm_,
  prodEffectiveStatus_,
  prodSpansMs_,
  type ProdInterval,
} from './validation'

// ---------------------------------------------------------------- helpers

/** prodWeekStart_: the Sunday that starts the week of a yyyy-MM-dd key (weeks start Sunday). */
export function prodWeekStart_(key: string): string {
  const p = String(key).split('-')
  const dow = new Date(Date.UTC(+p[0], +p[1] - 1, +p[2])).getUTCDay()
  return dqAddDays_(key, -dow)
}

/**
 * prodBand_ (spec section 0): 95+, 86-94.9, 80-85.9, below 80. pct is a fraction (1 = 100%).
 * Legacy quirk preserved verbatim: null/undefined/''/non-finite -> ''.
 */
export function prodBand_(pct: unknown): string {
  if (pct === null || pct === undefined || pct === '' || !isFinite(pct as number)) return ''
  const p = Number(pct) * 100
  return p >= 95 ? '95+' : p >= 86 ? '86-94.9' : p >= 80 ? '80-85.9' : 'below 80'
}

export function prodMedian_(xs: (number | null | undefined)[]): number | null {
  const s = xs.filter((x): x is number => x !== null && x !== undefined && isFinite(x)).sort((a, b) => a - b)
  if (!s.length) return null
  const m = Math.floor(s.length / 2)
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2
}

export function prodPct_(a: number, b: number): number | null {
  return b > 0 ? Math.round((a / b) * 1000) / 10 : null
}

/** prodIdleSegments_: the segments of an interval left after spans were moved out. */
export function prodIdleSegments_(iv: { startMs: number; endMs: number }, movedSpans: [number, number][]): [number, number][] {
  let segs: [number, number][] = [[iv.startMs, iv.endMs]]
  movedSpans.forEach((sp) => {
    const next: [number, number][] = []
    segs.forEach((s) => {
      if (sp[1] <= s[0] || sp[0] >= s[1]) {
        next.push(s)
        return
      }
      if (sp[0] > s[0]) next.push([s[0], sp[0]])
      if (sp[1] < s[1]) next.push([sp[1], s[1]])
    })
    segs = next
  })
  return segs
}

// ---------------------------------------------------------------- prodAnalytics_

export interface ProdAnalyticsInput {
  intervals: ProdInterval[]
  flags: Record<string, unknown>[]
  layers: Record<string, unknown>[]
  hist: Record<string, unknown>[]
  people: Record<string, { name: string; tlEmail: string }>
  tlName: (email: string) => string
  week: string
  weeks: string[]
  todayKey: string
  flagStatuses: string[]
  offlineStatuses: string[]
  channelStatus: Record<string, string>
  offsetMs: (ms: number) => number
  full: boolean
}

/** prodAnalytics_ verbatim: every analytic of the spec from stored rows. */
export function prodAnalytics_(inp: ProdAnalyticsInput): Record<string, unknown> {
  const inWeek = (date: string, wk: string) => date >= wk && date <= dqAddDays_(wk, 6)
  const person = (e: string) => inp.people[e] || { name: e, tlEmail: '' }
  const flagsBy: Record<string, Record<string, unknown>[]> = {}
  inp.flags.forEach((f) => {
    const key = String(f.agent_email) + '|' + String(f.date)
    ;(flagsBy[key] = flagsBy[key] || []).push(f)
  })
  const movedSpans = (f: Record<string, unknown>): [number, number][] => {
    const eff = prodEffectiveStatus_(f as never)
    if (!eff || eff === String(f.raw_status)) return []
    try {
      return (JSON.parse(String(f.spans_json || '[]')) as [string, string][]).map((s) => [
        Date.parse(s[0]),
        Date.parse(s[1]),
      ])
    } catch {
      return []
    }
  }
  // Per agent and week: logged, idle raw, idle effective (minutes) from the intervals.
  const acc: Record<
    string,
    { email: string; week: string; logged: number; idleRaw: number; idleEff: number }
  > = {}
  const hourGrid: { idle: number; logged: number }[][] = []
  for (let d0 = 0; d0 < 7; d0++) {
    hourGrid.push([])
    for (let h0 = 0; h0 < 24; h0++) hourGrid[d0].push({ idle: 0, logged: 0 })
  }
  const bucket = (s: number, e: number, key: 'idle' | 'logged') => {
    for (let t = s; t < e; ) {
      const off = inp.offsetMs(t)
      const local = t + off
      const hourEnd = Math.floor(local / 3600000) * 3600000 + 3600000 - off
      const stop = Math.min(e, hourEnd)
      const dt = new Date(local)
      hourGrid[dt.getUTCDay()][dt.getUTCHours()][key] += (stop - t) / 60000
      t = stop
    }
  }
  inp.intervals.forEach((iv) => {
    if (!iv.agentEmail || prodIn_(iv.status, inp.offlineStatuses)) return
    const wk = prodWeekStart_(iv.date as string)
    const k = iv.agentEmail + '|' + wk
    const a = (acc[k] = acc[k] || { email: iv.agentEmail, week: wk, logged: 0, idleRaw: 0, idleEff: 0 })
    a.logged += iv.minutes
    if (inp.full) bucket(iv.startMs, iv.endMs, 'logged')
    if (!prodIn_(iv.status, inp.flagStatuses)) return
    a.idleRaw += iv.minutes
    let spans: [number, number][] = []
    ;(flagsBy[iv.agentEmail + '|' + iv.date] || []).forEach((f) => {
      if (Date.parse(String(f.interval_start)) === iv.startMs) spans = spans.concat(movedSpans(f))
    })
    const segs = prodIdleSegments_(iv, spans)
    a.idleEff += prodSpansMs_(segs) / 60000
    if (inp.full) segs.forEach((s) => bucket(s[0], s[1], 'idle'))
  })
  // Raw vs effective productivity per agent and week (ratio of sums, like the engine).
  const prod: Record<string, { res: number; aux: number }> = {}
  inp.layers.forEach((r) => {
    const wk = prodWeekStart_(String(r.date))
    const k = String(r.email) + '|' + wk + '|' + String(r.layer)
    const p = (prod[k] = prod[k] || { res: 0, aux: 0 })
    p.res += Number(r.productiveMinResolution) || 0
    p.aux += Number(r.productiveMinAux) || 0
  })
  const ratio = (email: string, wk: string, layer: string): number | null => {
    const p = prod[email + '|' + wk + '|' + layer]
    return p && p.aux > 0 ? p.res / p.aux : null
  }
  const emails: Record<string, boolean> = {}
  Object.keys(acc).forEach((k) => {
    if (acc[k].week === inp.week) emails[acc[k].email] = true
  })
  inp.layers.forEach((r) => {
    if (inWeek(String(r.date), inp.week)) emails[String(r.email)] = true
  })
  const agents = Object.keys(emails)
    .sort()
    .map((e) => {
      const a = acc[e + '|' + inp.week] || { logged: 0, idleRaw: 0, idleEff: 0 }
      const pr = ratio(e, inp.week, 'raw')
      const pe = ratio(e, inp.week, 'effective')
      const br = prodBand_(pr)
      const be = prodBand_(pe)
      return {
        email: e,
        name: person(e).name,
        tlEmail: person(e).tlEmail || '',
        loggedMin: Math.round(a.logged),
        idleRawMin: Math.round(a.idleRaw),
        idleEffMin: Math.round(a.idleEff),
        idleDeltaMin: Math.round(a.idleRaw - a.idleEff),
        idleEffPct: prodPct_(a.idleEff, a.logged),
        prodRawPct: pr === null ? null : Math.round(pr * 1000) / 10,
        prodEffPct: pe === null ? null : Math.round(pe * 1000) / 10,
        deltaPp: pr === null || pe === null ? null : Math.round((pe - pr) * 1000) / 10,
        bandChange: br && be && br !== be ? br + ' → ' + be : '',
      }
    })
  // Flag funnel, review discipline and replacement mix per TL (A3-A5), flags raised in the week.
  const tlAcc: Record<string, Record<string, unknown>> = {}
  inp.flags.forEach((f) => {
    if (f.decision === 'void' || !inWeek(String(f.date), inp.week)) return
    const tl = String(f.tl_email || person(String(f.agent_email)).tlEmail || '')
    const t = (tlAcc[tl] = tlAcc[tl] || {
      tlEmail: tl,
      raised: 0,
      accepted: 0,
      reverted: 0,
      auto: 0,
      pending: 0,
      hours: [] as number[],
      openSec: [] as number[],
      mix: {} as Record<string, number>,
      matched: 0,
      accepts: 0,
    })
    t.raised = (t.raised as number) + 1
    t[String(f.decision)] = ((t[String(f.decision)] as number) || 0) + 1
    if (f.decision === 'accepted' || f.decision === 'reverted') {
      if (f.decided_at && f.created_at)
        (t.hours as number[]).push((Date.parse(String(f.decided_at)) - Date.parse(String(f.created_at))) / 3600000)
      if (Number(f.review_open_ms) > 0) (t.openSec as number[]).push(Number(f.review_open_ms) / 1000)
    }
    if (f.decision === 'accepted') {
      t.accepts = (t.accepts as number) + 1
      const vs = String(f.validated_status)
      ;(t.mix as Record<string, number>)[vs] = ((t.mix as Record<string, number>)[vs] || 0) + 1
      if (prodNorm_(f.validated_status) === prodNorm_(f.suggested_status)) t.matched = (t.matched as number) + 1
    }
  })
  const tls = Object.keys(tlAcc)
    .sort()
    .map((k) => {
      const t = tlAcc[k]
      return {
        tlEmail: t.tlEmail,
        name: t.tlEmail ? inp.tlName(String(t.tlEmail)) : 'No team lead',
        raised: t.raised,
        acceptedPct: prodPct_(t.accepted as number, t.raised as number),
        revertedPct: prodPct_(t.reverted as number, t.raised as number),
        autoPct: prodPct_(t.auto as number, t.raised as number),
        pendingPct: prodPct_(t.pending as number, t.raised as number),
        medianHoursToDecision: (t.hours as number[]).length
          ? Math.round((prodMedian_(t.hours as number[]) as number) * 10) / 10
          : null,
        medianOpenSec: (t.openSec as number[]).length ? Math.round(prodMedian_(t.openSec as number[]) as number) : null,
        mix: t.mix,
        channelMatchPct: prodPct_(t.matched as number, t.accepts as number),
      }
    })
  const med = (f: string): number | null => {
    const m = prodMedian_(tls.map((t) => t[f as keyof typeof t] as number))
    return m === null ? null : Math.round(m * 10) / 10
  }
  const tlMedian =
    tls.length > 1
      ? {
          raised: med('raised'),
          acceptedPct: med('acceptedPct'),
          revertedPct: med('revertedPct'),
          autoPct: med('autoPct'),
          pendingPct: med('pendingPct'),
          medianHoursToDecision: med('medianHoursToDecision'),
          medianOpenSec: med('medianOpenSec'),
          channelMatchPct: med('channelMatchPct'),
        }
      : null
  // Disputes removed - mechanism disabled
  const disputes: unknown[] = []
  // 4-week trend (A7).
  const trend = inp.weeks.map((wk) => {
    let logged = 0,
      idleEff = 0,
      raised = 0,
      acc2 = 0,
      rev = 0
    Object.keys(acc).forEach((k) => {
      if (acc[k].week === wk) {
        logged += acc[k].logged
        idleEff += acc[k].idleEff
      }
    })
    inp.flags.forEach((f) => {
      if (f.decision === 'void' || !inWeek(String(f.date), wk)) return
      raised++
      if (f.decision === 'accepted') acc2++
      if (f.decision === 'reverted') rev++
    })
    return {
      week: wk,
      partial: inp.todayKey <= dqAddDays_(wk, 6),
      idleEffPct: prodPct_(idleEff, logged),
      flagsPer100h: logged > 0 ? Math.round((raised / (logged / 60)) * 1000) / 10 : null,
      precisionPct: prodPct_(acc2, acc2 + rev),
    }
  })
  const out: Record<string, unknown> = { agents, tls, tlMedian, disputes, trend }
  if (inp.full) {
    out.heatmap = hourGrid.map((row) =>
      row.map((c) => (c.logged > 0 ? Math.round((c.idle / c.logged) * 1000) / 10 : null))
    )
    const hist: Record<string, Record<string, number>> = { idle: {}, working: {} }
    inp.hist.forEach((r) => {
      // BUG FIXED per user approval (ProdValidation.js:541 had an undeclared `from`
      // ReferenceError): hist rows before the resolved lower window bound are skipped.
      if (String(r.date) < inp.weeks[0] || !hist[String(r.class)]) return
      let counts: Record<string, number> = {}
      try {
        counts = JSON.parse(String(r.counts_json || '{}'))
      } catch {
        counts = {}
      }
      Object.keys(counts).forEach((n) => {
        hist[String(r.class)][n] = (hist[String(r.class)][n] || 0) + Number(counts[n])
      })
    })
    out.calibration = hist
  }
  return out
}
