'use client'

import { useEffect, useState, type CSSProperties } from 'react'
import { toast } from '@/features/shared/components/shell/Toasts'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { pageParams } from '@/features/shared/shell/gates'

/* --- ae — the page's API surface ---------------------------------------- */

export const ae = {
  page: (date?: string) => fetchJson(`/api/tph/page${date ? `?date=${date}` : ''}`),
  trend: (from: string, to: string) => fetchJson(`/api/tph/trend?from=${from}&to=${to}`),
  saveSlots: (input: Record<string, unknown>) =>
    fetchJson('/api/tph/slots', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  addTask: (input: Record<string, unknown>) =>
    fetchJson('/api/tph/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
  removeTask: (taskId: string) =>
    fetchJson('/api/tph/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ taskId, remove: true }) }),
  runStep: (date: string, step: string) =>
    fetchJson('/api/tph/run-step', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date, step }) }),
  runDay: (date: string) =>
    fetchJson('/api/tph/run-day', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ date }) }),
  touchList: (date: string, email: string) =>
    fetchJson(`/api/tph/touches?date=${date}&email=${encodeURIComponent(email)}`),
  saveCases: (input: Record<string, unknown>) =>
    fetchJson('/api/tph/cases', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(input) }),
}

/* --- data shapes --------------------------------------------------------- */

export interface TphChannel { key: string; name: string; kind: string; groups: string[] }
export interface TphAgentRow {
  email: string; name: string; minutes: number; callsMin: number; capMin: number
  touches: number | null; tph: number | null; cap: number | null
  pctOfCap: number | null; pctRaw: number | null; over: boolean
  reason: string; limit: string
}
export interface TphTableRow {
  hour: number; channel: string; cases: number | null; source: string; agents: TphAgentRow[]
}
export interface TphDayTotal {
  email: string; name: string; minutes: number; touches: number | null; cap: number | null
  capTouches: number | null; pctOfCap: number | null; pctRaw: number | null
  scoredHours: number; overHours: number; limits: Record<string, number>
}
export interface TphTask { taskId: string; email: string; name: string; channel: string; calls: boolean; start: string; end: string; by: string }
export interface TphCell { c: string; calls: boolean; src: string }
export interface TphCaseCell { cases: number | null; source: string; tl: number | null; auto: number | null; rebuilt: { stock: number; new: number } | null }
export interface TphData {
  date: string; today: string; slotMin: number; hours: number[]; firstSlot: number; nowSlot: number | null
  channels: TphChannel[]; activities: { key: string; name: string }[]; off: string
  agents: { email: string; name: string; tlEmail: string; mine: boolean }[]
  cells: Record<string, TphCell[]>; tasks: TphTask[]; table: TphTableRow[]
  cases: { hour: number; byChannel: Record<string, TphCaseCell> }[]
  eligible: { channel: string; agents: { email: string; name: string; touches: number }[] }[]
  eligibleDays: number; minutesPerCase: number; callsFactor: number; capWindowMin: number
  callsBasis: string; callsAsOf: string; callMinutes: unknown
  callVariance: { email: string; name: string; hour: number; callMin: number }[]
  dayTotals: TphDayTotal[]
  rebuiltAsOf: string; rebuiltReasons: Record<string, string>; hasCases: boolean
  autoAsOf: string; touchesReady: boolean; touchesAsOf: string; shiftsLinked: boolean
  canEdit: boolean; tlEditDays: number; isAdmin: boolean
  lastAuto: { at: string; job: string; status: string; note: string } | null
  storeErrors?: string[]
}
export interface TrendDay {
  date: string; pct: number | null; pctRaw: number | null; scored: number; onGrid: number
  over: number; touchesReady: boolean; hasCases: boolean
}
export interface Sum {
  touches: number | null; outside: number; minutes: number
  tph: number | null; tphExCalls: number | null; cap: number | null
  pct: number | null; pctRaw: number | null; scored: number; onGrid: number
  agents: number; over: number; overAgents: number; overTouches: number
  zeroCapTouches: number; missing: number; covered: number; carried: number
  hours: { hour: number; pct: number | null; pctRaw: number | null; over: number }[]
}

/* --- module constants + formatters --------------------------------------- */

