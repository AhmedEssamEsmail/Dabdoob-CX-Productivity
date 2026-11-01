/**
 * Freshchat API v2 client — GET https://{domain}/v2/conversations, Bearer auth.
 * Env: FRESHCHAT_API_KEY, FRESHCHAT_DOMAIN (account host — 'dabdoob',
 * 'dabdoob.freshchat.com', or a full URL; /v2 is appended if missing).
 */

import { vendorJson } from './http'

export interface FreshchatCreds {
  key: string
  /** e.g. dabdoob.freshchat.com/v2 */
  base: string
}

export interface FreshchatConversation {
  [k: string]: unknown
}

export function freshchatCredsFromEnv(): FreshchatCreds | null {
  const key = process.env.FRESHCHAT_API_KEY
  const domain = process.env.FRESHCHAT_DOMAIN
  if (!key || !domain) return null
  return { key, base: freshchatBase(domain) }
}

/** 'dabdoob' | 'dabdoob.freshchat.com' | 'https://…/v2' -> <host>/v2 */
export function freshchatBase(domain: string): string {
  let d = String(domain).trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')
  if (d.endsWith('/v2')) d = d.slice(0, -3)
  if (!d.includes('.')) d = `${d}.freshchat.com`
  return `${d}/v2`
}

/**
 * Conversations paged newest-updated first. When `sinceMs` is given, paging
 * stops once a whole page is older than it (updated < sinceMs) — nothing newer
 * can follow in desc order. Otherwise pages run to a short page or maxPages.
 */
export async function listFreshchatConversations(
  creds: FreshchatCreds,
  opts: { sinceMs?: number; maxPages?: number; itemsPerPage?: number } = {}
): Promise<FreshchatConversation[]> {
  const out: FreshchatConversation[] = []
  const per = Math.min(100, Math.max(1, opts.itemsPerPage ?? 100))
  const maxPages = Math.max(1, opts.maxPages ?? 500)
  for (let page = 1; page <= maxPages; page++) {
    const q = new URLSearchParams({
      page: String(page),
      items_per_page: String(per),
      sort_by: 'updated_time',
      sort_order: 'desc',
    })
    const data = await vendorJson(`https://${creds.base}/conversations?${q}`, { headers: { authorization: `Bearer ${creds.key}` } }, 'freshchat')
    const convs = Array.isArray(data)
      ? (data as FreshchatConversation[])
      : ((data as { conversations?: FreshchatConversation[] }).conversations || [])
    if (!convs.length) break
    let allOlder = !!opts.sinceMs
    for (const c of convs) {
      const upd = Number(c.updated_time || c.updated_at || 0)
      const updMs = upd && upd < 1e12 ? upd * 1000 : upd
      if (!opts.sinceMs || !updMs || updMs >= opts.sinceMs) {
        out.push(c)
        allOlder = false
      }
    }
    if (allOlder || convs.length < per) break
  }
  return out
}
