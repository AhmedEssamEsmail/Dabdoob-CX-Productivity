/* --- fetchJson — the ce.google-run seam -------------------------------- */

export async function fetchJson(url: string, init?: RequestInit) {
  const res = await fetch(url, { cache: 'no-store', ...init })
  const data = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error((data as { error?: string }).error || 'Request failed')
  return data
}
