'use client'
/* eslint-disable @typescript-eslint/no-explicit-any -- verbatim legacy port: closure code uses any. */
/* Queue & Workforce shared widgets — ports of the closure-bundle helpers
 * (dq-head, cx-chip, cx-agechip, dq-refresh, the useSe loader, Kuwait formatters).
 */
import { useCallback, useEffect, useMemo, useState } from 'react'
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

export { PageHead }
