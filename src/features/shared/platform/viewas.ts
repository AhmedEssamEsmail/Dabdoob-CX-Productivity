/**
 * View as — port of original_deprecated/ViewAs.js plus the view-as internals of
 * Auth.js (viewAsState_ / viewAsRead_ / viewAsBlocking_ / viewAsGuard_).
 *
 * The owner (assistantOwnerEmail_) picks one roster person and every read answers
 * as that person; while it is on, every write refuses (assertWritable). State lives
 * in the `view_as` table — one row per start / stop, so it is also the audit log.
 * The last action wins.
 *
 * CacheService script cache -> the in-memory Map TTL in repo.ts (VIEW_AS_CACHE_SEC).
 * Trigger/system runs are n/a: a cron request has no session, so realEmail() is ''
 * and no View as state can ever attach — VA_SYSTEM_ has no equivalent needed.
 */

import 'server-only'

import { db, cacheGet, cachePut, cacheRemove, appendRow } from './repo'
import { realEmail, normEmail, assistantOwnerEmail, actorEmail, pwDirectory } from './identity'
import { getConfig, ccApp } from './settings'
import { described } from '@/features/shared/lib/errors'

const VIEW_AS_TABLE = 'view_as'
const VIEW_AS_CACHE_SEC = 30
export const VIEW_AS_READONLY = 'View as is read-only — exit to make changes.'

interface ViewAsState {
  real: string
  owner: boolean
  target: string
}

// Per-real-email memo — the legacy execution memo, bounded by the same 30 s cache.
const VA_MEMO = new Map<string, { st: ViewAsState; expiresAt: number }>()

function viewAsCacheKey(owner: string): string {
  return 'cc.viewas.' + owner
}

/** The owner's current target: the cached answer, else the last view_as row of his (viewAsRead_). */
export async function viewAsRead(owner: string, fresh?: boolean): Promise<string> {
  const key = viewAsCacheKey(owner)
  if (!fresh) {
    const hit = cacheGet(key)
    if (hit) return String((JSON.parse(hit) as { t?: string }).t || '')
  }
  let target = ''
  const { data, error } = await db()
    .from(VIEW_AS_TABLE)
    .select('action, target_email')
    .eq('owner_email', owner)
    .order('id', { ascending: true })
  if (error) throw described(error, { table: VIEW_AS_TABLE })
  ;(data || []).forEach((r) => {
    target = String(r.action) === 'start' ? normEmail(r.target_email) : ''
  })
  cachePut(key, JSON.stringify({ t: target }), VIEW_AS_CACHE_SEC)
  return target
}

/**
 * viewAsState_: { real, owner, target } — target is the person the owner is viewing
 * as, '' when off. Only the owner (by his real signed-in address) can ever have a
 * target. `fresh` skips the memo and the cache (bootstrap, getViewAsState).
 */
export async function viewAsState(fresh?: boolean): Promise<ViewAsState> {
  const real = await realEmail()
  if (!real) return { real, owner: false, target: '' }
  if (!fresh) {
    const memo = VA_MEMO.get(real)
    if (memo && memo.expiresAt > Date.now()) return memo.st
  }
  const st: ViewAsState = { real, owner: false, target: '' }
  st.owner = real === (await assistantOwnerEmail())
  if (st.owner) st.target = await viewAsRead(real, fresh)
  VA_MEMO.set(real, { st, expiresAt: Date.now() + VIEW_AS_CACHE_SEC * 1000 })
  return st
}

/** True while this request is the owner viewing as someone (viewAsBlocking_). */
export async function viewAsBlocking(): Promise<boolean> {
  const st = await viewAsState()
  return !!st.target
}

/**
 * viewAsGuard_: every write path calls this first. Exported as assertWritable for
 * use by mutations in new code, and as a middleware-able check.
 */
export async function assertWritable(): Promise<void> {
  if (await viewAsBlocking()) throw new Error(VIEW_AS_READONLY)
}

export const viewAsGuard = assertWritable