export const F = (h: number) => `${String(h).padStart(2, '0')}:00`
export const Wa = (v: number) => `${String(Math.floor(v / 4)).padStart(2, '0')}:${String((v % 4) * 15).padStart(2, '0')}`
export const dt = (d: string, n: number) => {
  const a = new Date(`${d}T00:00:00Z`)
  a.setUTCDate(a.getUTCDate() + n)
  return a.toISOString().slice(0, 10)
}
export const P = (t: number | null | undefined) => (t == null ? '–' : String(Math.round(t * 10) / 10))
export const $e = (t: string) => (t ? `${t.slice(0, 16).replace('T', ' ')} UTC` : 'never')
export const oe = '+calls'
export const Ze = '-calls'
export const Ka = 'calls'
export const ge: Record<string, string> = {
  tl: 'entered by a team lead',
  rebuilt: 'rebuilt from history',
  auto: 'queue snapshot',
  carried: 'carried from the hour before',
  '': 'no number',
}
export function Gt(d: TphData, key: string) {
  if (!key) return undefined
  if (key === d.off) return 'off'
  const a = d.channels.findIndex((c) => c.key === key)
  if (a !== -1) return String(a)
  const s = d.activities.findIndex((c) => c.key === key)
  return s !== -1 ? `a${s % 2}` : undefined
}
export const We = (d: TphData, key: string) =>
  key === d.off ? 'Off shift' : [...d.channels, ...d.activities].find((c) => c.key === key)?.name ?? key
export const U = (t: number, n: string, a = `${n}s`) => `${t} ${t === 1 ? n : a}`
const An = (t: number) => Math.round(t * 10) / 10
const Qe = (t: number) => Math.round(t * 100) / 100
const Pe = (t: number, n: number) => (n > 0 ? An((t / n) * 100) : null)

/* --- Va — the day's team summary (mirror of tphDaySummary_) --------------- */

export function Va(table: TphTableRow[], callsKey: string): Sum {
  let touches: number | null = null
  let outside = 0
  let minutes = 0
  let gridT = 0
  let minX = 0
  let gridTX = 0
  let zeroCapTouches = 0
  let cap = 0
  let clipped = 0
  let capT = 0
  let over = 0
  let overT = 0
  let missing = 0
  let covered = 0
  let carried = 0
  const onGrid = new Set<string>()
  const scored = new Set<string>()
  const agents = new Set<string>()
  const overAgents = new Set<string>()
  const hours = new Map<number, { cap: number; clipped: number; capT: number; over: number }>()
  for (const r of table) {
    let someone = false
    const hr = hours.get(r.hour) ?? { cap: 0, clipped: 0, capT: 0, over: 0 }
    hours.set(r.hour, hr)
    for (const a of r.agents) {
      const t = a.touches
      if (t != null) touches = (touches ?? 0) + t
      if (a.reason === 'no_grid') {
        outside += t || 0
        continue
      }
      if (a.minutes > 0) {
        someone = true
        agents.add(a.email)
        onGrid.add(`${a.email}|${r.hour}`)
        minutes += a.minutes
        gridT += t || 0
        if (r.channel !== callsKey) {
          minX += a.minutes
          gridTX += t || 0
        }
        if (a.reason === 'zero_cap') zeroCapTouches += t || 0
        if (!(a.reason !== '' || a.cap == null || t == null)) {
          scored.add(`${a.email}|${r.hour}`)
          cap += a.cap
          clipped += Math.min(t, a.cap)
          capT += t
          hr.cap += a.cap
          hr.clipped += Math.min(t, a.cap)
          hr.capT += t
          if (a.over) {
            over++
            overT += t - a.cap
            overAgents.add(a.email)
            hr.over++
          }
        }
      }
    }
    if (someone) {
      if (r.cases == null) missing++
      else covered++
      if (r.source === 'carried') carried++
    }
  }
  const hasT = touches !== null
  return {
    touches,
    outside,
    minutes,
    tph: hasT && minutes ? Qe((gridT * 60) / minutes) : null,
    tphExCalls: hasT && minX ? Qe((gridTX * 60) / minX) : null,
    cap: Qe(cap),
    pct: Pe(clipped, cap),
    pctRaw: Pe(capT, cap),
    scored: scored.size,
    onGrid: onGrid.size,
    agents: agents.size,
    over,
    overAgents: overAgents.size,
    overTouches: An(overT),
    zeroCapTouches,
    missing,
    covered,
    carried,
    hours: [...hours]
      .sort(([a], [b]) => a - b)
      .map(([hour, h]) => ({ hour, pct: Pe(h.clipped, h.cap), pctRaw: Pe(h.capT, h.cap), over: h.over })),
  }
}

/* --- Ua — hour-channels with someone on grid and no cases ---------------- */

export function Ua(table: TphTableRow[]) {
  const m = new Map<string, number[]>()
  table.forEach((r) => {
    if (r.agents.some((a) => a.minutes > 0 && a.reason === 'no_cases'))
      m.set(r.channel, [...(m.get(r.channel) ?? []), r.hour])
  })
  return m
}

/* --- Ne/xe/Pn/$n/St/ut/_e/pt/je — cap-cell helpers ------------------------ */

