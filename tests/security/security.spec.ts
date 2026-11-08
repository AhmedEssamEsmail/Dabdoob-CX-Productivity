/**
 * Authz: the real requireRole/currentUser chain and apiError's status mapping.
 * Only the seams are mocked — the auth session (lib/auth), the store
 * (platform/repo), config (platform/settings). No session -> 'Unauthorized'
 * -> 401; a signed-in roster agent denied by requireRole -> the legacy
 * 'do not have access' message -> 403; the owner with View as on ->
 * assertWritable's VIEW_AS_READONLY -> 403; an allowed role resolves.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const config: Record<string, unknown> = {
    allowed_domain: 'dabdoob.com',
    admin_emails: 'admin@dabdoob.com',
  }
  return {
    user: null as { email: string } | null,
    tables: { roster: [], view_as: [] } as Record<string, Record<string, unknown>[]>,
    config,
    getConfig: async (key: string, fallback?: unknown) => (key in config ? config[key] : fallback),
  }
})

vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({ auth: { getUser: async () => ({ data: { user: h.user } }) } }),
}))

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({
    from: (table: string) => {
      const r = { data: h.tables[table] || [], error: null }
      const chain: Record<string, unknown> = {}
      const thenable = { then: (resolve: (v: unknown) => void) => resolve(r) }
      for (const m of ['select', 'eq', 'order', 'neq', 'in', 'gte', 'lte', 'limit']) {
        chain[m] = () => Object.assign({}, chain, thenable)
      }
      return Object.assign(chain, thenable)
    },
  }),
  cacheGet: () => null,
  cachePut: () => {},
  cacheRemove: () => {},
  appendRow: vi.fn(),
}))

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: h.getConfig,
  ccApp: () => 'cx-hub',
}))

import { requireRole } from '@/features/shared/platform/identity'
import { apiError } from '@/features/shared/lib/api-error'
import { assertWritable, VIEW_AS_READONLY, viewAsResetCaches } from '@/features/shared/platform/viewas'

describe('authz: requireRole -> apiError', () => {
  beforeEach(() => {
    viewAsResetCaches()
    h.user = null
    h.tables.roster = []
    h.tables.view_as = []
  })

  it('no session -> requireRole throws Unauthorized -> apiError answers 401', async () => {
    const err = await requireRole(['admin']).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('Unauthorized')
    const res = apiError(err)
    expect(res.status).toBe(401)
    expect(await res.json()).toEqual({ error: 'Unauthorized' })
  })

  it('roster agent asking for admin -> legacy denial -> apiError answers 403', async () => {
    h.user = { email: 'agent@dabdoob.com' }
    h.tables.roster = [{ email: 'agent@dabdoob.com', name: 'Agent', role: 'agent', active: true }]
    const err = await requireRole(['admin']).catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe('You do not have access to this. Ask the CX admin to add you to the roster.')
    const res = apiError(err)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: err.message })
  })

  it('owner with View as on -> assertWritable throws VIEW_AS_READONLY -> apiError answers 403', async () => {
    h.user = { email: 'admin@dabdoob.com' } // admin_emails[0] = the owner
    h.tables.view_as = [{ owner_email: 'admin@dabdoob.com', action: 'start', target_email: 'agent@dabdoob.com' }]
    const err = await assertWritable().catch((e) => e)
    expect(err).toBeInstanceOf(Error)
    expect(err.message).toBe(VIEW_AS_READONLY)
    const res = apiError(err)
    expect(res.status).toBe(403)
    expect(await res.json()).toEqual({ error: VIEW_AS_READONLY })
  })

  it('roster agent asking for agent/tl -> requireRole resolves the PlatformUser', async () => {
    h.user = { email: 'agent@dabdoob.com' }
    h.tables.roster = [{ email: 'agent@dabdoob.com', name: 'Agent', role: 'agent', active: true }]
    const u = await requireRole(['agent', 'tl'])
    expect(u.email).toBe('agent@dabdoob.com')
    expect(u.role).toBe('agent')
  })
})
