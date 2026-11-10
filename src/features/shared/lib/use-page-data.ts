'use client'

import { useCallback, useEffect, useState } from 'react'

/**
 * usePageData — the single loader hook, merging the four legacy variants:
 *  - cx-queue `useSe(name, load, deps)`: module Map name-cache, stale-while-revalidate
 *    (cached value returns immediately while a silent refetch updates it).
 *  - cx-quality `se` / cx-hub `Eo`: function-identity cache — pass the loader via
 *    `opts.cacheKey`.
 *  - cx-productivity `se` / cx-desk `useLoaded`: no-cache mode via `opts.cache: false`
 *    (always fetches; also re-fires when the loader identity changes).
 * `opts.initialData` seeds the first render and still revalidates in the background.
 * Client-only by decision — no server/RSC hoisting.
 */

const pageDataCache = new Map<unknown, unknown>()

export interface UsePageDataOptions<T> {
  /** Seed for the first render; the loader still revalidates in background. */
  initialData?: T
  /** false = no-cache mode (useLoaded). Default true. */
  cache?: boolean
  /** Map key override — pass the loader fn for function-identity caches. */
  cacheKey?: unknown
  /** Extra deps that re-fire the loader (cx-queue useSe `deps`). */
  deps?: unknown[]
}

export function usePageData<T>(
  key: string | null,
  loader: () => Promise<T>,
  opts?: UsePageDataOptions<T>,
) {
  const cacheOn = opts?.cache !== false
  const cacheKey = opts?.cacheKey ?? key
  const cacheable = cacheOn && cacheKey !== null && cacheKey !== undefined

  const [data, setData] = useState<T | null>(() => {
    if (cacheable) {
      const hit = pageDataCache.get(cacheKey)
      if (hit !== undefined) return hit as T
    }
    return opts?.initialData ?? null
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(() => {
    const seeded =
      (cacheable && pageDataCache.get(cacheKey) !== undefined) ||
      opts?.initialData !== undefined
    return !seeded
  })
  const [tick, setTick] = useState(0)

  useEffect(() => {
    if (cacheable && data !== null) pageDataCache.set(cacheKey, data)
  }, [cacheable, cacheKey, data])

  const deps = opts?.deps
  useEffect(() => {
    let live = true
    // eslint-disable-next-line react-hooks/set-state-in-effect -- verbatim useSe: clears stale error before reload
    setError('')
    loader()
      .then((d) => {
        if (!live) return
        setData(d)
        setLoading(false)
      })
      .catch((e) => {
        if (!live) return
        setError(e instanceof Error ? e.message : String(e))
        setLoading(false)
      })
    return () => {
      live = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- cached variants re-fire on tick+deps only; no-cache (useLoaded) also on loader identity
  }, cacheOn ? [tick, ...(deps ?? [])] : [tick, loader])

  const reload = useCallback(() => setTick((t) => t + 1), [])
  return { data, error, loading, reload, setData }
}
