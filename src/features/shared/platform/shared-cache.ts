/**
 * Shared key/value cache over the app_cache table (S10-01) — the
 * cross-instance replacement for the repo.ts process-local Map.
 * Same semantics as cacheGet/cachePut/cacheRemove: string in/out,
 * TTL seconds, null on miss, every failure swallowed.
 */
import 'server-only'
import { db } from './repo'

/** Cache get: the unexpired row's value, null on miss/expired/error. */
export async function dbCacheGet(key: string): Promise<string | null> {
  try {
    const { data, error } = await db()
      .from('app_cache')
      .select('value, expires_at')
      .eq('key', key)
      .maybeSingle()
    if (error || !data) return null
    const row = data as { value?: string | null; expires_at?: string | null }
    const expiresAt = Date.parse(String(row.expires_at || ''))
    if (!isFinite(expiresAt) || expiresAt <= Date.now()) return null
    return row.value == null ? null : String(row.value)
  } catch {
    return null
  }
}

/** Cache put: upsert {key, value, expires_at: now + ttlSeconds}. Errors swallowed. */
export async function dbCachePut(key: string, value: string, ttlSeconds: number): Promise<void> {
  try {
    const now = new Date()
    const { error } = await db()
      .from('app_cache')
      .upsert(
        {
          key,
          value,
          expires_at: new Date(now.getTime() + ttlSeconds * 1000).toISOString(),
          updated_at: now.toISOString(),
        },
        { onConflict: 'key' }
      )
    if (error) throw new Error(error.message)
  } catch {
    /* the script cache was best-effort; so is this one */
  }
}

/** Cache remove: delete by exact key. Errors swallowed. */
export async function dbCacheRemove(key: string): Promise<void> {
  try {
    await db().from('app_cache').delete().eq('key', key)
  } catch {
    /* best-effort */
  }
}
