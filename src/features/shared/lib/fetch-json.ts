/* --- fetchJson — the ce.google-run seam -------------------------------- */

export class FetchError extends Error {
  readonly url: string
  constructor(message: string, url: string) {
    super(message)
    this.name = 'FetchError'
    this.url = url
  }
}

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new FetchError((data as { error?: string }).error || 'Request failed', url)
  return data
}

export function postJson(url: string, body: unknown, init?: RequestInit) {
  return fetchJson(url, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify(body),
    ...init,
  })
}
