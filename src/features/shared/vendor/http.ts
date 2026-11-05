/**
 * Vendor API HTTP helper — fetch JSON with retry on 429/5xx/network failures
 * and described errors that carry endpoint + status (never credentials).
 */

import { DescribedError, described } from '@/features/shared/lib/errors'

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms))

/**
 * GET/POST JSON against a vendor API. 401 -> missing_credentials, 403 ->
 * source_forbidden (no retry), 429/5xx/network -> up to 3 tries with backoff.
 * `source` names the vendor in errors ('maqsam' | 'freshchat').
 */
export async function vendorJson(url: string, init: RequestInit, source: string): Promise<unknown> {
  for (let attempt = 0; ; attempt++) {
    let res: Response
    try {
      res = await fetch(url, init)
    } catch (e) {
      if (attempt >= 2) throw described(e, { step: source + ' API request' })
      await sleep(400 * 2 ** attempt)
      continue
    }
    if (res.ok) return res.json()
    const body = await res.text().catch(() => '')
    if (res.status === 401 || res.status === 403) {
      throw new DescribedError({
        code: res.status === 401 ? 'missing_credentials' : 'source_forbidden',
        message: `${source} API ${init.method || 'GET'} ${url} failed: HTTP ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`,
        hint: `Check the ${source.toUpperCase()}_API_KEY / ${source.toUpperCase()}_DOMAIN env vars in Vercel.`,
      })
    }
    if ((res.status === 429 || res.status >= 500) && attempt < 2) {
      await sleep(400 * 2 ** attempt)
      continue
    }
    throw described(new Error(`${source} API ${init.method || 'GET'} ${url} failed: HTTP ${res.status}${body ? ' — ' + body.slice(0, 200) : ''}`), {
      step: source + ' API request',
    })
  }
}

/** Epoch seconds or milliseconds -> ms; 0 when unreadable. */
export function epochMs(v: unknown): number {
  const n = typeof v === 'number' ? v : Number(String(v || '').trim())
  if (!n || !isFinite(n) || n <= 0) return 0
  return n < 1e12 ? n * 1000 : n
}

/** ms -> ISO instant string the tph clocks parse unambiguously. */
export function isoMs(ms: number): string {
  return new Date(ms).toISOString()
}
