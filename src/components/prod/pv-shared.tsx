'use client'

import { Fragment, useCallback, useEffect, useRef, useState, type CSSProperties } from 'react'
import { Chip, stagger, useEnterAnim, useTip, vsPrev } from '@/components/shell/ui'
import { daysUntil, type FlagView } from '@/lib/prod-validation'

/**
 * The productivity pages' shared machinery, mirroring the bundle's module scope:
 * Ta/Aa (ue/re/fe/G/Ea/T formatters), zt/be decision chips, kt (FlagStrip),
 * Mt (CasesLine), Se (useSe) and the ce-style JSON fetch.
 */

/* --- Ta/Aa — Kuwait formatters ---------------------------------------- */

export const timeFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  hour: '2-digit',
  minute: '2-digit',
  hourCycle: 'h23',
})
export const dayFmt = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Kuwait',
  weekday: 'short',
  day: 'numeric',
  month: 'short',
})
export const ue = (t: string) => (t ? timeFmt.format(new Date(t)) : '')
export const re = (t: string) => (t ? dayFmt.format(new Date(t)) : '')
export const fe = (f: { intervalStart: string; intervalEnd: string }) =>
  `${ue(f.intervalStart)}–${ue(f.intervalEnd)}`
export const G = (t: number) => `${Math.round(t)} min`
export const T = (t: number | null | undefined, n = '') => (t == null ? '–' : `${t}${n}`)
export const Ea = (due: string, today: string) => daysUntil(due, today)

/* --- zt/be — decision chip -------------------------------------------- */

export const DECISIONS: Record<string, [string, string]> = {
  pending: ['Waiting for review', 'warn'],
  accepted: ['Accepted', 'ok'],
  reverted: ['Reverted to raw', 'neutral'],
  auto: ['Auto-accepted (not reviewed)', 'bad'],
  void: ['No longer applies', 'neutral'],
  open: ['Dispute open', 'warn'],
  upheld: ['Dispute upheld', 'ok'],
  rejected: ['Dispute not upheld', 'neutral'],
}

export function DecisionChip({ d }: { d: string }) {
  return <Chip status={DECISIONS[d]?.[1] ?? 'neutral'}>{DECISIONS[d]?.[0] ?? d}</Chip>
}

export const CHANNEL_LABELS: Record<string, string> = {
  chat: 'chat',
  ticket: 'ticket',
  wa: 'waiting address',
}

/* --- fetchJson — the ce.google-run seam -------------------------------- */

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data
}

/** Se — data fetch with error + reload. */
export function useSe<T>(fn: () => Promise<T>) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    let live = true
    queueMicrotask(() => live && setError(''))
    fn().then(
      (d) => live && setData(d),
      (e: unknown) => live && setError(e instanceof Error ? e.message : String(e)),
    )
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload, setData }
}

/* --- kt — the three-lane strip ----------------------------------------- */

export function FlagStrip({ f }: { f: FlagView }) {
  const n = Date.parse(f.intervalStart)
  const a = Date.parse(f.intervalEnd)
  const s = Math.max(a - n, 1)
  const l = (i: string) => Math.min(100, Math.max(0, ((Date.parse(i) - n) / s) * 100))
  const r = f.decision === 'pending' ? '' : f.validatedStatus || f.suggestedStatus
  const lane = (label: string, status: string, kind: string) => (
    <div className="pv-lane" data-kind={kind}>
      <span className="pv-lane__label">{label}</span>
      <div className="pv-lane__bar" aria-hidden="true">
        {kind !== 'raw'
          ? f.spans.map(([from, to]) => (
              <span
                key={from}
                className="pv-lane__span"
                style={{
                  insetInlineStart: `${l(from)}%`,
                  inlineSize: `${Math.max(l(to) - l(from), 0.8)}%`,
                }}
              />
            ))
          : null}
      </div>
      <span className="pv-lane__status">{status}</span>
    </div>
  )
  return (
    <figure className="pv-strip">
      {lane('Logged', f.rawStatus, 'raw')}
      {lane('Suggested', f.suggestedStatus, 'suggested')}
      {lane('Reviewed', r || 'not yet', r ? (r === f.rawStatus ? 'reverted' : 'reviewed') : 'pending')}
      <figcaption className="pv-strip__axis">
        <span>{ue(f.intervalStart)}</span>
        <span>
          {G(f.flaggedMin)} flagged of {G(f.intervalMin)} {f.rawStatus}
        </span>
        <span>{ue(f.intervalEnd)}</span>
      </figcaption>
    </figure>
  )
}

