'use client'
/* --- useSearchParamState — view state in the URL (S02-04) ------------
 * `useSearchParamState(key, initial)` returns `[value, setValue]` synced to
 * `?key=value` so tab/date/view state is deep-linkable and survives reload.
 * Reads go through `pageParams()` (covers the legacy `#k=v` tail the
 * HashShim rewrites into location.search); writes use `router.replace` with
 * `scroll: false` by default — `opts.push` opts into `router.push`.
 * Setting the value to '' removes the param.
 */

import { useCallback } from 'react'
import { usePathname, useRouter } from 'next/navigation'
import { pageParams } from '../shell/gates'

export type SearchParamSetter = (next: string | ((prev: string) => string)) => void

export function useSearchParamState(
  key: string,
  initial: string,
  opts?: { push?: boolean },
): [string, SearchParamSetter] {
  const router = useRouter()
  const pathname = usePathname()
  const value = pageParams().get(key) ?? initial

  const setValue = useCallback<SearchParamSetter>(
    (next) => {
      const prev = pageParams().get(key) ?? initial
      const resolved = typeof next === 'function' ? next(prev) : next
      const params = pageParams()
      if (resolved === '') params.delete(key)
      else params.set(key, resolved)
      const qs = params.toString()
      const url = qs ? `${pathname}?${qs}` : pathname
      if (opts?.push) router.push(url, { scroll: false })
      else router.replace(url, { scroll: false })
    },
    [key, initial, pathname, router, opts?.push]
  )

  return [value, setValue]
}
