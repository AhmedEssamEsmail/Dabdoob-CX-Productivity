'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* Queue & Workforce shared widgets — ports of the closure-bundle helpers
 * (dq-head, cx-chip, cx-agechip, dq-refresh, the useSe loader, Kuwait formatters,
 * and the Qa dropdown + options cache from checkins.closure.js).
 */
import { useCallback, useEffect, useId, useMemo, useRef, useState } from 'react'
import { PageHead } from '@/features/shared/components/shell/ui'

export const kwTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
export const kwDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', weekday: 'short', day: 'numeric', month: 'short' })
export const hm = (t?: string | null) => (t ? kwTime.format(new Date(t)) : '')
export const dayAt = (t?: string | null) => (t ? kwDay.format(new Date(t)) : '')

export const AGE_RANKS = [0, 1, 3, 4, 6]
export const ageRank = (t: number, n = 13) => {
  const s = Math.max(0, Math.min(n - 1, t))
  return n === AGE_RANKS.length ? String(AGE_RANKS[s]) : String(n <= 1 ? 0 : Math.round((s * 6) / (n - 1)))
}
export const bandTop = (t: number) => (t >= 24 && t % 24 === 0 ? `${t / 24} d` : `${t} h`)
export const humanH = (t: number) => (t < 1 ? `${Math.max(1, Math.round(t * 60))} min` : t < 24 ? `${Math.floor(t)} h` : `${Math.floor(t / 24)} d ${Math.floor(t % 24)} h`)
export const fmt = (n: number) => n.toLocaleString('en-US')

export function AgeChip({ hours, band }: { hours: number; band: number }) {
  return (
    <span className="cx-agechip" data-age={ageRank(band)}>
      {humanH(hours)}
    </span>
  )
}

export function Head({ title, sub, aside }: { title: string; sub: string; aside?: React.ReactNode }) {
  return (
    <header className="dq-head">
      <div>
        <h1 id="page-title" className="page-title">
          {title}
        </h1>
        <p className="page-purpose">{sub}</p>
      </div>
      {aside ? <div className="dq-head__aside">{aside}</div> : null}
    </header>
  )
}

export function AsOfHint({ iso, what = 'Freshdesk' }: { iso?: string | null; what?: string }) {
  return iso ? (
    <span className="cx-section__hint">
      {what}, read {dayAt(iso)} at {hm(iso)} Kuwait time
    </span>
  ) : (
    <span className="cx-section__hint">No data yet: the first scheduled run has not finished.</span>
  )
}

export function LoadError({ message, onRetry }: { message: string; onRetry: () => void }) {
  return (
    <div className="cx-note" data-status="bad" role="alert">
      <div>
        <strong>This page could not load.</strong> {message}{' '}
        <button type="button" className="cx-btn cx-btn--quiet" onClick={onRetry}>
          Try again
        </button>
      </div>
    </div>
  )
}

export function Skeleton({ lines = 3, tall = false }: { lines?: number; tall?: boolean }) {
  return (
    <div className="cx-panel cx-panel--pad cc-skel" aria-hidden="true">
      <span className="skeleton cc-skel__title" />
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="cc-skel__row">
          <span className="skeleton" />
          <span className="skeleton" style={{ inlineSize: `${[78, 62, 90, 54, 70, 46, 84, 58][i % 8]}%` }} />
          <span className="skeleton" />
        </span>
      ))}
      {tall ? <span className="skeleton cc-skel__ladder" /> : null}
    </div>
  )
}

export class FetchError extends Error {
  fn: string
  constructor(fn: string, message: string) {
    super(message)
    this.fn = fn
  }
}

