'use client'
/* --- useOptions — the one dropdown-options cache (S02-03) --------------
 * GET /api/options/<listKey> -> { options: string[] }. One module-level
 * inflight+cache pair: concurrent callers share a single fetch, and a list
 * loaded on one page is reused on the next in the same session. Errors are
 * never cached, so a failed load retries on the next mount or `reload`.
 * Barrel aliases (dropdownApi / optInflight / Vo / Ce / it) wrap this hook;
 * `loadOptions` is the promise form for non-hook callers.
 */

import { useCallback, useEffect, useState } from 'react'
import { fetchJson } from './fetch-json'

const optionsCache = new Map<string, string[]>()
const optionsInflight = new Map<string, Promise<string[]>>()

function requestOptions(listKey: string): Promise<string[]> {
  return fetchJson(`/api/options/${encodeURIComponent(listKey)}`).then((data) => {
    const raw = Array.isArray(data) ? data : (data as { options?: unknown } | null)?.options
    const list = Array.isArray(raw) ? (raw as string[]) : []
    optionsCache.set(listKey, list)
    return list
  })
}

/** Deduped, session-cached loader — one fetch per key while inflight, cache hit after. */
export function loadOptions(listKey: string): Promise<string[]> {
  const hit = optionsCache.get(listKey)
  if (hit) return Promise.resolve(hit)
  let p = optionsInflight.get(listKey)
  if (!p) {
    p = requestOptions(listKey).then(
      (list) => {
        optionsInflight.delete(listKey)
        return list
      },
      (err) => {
        optionsInflight.delete(listKey)
        throw err
      }
    )
    optionsInflight.set(listKey, p)
  }
  return p
}

type OptionsState = { key: string | null; options: string[]; loading: boolean; error: string | null }

function freshState(key: string | null, fallbackOptions: string[]): OptionsState {
  const cached = key ? optionsCache.get(key) : undefined
  return {
    key,
    options: cached ?? (key === null ? [] : fallbackOptions),
    loading: cached === undefined && key !== null,
    error: null,
  }
}

function errorMessage(err: unknown): string {
  return err instanceof Error ? err.message : String(err)
}

/**
 * Dropdown options for `listKey`: `{ options, loading, error, reload }`.
 * Cache hits return immediately with no refetch (legacy store semantics);
 * `reload` drops the cached entry and refetches. `listKey: null` yields an
 * idle empty state.
 */
export function useOptions(listKey: string | null): {
  options: string[]
  loading: boolean
  error: string | null
  reload: () => void
} {
  const [state, setState] = useState<OptionsState>(() => freshState(listKey, []))

  // State is keyed by listKey: on a key change derive the fresh state during
  // render (cache hit -> instant, miss -> keep prior options while loading,
  // matching legacy semantics) instead of setState inside the effect.
  const current = state.key === listKey ? state : freshState(listKey, state.options)

  useEffect(() => {
    if (!listKey) return
    let alive = true
    loadOptions(listKey).then(
      (options) => {
        if (alive) setState({ key: listKey, options, loading: false, error: null })
      },
      (err) => {
        if (alive)
          setState((s) => ({
            ...s,
            key: listKey,
            loading: false,
            error: errorMessage(err),
          }))
      }
    )
    return () => {
      alive = false
    }
  }, [listKey])

  const reload = useCallback(() => {
    if (!listKey) return
    optionsCache.delete(listKey)
    setState({ key: listKey, options: [], loading: true, error: null })
    loadOptions(listKey).then(
      (options) => setState({ key: listKey, options, loading: false, error: null }),
      (err) =>
        setState((s) => ({
          key: listKey,
          options: s.key === listKey ? s.options : [],
          loading: false,
          error: errorMessage(err),
        }))
    )
  }, [listKey])

  return { options: current.options, loading: current.loading, error: current.error, reload }
}