/* --- Mt — the cases line ------------------------------------------------ */

export function CasesLine({ f, ticketUrl }: { f: FlagView; ticketUrl: string }) {
  return (
    <p className="pv-cases">
      <strong>
        {f.distinctCases} distinct {f.distinctCases === 1 ? 'case' : 'cases'}
      </strong>
      <span className="cx-muted"> ({f.caseCount} events) in the flagged time: </span>
      {f.cases.map((c, i) => (
        <span key={c.id}>
          {i ? ', ' : ''}
          <a href={ticketUrl + c.id} target="_blank" rel="noopener noreferrer">
            #{c.id}
          </a>
          <span className="cx-faint"> {CHANNEL_LABELS[c.channel] ?? c.channel}</span>
        </span>
      ))}
    </p>
  )
}

/* --------------------------------------------------------------------------
 * Ba / Na / ja — analytics-only helpers (Fa page): status mix text, the
 * pv-heat weekday×hour heatmap, and the calibration histogram.
 * ------------------------------------------------------------------------ */

export const Ba = (t: Record<string, number>) =>
  Object.entries(t)
    .sort((n, a) => a[1] - n[1])
    .map(([n, a]) => `${n} ${a}`)
    .join(', ') || '–'

/** Na — idle-after-review heatmap: weekday rows × 24 hour cells. */
export function HeatGrid({ grid }: { grid: (number | null)[][] }) {
  const ref = useRef<HTMLDivElement | null>(null)
  useEnterAnim(ref)
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
  const max = Math.max(1, ...grid.flat().filter((l): l is number => l !== null))
  return (
    <div
      ref={ref}
      className="cx-panel cx-panel--pad pv-heat cc-chart"
      role="table"
      aria-label="Idle after review, % of logged time, by weekday and hour (Kuwait)"
    >
      <div className="pv-heat__row" role="row">
        <span role="columnheader" />
        {Array.from({ length: 24 }, (_, r) => (
          <span key={r} role="columnheader" className="pv-heat__h">
            {r % 3 === 0 ? r : ''}
          </span>
        ))}
      </div>
      {grid.map((row, r) => (
        <div key={r} className="pv-heat__row cc-sweep-fade" style={stagger(r)} role="row">
          <span role="rowheader" className="pv-heat__d">
            {days[r]}
          </span>
          {row.map((o, i) => (
            <span
              key={i}
              role="cell"
              className="pv-heat__c"
              title={`${days[r]} ${i}:00, ${T(o, '%')}`}
              style={o === null ? undefined : ({ '--pv-heat': String(Math.min(o / max, 1)) } as CSSProperties)}
              data-empty={o === null ? 'true' : undefined}
            >
              <span className="cx-sr">{T(o, '%')}</span>
            </span>
          ))}
        </div>
      ))}
    </div>
  )
}