/** Throws unless the real caller is the owner. Returns his address (viewAsRequireOwner_). */
export async function viewAsRequireOwner(): Promise<string> {
  const real = await realEmail()
  if (!real || real !== (await assistantOwnerEmail())) {
    throw new Error('View as is only available to the CX owner.')
  }
  return real
}

/** Writes one start / stop row — the only writes allowed while View as is on (viewAsLog_). */
async function viewAsLog(owner: string, action: 'start' | 'stop', target: string): Promise<void> {
  const actor = await actorEmail()
  await appendRow(VIEW_AS_TABLE, { owner_email: owner, action, target_email: target || '', app: ccApp() }, actor)
  cachePut(viewAsCacheKey(owner), JSON.stringify({ t: action === 'start' ? target : '' }), VIEW_AS_CACHE_SEC)
  VA_MEMO.delete(owner)
}

/**
 * Audit access as Quality's qaAuditors_ grants it (viewAsAuditors_): this project has
 * no Quality.js, so the same rule is read from config qa_auditor_positions /
 * qa_auditor_emails.
 */
export async function viewAsAuditors(dir: Awaited<ReturnType<typeof pwDirectory>>): Promise<Record<string, boolean>> {
  const out: Record<string, boolean> = {}
  const keys = ([] as unknown[])
    .concat((await getConfig('qa_auditor_positions', ['enablement'])) || [])
    .map((s) => String(s).toLowerCase().trim())
    .filter(String)
  Object.keys(dir.by).forEach((k) => {
    const p = dir.by[k]
    const pos = String(p.position || '').toLowerCase()
    if (p.active && (p.role === 'tl' || keys.some((w) => pos.indexOf(w as string) !== -1))) out[k] = true
  })
  ;([] as unknown[])
    .concat((await getConfig('qa_auditor_emails', [])) || [])
    .map(normEmail)
    .filter(String)
    .forEach((e) => {
      out[e] = true
    })
  return out
}

/** The picker: every active roster person (and listed admin) but the owner, by name (getViewAsPeople). */
export async function getViewAsPeople(): Promise<
  { email: string; name: string; role: string; position: string; tlName: string; auditor: boolean }[]
> {
  const owner = await viewAsRequireOwner()
  const dir = await pwDirectory()
  const auditors = await viewAsAuditors(dir)
  const roles: Record<string, boolean> = { admin: true, tl: true, agent: true, specialist: true }
  return Object.keys(dir.by)
    .map((k) => dir.by[k])
    .filter((p) => p.active && p.email !== owner && roles[p.role])
    .map((p) => ({
      email: p.email,
      name: p.name,
      role: p.role,
      position: p.position || '',
      tlName: p.tlEmail ? dir.name(p.tlEmail) : '',
      auditor: !!auditors[p.email],
    }))
    .sort((a, b) => a.name.localeCompare(b.name))
}

/** Starts (or switches) View as (startViewAs). The browser reloads after this. */
export async function startViewAs(email: string): Promise<{ target: string }> {
  const owner = await viewAsRequireOwner()
  const target = normEmail(email)
  if (!target) throw new Error('Pick a person to view as.')
  if (target === owner) throw new Error('Pick someone other than yourself.')
  const dir = await pwDirectory()
  const p = dir.person(target)
  if (!p || !p.active) {
    throw new Error(target + ' is not on the active roster. Pick someone from the list.')
  }
  await viewAsLog(owner, 'start', target)
  return { target }
}

/** Ends View as. Safe to call when it is already off (stopViewAs). */
export async function stopViewAs(): Promise<{ target: string }> {
  const owner = await viewAsRequireOwner()
  if (await viewAsRead(owner, true)) await viewAsLog(owner, 'stop', '')
  else VA_MEMO.delete(owner)
  return { target: '' }
}

/** Fresh answer, for the browser to notice a start / stop made in another tab (getViewAsState). */
export async function getViewAsState(): Promise<{ target: string }> {
  const st = await viewAsState(true)
  return st.owner ? { target: st.target } : { target: '' }
}

/** Test hook: drop the memo and cached reads. */
export function viewAsResetCaches(): void {
  VA_MEMO.clear()
  cacheRemove('cc.viewas.') // keyed entries are per-owner; callers clear via fresh reads
}
