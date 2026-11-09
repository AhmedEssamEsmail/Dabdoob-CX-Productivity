import { describe, it, expect, vi, beforeEach } from 'vitest'

type QueryResult = { data: unknown; error: { message: string } | null }

// Controllable supabase stub: each test sets `rosterRows`; every awaited query
// resolves to them (roleForEmail matches the row itself after ilike).
const supa = vi.hoisted(() => ({
  rosterRows: [] as unknown[],
  from: (_table: string): unknown => {
    const result: QueryResult = { data: supa.rosterRows, error: null }
    const b = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (
            f?: ((v: QueryResult) => unknown) | null,
            rj?: ((e: unknown) => unknown) | null
          ) => Promise.resolve(result).then(f, rj)
        }
        if (prop === Symbol.toPrimitive) return () => ''
        return () => b
      },
    })
    return b
  },
}))
vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: { from: (t: string) => supa.from(t) },
  createClient: () => ({ from: (t: string) => supa.from(t) }),
}))
vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({ auth: { getClaims: async () => ({ data: null }) } }),
}))

// Configurable getConfig: tests set allowed_domain / admin_emails per case.
const cfg = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
}))
vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (key: string, fallback?: unknown) =>
    key in cfg.values ? cfg.values[key] : fallback,
}))

import { roleForEmail } from '@/features/shared/platform/identity'

const DOMAIN = 'dabdoob.com'

function rosterRow(over: Record<string, unknown>) {
  return { email: 'a@dabdoob.com', name: 'Agent A', role: 'agent', active: true, ...over }
}

describe('roleForEmail (sign-in verdict)', () => {
  beforeEach(() => {
    supa.rosterRows = []
    cfg.values = { allowed_domain: DOMAIN, admin_emails: '' }
  })

  it('off-domain email -> unknown, even with a roster row', async () => {
    supa.rosterRows = [rosterRow({ email: 'x@other.com', role: 'admin' })]
    const u = await roleForEmail('x@other.com')
    expect(u.role).toBe('unknown')
  })

  it('admin_emails member -> admin', async () => {
    cfg.values.admin_emails = 'boss@dabdoob.com'
    const u = await roleForEmail('boss@dabdoob.com')
    expect(u.role).toBe('admin')
    expect(u.tlEmail).toBeNull()
  })

  it('active roster tl -> tl with tlEmail', async () => {
    supa.rosterRows = [rosterRow({ role: 'tl', tl_email: 'Boss@dabdoob.com' })]
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('tl')
    expect(u.tlEmail).toBe('boss@dabdoob.com')
  })

  it('active roster agent -> agent', async () => {
    supa.rosterRows = [rosterRow({})]
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('agent')
    expect(u.specialist).toBe(false)
  })

  it('active roster specialist -> agent with specialist flag', async () => {
    supa.rosterRows = [rosterRow({ role: 'specialist' })]
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('agent')
    expect(u.specialist).toBe(true)
  })

  it('inactive roster row -> unknown', async () => {
    supa.rosterRows = [rosterRow({ active: false })]
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('unknown')
  })

  it('no roster row and not admin -> unknown', async () => {
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('unknown')
  })
})
