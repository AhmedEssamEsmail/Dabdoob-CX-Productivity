'use client'

import {
  Fragment,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type FormEvent,
  type ReactNode,
} from 'react'
import {
  Chip,
  LinesSkeleton,
  LoadError,
  Section,
} from '@/features/shared/components/shell/ui'
import { D } from '@/features/shared/shell/i18n'
import { toast } from '@/features/shared/components/shell/Toasts'
import { Button, Input, Seg, Select, Toggle } from '@/features/shared/components/ui'
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { useSe } from '@/features/cx-productivity/components/pv-shared'
import { pageParams } from '@/features/shared/shell/gates'

/**
 * TPH — verbatim port of the legacy `za` page and its parts
 * (Ga/Ya/de/Xa/Qa/Za/Ja/es/ts/as/rs/cs/is/os/ds) with the module helpers
 * (Va/Ua/F/Wa/dt/P/$e/Gt/We/U/Qe/Pe/An/Ne/xe/Pn/St/ut/je/ss/ns/ht/ls/te/Yt).
 */

/* --- ae — the page's API surface ---------------------------------------- */

const ae = {
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

interface TphChannel { key: string; name: string; kind: string; groups: string[] }
interface TphAgentRow {
  email: string; name: string; minutes: number; callsMin: number; capMin: number
  touches: number | null; tph: number | null; cap: number | null
  pctOfCap: number | null; pctRaw: number | null; over: boolean
  reason: string; limit: string
}
interface TphTableRow {
  hour: number; channel: string; cases: number | null; source: string; agents: TphAgentRow[]
}
interface TphDayTotal {
  email: string; name: string; minutes: number; touches: number | null; cap: number | null
  capTouches: number | null; pctOfCap: number | null; pctRaw: number | null
  scoredHours: number; overHours: number; limits: Record<string, number>
}
interface TphTask { taskId: string; email: string; name: string; channel: string; calls: boolean; start: string; end: string; by: string }
interface TphCell { c: string; calls: boolean; src: string }
interface TphCaseCell { cases: number | null; source: string; tl: number | null; auto: number | null; rebuilt: { stock: number; new: number } | null }
interface TphData {
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
interface TrendDay {
  date: string; pct: number | null; pctRaw: number | null; scored: number; onGrid: number
  over: number; touchesReady: boolean; hasCases: boolean
}
interface Sum {
  touches: number | null; outside: number; minutes: number
  tph: number | null; tphExCalls: number | null; cap: number | null
  pct: number | null; pctRaw: number | null; scored: number; onGrid: number
  agents: number; over: number; overAgents: number; overTouches: number
  zeroCapTouches: number; missing: number; covered: number; carried: number
  hours: { hour: number; pct: number | null; pctRaw: number | null; over: number }[]
}

/* --- module constants + formatters --------------------------------------- */

const F = (h: number) => `${String(h).padStart(2, '0')}:00`
const Wa = (v: number) => `${String(Math.floor(v / 4)).padStart(2, '0')}:${String((v % 4) * 15).padStart(2, '0')}`
const dt = (d: string, n: number) => {
  const a = new Date(`${d}T00:00:00Z`)
  a.setUTCDate(a.getUTCDate() + n)
  return a.toISOString().slice(0, 10)
}
const P = (t: number | null | undefined) => (t == null ? '–' : String(Math.round(t * 10) / 10))
const $e = (t: string) => (t ? `${t.slice(0, 16).replace('T', ' ')} UTC` : 'never')
const oe = '+calls'
const Ze = '-calls'
const Ka = 'calls'
const ge: Record<string, string> = {
  tl: 'entered by a team lead',
  rebuilt: 'rebuilt from history',
  auto: 'queue snapshot',
  carried: 'carried from the hour before',
  '': 'no number',
}
function Gt(d: TphData, key: string) {
  if (!key) return undefined
  if (key === d.off) return 'off'
  const a = d.channels.findIndex((c) => c.key === key)
  if (a !== -1) return String(a)
  const s = d.activities.findIndex((c) => c.key === key)
  return s !== -1 ? `a${s % 2}` : undefined
}
const We = (d: TphData, key: string) =>
  key === d.off ? 'Off shift' : [...d.channels, ...d.activities].find((c) => c.key === key)?.name ?? key
const U = (t: number, n: string, a = `${n}s`) => `${t} ${t === 1 ? n : a}`
const An = (t: number) => Math.round(t * 10) / 10
const Qe = (t: number) => Math.round(t * 100) / 100
const Pe = (t: number, n: number) => (n > 0 ? An((t / n) * 100) : null)

/* --- Va — the day's team summary (mirror of tphDaySummary_) --------------- */

function Va(table: TphTableRow[], callsKey: string): Sum {
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

function Ua(table: TphTableRow[]) {
  const m = new Map<string, number[]>()
  table.forEach((r) => {
    if (r.agents.some((a) => a.minutes > 0 && a.reason === 'no_cases'))
      m.set(r.channel, [...(m.get(r.channel) ?? []), r.hour])
  })
  return m
}

/* --- Ne/xe/Pn/$n/St/ut/_e/pt/je — cap-cell helpers ------------------------ */

const Ne = (d: TphData, limit: string) =>
  ({ share: 'share of cases', time: `time (${d.minutesPerCase} min a case)`, cases: 'cases offered' })[limit] ?? '–'
const xe = (p: number) => (p >= 90 ? 'ok' : p >= 60 ? 'warn' : 'bad')
const Pn = (d: TphData, limits: Record<string, number>) =>
  ['share', 'time', 'cases']
    .filter((k) => limits?.[k])
    .map((k) => `${Ne(d, k)} ${limits[k]} h`)
    .join(', ') || '–'
const $n: Record<string, string> = {
  no_grid: 'not on this channel in the grid',
  no_cases: 'no cases for this hour',
  zero_cap: 'cap is 0',
  pending: 'touches not computed yet',
}
function St({ pct, raw, over, why }: { pct: number | null; raw: number | null; over: boolean; why: string }) {
  return pct == null ? (
    <span className="cx-faint">{why}</span>
  ) : (
    <Fragment>
      <Chip status={xe(pct)}>{pct}%</Chip>
      {over ? <span className="tph-src tph-over">over cap: {raw}%</span> : null}
    </Fragment>
  )
}
const ut = (a: TphAgentRow) => <St pct={a.pctOfCap} raw={a.pctRaw} over={a.over} why={$n[a.reason] ?? 'no cap'} />
const _e = (p: number | null | undefined) => (p == null ? '–' : `${P(p)}%`)
const pt = (cells: { a: TphAgentRow }[]) =>
  $n[cells.find((c) => c.a.reason)?.a.reason ?? ''] ?? 'no cap'
function je(cells: { a: TphAgentRow }[]) {
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

function useSs() {
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

const te: [string, string][] = [
  ['overview', 'Overview'],
  ['grid', 'Grid and tasks'],
  ['cases', 'Cases'],
  ['agents', 'Agents'],
  ['caps', 'Caps and touches'],
  ['channels', 'Channels'],
]
const Yt = () => {
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
function useNs(d: TphData, reload: () => void) {
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

/* --- ht — the back-to-overview notice -------------------------------------- */

function ht({ text, select }: { text: string; select: (tab: string, focus?: boolean) => void }) {
  return (
    <p className="tph-back">
      <Chip status="warn">{text}</Chip>
      <Button onClick={() => select('overview', true)}>See Overview</Button>
    </p>
  )
}

/* --- Ja — the day picker in the page-head aside ---------------------------- */

function Ja({ d, go }: { d: TphData; go: (date: string) => void }) {
  return (
    <div className="tph-day">
      <Button onClick={() => go(dt(d.date, -1))}>Previous day</Button>
      <label className="sr-only" htmlFor="tph-date">
        Day
      </label>
      <Input
        id="tph-date"
        type="date"
        value={d.date}
        max={d.today}
        onChange={(e) => e.currentTarget.value && go(e.currentTarget.value)}
      />
      <Button disabled={d.date >= d.today} onClick={() => go(dt(d.date, 1))}>
        Next day
      </Button>
    </div>
  )
}

/* --- Ya — the tablist ------------------------------------------------------- */

function Ya({ tab, select, badges }: { tab: string; select: (t: string, focus?: boolean) => void; badges: Record<string, string> }) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const rm = matchMedia('(prefers-reduced-motion: reduce)').matches
    ref.current
      ?.querySelector('[aria-selected="true"]')
      ?.scrollIntoView({ inline: 'nearest', block: 'nearest', behavior: rm ? 'auto' : 'smooth' })
  }, [tab])
  return (
    <div
      className="tph-tabs"
      role="tablist"
      aria-label="TPH views"
      ref={ref}
      onKeyDown={(e) => {
        const o = te.findIndex(([k]) => k === tab)
        const rtl = getComputedStyle(e.currentTarget).direction === 'rtl'
        const h = e.key === 'ArrowRight' ? (rtl ? -1 : 1) : e.key === 'ArrowLeft' ? (rtl ? 1 : -1) : 0
        const p = h ? (o + h + te.length) % te.length : e.key === 'Home' ? 0 : e.key === 'End' ? te.length - 1 : -1
        if (p < 0) return
        e.preventDefault()
        select(te[p][0])
        requestAnimationFrame(() => document.getElementById(`tph-tab-${te[p][0]}`)?.focus())
      }}
    >
      {te.map(([k, label]) => (
        <Button
          key={k}
          role="tab"
          id={`tph-tab-${k}`}
          className="tph-tab"
          aria-selected={tab === k}
          aria-controls={`tph-panel-${k}`}
          tabIndex={tab === k ? 0 : -1}
          onClick={() => select(k)}
        >
          {label}
          {badges[k] ? (
            <span className="tph-tab__n">
              {badges[k]}
              <span className="cx-sr"> need attention</span>
            </span>
          ) : null}
        </Button>
      ))}
    </div>
  )
}

/* --- de — a KPI card --------------------------------------------------------- */

function de({ label, value, lines, warn, lead }: { label: string; value: ReactNode; lines: (ReactNode | null | false)[]; warn?: boolean; lead?: boolean }) {
  return (
    <div className={`tph-kpi${lead ? ' tph-kpi--lead' : ''}`} data-state={warn ? 'warn' : undefined}>
      <span className="tph-kpi__l">{label}</span>
      <span className="tph-kpi__v">{value}</span>
      {lines.filter(Boolean).map((l, i) => (
        <span key={i} className="tph-kpi__s">
          {l}
        </span>
      ))}
    </div>
  )
}

/* --- Qa — the 7-day team % of cap chart --------------------------------------- */

function Qa({ d, trend, go }: { d: TphData; trend: { forD: TphData; days: TrendDay[] | null; err: string } | null; go: (date: string) => void }) {
  const s = trend?.days
  const l = (date: string) =>
    new Date(`${date}T00:00:00Z`).toLocaleDateString('en-GB', { weekday: 'short', timeZone: 'UTC' })
  return (
    <figure className="tph-trendbox">
      <figcaption className="tph-trend__cap">Last 7 days, clipped at each hour&rsquo;s cap</figcaption>
      {trend?.err ? (
        <p className="cx-error" role="alert">
          The 7-day trend could not load: {trend.err}
        </p>
      ) : s ? (
        <ol className="tph-trend tph-trend--days">
          {s.map((r) => {
            const o = !r.touchesReady || !r.hasCases || r.pct == null
            const i = r.touchesReady ? (r.hasCases ? 'no scored hours' : 'cases not computed') : 'touches not computed'
            const h = o
              ? `not computed (${i})`
              : `${P(r.pct)}%${r.pctRaw !== r.pct ? `, un-clipped ${P(r.pctRaw)}%` : ''}, scored ${r.scored} of ${r.onGrid} agent-hours`
            return (
              <li key={r.date} className="tph-trend__col" data-sel={r.date === d.date ? '' : undefined}>
                <Button
                  className="tph-trend__hit"
                  onClick={() => go(r.date)}
                  aria-label={`${r.date}: ${h}. Open this day`}
                  title={`${r.date}: ${h}`}
                >
                  <span className="tph-trend__val" aria-hidden="true">
                    {o ? '–' : `${Math.round(r.pct ?? 0)}%`}
                  </span>
                  <span className="tph-trend__track" aria-hidden="true">
                    {o ? (
                      <span className="tph-trend__gap" />
                    ) : (
                      <span className="tph-trend__bar" style={{ '--p': r.pct } as CSSProperties} data-over={r.over ? '' : undefined} />
                    )}
                  </span>
                  <span className="tph-trend__axis" aria-hidden="true">
                    {l(r.date)}
                    <br />
                    {r.date.slice(8)}
                  </span>
                </Button>
              </li>
            )
          })}
        </ol>
      ) : (
        <p className="cx-faint" role="status">
          Loading the last 7 days…
        </p>
      )}
    </figure>
  )
}

/* --- Za — the day's % of cap by hour ------------------------------------------ */

function Za({ d, sum }: { d: TphData; sum: Sum }) {
  const a = new Map(sum.hours.map((h) => [h.hour, h]))
  const s = d.nowSlot == null ? -1 : Math.floor(d.nowSlot / 4)
  return (
    <figure className="tph-trendbox">
      <figcaption className="tph-trend__cap">{d.date} by hour</figcaption>
      <ol className="tph-trend tph-trend--hours">
        {d.hours.map((h) => {
          const r = a.get(h)
          const o = r?.pct == null ? 'no score' : `${P(r.pct)}%${r.over ? `, ${U(r.over, 'hour-channel')} over cap` : ''}`
          return (
            <li key={h} className="tph-trend__col" data-now={h === s ? '' : undefined} title={`${F(h)}: ${o}`}>
              <span className="cx-sr">
                {F(h)}: {o}
              </span>
              <span className="tph-trend__track" aria-hidden="true">
                {r?.pct == null ? null : (
                  <span className="tph-trend__bar" style={{ '--p': r.pct } as CSSProperties} data-over={r.over ? '' : undefined} />
                )}
              </span>
              <span className="tph-trend__axis" aria-hidden="true" data-third={h % 3 === 0 ? '' : undefined}>
                {String(h).padStart(2, '0')}
              </span>
            </li>
          )
        })}
      </ol>
    </figure>
  )
}



/* --- Xa — the Overview tab --------------------------------------------------- */

function Xa({ d, sum, runner, trend, select, go }: {
  d: TphData; sum: Sum; runner: ReturnType<typeof useNs>
  trend: { forD: TphData; days: TrendDay[] | null; err: string } | null
  select: (t: string, focus?: boolean) => void; go: (date: string) => void
}) {
  const o = d.date < d.today
  const i = !d.hasCases && o
  const h = d.touchesReady ? '' : o ? 'Touches not computed for this day' : 'Touches for today come in tomorrow at about 08:30'
  const p = d.dayTotals.filter((w) => w.pctOfCap != null)
  const below = p.filter((w) => (w.pctOfCap ?? 0) < 60)
  const overRows = d.dayTotals.filter((w) => w.overHours > 0)
  const missingMap = Ua(d.table)
  const g = (k: string) => We(d, k)
  const note =
    h || (i ? 'No cases for this day: rebuild needed' : sum.scored ? '' : 'No scored hours yet: no agent has a cap and touches')
  const { running: m, progress: f, run: v, btn: y } = runner
  const x = (label: string) => (
    <Button className={y.class || undefined} style={y.style} disabled={m} onClick={v}>
      {y.label === 'Rebuild cases and touches' ? label : y.label}
    </Button>
  )
  const M = (tab: string, label: string) => (
    <Button className="tph-attn__go" onClick={() => select(tab, true)}>
      {label}
    </Button>
  )
  const k: { key: string; title: string; body: ReactNode; actions: ReactNode }[] = []
  if (i)
    k.push({
      key: 'noday',
      title: `No cases for ${d.date} yet`,
      body: (
        <p className="cx-faint">
          The 08:30 run and the hourly build cover the last 3 days. Rebuild this day from history to get caps, TPH and % of cap.
        </p>
      ),
      actions: x('Rebuild this day'),
    })
  if (missingMap.size)
    k.push({
      key: 'missing',
      title: `Cases: ${U(sum.missing, 'hour-channel')} missing, so nobody on them has a score`,
      body: (
        <Fragment>
          <ul>
            {[...missingMap].map(([w, V]) => (
              <li key={w}>
                {g(w)}: {V.map(F).join(', ')}
              </li>
            ))}
          </ul>
          <p className="cx-faint">
            {d.canEdit
              ? 'Enter them in Cases, then cap, TPH and % of cap appear.'
              : `Only an admin can enter cases for a day more than ${d.tlEditDays} days ago.`}
          </p>
        </Fragment>
      ),
      actions: d.canEdit ? M('cases', 'Go to cases') : null,
    })
  if (!d.touchesReady && o)
    k.push({
      key: 'touches',
      title: `Touches for ${d.date} have not been computed`,
      body: (
        <p className="cx-faint">
          The hourly build covers the last 3 days, so TPH and % of cap stay empty for this day until you compute it.
        </p>
      ),
      actions: m ? null : x('Compute touches and cases now'),
    })
  if (d.callVariance.length)
    k.push({
      key: 'calls',
      title: 'Call time deducted where the grid shows no calls',
      body: (
        <Fragment>
          <p className="cx-faint">
            These agents took calls in hours where no slot is marked with calls. The call minutes were still taken off
            their queue minutes; mark the slots with + Calls to keep the grid accurate.
          </p>
          <ul>
            {d.callVariance.map((w) => (
              <li key={`${w.email}|${w.hour}`}>
                {w.name}, {F(w.hour)}: {w.callMin} min
              </li>
            ))}
          </ul>
        </Fragment>
      ),
      actions: M('grid', 'Open the grid'),
    })
  if (sum.over)
    k.push({
      key: 'over',
      title: `Over cap: ${U(sum.overAgents, 'agent')} in ${U(sum.over, 'hour-channel')}`,
      body: (
        <Fragment>
          <p className="cx-faint">
            % of cap stops at 100, so these hours look full; {P(sum.overTouches)} touches went above the cap.
          </p>
          <ul>
            {overRows.map((w) => (
              <li key={w.email}>
                {w.name}: {U(w.overHours, 'hour-channel')}, {P(w.pctRaw)}% un-clipped
              </li>
            ))}
          </ul>
        </Fragment>
      ),
      actions: M('agents', 'Open agents'),
    })
  if (below.length)
    k.push({
      key: 'below',
      title: `${U(below.length, 'agent')} below 60% of cap`,
      body: (
        <ul>
          {below.map((w) => (
            <li key={w.email}>
              {w.name}: {P(w.pctOfCap)}%
            </li>
          ))}
        </ul>
      ),
      actions: M('agents', 'Open agents'),
    })
  if (sum.zeroCapTouches)
    k.push({
      key: 'zero',
      title: `${U(sum.zeroCapTouches, 'touch', 'touches')} in hours with a cap of 0`,
      body: <p className="cx-faint">The hour had 0 cases or no cap minutes, so this work is not scored.</p>,
      actions: M('caps', 'Open caps'),
    })
  const N = d.channels.filter((w) => d.rebuiltReasons[w.key])
  if (N.length)
    k.push({
      key: 'notes',
      title: `Notes on the rebuilt numbers${d.rebuiltAsOf ? `, ${$e(d.rebuiltAsOf)}` : ''}`,
      body: (
        <Fragment>
          <ul>
            {N.map((w) => (
              <li key={w.key}>
                {w.name}: {d.rebuiltReasons[w.key]}
              </li>
            ))}
          </ul>
          <p className="cx-faint">A channel without numbers needs yours, or a rebuild once its source has the day.</p>
        </Fragment>
      ),
      actions: M('cases', 'Open cases'),
    })
  const A = d.lastAuto
  return (
    <div className="tph-ov">
      <div className="tph-ov__build">
        <p className="cx-faint" role="status">
          {f || (A ? (
            <Fragment>
              Last automatic build: {$e(A.at)} ({A.job}){A.status === 'error' ? ', with errors' : ''}.
            </Fragment>
          ) : (
            'No automatic build found in the run log yet.'
          ))}
          {f ? null : ` Touches computed: ${d.touchesReady ? $e(d.touchesAsOf) : 'not yet'}.`}
        </p>
        {o && !i ? x('Rebuild now') : null}
      </div>
      <h2 className="cx-sr">Key numbers for {d.date}</h2>
      <div className="tph-kpis">
        {de({
          lead: true,
          label: 'Team % of cap',
          warn: !!note || sum.pct == null,
          value: sum.pct == null ? '–' : `${P(sum.pct)}%`,
          lines:
            sum.pct == null
              ? [note]
              : [
                  sum.pctRaw !== sum.pct ? `Un-clipped ${P(sum.pctRaw)}%` : null,
                  `Scored ${sum.scored} of ${sum.onGrid} on-grid agent-hours`,
                ],
        })}
        {de({
          label: 'Team TPH, excl. Inbound calls',
          warn: !d.touchesReady,
          value: P(sum.tphExCalls),
          lines: d.touchesReady
            ? [`All channels: ${P(sum.tph)}`, sum.outside ? `${U(sum.outside, 'touch', 'touches')} outside the grid, not in TPH` : null]
            : [h],
        })}
        {de({
          label: 'Cases coverage',
          warn: i || sum.missing > 0,
          value: i ? '–' : `${sum.covered} of ${sum.covered + sum.missing}`,
          lines: i
            ? ['No cases for this day: rebuild needed']
            : [
                sum.missing
                  ? `${U(sum.missing, 'hour-channel')} with someone on the grid and no cases`
                  : 'Every on-grid hour-channel has cases',
                sum.carried ? `${sum.carried} carried from the hour before (estimate)` : null,
              ],
        })}
        {de({
          label: 'Agents on the grid',
          value: sum.agents,
          lines: [p.length ? `${below.length} of ${p.length} scored below 60% of cap` : 'None scored yet'],
        })}
        {de({
          label: 'Over cap',
          warn: sum.over > 0,
          value: d.touchesReady ? U(sum.over, 'hour-channel') : '–',
          lines: d.touchesReady
            ? [sum.over ? `${U(sum.overAgents, 'agent')}, ${P(sum.overTouches)} touches above cap` : 'Nobody went over a cap']
            : [h],
        })}
        {de({
          label: 'Call time',
          value: d.callsBasis === 'actual' ? 'Actual' : 'Estimate',
          lines: [
            d.callsBasis === 'actual'
              ? `Maqsam minutes, ${$e(d.callsAsOf)}`
              : `Marked slots count at ${Math.round(d.callsFactor * 100)}% until the actual minutes arrive`,
            d.callVariance.length ? `${U(d.callVariance.length, 'hour')} with calls not marked on the grid` : null,
          ],
        })}
      </div>
      <section className="tph-ov__sec" aria-labelledby="tph-attn">
        <h2 className="cx-section__title" id="tph-attn">
          Needs attention
        </h2>
        {k.length ? (
          <ul className="tph-attn">
            {k.map((w) => (
              <li key={w.key} className="cx-panel cx-panel--pad tph-attn__row">
                <div className="tph-attn__text">
                  <strong>{w.title}</strong>
                  {w.body}
                </div>
                {w.actions ? <div className="tph-attn__act">{w.actions}</div> : null}
              </li>
            ))}
          </ul>
        ) : (
          <p className="tph-attn__none">Nothing needs attention for {d.date}.</p>
        )}
      </section>
      <section className="tph-ov__sec" aria-labelledby="tph-trend-h">
        <h2 className="cx-section__title" id="tph-trend-h">
          Team % of cap
        </h2>
        <div className="tph-trends">
          <Qa d={d} trend={trend} go={go} />
          <Za d={d} sum={sum} />
        </div>
      </section>
    </div>
  )
}

/* --- es — the paintable grid --------------------------------------------------- */

function Es({ d, onSaved }: { d: TphData; onSaved: () => void }) {
  const [brush, setBrush] = useState(d.channels[0]?.key ?? d.off)
  const [cells, setCells] = useState(d.cells)
  const [saving, setSaving] = useState(false)
  const touched = useRef<Record<string, Set<number>>>({})
  useEffect(() => {
    const c = d.cells
    queueMicrotask(() => setCells(c))
  }, [d])
  const painting = useRef(false)
  const label = (k: string) => We(d, k)
  const paint = (email: string, idx: number) => {
    setCells((f) => {
      const v = f[email].slice()
      const y = v[idx]
      if (brush === oe || brush === Ze) {
        const add = brush === oe
        const M = !add && y.c === 'calls' ? '' : y.c || (add ? 'calls' : '')
        v[idx] = M ? { c: M, calls: add && M !== 'calls' && M !== d.off, src: 'grid' } : { c: '', calls: false, src: '' }
      } else {
        v[idx] = brush
          ? { c: brush, calls: y.calls && brush !== 'calls' && brush !== d.off, src: 'grid' }
          : { c: '', calls: false, src: '' }
      }
      return { ...f, [email]: v }
    })
    ;(touched.current[email] = touched.current[email] || new Set()).add(d.firstSlot + idx)
  }
  const flush = useCallback(() => {
    painting.current = false
    const entries = Object.entries(touched.current)
    touched.current = {}
    if (!entries.length) return
    setSaving(true)
    const body = brush === oe || brush === Ze ? { calls: brush === oe } : { channel: brush }
    Promise.all(
      entries.map(([email, slots]) => ae.saveSlots({ date: d.date, email, slots: [...slots], ...body }))
    ).then(
      () => {
        setSaving(false)
        onSaved()
      },
      (err: unknown) => {
        setSaving(false)
        toast(err instanceof Error ? err.message : String(err), 'error')
        onSaved()
      }
    )
  }, [brush, d.date, onSaved])
  useEffect(() => {
    const up = () => painting.current && flush()
    window.addEventListener('pointerup', up)
    return () => window.removeEventListener('pointerup', up)
  }, [flush])
  const n = (d.hours.length * 60) / d.slotMin
  return (
    <Section
      id="tph-grid"
      title="Who is on which channel"
      hint={saving ? 'Saving…' : d.canEdit ? 'Pick a channel or activity, then click or drag across the slots' : 'Read-only'}
    >
      <div hidden={!d.canEdit}>
        <Seg
          name="tph-brush"
          className="tph-brush"
          aria-label="Channel or activity to paint"
          value={brush}
          onChange={setBrush}
          options={[...d.channels.map((c) => c.key), ...d.activities.map((c) => c.key), d.off, ''].map((k) => ({
            value: k,
            label: k ? (
              <>
                <i className="tph-swatch" data-ch={Gt(d, k)} aria-hidden="true" />
                {label(k)}
              </>
            ) : (
              'Clear'
            ),
          }))}
        />
      </div>
      <div hidden={!d.canEdit}>
        <Seg
          name="tph-brush"
          className="tph-brush"
          aria-label="Inbound calls alongside the channel"
          value={brush}
          onChange={setBrush}
          options={([
            [oe, '+ Calls (blended)'],
            [Ze, '− Calls'],
          ] as [string, string][]).map(([k, lbl]) => ({
            value: k,
            label: k === oe ? (
              <>
                <i className="tph-swatch tph-swatch--calls" aria-hidden="true" />
                {lbl}
              </>
            ) : (
              lbl
            ),
          }))}
        />
      </div>
      <section className="card" aria-labelledby="tph-grid-card-h">
        <div className="card-head">
          <div>
            <h2 id="tph-grid-card-h" className="card-title" style={{ margin: 0 }}>
              {D('Who is on which channel')}
            </h2>
            <div className="card-hint">
              {D('{agents} agents · {channels} channels · {slots} slots of {minutes} min', {
                agents: String(d.agents.length),
                channels: String(d.channels.length),
                slots: String(n),
                minutes: String(d.slotMin),
              })}
            </div>
          </div>
        </div>
        <div className="tph-gridwrap">
          <div
            className="tph-grid"
          style={{ '--tph-n': n } as CSSProperties}
          role="grid"
          aria-label={`Channel per agent, ${d.slotMin}-minute slots`}
        >
          <div className="tph-row tph-row--head" role="row">
            <span className="tph-name" role="columnheader">
              Agent
            </span>
            {d.hours.map((h) => (
              <span key={h} className="tph-hour" role="columnheader">
                {F(h)}
              </span>
            ))}
          </div>
          {d.agents.map((a) => (
            <div key={a.email} className="tph-row" role="row">
              <span className="tph-name" role="rowheader">
                {a.name}
              </span>
              {(cells[a.email] || []).map((cell, f) => {
                const v = d.firstSlot + f
                const y = `${a.name} ${Wa(v)}: ${cell.c ? label(cell.c) : 'nothing logged'}${cell.calls ? ' + inbound calls' : ''}${cell.src === 'carried' ? ' (carried)' : cell.src === 'task' ? ' (from a task)' : ''}`
                return (
                  <Button
                    key={v}
                    role="gridcell"
                    className="tph-cell"
                    title={y}
                    aria-label={y}
                    disabled={!d.canEdit}
                    data-ch={Gt(d, cell.c)}
                    data-calls={cell.calls ? '' : undefined}
                    data-src={cell.src || undefined}
                    data-now={d.nowSlot === v ? '' : undefined}
                    data-hour={v % 4 === 0 ? '' : undefined}
                    onPointerDown={(e) => {
                      e.preventDefault()
                      e.currentTarget.releasePointerCapture?.(e.pointerId)
                      painting.current = true
                      paint(a.email, f)
                    }}
                    onPointerEnter={() => painting.current && paint(a.email, f)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        e.preventDefault()
                        paint(a.email, f)
                        flush()
                      }
                    }}
                  />
                )
              })}
            </div>
          ))}
          </div>
        </div>
      </section>
      <p className="cx-faint tph-note">
        A dark bar on top marks Inbound calls blended with the channel. Hatched slots were not logged and repeat the
        slot before them until Off shift or now.
        {d.shiftsLinked
          ? ' Carrying also stops at the end of each shift.'
          : ' Shifts are not linked yet, so log Off shift at the end of a shift.'}
      </p>
    </Section>
  )
}

/* --- ts — log a task ----------------------------------------------------------- */

function Ts({ d, onSaved }: { d: TphData; onSaved: () => void }) {
  const [form, setForm] = useState({
    email: d.agents[0]?.email ?? '',
    channel: d.channels[0]?.key ?? '',
    calls: false,
    start: '',
    end: '',
  })
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const h = (key: string) => (e: { currentTarget: { value: string } }) => setForm({ ...form, [key]: e.currentTarget.value })
  const submit = (e: FormEvent) => {
    e.preventDefault()
    setBusy(true)
    setErr('')
    ae.addTask({ date: d.date, ...form, calls: form.calls && form.channel !== d.off }).then(
      (g: { slots: number }) => {
        setBusy(false)
        toast(`Task logged: ${g.slots} slots filled.`)
        setForm({ ...form, start: form.end, end: '' })
        onSaved()
      },
      (g: unknown) => {
        setBusy(false)
        setErr(g instanceof Error ? g.message : String(g))
      }
    )
  }
  const remove = (taskId: string) =>
    ae.removeTask(taskId).then(
      () => {
        toast('Task removed.')
        onSaved()
      },
      (g: unknown) => toast(g instanceof Error ? g.message : String(g), 'error')
    )
  const label = (k: string) => We(d, k)
  return (
    <Section id="tph-tasks" title="Log a task" hint="Fills the grid slots it covers for 8 minutes or more">
      <form className="tph-taskform" onSubmit={submit} hidden={!d.canEdit}>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-a">
            Agent
          </label>
          <Select id="tt-a" value={form.email} onChange={h('email')}>
            {d.agents.map((a) => (
              <option key={a.email} value={a.email}>
                {a.name}
              </option>
            ))}
          </Select>
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-c">
            Channel
          </label>
          <Select id="tt-c" value={form.channel} onChange={h('channel')}>
            {d.channels.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
            {d.activities.map((c) => (
              <option key={c.key} value={c.key}>
                {c.name}
              </option>
            ))}
            <option value={d.off}>Off shift</option>
          </Select>
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-s">
            Start
          </label>
          <Input id="tt-s" type="time" step={300} required value={form.start} onInput={h('start')} />
        </div>
        <div className="cx-field">
          <label className="cx-label" htmlFor="tt-e">
            End
          </label>
          <Input id="tt-e" type="time" step={300} required value={form.end} onInput={h('end')} />
        </div>
        <Toggle
          className="tph-check"
          checked={form.calls}
          disabled={form.channel === d.off || form.channel === 'calls'}
          onChange={(c) => setForm({ ...form, calls: c })}
        >
          + Inbound calls
        </Toggle>
        <Button type="submit" variant="primary" disabled={busy || !form.email}>
          {busy ? 'Logging…' : 'Log task'}
        </Button>
      </form>
      {err ? (
        <p className="cx-error" role="alert">
          {err}
        </p>
      ) : null}
      {d.tasks.length ? (
        <ul className="tph-tasks">
          {d.tasks.map((t) => (
            <li key={t.taskId}>
              <span>
                <strong>{t.name}</strong> {t.start}–{t.end}, {label(t.channel)}
                {t.calls ? ' + inbound calls' : ''} <span className="cx-faint">by {t.by}</span>
              </span>
              {d.canEdit ? (
                <Button onClick={() => remove(t.taskId)}>Remove</Button>
              ) : null}
            </li>
          ))}
        </ul>
      ) : null}
    </Section>
  )
}

/* --- as — cases offered each hour -------------------------------------------- */

function As({ d, onSaved, missing, select }: {
  d: TphData; onSaved: () => void; missing: number; select: (t: string, focus?: boolean) => void
}) {
  const save = (hour: number, channel: string, raw: string, prev: number | null) => {
    const v = raw.trim() === '' ? '' : Number(raw)
    if ((v === '' && prev == null) || v === prev) return
    ae.saveCases({ date: d.date, hour, channel, cases: v }).then(
      () => onSaved(),
      (u: unknown) => toast(u instanceof Error ? u.message : String(u), 'error')
    )
  }
  const r = !d.hasCases && d.date < d.today
  return (
    <Section
      id="tph-cases"
      title="Cases offered each hour"
      hint="Open at the start of the hour plus new during it (chats: open at half past the hour). Today fills in from the queue; past days are rebuilt from Freshchat, the ticket store and Freshdesk activity. Your number replaces both."
    >
      {r ? (
        ht({ text: `No cases for ${d.date}: rebuild needed`, select })
      ) : missing ? (
        ht({ text: `${U(missing, 'hour-channel')} missing`, select })
      ) : null}
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table tph-cases">
          <thead>
            <tr>
              <th scope="col">Hour</th>
              {d.channels.map((c) => (
                <th key={c.key} scope="col">
                  {c.name}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {d.cases.map((o) => (
              <tr key={o.hour}>
                <th scope="row">{F(o.hour)}</th>
                {d.channels.map((ch) => {
                  const cell = o.byChannel[ch.key]
                  return (
                    <td key={ch.key}>
                      <Input
                        className="tph-num"
                        type="number"
                        min={0}
                        step={1}
                        inputMode="numeric"
                        aria-label={`${ch.name} at ${F(o.hour)}`}
                        disabled={!d.canEdit}
                        value={cell?.tl ?? ''}
                        placeholder={cell?.cases == null ? '' : String(cell.cases)}
                        onChange={(e) => save(o.hour, ch.key, e.currentTarget.value, cell?.tl ?? null)}
                      />
                      {cell?.source && cell.source !== 'tl' ? (
                        <span className="cx-faint tph-src">{ge[cell.source]}</span>
                      ) : null}
                      {cell?.rebuilt && cell.source !== 'rebuilt' ? (
                        <span className="cx-faint tph-src">history: {cell.rebuilt.stock + cell.rebuilt.new}</span>
                      ) : null}
                      {cell?.rebuilt && cell.source === 'rebuilt' ? (
                        <span className="cx-faint tph-src">
                          {cell.rebuilt.stock} open + {cell.rebuilt.new} new
                        </span>
                      ) : null}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Section>
  )
}

/* --- rs — caps and touches per hour (cards on narrow, table on wide) --------- */

function Rs({ d, badge, select }: { d: TphData; badge: string; select: (t: string, focus?: boolean) => void }) {
  const chName = (u: string) => d.channels.find((c) => c.key === u)?.name ?? u
  const onGrid = (u: TphAgentRow) => u.minutes > 0
  const r = d.table.some((u) => u.agents.some(onGrid))
  const [onlyGrid, setOnlyGrid] = useState(true)
  const wide = useSs()
  const p = onlyGrid && r ? d.table.reduce((n, row) => n + row.agents.filter((g) => !onGrid(g)).length, 0) : 0
  const rows = d.table
    .map((u) => ({
      ...u,
      agents: u.agents.filter((c) => !p || onGrid(c)).sort((c, g) => Number(onGrid(g)) - Number(onGrid(c))),
    }))
    .filter((u, c) => u.agents.length || !d.table[c].agents.length)
  return (
    <Section
      id="tph-caps"
      title="Caps and touches per hour"
      hint={`Cap: the smallest of the agent's share of the cases, one case per ${d.minutesPerCase} minutes, and the cases offered; minutes after :${d.capWindowMin} do not count, and call time comes off the agent's queue minutes in that hour.`}
    >
      {badge ? ht({ text: 'Call time, touches or over-cap hours need attention', select }) : null}
      <p className="cx-muted tph-note">
        {d.callsBasis === 'actual'
          ? "Call time: each agent's actual Maqsam call minutes are taken off their Internal, Chats and other queue minutes in that hour, whether or not the slot is marked with calls. Breaks, meetings and Inbound calls slots are not reduced."
          : `Call time: estimate until tomorrow, only for slots marked with calls (they count at ${Math.round(d.callsFactor * 100)}%). After the morning run the actual Maqsam call minutes replace it.`}
      </p>
      {d.touchesReady || d.date < d.today ? null : (
        <p className="cx-muted tph-note">
          Touches for today come in tomorrow at about 08:30, once Freshdesk activity is in. Until then the table shows
          minutes and caps only.
        </p>
      )}
      {r && d.table.some((u) => u.agents.some((c) => !onGrid(c))) ? (
        <Toggle className="tph-check" checked={onlyGrid} onChange={setOnlyGrid}>
          Only agents on the grid
          {p ? ` (${p} with touches but no grid time hidden)` : ''}
        </Toggle>
      ) : null}
      {rows.length ? (
        <Fragment>
          {wide ? null : (
            <div className="tph-cards">
              {rows.map((u) => (
                <div key={`${u.hour}|${u.channel}`} className="cx-panel cx-panel--pad tph-card">
                  <strong>
                    {F(u.hour)} {chName(u.channel)}: {u.cases ?? '–'} cases
                    {u.source && u.source !== 'tl' ? <span className="cx-faint"> ({ge[u.source]})</span> : null}
                  </strong>
                  {u.agents.length ? (
                    u.agents.map((c) => (
                      <dl key={c.email} className="tph-card__agent" aria-label={c.name}>
                        <div className="tph-card__name">
                          <dt>Agent</dt>
                          <dd>{c.name}</dd>
                        </div>
                        <div>
                          <dt>Minutes</dt>
                          <dd>{c.minutes}</dd>
                        </div>
                        <div>
                          <dt>Touches</dt>
                          <dd>{c.touches == null ? 'pending' : c.touches}</dd>
                        </div>
                        <div>
                          <dt>TPH</dt>
                          <dd>{P(c.tph)}</dd>
                        </div>
                        <div>
                          <dt>Cap</dt>
                          <dd>{P(c.cap)}</dd>
                        </div>
                        <div>
                          <dt>Of cap</dt>
                          <dd>{ut(c)}</dd>
                        </div>
                        <div>
                          <dt>Cap set by</dt>
                          <dd>{c.limit ? Ne(d, c.limit) : '–'}</dd>
                        </div>
                      </dl>
                    ))
                  ) : (
                    <p className="cx-faint">Nobody is on this channel in the grid and nobody touched it this hour</p>
                  )}
                </div>
              ))}
            </div>
          )}
          {wide ? (
            <div className="cx-panel cx-tablewrap tph-capstable">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Hour</th>
                    <th scope="col">Channel</th>
                    <th scope="col" className="cx-num">Cases</th>
                    <th scope="col">Agent</th>
                    <th scope="col" className="cx-num">Minutes</th>
                    <th scope="col" className="cx-num">Cap minutes</th>
                    <th scope="col" className="cx-num">Touches</th>
                    <th scope="col" className="cx-num">TPH</th>
                    <th scope="col" className="cx-num">Cap</th>
                    <th scope="col">Of cap</th>
                    <th scope="col">Cap set by</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.flatMap((u) =>
                    (u.agents.length ? u.agents : [null]).map((c, g) =>
                      c === null ? (
                        <tr key={`${u.hour}|${u.channel}`} className="tph-first">
                          <th scope="rowgroup">{F(u.hour)}</th>
                          <td>{chName(u.channel)}</td>
                          <td className="cx-num">
                            {u.cases ?? '–'}
                            {u.source && u.source !== 'tl' ? (
                              <span className="cx-faint tph-src">{ge[u.source]}</span>
                            ) : null}
                          </td>
                          <td colSpan={8} className="cx-faint">
                            Nobody is on this channel in the grid and nobody touched it this hour
                          </td>
                        </tr>
                      ) : (
                        <tr key={`${u.hour}|${u.channel}|${c.email}`} className={g === 0 ? 'tph-first' : undefined}>
                          {g === 0 ? (
                            <th scope="rowgroup" rowSpan={u.agents.length}>
                              {F(u.hour)}
                            </th>
                          ) : null}
                          {g === 0 ? <td rowSpan={u.agents.length}>{chName(u.channel)}</td> : null}
                          {g === 0 ? (
                            <td rowSpan={u.agents.length} className="cx-num">
                              {u.cases ?? '–'}
                              {u.source && u.source !== 'tl' ? (
                                <span className="cx-faint tph-src">{ge[u.source]}</span>
                              ) : null}
                            </td>
                          ) : null}
                          <td>{c.name}</td>
                          <td className="cx-num">
                            {c.minutes}
                            {c.callsMin ? <span className="cx-faint tph-src">{c.callsMin} with calls</span> : null}
                          </td>
                          <td className="cx-num">{c.capMin}</td>
                          <td className="cx-num">
                            {c.touches == null ? <span className="cx-faint">pending</span> : c.touches}
                          </td>
                          <td className="cx-num">{P(c.tph)}</td>
                          <td className="cx-num">{P(c.cap)}</td>
                          <td>{ut(c)}</td>
                          <td>{c.limit ? Ne(d, c.limit) : '–'}</td>
                        </tr>
                      )
                    )
                  )}
                </tbody>
              </table>
            </div>
          ) : null}
        </Fragment>
      ) : (
        <p className="cx-muted">
          Nothing to score for this day: no agent is on a channel in the grid, no cases are logged
          {d.touchesReady ? ' and nobody has touches' : ''}. Paint the grid above to see caps.
        </p>
      )}
    </Section>
  )
}

/* --- ls/cs — the agents-by-hour matrix + is dialog ---------------------------- */

const ls: [string, string][] = [
  ['pct', 'Score %'],
  ['touches', 'Cases touched'],
  ['cap', 'Target'],
]
interface HgSel { email: string; hour?: number }
function Cs({ d }: { d: TphData }) {
  const [metric, setMetric] = useState('pct')
  const [sel, setSel] = useState<HgSel | null>(null)
  const r = new Map<string, Map<number, { r: TphTableRow; a: TphAgentRow }[]>>()
  const o = new Map<string, string>()
  for (const row of d.table)
    for (const m of row.agents) {
      o.set(m.email, m.name)
      if (!r.has(m.email)) r.set(m.email, new Map())
      const f = r.get(m.email)!
      f.set(row.hour, [...(f.get(row.hour) ?? []), { r: row, a: m }])
    }
  const i = new Map(d.dayTotals.map((x) => [x.email, x]))
  d.dayTotals.forEach((x) => o.has(x.email) || o.set(x.email, x.name))
  if (!o.size) return null
  const onGridSet = new Set(d.agents.map((x) => x.email))
  const p = [
    ...d.agents.map((x) => x.email).filter((x) => o.has(x)),
    ...[...o.keys()].filter((x) => !onGridSet.has(x)),
  ]
  const hours913 = d.hours.filter((x) => x >= 9 && x <= 21)
  const hourLabel = (x: number) => (x === 9 ? '09:30' : F(x))
  const cellText = (v: { touches: number | null; cap: number | null; pct: number | null }) =>
    metric === 'pct' ? _e(v.pct) : P(metric === 'touches' ? v.touches : v.cap)
  const dayCell = (email: string) => {
    const m = i.get(email)
    const f = je([...(r.get(email)?.values() ?? [])].flat())
    return metric === 'pct'
      ? { text: _e(m?.pctOfCap ?? null), p: m?.pctOfCap ?? null }
      : { text: P(metric === 'touches' ? (m?.touches ?? f.touches) : (m?.cap ?? f.cap)), p: null }
  }
  return (
    <Section
      id="tph-hg"
      title="Agents by hour"
      hint="09:30 to 22:00. Click a number for that hour's channels, or a name for the agent's day."
    >
      <Seg
        name="tph-hg-metric"
        className="tph-brush tph-hg-seg"
        aria-label="Value in each cell"
        value={metric}
        onChange={setMetric}
        options={ls.map(([k, label]) => ({ value: k, label }))}
      />
      <div className="cx-panel cx-tablewrap">
        <table className="cx-table tph-hg">
          <thead>
            <tr>
              <th scope="col">Agent</th>
              {hours913.map((x) => (
                <th key={x} scope="col" className="cx-num">
                  {hourLabel(x)}
                </th>
              ))}
              <th scope="col" className="cx-num">Day</th>
            </tr>
          </thead>
          <tbody>
            {p.map((email) => {
              const m = dayCell(email)
              return (
                <tr key={email}>
                  <th scope="row">
                    <Button className="tph-hg__name" onClick={() => setSel({ email })}>
                      {o.get(email)}
                    </Button>
                  </th>
                  {hours913.map((hh) => {
                    const v = r.get(email)?.get(hh)
                    if (!v) return <td key={hh} />
                    const y = je(v)
                    return (
                      <td key={hh} className="cx-num">
                        <Button
                          className="tph-hg__cell"
                          data-status={metric === 'pct' && y.pct != null ? xe(y.pct) : undefined}
                          aria-label={`${o.get(email)} ${hourLabel(hh)}: ${cellText(y)}`}
                          title={metric === 'pct' && y.pct == null ? pt(v) : undefined}
                          onClick={() => setSel({ email, hour: hh })}
                        >
                          {cellText(y)}
                        </Button>
                      </td>
                    )
                  })}
                  <td className="cx-num">
                    <Button
                      className="tph-hg__cell tph-hg__day"
                      data-status={m.p != null ? xe(m.p) : undefined}
                      aria-label={`${o.get(email)} day: ${m.text}`}
                      onClick={() => setSel({ email })}
                    >
                      {m.text}
                    </Button>
                    {i.get(email)?.overHours ? (
                      <span className="tph-hg__over">
                        <Chip status="warn">
                          {i.get(email)!.overHours}
                          <span className="cx-sr"> hour-channels</span> over cap
                        </Chip>
                      </span>
                    ) : null}
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
      {sel ? (
        <AgentDialog
          d={d}
          sel={sel}
          name={o.get(sel.email) ?? sel.email}
          byHour={r.get(sel.email) ?? new Map()}
          total={i.get(sel.email)}
          pick={setSel}
        />
      ) : null}
    </Section>
  )
}

/* --- is — the agent hour/day dialog -------------------------------------------- */

function AgentDialog({ d, sel, name, byHour, total, pick }: {
  d: TphData; sel: HgSel; name: string
  byHour: Map<number, { r: TphTableRow; a: TphAgentRow }[]>
  total: TphDayTotal | undefined; pick: (s: HgSel | null) => void
}) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const m = ref.current
    if (m && !m.open) m.showModal()
  }, [])
  const chName = (k: string) => We(d, k)
  const close = () => pick(null)
  const rows = sel.hour == null ? [] : (byHour.get(sel.hour) ?? [])
  const hrSum = je(rows)
  const [touches, setTouches] = useState<{ busy: boolean; err: string; data: { touches: { time: string; ticket: string; channel: string; status: string; group: string; hour: number }[]; outside: number } | null; hour: number | null } | null>(null)
  const loadTouches = (hour: number | null) => {
    setTouches((f) => ({ busy: !!f?.busy || !f?.data, err: '', data: f?.data ?? null, hour }))
    if (touches?.data || touches?.busy) return
    ae.touchList(d.date, sel.email).then(
      (f) => setTouches((v) => ({ busy: false, err: '', data: f as never, hour: v?.hour ?? null })),
      (f: unknown) =>
        setTouches((v) => ({
          busy: false,
          err: f instanceof Error ? f.message : String(f),
          data: null,
          hour: v?.hour ?? null,
        }))
    )
  }
  const visible = touches?.data ? touches.data.touches.filter((m) => touches.hour == null || m.hour === touches.hour) : []
  return (
    <dialog ref={ref} className="popup tph-dialog" aria-labelledby="tph-hg-h" onClose={close} onCancel={close}>
      <div className="popup-body">
        <h2 id="tph-hg-h" className="popup-title">
          {sel.hour == null ? `${name}, ${d.date}` : `${name}, ${F(sel.hour)} to ${F(sel.hour + 1)}`}
        </h2>
        {sel.hour != null ? (
          <div className="cx-tablewrap">
            <table className="cx-table">
              <thead>
                <tr>
                  <th scope="col">Channel</th>
                  <th scope="col" className="cx-num">Cases offered</th>
                  <th scope="col" className="cx-num">Minutes</th>
                  <th scope="col" className="cx-num">Cap</th>
                  <th scope="col" className="cx-num">Touches</th>
                  <th scope="col" className="cx-num">TPH</th>
                  <th scope="col">Of cap</th>
                  <th scope="col" className="cx-num">Raw %</th>
                  <th scope="col">Cap set by</th>
                </tr>
              </thead>
              <tbody>
                {rows.map(({ r: m, a: f }) => (
                  <tr key={m.channel}>
                    <th scope="row">{chName(m.channel)}</th>
                    <td className="cx-num">
                      {m.cases ?? '–'}
                      {m.source ? <span className="cx-faint tph-src">{ge[m.source]}</span> : null}
                    </td>
                    <td className="cx-num">
                      {f.minutes}
                      {f.callsMin ? <span className="cx-faint tph-src">{f.callsMin} with calls</span> : null}
                    </td>
                    <td className="cx-num">{P(f.cap)}</td>
                    <td className="cx-num">{f.touches ?? <span className="cx-faint">pending</span>}</td>
                    <td className="cx-num">{P(f.tph)}</td>
                    <td>{ut(f)}</td>
                    <td className="cx-num">{_e(f.pctRaw)}</td>
                    <td>{f.limit ? Ne(d, f.limit) : '–'}</td>
                  </tr>
                ))}
                {rows.length > 1 ? (
                  <tr>
                    <th scope="row">This hour</th>
                    <td />
                    <td className="cx-num">{rows.reduce((m, f) => m + f.a.minutes, 0)}</td>
                    <td className="cx-num">{P(hrSum.cap)}</td>
                    <td className="cx-num">{P(hrSum.touches)}</td>
                    <td />
                    <td>
                      {hrSum.pct == null ? (
                        <span className="cx-faint">{pt(rows)}</span>
                      ) : (
                        <Chip status={xe(hrSum.pct)}>{_e(hrSum.pct)}</Chip>
                      )}
                    </td>
                    <td />
                    <td />
                  </tr>
                ) : null}
              </tbody>
            </table>
          </div>
        ) : (
          <Fragment>
            <div className="cx-tablewrap">
              <table className="cx-table">
                <thead>
                  <tr>
                    <th scope="col">Hour</th>
                    <th scope="col">Channels</th>
                    <th scope="col" className="cx-num">Minutes</th>
                    <th scope="col" className="cx-num">Cases</th>
                    <th scope="col" className="cx-num">Cap</th>
                    <th scope="col" className="cx-num">Touches</th>
                    <th scope="col">Of cap</th>
                  </tr>
                </thead>
                <tbody>
                  {[...byHour]
                    .sort(([m], [f]) => m - f)
                    .map(([m, f]) => {
                      const v = je(f)
                      return (
                        <tr key={m}>
                          <th scope="row">
                            <Button className="tph-hg__name" onClick={() => pick({ email: sel.email, hour: m })}>
                              {F(m)}
                            </Button>
                          </th>
                          <td>{f.map((y) => chName(y.r.channel)).join(', ')}</td>
                          <td className="cx-num">{f.reduce((y, x) => y + x.a.minutes, 0)}</td>
                          <td className="cx-num">{f.map((y) => y.r.cases ?? '–').join(' + ')}</td>
                          <td className="cx-num">{P(v.cap)}</td>
                          <td className="cx-num">
                            {v.touches ? (
                              <Button
                                className="tph-hg__name"
                                aria-label={`View touches ${F(m)} to ${F(m + 1)} (${v.touches})`}
                                onClick={() => loadTouches(m)}
                              >
                                {P(v.touches)}
                              </Button>
                            ) : (
                              P(v.touches)
                            )}
                          </td>
                          <td>
                            {v.pct == null ? (
                              <span className="cx-faint">{pt(f)}</span>
                            ) : (
                              <Chip status={xe(v.pct)}>{_e(v.pct)}</Chip>
                            )}
                          </td>
                        </tr>
                      )
                    })}
                </tbody>
              </table>
            </div>
            {total ? (
              <dl className="tph-card__agent" aria-label="Day totals">
                <div>
                  <dt>Touches</dt>
                  <dd>
                    {total.touches ? (
                      <Button
                        className="tph-hg__name"
                        aria-expanded={!!touches}
                        onClick={() => loadTouches(null)}
                      >
                        View touches ({total.touches})
                      </Button>
                    ) : (
                      (total.touches ?? 'pending')
                    )}
                  </dd>
                </div>
                <div>
                  <dt>Cap</dt>
                  <dd>{P(total.cap)}</dd>
                </div>
                <div>
                  <dt>Of cap</dt>
                  <dd>
                    <St pct={total.pctOfCap} raw={total.pctRaw} over={(total.pctRaw ?? 0) > 100} why="no capped hour" />
                  </dd>
                </div>
                <div>
                  <dt>Scored hours</dt>
                  <dd>{total.scoredHours}</dd>
                </div>
                <div>
                  <dt>Hour-channels over cap</dt>
                  <dd>{total.overHours}</dd>
                </div>
                <div className="tph-card__wide">
                  <dt>Cap set by</dt>
                  <dd>{Pn(d, total.limits)}</dd>
                </div>
              </dl>
            ) : null}
            {touches ? (
              <section className="tph-touches" aria-labelledby="tph-touches-h" aria-busy={touches.busy}>
                <h3 id="tph-touches-h" className="tph-touches__h">
                  {touches.hour == null ? 'Every touch this day' : `Touches ${F(touches.hour)} to ${F(touches.hour + 1)}`}
                  {touches.data ? ` (${visible.length})` : ''}
                  {touches.hour != null && touches.data ? (
                    <Button className="tph-touches__all" onClick={() => loadTouches(null)}>
                      Show all hours
                    </Button>
                  ) : null}
                </h3>
                {touches.busy ? (
                  <p className="cx-faint" role="status">
                    Loading touches from Freshdesk activity…
                  </p>
                ) : touches.err ? (
                  <Fragment>
                    <p className="cx-error" role="alert">
                      Touches could not load: {touches.err}
                    </p>
                    <Button onClick={() => loadTouches(touches.hour)}>Try again</Button>
                  </Fragment>
                ) : touches.data ? (
                  <Fragment>
                    <p className="cx-faint">
                      A ticket counts once per hour and channel; Kuwait time.
                      {touches.data.touches.length !== total?.touches
                        ? ` This list has ${touches.data.touches.length} against the stored ${total?.touches ?? 0}: activity changed since touches were computed, so rebuild the day.`
                        : ''}
                      {touches.data.outside
                        ? ` ${touches.data.outside} more outside the grid hours are not in the total.`
                        : ''}
                    </p>
                    {visible.length ? (
                      <div className="cx-tablewrap tph-touches__wrap">
                        <table className="cx-table">
                          <thead>
                            <tr>
                              <th scope="col">Time</th>
                              <th scope="col">Ticket</th>
                              <th scope="col">Counted on</th>
                              <th scope="col">Status</th>
                              <th scope="col">Group</th>
                            </tr>
                          </thead>
                          <tbody>
                            {visible.map((m, f) => (
                              <tr key={f}>
                                <td className="cx-num">{m.time}</td>
                                <th scope="row" className="cx-num">{m.ticket}</th>
                                <td>{chName(m.channel)}</td>
                                <td>{m.status || <span className="cx-faint">unknown</span>}</td>
                                <td>{m.group || <span className="cx-faint">none</span>}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      <p className="cx-muted">No touches in this hour in the current Freshdesk activity.</p>
                    )}
                  </Fragment>
                ) : null}
              </section>
            ) : null}
          </Fragment>
        )}
        <div className="popup-actions">
          {sel.hour != null ? (
            <Button onClick={() => pick({ email: sel.email })}>{name}&apos;s day</Button>
          ) : null}
          <Button variant="primary" onClick={close}>Close</Button>
        </div>
      </div>
    </dialog>
  )
}

/* --- os — each agent's day (collapsible) --------------------------------------- */

function Os({ d }: { d: TphData }) {
  const n = d.dayTotals.filter((o) => o.minutes > 0 || o.touches)
  if (!n.length) return null
  const a = n.filter((o) => o.pctOfCap != null && o.pctOfCap < 60).length
  const s = n.reduce((o, i) => o + (i.overHours || 0), 0)
  const perAgent = new Map<string, { t: number; m: number }>()
  d.table.forEach((o) =>
    o.agents.forEach((i) => {
      if (i.minutes <= 0 || i.touches == null) return
      const h = perAgent.get(i.email) ?? { t: 0, m: 0 }
      perAgent.set(i.email, { t: h.t + i.touches, m: h.m + i.minutes })
    })
  )
  const tph = (email: string) => {
    const v = perAgent.get(email)
    return v && v.m ? (v.t * 60) / v.m : null
  }
  return (
    <Section
      id="tph-day"
      title="Each agent's day"
      collapsible
      defaultOpen={false}
      unmount
      summary={
        <Fragment>
          {n.length} agents{' '}
          {a ? <Chip status="warn">{a} below 60%</Chip> : <span>0 below 60%</span>}{' '}
          {s ? <Chip status="warn">{U(s, 'hour-channel')} over cap</Chip> : <span>0 hour-channels over cap</span>}
        </Fragment>
      }
      hint="Touches and TPH over every logged hour. Cap and % of cap count only hours with a cap and touches; an hour over its cap counts as 100%, so it cannot make up for an hour under it."
    >
      <div className="tph-cards tph-cards--day">
        {n.map((o) => (
          <dl key={o.email} className="cx-panel cx-panel--pad tph-card__agent" aria-label={o.name}>
            <div className="tph-card__name">
              <dt>Agent</dt>
              <dd>{o.name}</dd>
            </div>
            <div>
              <dt>Minutes</dt>
              <dd>{o.minutes}</dd>
            </div>
            <div>
              <dt>Touches</dt>
              <dd>{o.touches ?? 'pending'}</dd>
            </div>
            <div>
              <dt>TPH on the grid</dt>
              <dd>{P(tph(o.email))}</dd>
            </div>
            <div>
              <dt>Cap ({o.scoredHours} h)</dt>
              <dd>{P(o.cap)}</dd>
            </div>
            <div>
              <dt>Touches in capped hours</dt>
              <dd>{o.capTouches ?? '–'}</dd>
            </div>
            <div>
              <dt>Of cap</dt>
              <dd>
                <St pct={o.pctOfCap} raw={o.pctRaw} over={(o.pctRaw ?? 0) > 100} why="no capped hour" />
              </dd>
            </div>
            <div>
              <dt>Hour-channels over cap</dt>
              <dd>{o.overHours}</dd>
            </div>
            <div className="tph-card__wide">
              <dt>Cap set by</dt>
              <dd>{Pn(d, o.limits)}</dd>
            </div>
          </dl>
        ))}
      </div>
    </Section>
  )
}

/* --- ds — who works each channel ------------------------------------------------ */

function Ds({ d }: { d: TphData }) {
  return (
    <Section
      id="tph-who"
      title="Who works each channel"
      hint={`Agents with touches on the channel in the last ${d.eligibleDays} days`}
    >
      <div className="tph-who">
        {d.eligible.map((n) => (
          <div key={n.channel} className="cx-panel cx-panel--pad">
            <h3 className="cx-label">{d.channels.find((c) => c.key === n.channel)?.name}</h3>
            {n.agents.length ? (
              <p className="tph-names">{n.agents.map((a) => a.name).join(', ')}</p>
            ) : (
              <p className="cx-faint">Nobody yet.</p>
            )}
          </div>
        ))}
      </div>
    </Section>
  )
}

/* --- Ga — the tab router ---------------------------------------------------------- */

function Ga({ d, reload, go }: { d: TphData; reload: () => void; go: (date: string) => void }) {
  const [tab, setTab] = useState(Yt)
  const runner = useNs(d, reload)
  const [trend, setTrend] = useState<{ forD: TphData; days: TrendDay[] | null; err: string } | null>(null)
  useEffect(() => {
    const onHash = () => setTab(Yt())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])
  useEffect(() => {
    if (tab !== 'overview' || trend?.forD === d) return
    queueMicrotask(() => setTrend((f) => (f?.forD === d ? f : { forD: d, days: f?.days ?? null, err: '' })))
    ae.trend(dt(d.date, -6), d.date).then(
      (m: { days: TrendDay[] }) =>
        setTrend((f) => (f?.forD === d ? { forD: d, days: m.days, err: '' } : f)),
      (m: unknown) =>
        setTrend((f) => (f?.forD === d ? { forD: d, days: null, err: m instanceof Error ? m.message : String(m) } : f))
    )
  }, [tab, d, trend?.forD, trend?.days])
  const select = (m: string, focus?: boolean) => {
    setTab(m)
    history.replaceState(null, '', `${location.pathname || '/tph'}?tab=${m}`)
    if (focus) requestAnimationFrame(() => document.getElementById(`tph-panel-${m}`)?.focus())
  }
  const sum = useMemo(() => Va(d.table, Ka), [d])
  const past = d.date < d.today
  const u = !d.hasCases && past
  const c = !d.touchesReady && past
  const badges = {
    cases: u ? '!' : sum.missing ? String(sum.missing) : '',
    agents: sum.overAgents ? String(sum.overAgents) : '',
    caps: String(d.callVariance.length + (c ? 1 : 0) + sum.over || ''),
  }
  const panel = (m: string, children: ReactNode) => (
    <div role="tabpanel" id={`tph-panel-${m}`} aria-labelledby={`tph-tab-${m}`} tabIndex={0} className="tph-panel">
      {children}
    </div>
  )
  return (
    <Fragment>
      {d.storeErrors?.length ? (
        <div className="cx-panel cx-panel--pad tph-lock" role="alert">
          <strong>Some stores could not be read — numbers may be missing:</strong>
          <ul>
            {d.storeErrors.map((s, i) => (
              <li key={i}>{s}</li>
            ))}
          </ul>
          {d.isAdmin ? (
            <p className="cx-faint">
              Run <code>GET /api/admin/source-health</code> for the full diagnosis.
            </p>
          ) : null}
        </div>
      ) : null}
      {d.canEdit ? null : (
        <p className="cx-panel cx-panel--pad tph-lock" role="status">
          This day is read-only for you: team leads can change today and the {d.tlEditDays} days before it. Ask Mohamed
          to change an older day.
        </p>
      )}
      <Ya tab={tab} select={select} badges={badges} />
      {tab === 'overview' ? panel('overview', <Xa d={d} sum={sum} runner={runner} trend={trend} select={select} go={go} />) : null}
      <div
        role="tabpanel"
        id="tph-panel-grid"
        aria-labelledby="tph-tab-grid"
        tabIndex={0}
        className="tph-panel"
        hidden={tab !== 'grid'}
      >
        <Es key={d.date} d={d} onSaved={reload} />
        <Ts d={d} onSaved={reload} />
      </div>
      {tab === 'cases' ? panel('cases', <As d={d} onSaved={reload} missing={sum.missing} select={select} />) : null}
      {tab === 'agents' ? panel('agents', <Fragment><Cs d={d} /><Os d={d} /></Fragment>) : null}
      {tab === 'caps' ? panel('caps', <Rs d={d} badge={badges.caps ?? ''} select={select} />) : null}
      {tab === 'channels' ? panel('channels', <Ds d={d} />) : null}
    </Fragment>
  )
}

/* --- Qs — the mid-section: % of cap by hour + needs attention --------------- */

function Qs({ d, sum }: { d: TphData; sum: Sum }) {
  const byHour = new Map(sum.hours.map((h) => [h.hour, h]))
  const sparkHours = sum.hours
  const o = d.date < d.today
  const missingMap = Ua(d.table)
  const below = d.dayTotals.filter((w) => w.pctOfCap != null && w.pctOfCap < 60)
  const attn: { key: string; title: string; body: ReactNode }[] = []
  if (!d.hasCases && o)
    attn.push({
      key: 'noday',
      title: `No cases for ${d.date} yet`,
      body: 'Rebuild this day from history to get caps, TPH and % of cap.',
    })
  if (missingMap.size)
    attn.push({
      key: 'missing',
      title: `Cases: ${U(sum.missing, 'hour-channel')} missing, so nobody on them has a score`,
      body: [...missingMap]
        .map(([w, V]) => `${We(d, w)}: ${V.map(F).join(', ')}`)
        .join(' · '),
    })
  if (!d.touchesReady && o)
    attn.push({
      key: 'touches',
      title: `Touches for ${d.date} have not been computed`,
      body: 'TPH and % of cap stay empty for this day until they are computed.',
    })
  if (d.callVariance.length)
    attn.push({
      key: 'calls',
      title: 'Call time deducted where the grid shows no calls',
      body: d.callVariance.map((w) => `${w.name}, ${F(w.hour)}: ${w.callMin} min`).join(' · '),
    })
  if (sum.over)
    attn.push({
      key: 'over',
      title: `Over cap: ${U(sum.overAgents, 'agent')} in ${U(sum.over, 'hour-channel')}`,
      body: `${P(sum.overTouches)} touches went above the cap.`,
    })
  if (below.length)
    attn.push({
      key: 'below',
      title: `${U(below.length, 'agent')} below 60% of cap`,
      body: below.map((w) => `${w.name}: ${P(w.pctOfCap)}%`).join(', '),
    })
  if (sum.zeroCapTouches)
    attn.push({
      key: 'zero',
      title: `${U(sum.zeroCapTouches, 'touch', 'touches')} in hours with a cap of 0`,
      body: 'This work is not scored.',
    })
  return (
    <div className="grid mb-3" style={{ gridTemplateColumns: '1.4fr 1fr', alignItems: 'start' }}>
      <section className="card" aria-labelledby="tph-cap-h">
        <div className="card-head">
          <div>
            <h2 id="tph-cap-h" className="card-title" style={{ margin: 0 }}>
              {D('Team % of cap — today by hour')}
            </h2>
            <div className="card-hint">{D('cap = hourly share of offered cases')}</div>
          </div>
        </div>
        <div className="card-pad">
          <div
            className="mixbar"
            role="img"
            aria-label={D('Team percent of cap for each hour of {date}', { date: d.date })}
          >
            {d.hours.map((h) => {
              const r = byHour.get(h)
              const over = !!r?.over
              const scored = r?.pct != null
              const flat = !over && !(scored && d.touchesReady)
              const bg = over ? 'var(--cx-status-bad-fg)' : scored && d.touchesReady ? 'var(--cx-accent)' : 'var(--cx-line-2)'
              const ink = flat ? { color: 'var(--cx-ink)' } : undefined
              return (
                <div
                  key={h}
                  title={`${F(h)}: ${r?.pct == null ? 'no score' : `${P(r.pct)}%${over ? `, over cap ${P(r.pctRaw)}%` : ''}`}`}
                  style={{ flex: 1, background: bg, minWidth: 0, ...ink }}
                >
                  <span>{String(h).padStart(2, '0')}</span>
                </div>
              )
            })}
          </div>
          <div className="mixbar-legend">
            <span>
              <i style={{ background: 'var(--cx-accent)' }} />
              {D('Actual')}
            </span>
            <span>
              <i style={{ background: 'var(--cx-line-2)' }} />
              {D('Scheduled / estimate')}
            </span>
            <span>
              <i style={{ background: 'var(--cx-status-bad-fg)' }} />
              {D('Over cap')}
            </span>
          </div>
        </div>
      </section>
      <section className="card" aria-labelledby="tph-attn-h">
        <div className="card-head">
          <div>
            <h2 id="tph-attn-h" className="card-title" style={{ margin: 0 }}>
              {D('Needs attention')}
            </h2>
            <div className="card-hint">{D('today')}</div>
          </div>
        </div>
        {attn.length ? (
          <div className="card-pad" style={{ display: 'grid', gap: 'var(--cx-space-3)' }}>
            {attn.map((w) => (
              <div key={w.key}>
                <strong className="small">{w.title}</strong>
                <div className="small faint">{w.body}</div>
              </div>
            ))}
          </div>
        ) : (
          <div className="empty" style={{ padding: '2rem' }}>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" aria-hidden="true">
              <path d="M22 11.1V12a10 10 0 1 1-5.9-9.1" />
              <path d="M22 4 12 14l-3-3" />
            </svg>
            <div className="t">{D('Nothing needs attention')}</div>
            <div className="s">{D('All channels covered and no agent is over cap so far today.')}</div>
          </div>
        )}
        <div className="card-pad" style={{ borderTop: '1px solid var(--line)' }}>
          <div className="small faint mb-2">{D("Today's % of cap by hour (clipped)")}</div>
          <div className="spark" style={{ height: '3rem' }}>
            {sparkHours.map((w) => (
              <i
                key={w.hour}
                title={`${F(w.hour)}: ${w.pct == null ? 'no score' : `${P(w.pct)}%`}`}
                style={{ height: w.pct == null ? '6%' : `${Math.max(w.pct, 4)}%`, opacity: w.pct == null ? 0.3 : 0.8 }}
              />
            ))}
          </div>
        </div>
      </section>
    </div>
  )
}

/* --- za — the page -------------------------------------------------------------- */

const ROUTE = { title: 'TPH and caps' }

export function TphGridPage() {
  const dateRef = useRef('')
  const { data: d, error, reload } = useSe<TphData>(() => ae.page(dateRef.current))
  const go = (date: string) => {
    dateRef.current = date
    reload()
  }
  const sum = useMemo(() => (d ? Va(d.table, Ka) : null), [d])
  const touchesPending = !!d && !d.touchesReady
  return (
    <section className="cxp dq-page" aria-labelledby="page-title" aria-busy={!d && !error}>
      <header className="page-head">
        <div>
          <h1 id="page-title" className="page-title">
            {ROUTE.title}
          </h1>
          <p className="page-sub">
            {D("Log which channel each agent is on, check the cases offered each hour, and compare each agent's touches with their cap.")}
          </p>
        </div>
        {d ? (
          <div className="page-actions">
            <Ja d={d} go={go} />
            {d.lastAuto ? (
              <span className="small faint">{D('Last build {at}', { at: $e(d.lastAuto.at) })}</span>
            ) : null}
          </div>
        ) : null}
      </header>
      {error ? <LoadError message={error} onRetry={reload} /> : null}
      {!d && !error ? <LinesSkeleton lines={6} /> : null}
      {d && sum ? (
        <Fragment>
          {touchesPending ? (
            <div className="note warn mb-3" role="status">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" aria-hidden="true">
                <circle cx="12" cy="12" r="10" />
                <path d="M12 8v4M12 16h.01" />
              </svg>
              <span>
                <b>{D("Touches aren't in yet.")}</b>{' '}
                {d.date < d.today
                  ? D('Touches for {date} have not been computed.', { date: d.date })
                  : D("Today's counts arrive tomorrow ~08:30 — percentages below are capped at estimate.")}
              </span>
            </div>
          ) : null}
          <div className="grid grid-5 mb-3">
            <div className="stat">
              <span className="stat-l">{D('Team TPH excl. calls')}</span>
              <span className="stat-v num">{P(sum.tphExCalls)}</span>
              <span className="stat-d muted">{touchesPending ? D('tomorrow 08:30') : D('excl. Inbound calls')}</span>
            </div>
            <div className="stat">
              <span className="stat-l">{D('Cases coverage')}</span>
              <span className="stat-v num">
                {sum.covered}
                <span className="faint" style={{ fontSize: '1rem' }}>
                  {' '}
                  / {sum.covered + sum.missing}
                </span>
              </span>
              <span className="stat-d muted">{D('on-grid slots with cases')}</span>
            </div>
            <div className="stat">
              <span className="stat-l">{D('Agents on grid')}</span>
              <span className="stat-v num">{sum.agents}</span>
              <span className="stat-d">{D('{n} channels', { n: String(d.channels.length) })}</span>
            </div>
            <div className="stat" data-tone="warn">
              <span className="stat-l">{D('Over cap')}</span>
              <span className="stat-v num">{d.touchesReady ? U(sum.over, 'hour-channel') : '–'}</span>
              <span className="stat-d muted">
                {d.touchesReady
                  ? sum.over
                    ? D('{a} · {t} touches above cap', { a: U(sum.overAgents, 'agent'), t: P(sum.overTouches) })
                    : D('nobody went over a cap')
                  : D('computed with touches')}
              </span>
            </div>
            <div className="stat">
              <span className="stat-l">{D('Call time')}</span>
              <span className="stat-v">{d.callsBasis === 'actual' ? D('Actual') : D('Estimate')}</span>
              <span className="stat-d">
                {d.callsBasis === 'actual'
                  ? D('Maqsam minutes, {at}', { at: $e(d.callsAsOf) })
                  : D('marked slots × {pct}%', { pct: String(Math.round(d.callsFactor * 100)) })}
              </span>
            </div>
          </div>
          <Qs d={d} sum={sum} />
        </Fragment>
      ) : null}
      {d ? <Ga d={d} reload={reload} go={go} /> : null}
    </section>
  )
}