/** ja — histogram of distinct-case counts in idle vs working windows. */
export function CalibrationChart({
  cal,
  windowMin,
}: {
  cal: { idle: Record<string, number>; working: Record<string, number> }
  windowMin: number
}) {
  const keys = [...new Set([...Object.keys(cal.idle), ...Object.keys(cal.working)])]
    .map(Number)
    .sort((i, h) => i - h)
  const share = (i: Record<string, number>) => {
    const total = Object.values(i).reduce((p, x) => p + x, 0) || 1
    return (p: number) => ((i[p] || 0) / total) * 100
  }
  const idleShare = share(cal.idle)
  const workingShare = share(cal.working)
  const ref = useRef<HTMLDivElement | null>(null)
  useEnterAnim(ref)
  return (
    <div ref={ref} className="cx-panel cx-panel--pad pv-hist cc-chart">
      <p className="cx-muted">
        Share of {windowMin}-minute windows by distinct cases in them. A good X sits where IDLE
        windows end and working windows start.
      </p>
      <table className="cx-table">
        <thead>
          <tr>
            <th scope="col">Distinct cases</th>
            <th scope="col">IDLE windows</th>
            <th scope="col">Working windows</th>
          </tr>
        </thead>
        <tbody>
          {keys.map((i, h) => (
            <tr key={i}>
              <td className="cx-num">{i}</td>
              <td>
                <span
                  className="pv-bar cc-sweep-bar"
                  data-kind="idle"
                  style={{ inlineSize: `${idleShare(i)}%`, ...stagger(h) }}
                />{' '}
                {idleShare(i).toFixed(1)}%
              </td>
              <td>
                <span
                  className="pv-bar cc-sweep-bar"
                  data-kind="working"
                  style={{ inlineSize: `${workingShare(i)}%`, ...stagger(h) }}
                />{' '}
                {workingShare(i).toFixed(1)}%
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

/* --- Xe / Tn � the weekly sparkline trio (my-status + Fa) ---------------- */

export interface TrendPoint {
  week: string
  partial: boolean
  idleEffPct: number | null
  flagsPer100h: number | null
  precisionPct: number | null
}

/** Xe � one SVG sparkline (polyline + hoverable points + Ca tooltip). */
export function Xe({
  title,
  unit,
  points,
  pick,
}: {
  title: string
  unit: string
  points: TrendPoint[]
  pick: (p: TrendPoint) => number | null
}) {
  const { ref, tipFor, tipEl } = useTip<HTMLElement>()
  const i = points.map(pick)
  const h = i.filter((d): d is number => d !== null)
  const p = Math.max(...h, 1)
  const lo = Math.min(...h, 0)
  const u = (m: number) => 12 + (m * 176) / Math.max(points.length - 1, 1)
  const c = (d: number) => 60 - ((d - lo) / Math.max(p - lo, 1e-9)) * 48
  const g = i
    .map((d, m) => (d === null ? '' : `${u(m)},${c(d)}`))
    .filter(Boolean)
    .join(' ')
  return (
    <figure ref={ref} className="pv-spark cx-panel cx-panel--pad cc-chart">
      {tipEl}
      <figcaption>{title}</figcaption>
      <svg
        viewBox="0 0 200 72"
        role="group"
        aria-label={`${title}: ${i.map((d, m) => `${points[m].week} ${T(d, unit)}`).join(', ')}`}
      >
        <polyline className="cc-sweep-line" pathLength={1} points={g} />
        {i.map((d, m) =>
          d === null ? null : (
            <circle
              key={m}
              className="cc-sweep-fade"
              cx={u(m)}
              cy={c(d)}
              r={3}
              data-partial={points[m].partial ? 'true' : undefined}
              tabIndex={0}
              role="img"
              {...tipFor(
                [
                  `Week of ${points[m].week}: ${T(d, unit)}${points[m].partial ? ' so far' : ''}`,
                  points[m].partial ? '' : vsPrev(d, i[m - 1]),
                ]
                  .filter(Boolean)
                  .join(', ')
              )}
            />
          )
        )}
      </svg>
      <div className="pv-spark__vals">
        {i.map((d, m) => (
          <span key={m}>
            {T(d, unit)}
            {points[m].partial ? '*' : ''}
          </span>
        ))}
      </div>
    </figure>
  )
}

/** Tn � the three sparklines + footnote. */
export function Tn({ points }: { points: TrendPoint[] }) {
  return (
    <Fragment>
      <div className="pv-sparks">
        <Xe title="Idle after review, % of logged" unit="%" points={points} pick={(n) => n.idleEffPct} />
        <Xe title="Flags per 100 logged hours" unit="" points={points} pick={(n) => n.flagsPer100h} />
        <Xe
          title="Flag precision (accepted of reviewed)"
          unit="%"
          points={points}
          pick={(n) => n.precisionPct}
        />
      </div>
      <p className="cx-faint">Weeks start on Sunday; * marks the week in progress.</p>
    </Fragment>
  )
}