/** google.script.run facade -> fetch on the Next API routes. */
export async function fetchJson(url: string, body?: unknown): Promise<any> {
  const res = await fetch(url, body === undefined ? { cache: 'no-store' } : { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
  const data = await res.json().catch(() => null)
  if (!res.ok) throw new FetchError(url, String((data && data.error) || res.statusText || 'Request failed'))
  return data
}

const cache = new Map<string, unknown>()

/** The vt() loader from the bundles: cached data, error, reload. */
export function useSe<T = any>(name: string, load: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(() => (cache.get(name) as T) ?? null)
  const [error, setError] = useState('')
  const [tick, setTick] = useState(0)
  useEffect(() => {
    if (data !== null) cache.set(name, data)
  }, [data, name])
  useEffect(() => {
    let on = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim useSe: clears stale error before reload
    setError('')
    load()
      .then((d) => on && setData(d))
      .catch((e) => on && setError(e.message))
    return () => {
      on = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tick, ...deps])
  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, reload, setData }
}

export function useHashParams(): URLSearchParams {
  return useMemo(() => {
    if (typeof location === 'undefined') return new URLSearchParams()
    const i = location.hash.indexOf('?')
    return new URLSearchParams(i === -1 ? '' : location.hash.slice(i + 1))
  }, [])
}

// ---------------------------------------------------------------------------
// The server-backed dropdown (checkins.closure.js symbols qt/Ot/ea/kn/ls/Qa).
// Options live per listKey and are shared by every mounted select; "Other…"
// appends through POST /api/options/<listKey>, which the data layer refuses
// in a View as session (assertWritable_).
// ---------------------------------------------------------------------------

const OPT_OTHER = '__other__' // qt
let optData: Record<string, string[]> = {} // ot
const optInflight = new Map<string, Promise<unknown>>() // Ot
const optSubs = new Set<() => void>() // It

/** ss/kn: write one list's options, then notify subscribers. */
function optPut(listKey: string, options: string[]): void {
  optData = { ...optData, [listKey]: options }
  optSubs.forEach((f) => f())
}

/** ls: subscribe a component to the shared options store. */
function useOpt<T>(read: () => T, deps: unknown[] = []): T {
  const [v, setV] = useState(read)
  useEffect(() => {
    const f = () => setV(() => read())
    optSubs.add(f)
    f()
    return () => {
      optSubs.delete(f)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- verbatim ls(): re-subscribes on the caller's deps
  }, deps)
  return v
}

/**
 * Qa verbatim: a dropdown backed by GET /api/options/<listKey>, with an
 * "Other…" choice that posts a new option and selects it. While the choices
 * load the select is disabled and shows "Loading choices…"; a current value
 * that is not in the list is prepended so it stays visible.
 */
export function ListSelect({
  listKey,
  label,
  value,
  onChange,
  placeholder = 'Choose…',
  required,
  disabled,
  hint,
}: {
  listKey: string
  label: string
  value: string
  onChange: (v: string) => void
  placeholder?: string
  required?: boolean
  disabled?: boolean
  hint?: string
}) {
  const p = useId()
  const d = useOpt(() => optData[listKey], [listKey])
  const [u, c] = useState(false)
  const [o, f] = useState('')
  const [g, m] = useState(false)
  const [b, v] = useState('')
  const [y, w] = useState('')
  const M = useRef<HTMLInputElement | null>(null)
  useEffect(() => {
    if (d !== undefined) return
    let q = optInflight.get(listKey)
    if (!q) {
      q = fetchJson('/api/options/' + encodeURIComponent(listKey)).then((N) => optPut(listKey, (N.options as string[]) ?? []))
      optInflight.set(listKey, q)
      q.catch(() => optInflight.delete(listKey))
    }
    q.catch((N) => w((N as Error).message))
  }, [listKey, d])
  useEffect(() => {
    if (u) M.current?.focus()
  }, [u])
  const $ = d ?? []
  const L = value && !$.includes(value) ? [value, ...$] : $
  function H(q: React.ChangeEvent<HTMLSelectElement>) {
    const N = q.currentTarget.value
    if (N === OPT_OTHER) {
      c(true)
      v('')
      return
    }
    c(false)
    onChange(N)
  }
  async function O() {
    if (g) return
    m(true)
    v('')
    try {
      const q = await fetchJson('/api/options/' + encodeURIComponent(listKey), { value: o })
      optPut(listKey, q.options)
      onChange(q.value)
      c(false)
      f('')
    } catch (q: any) {
      v(q.message)
    } finally {
      m(false)
    }
  }
  function T() {
    c(false)
    f('')
    v('')
  }
  const S = hint ? `${p}-hint` : undefined
  const C = b || y ? `${p}-err` : undefined
  return (
    <div className="field">
      <label htmlFor={p} className="field-label">
        {label}
        {required ? (
          <span className="req" aria-hidden="true">
            {' '}
            *
          </span>
        ) : null}
      </label>
      <select
        id={p}
        className="select"
        value={u ? OPT_OTHER : value}
        onChange={H}
        disabled={disabled || d === undefined}
        required={required}
        aria-describedby={[S, C].filter(Boolean).join(' ') || undefined}
      >
        <option value="" disabled={required}>
          {d === undefined ? 'Loading choices…' : placeholder}
        </option>
        {L.map((q) => (
          <option key={q} value={q}>
            {q}
          </option>
        ))}
        <option value={OPT_OTHER}>Other…</option>
      </select>
      {hint ? (
        <p id={S} className="field-hint">
          {hint}
        </p>
      ) : null}
      {u ? (
        <div className="other-row">
          <input
            ref={M}
            className="input"
            type="text"
            maxLength={120}
            value={o}
            aria-label={`New choice for ${label}`}
            placeholder="Type the new choice"
            onInput={(q) => f(q.currentTarget.value)}
            onKeyDown={(q) => {
              if (q.key === 'Enter') {
                q.preventDefault()
                O()
              } else if (q.key === 'Escape') T()
            }}
          />
          <button type="button" className="btn btn-primary" onClick={O} disabled={g || !o.trim()}>
            {g ? 'Adding…' : 'Add choice'}
          </button>
          <button type="button" className="btn btn-quiet" onClick={T} disabled={g}>
            Cancel
          </button>
        </div>
      ) : null}
      {b || y ? (
        <p id={C} className="field-error" role="alert">
          {b || `Choices did not load: ${y}`}
        </p>
      ) : null}
    </div>
  )
}

export { PageHead }
