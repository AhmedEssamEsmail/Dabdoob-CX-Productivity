/**
 * Who is calling, and what they may do — port of original_deprecated/Auth.js
 * (and the people-directory part of PeopleCore.js).
 *
 * Session: Supabase Auth cookie (src/lib/auth.ts + src/proxy.ts) replaces
 * Session.getActiveUser(). A request with no session is the cron/trigger case:
 * realEmail() returns '' and actorEmail() stamps 'system:trigger'.
 *
 * Roles follow V1 (Auth.js:63-77), unchanged:
 *   admin     - listed in config.admin_emails, or an active roster row with role "admin"
 *   tl        - roster row with role "tl"
 *   agent     - roster row with role "agent" or "specialist" (specialist = agent-level)
 *   unknown   - anyone else on the domain
 *
 * View as (viewas.ts): currentEmail()/currentUser() answer with the person the owner
 * is viewing as; realEmail() always answers the signed-in caller.
 */

import { createAuthClient } from '@/features/shared/lib/auth'
import { db } from './repo'
import { getConfig } from './settings'
import { viewAsState, assertWritable } from './viewas'
import { described } from '@/features/shared/lib/errors'

export function normEmail(e: unknown): string {
  return String(e || '').trim().toLowerCase()
}

/** The signed-in caller, whatever View as says. '' in a cron run (no session). */
export async function realEmail(): Promise<string> {
  try {
    const supabase = await createAuthClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()
    return normEmail(user?.email)
  } catch {
    return ''
  }
}

/**
 * Who to stamp on a write (actorEmail_). Interactive calls stamp the caller;
 * cron runs have no session and stamp "system:trigger" — the trigger fallback
 * of the legacy effective user.
 */
export async function actorEmail(): Promise<string> {
  const active = await realEmail()
  if (active) return active
  return 'system:trigger'
}

/**
 * The caller's address — the View as person while the owner has it on
 * (currentEmail_). Throws when there is no signed-in user.
 */
export async function currentEmail(): Promise<string> {
  const email = await realEmail()
  if (!email) throw new Error('Unauthorized')
  const st = await viewAsState()
  return st.target || email
}

export interface PlatformUser {
  email: string
  name: string
  role: 'admin' | 'tl' | 'agent' | 'unknown'
  tlEmail: string | null
  specialist?: boolean
}

/**
 * currentUser_ verbatim (Auth.js:53-77): domain check, admin_emails, roster join,
 * the active flag, specialist -> agent-level.
 */
export async function currentUser(): Promise<PlatformUser> {
  const email = await currentEmail()
  const domain = String((await getConfig('allowed_domain', 'dabdoob.com')) || '').toLowerCase()
  if (email.split('@')[1] !== domain) {
    return { email, name: email, role: 'unknown', tlEmail: null }
  }
  const admins = String((await getConfig('admin_emails', '')) || '')
    .split(',')
    .map(normEmail)
    .filter(String)
  const { data: rosterRows, error: rosterErr } = await db()
    .from('roster')
    .select('*')
  if (rosterErr) throw described(rosterErr, { table: 'roster' })
  const row = (rosterRows || []).find((r) => normEmail(r.email) === email)
  const active = !row || (row.active !== false && String(row.active).toLowerCase() !== 'false')
  if (admins.indexOf(email) !== -1) {
    return { email, name: row ? String(row.name) : email, role: 'admin', tlEmail: null }
  }
  if (row && active && row.role === 'admin') {
    return { email, name: String(row.name || email), role: 'admin', tlEmail: null }
  }
  // 'specialist' (non-agent staff, e.g. Enablement) gets agent-level access.
  if (row && active && (row.role === 'tl' || row.role === 'agent' || row.role === 'specialist')) {
    return {
      email,
      name: String(row.name || email),
      role: row.role === 'specialist' ? 'agent' : (row.role as 'tl' | 'agent'),
      tlEmail: row.tl_email ? normEmail(row.tl_email) : null,
      specialist: row.role === 'specialist',
    }
  }
  return { email, name: row ? String(row.name || email) : email, role: 'unknown', tlEmail: null }
}

