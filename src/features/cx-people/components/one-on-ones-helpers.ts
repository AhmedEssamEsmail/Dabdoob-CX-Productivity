'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* shared oo formatting + period/project helpers — extracted from one-on-ones-page.tsx (verbatim move, S13-03). */
import { addDays } from './pw'

/* ---------------------------------------------- shared oo formatting */
const MONTH_FULL = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
]
/** Pt(ym) — "January" for a YYYY-MM(-DD) string. */
export const monthName = (t: string) => MONTH_FULL[Number(t.slice(5, 7)) - 1] ?? t
/** ke(value, floor) — data-band for a percentage. */
export const bandOf = (t: number | null, n = 75) => (t === null ? 'none' : t >= 90 ? 'ok' : t >= n ? 'warn' : 'bad')
/** se(t) — "75%" or "–". */
export const pct = (t: number | null) => (t === null ? '–' : `${t}%`)
/** Cl(hours) — "2 d" or "5 h". */
export const ageH = (t: number) => (t >= 48 ? `${Math.floor(t / 24)} d` : `${Math.round(t)} h`)
/** Ll / ql — check-in slot states. */
export const SLOT_LABELS: Record<string, string> = { done: 'Done', due: 'Due now', upcoming: 'Later', missed: 'Missed' }
export const SLOT_TONES: Record<string, string | undefined> = { done: 'ok', due: 'warn', missed: 'bad', upcoming: undefined }
export const DOES_NOT_FIT = 'DOES_NOT_FIT:' // Ze
const AR_DIGITS = '٠١٢٣٤٥٦٧٨٩' // Js
export const NUM_RE = /^(\D*?)(-?)(\d{1,3}(?:,\d{3})+|\d+)(\.\d+)?(\D*)$/ // el

/** hn() — Arabic-Indic digits when the document is in Arabic. */
export function localizeNum(t: string) {
  if (typeof document === 'undefined' || document.documentElement.lang !== 'ar') return t
  return t
    .replace(/(\d)([.,])(?=\d)/g, (_m, d, p) => d + (p === '.' ? '٫' : '٬'))
    .replace(/\d/g, (d) => AR_DIGITS[+d])
}

/** sl() — "▲ +12% vs prev". */
export function vsPrev(now: number | null, before: number | null | undefined) {
  if (now == null || before == null || !before) return ''
  const d = Math.round(((now - before) / Math.abs(before)) * 100)
  return d === 0 ? 'Same as prev' : `${d > 0 ? '▲ +' : '▼ −'}${Math.abs(d)}% vs prev`
}

export function factLines(metric: string, c: any): string[] {
  // Il()
  if (metric === 'prod')
    return [
      `${c.totalAchieved} of ${c.totalTarget} target, ${c.days} day${c.days === 1 ? '' : 's'}`,
      c.inbTarget ? `Inbound ${pct(c.inbProd)} (${c.inbAchieved} of ${c.inbTarget})` : '',
      c.txtTarget ? `Texting ${pct(c.txtProd)} (${c.txtAchieved} of ${c.txtTarget})` : '',
      c.waTarget ? `Waiting address ${pct(c.waProd)} (${c.waAchieved} of ${c.waTarget})` : '',
    ].filter(Boolean)
  if (metric === 'qual')
    return [c.qual === null ? 'No audits in this period' : `Average over ${c.audits} audit${c.audits === 1 ? '' : 's'}`]
  return [
    c.fcr === null
      ? 'No FCR checks in this period'
      : `${c.fcrPassed} of ${c.fcrPassed + c.fcrFailed} checked contacts resolved first time`,
  ]
}

export const PERIODS = [
  { id: 'today', label: 'Today' },
  { id: 'last7', label: 'Last 7 days' },
  { id: 'week', label: 'This week' },
  { id: 'last30', label: 'Last 30 days' },
  { id: 'month', label: 'This month' },
  { id: 'lastMonth', label: 'Last month' },
  { id: 'custom', label: 'Custom dates' },
]
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/** Se(from, to) — "3 Feb 2026" / "3-9 Feb 2026" / "30 Jan - 2 Feb 2026". */
export function periodLabel(a: string, b: string) {
  const d = (t: string) => Number(t.slice(8))
  const m = (t: string) => MONTHS[Number(t.slice(5, 7)) - 1]
  const yr = (t: string) => t.slice(0, 4)
  if (a === b) return `${d(a)} ${m(a)} ${yr(a)}`
  if (a.slice(0, 7) === b.slice(0, 7)) return `${d(a)}-${d(b)} ${m(b)} ${yr(b)}`
  if (yr(a) === yr(b)) return `${d(a)} ${m(a)} - ${d(b)} ${m(b)} ${yr(b)}`
  return `${d(a)} ${m(a)} ${yr(a)} - ${d(b)} ${m(b)} ${yr(b)}`
}

/** _n(metric, periodData) — the metric's headline number for a period. */
export const metricVal = (metric: string, d: any) =>
  metric === 'prod' ? (d.days ? d.prod : null) : metric === 'qual' ? d.qual : d.fcr

/** yt(id, today) — the [from,to] a preset resolves to. */
export function periodRange(id: string, now: string): [string, string] {
  const dow = new Date(now + 'T00:00:00Z').getUTCDay()
  const first = now.slice(0, 8) + '01'
  switch (id) {
    case 'today':
      return [now, now]
    case 'last7':
      return [addDays(now, -6), now]
    case 'week':
      return [addDays(now, -dow), now]
    case 'last30':
      return [addDays(now, -29), now]
    case 'lastMonth': {
      const prev = addDays(first, -1)
      return [prev.slice(0, 8) + '01', prev]
    }
    default:
      return [first, now]
  }
}

export function monthFacts(p: any, score: any): string[] {
  if (!score) return []
  if (p.id === 'prod')
    return [
      `${pct(score.prod)} of target over ${score.days} day${score.days === 1 ? '' : 's'}`,
      ...[
        score.inbTarget ? `Inbound ${pct(score.inbProd)} (${score.inbAchieved} of ${score.inbTarget})` : '',
        score.txtTarget ? `Texting ${pct(score.txtProd)} (${score.txtAchieved} of ${score.txtTarget})` : '',
        score.waTarget ? `Waiting address ${pct(score.waProd)} (${score.waAchieved} of ${score.waTarget})` : '',
      ].filter(Boolean),
    ]
  if (p.id === 'qual')
    return [
      score.qual === null
        ? 'No audits this month'
        : `Average ${score.qual}% over ${score.audits} audit${score.audits === 1 ? '' : 's'}`,
    ]
  return [
    score.fcr === null
      ? 'No FCR checks this month'
      : `${score.fcrPassed} of ${score.fcrPassed + score.fcrFailed} checked contacts resolved first time; ${score.fcrFailed} came back`,
  ]
}

export const PROJ_STATUS = [
  { id: 'in_progress', label: 'In progress' },
  { id: 'blocked', label: 'Blocked' },
  { id: 'done', label: 'Delivered' },
  { id: 'cancelled', label: 'Dropped' },
]

export const EMPTY_EVIDENCE = { behaviour: '', evidence: '', standard: '', shownBefore: '', explanation: '' } // zl
export const COACHING_ONLY = ['Coaching given', 'Standard communicated'] // kn
