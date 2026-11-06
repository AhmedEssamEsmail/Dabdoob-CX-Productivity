#!/usr/bin/env node
/**
 * Seeds the e2e fixture identities into the Supabase project that `.env.local`
 * points at (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY).
 *
 * Why this exists: e2e specs log in through the real sign-in form
 * (/auth/login -> POST /api/auth/login -> supabase.auth.signInWithPassword) and
 * every page is gated by src/proxy.ts (Supabase session) plus the roster/domain
 * checks in platform/identity.ts (allowed_domain = dabdoob.com). The old
 * *@example.com fixture creds can never satisfy either gate, so each spec needs
 * a real confirmed auth user on dabdoob.com with a matching roster row:
 *
 *   e2e.admin@dabdoob.com  roster role: admin
 *   e2e.tl@dabdoob.com     roster role: tl
 *   e2e.agent@dabdoob.com  roster role: agent (tl_email -> e2e.tl@dabdoob.com)
 *
 * All three share one password: E2E_USER_PASSWORD, default 'E2E-cx-local-2026!'
 * (keep in sync with e2e/users.ts).
 *
 * Idempotent: re-running resets the password and re-asserts the roster rows.
 * Safe against the shared dev project — it only touches the e2e.* addresses.
 *
 * Usage:
 *   node e2e/seed-users.mjs            # or: npm run test:e2e:seed
 *   E2E_USER_PASSWORD=... node e2e/seed-users.mjs
 */
import { createClient } from '@supabase/supabase-js'
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local' })

const PASSWORD = process.env.E2E_USER_PASSWORD || 'E2E-cx-local-2026!'

const USERS = [
  { email: 'e2e.admin@dabdoob.com', name: 'E2E Admin', role: 'admin', tl_email: null },
  { email: 'e2e.tl@dabdoob.com', name: 'E2E Team Lead', role: 'tl', tl_email: null },
  { email: 'e2e.agent@dabdoob.com', name: 'E2E Agent', role: 'agent', tl_email: 'e2e.tl@dabdoob.com' },
]

const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY
if (!url || !serviceKey) {
  console.error('Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env.local')
  process.exit(1)
}

const admin = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

/** All auth users, paginated (listUsers caps at 1000/page). */
async function listAllUsers() {
  const out = []
  for (let page = 1; ; page++) {
    const { data, error } = await admin.auth.admin.listUsers({ page, perPage: 1000 })
    if (error) throw error
    out.push(...data.users)
    if (data.users.length < 1000) return out
  }
}

async function ensureAuthUser(existing, user) {
  const found = existing.find((u) => u.email?.toLowerCase() === user.email)
  if (found) {
    const { error } = await admin.auth.admin.updateUserById(found.id, {
      password: PASSWORD,
      email_confirm: true,
    })
    if (error) throw new Error(`updateUserById ${user.email}: ${error.message}`)
    return `updated ${user.email} (${found.id})`
  }
  const { data, error } = await admin.auth.admin.createUser({
    email: user.email,
    password: PASSWORD,
    email_confirm: true,
  })
  if (error) throw new Error(`createUser ${user.email}: ${error.message}`)
  return `created ${user.email} (${data.user.id})`
}

async function ensureRosterRow(user) {
  const { error } = await admin.from('roster').upsert(
    {
      email: user.email,
      name: user.name,
      role: user.role,
      tl_email: user.tl_email,
      active: true,
      submitted_by: 'e2e/seed-users.mjs',
    },
    { onConflict: 'email' }
  )
  if (error) throw new Error(`roster upsert ${user.email}: ${error.message}`)
  return `roster ${user.email} -> ${user.role}`
}

async function verifySignIn(user) {
  const anon = createClient(url, process.env.SUPABASE_ANON_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
  })
  const { error } = await anon.auth.signInWithPassword({ email: user.email, password: PASSWORD })
  return error ? `sign-in FAILED for ${user.email}: ${error.message}` : `sign-in ok for ${user.email}`
}

const existing = await listAllUsers()
for (const user of USERS) {
  console.log(await ensureAuthUser(existing, user))
  console.log(await ensureRosterRow(user))
}
for (const user of USERS) {
  console.log(await verifySignIn(user))
}
console.log('Done. Run: npx playwright test')
