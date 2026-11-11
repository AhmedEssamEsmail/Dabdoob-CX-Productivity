'use client'
/* People pages keep queue chrome locally (AsOfHint/dayAt/hm/fmt; Head retired);
   plumbing names re-point to the shared homes (fetch-json / use-page-data /
   PageStates), and useHashParams reads pageParams directly. */
import { useMemo } from 'react'
import { fetchJson as sharedFetchJson, FetchError, postJson } from '@/features/shared/lib/fetch-json'
import { usePageData } from '@/features/shared/lib/use-page-data'
import { Failed, LinesSkeleton } from '@/features/shared/components/ui/PageStates'
import { pageParams } from '@/features/shared/shell/gates'

export { FetchError }

/** Legacy (url, body?) auto-POST signature kept for cx-people call sites. */
const fetchJsonLegacy = (url: string, body?: unknown) =>
  body === undefined ? sharedFetchJson(url) : postJson(url, body)
export { fetchJsonLegacy as fetchJson }

/** useSe(name, load, deps) — name-cache loader over the canonical usePageData. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any -- verbatim legacy port
function useSeLegacy<T = any>(name: string, load: () => Promise<T>, deps: unknown[] = []) {
  return usePageData(name, load, { deps })
}
export { useSeLegacy as useSe }

export { LinesSkeleton as Skeleton, Failed as LoadError }

const kwTime = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' })
const kwDay = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Kuwait', weekday: 'short', day: 'numeric', month: 'short' })
export const hm = (t?: string | null) => (t ? kwTime.format(new Date(t)) : '')
export const dayAt = (t?: string | null) => (t ? kwDay.format(new Date(t)) : '')
export const fmt = (n: number) => n.toLocaleString('en-US')

export function AsOfHint({ iso, what = 'Freshdesk' }: { iso?: string | null; what?: string }) {
  return iso ? (
    <span className="cx-section__hint">
      {what}, read {dayAt(iso)} at {hm(iso)} Kuwait time
    </span>
  ) : (
    <span className="cx-section__hint">No data yet: the first scheduled run has not finished.</span>
  )
}

export function useHashParams(): URLSearchParams {
  /* Same as the queue impl: params seed initial state once; pageParams covers
     the legacy '#…?k=v' tail the HashShim rewrites into location.search. */
  return useMemo(() => pageParams(), [])
}