export const Ne = (d: TphData, limit: string) =>
  ({ share: 'share of cases', time: `time (${d.minutesPerCase} min a case)`, cases: 'cases offered' })[limit] ?? '–'
export const xe = (p: number) => (p >= 90 ? 'ok' : p >= 60 ? 'warn' : 'bad')
export const Pn = (d: TphData, limits: Record<string, number>) =>
  ['share', 'time', 'cases']
    .filter((k) => limits?.[k])
    .map((k) => `${Ne(d, k)} ${limits[k]} h`)
    .join(', ') || '–'
export const $n: Record<string, string> = {
  no_grid: 'not on this channel in the grid',
  no_cases: 'no cases for this hour',
  zero_cap: 'cap is 0',
  pending: 'touches not computed yet',
}
export const _e = (p: number | null | undefined) => (p == null ? '–' : `${P(p)}%`)
export const pt = (cells: { a: TphAgentRow }[]) =>
  $n[cells.find((c) => c.a.reason)?.a.reason ?? ''] ?? 'no cap'
export function je(cells: { a: TphAgentRow }[]) {
  let touches: number | null = null
  let cap: number | null = null
  let s = 0
  let l = 0
  for (const { a } of cells) {
    if (a.touches != null) touches = (touches ?? 0) + a.touches
    if (a.cap != null) cap = (cap ?? 0) + a.cap
    if (!(a.pctRaw == null || a.cap == null || a.touches == null)) {
      s += a.cap
      l += Math.min(a.touches, a.cap)
    }
  }
  return {
    touches,
    cap: cap == null ? null : Math.round(cap * 100) / 100,
    pct: s > 0 ? Math.round((l / s) * 1e3) / 10 : null,
  }
}

/* --- ss — the (min-width: 48rem) media query ------------------------------ */

export function useSs() {
  const q = '(min-width: 48rem)'
  const [m, setM] = useState(() => matchMedia(q).matches)
  useEffect(() => {
    const mm = matchMedia(q)
    const on = () => setM(mm.matches)
    mm.addEventListener('change', on)
    return () => mm.removeEventListener('change', on)
  }, [])
  return m
}

/* --- te/Yt — the ?tab=-driven tab list ('#/tph?tab=' in the legacy; the shim
 * moves it to location.search — pageParams reads both) --------------------- */

export const te: [string, string][] = [
  ['overview', 'Overview'],
  ['grid', 'Grid and tasks'],
  ['cases', 'Cases'],
  ['agents', 'Agents'],
  ['caps', 'Caps and touches'],
  ['channels', 'Channels'],
]
export const Yt = () => {
  const t = pageParams().get('tab')
  return te.find(([k]) => k === t)?.[0] ?? 'overview'
}

/* --- Je/ns — the sequential rebuild runner -------------------------------- */

const Je: [string, string][] = [
  ['touches', 'Touches'],
  ['cases_chats', 'Chat and call cases'],
  ['cases_tickets', 'Ticket cases'],
  ['calls', 'Call minutes'],
]
export function useNs(d: TphData, reload: () => void) {
  const [prog, setProg] = useState('')
  const [w, setW] = useState<{ w: number; ms: number } | null>(null)
  const run = async () => {
    const h: string[] = []
    const errs: string[] = []
    let rebuilt = 0
    setW({ w: 0, ms: 0 })
    await new Promise((u) => setTimeout(u, 50))
    for (const [u, [step, label]] of Je.entries()) {
      setProg([...h, `${label}…`].join(', '))
      setW({ w: ((u + 0.92) / Je.length) * 100, ms: 40000 })
      try {
        const r = (await ae.runStep(d.date, step)) as { casesRebuilt?: number; ms: number }
        rebuilt += r.casesRebuilt ?? 0
        h.push(`${label} done ${Math.round(r.ms / 1000)}s`)
      } catch (err) {
        errs.push(`${label}: ${err instanceof Error ? err.message : String(err)}`)
        h.push(`${label} failed`)
      }
      setW({ w: ((u + 1) / Je.length) * 100, ms: 300 })
    }
    await new Promise((u) => setTimeout(u, 1500))
    setW(null)
    setProg('')
    toast(
      `${h.join(', ')}. ${rebuilt} hour-channel cases rebuilt.${errs.length ? ` ${errs.join('; ')}` : ''}`,
      errs.length ? 'error' : undefined
    )
    reload()
  }
  const btn = {
    class: w ? 'tph-rebuild' : '',
    style: w ? ({ backgroundSize: `${w.w}% 100%`, transitionDuration: `${w.ms}ms` } as CSSProperties) : undefined,
    label: w?.w === 100 ? 'Rebuilt' : prog !== '' ? 'Rebuilding…' : 'Rebuild cases and touches',
  }
  return { running: prog !== '', progress: prog, run, btn }
}