/**
 * Throws unless the caller has one of the given roles (requireRole_,
 * Auth.js:80-86 — the legacy denial message). The single implementation
 * lives here; shared/lib/auth.ts re-exports it so the API routes that
 * import requireRole from there resolve to this one copy. (It cannot be
 * re-exported the other way: the golden tests mock shared/lib/auth down
 * to createAuthClient, so this module must carry the implementation.)
 */
export async function requireRole(roles: string[]): Promise<PlatformUser> {
  const u = await currentUser()
  if (roles.indexOf(u.role) === -1) {
    throw new Error('You do not have access to this. Ask the CX admin to add you to the roster.')
  }
  return u
}

/** assistantOwnerEmail_: config assistant_owner_email, else the first admin. */
export async function assistantOwnerEmail(): Promise<string> {
  const owner = normEmail((await getConfig('assistant_owner_email', '')) || '')
  if (owner) return owner
  return normEmail(String((await getConfig('admin_emails', '')) || '').split(',')[0])
}

/**
 * requireJobCaller_: cron/job entry points have public names, so the browser could
 * call them too. Allowed: a run with no session (the trigger/cron case — Bearer
 * CRON_SECRET is checked by the route), or an admin. View as refuses a hand-run job.
 */
export async function requireJobCaller(): Promise<void> {
  const active = await realEmail()
  if (!active) return
  await assertWritable()
  const admins = String((await getConfig('admin_emails', '')) || '')
    .split(',')
    .map(normEmail)
  if (admins.indexOf(active) === -1) throw new Error('Scheduled jobs can only be run by an admin.')
}

// ---------------------------------------------------------------- people directory (pwDirectory_)

export interface DirectoryPerson {
  email: string
  name: string
  role: string
  tlEmail: string | null
  active: boolean
  position: string
}

export interface Directory {
  by: Record<string, DirectoryPerson>
  admins: string[]
  person: (e: string) => DirectoryPerson | null
  name: (e: string) => string
  managerOf: (e: string) => string | null
  agentsOf: (tl: string) => DirectoryPerson[]
  tls: () => DirectoryPerson[]
}

/**
 * Who is who, from the roster table and config admin_emails (pwDirectory_).
 * People are matched by email only, never by name. managerOf: agent -> their TL
 * (roster tl_email); TL -> the first admin.
 */
export async function pwDirectory(): Promise<Directory> {
  const admins = String((await getConfig('admin_emails', '')) || '')
    .split(',')
    .map(normEmail)
    .filter(String)
  const { data: rosterRows, error: rosterErr } = await db().from('roster').select('*')
  if (rosterErr) throw described(rosterErr, { table: 'roster' })
  const by: Record<string, DirectoryPerson> = {}
  ;(rosterRows || []).forEach((r) => {
    const e = normEmail(r.email)
    if (!e) return
    const active = r.active !== false && String(r.active).toLowerCase() !== 'false'
    by[e] = {
      email: e,
      name: String(r.name || e),
      role: String(r.role || ''),
      tlEmail: normEmail(r.tl_email) || null,
      active,
      position: String(r.position || ''),
    }
  })
  admins.forEach((a) => {
    if (by[a]) by[a].role = 'admin'
    else by[a] = { email: a, name: a, role: 'admin', tlEmail: null, active: true, position: '' }
  })
  return {
    by,
    admins,
    person: (e: string) => by[normEmail(e)] || null,
    name: (e: string) => {
      const p = by[normEmail(e)]
      return p ? p.name : String(e || '')
    },
    managerOf: (e: string) => {
      const p = by[normEmail(e)]
      if (!p) return null
      if (p.role === 'agent' || p.role === 'specialist') return p.tlEmail
      if (p.role === 'tl') return admins[0] || null
      return null
    },
    agentsOf: (tl: string) => {
      const t = normEmail(tl)
      return Object.keys(by)
        .map((k) => by[k])
        .filter((p) => (p.role === 'agent' || p.role === 'specialist') && p.active && p.tlEmail === t)
    },
    tls: () => Object.keys(by).map((k) => by[k]).filter((p) => p.role === 'tl' && p.active),
  }
}

/** pwIsManagerOf_: `user` manages `email` — admin, or the email's direct manager. */
export function pwIsManagerOf(user: { email?: string | null; role: string }, email: string, dir: Directory): boolean {
  if (user.role === 'admin') return true
  return !!email && dir.managerOf(email) === normEmail(user.email)
}
