/**
 * auth.ts unit tests against the real module: createAuthClient's cookie
 * adapter, getUser, requireAuth's 'Unauthorized' gate, getViewAsUser's
 * view_as query. External seams (@supabase/ssr, next/headers, the shared
 * createClient, platform/identity's requireRole) are mocked via hoisted spies.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  createServerClient: vi.fn(),
  getUser: vi.fn(),
  eq: vi.fn(),
  cookieStore: {
    getAll: vi.fn((): Array<{ name: string; value: string }> => []),
    set: vi.fn(),
  },
  viewAsRow: null as { target_email: string | null } | null,
}))

vi.mock('next/headers', () => ({
  cookies: async () => h.cookieStore,
}))

vi.mock('@supabase/ssr', () => ({
  createServerClient: (...args: unknown[]) => {
    h.createServerClient(...args)
    return { auth: { getUser: h.getUser } }
  },
}))

vi.mock('@/features/shared/lib/supabase', () => ({
  createClient: () => {
    const q: Record<string, unknown> = {}
    q.select = () => q
    q.eq = (...args: unknown[]) => {
      h.eq(...args)
      return q
    }
    q.order = () => q
    q.limit = () => q
    q.single = async () => ({ data: h.viewAsRow })
    return { from: () => q }
  },
}))

// requireRole is a re-export; internals are covered by the identity suite.
vi.mock('@/features/shared/platform/identity', () => ({ requireRole: vi.fn() }))

import {
  createAuthClient,
  getUser,
  requireAuth,
  getViewAsUser,
  requireRole,
} from './auth'

describe('createAuthClient', () => {
  beforeEach(() => vi.clearAllMocks())

  it('builds the server client with env URL, anon key and a cookie adapter', async () => {
    await createAuthClient()
    expect(h.createServerClient).toHaveBeenCalledWith(
      'https://test.supabase.co',
      'test-anon-key',
      expect.objectContaining({
        cookies: expect.objectContaining({
          getAll: expect.any(Function),
          setAll: expect.any(Function),
        }),
      })
    )
  })

  it('adapter getAll reads the request cookie store; setAll writes through', async () => {
    h.cookieStore.getAll.mockReturnValue([{ name: 'a', value: '1' }])
    await createAuthClient()
    const adapter = h.createServerClient.mock.calls[0][2].cookies
    expect(adapter.getAll()).toEqual([{ name: 'a', value: '1' }])
    adapter.setAll([{ name: 'sb', value: 'v', options: { path: '/' } }])
    expect(h.cookieStore.set).toHaveBeenCalledWith('sb', 'v', { path: '/' })
  })

  it('setAll swallows a cookie-store failure instead of throwing', async () => {
    h.cookieStore.set.mockImplementation(() => {
      throw new Error('cookies are read-only here')
    })
    await createAuthClient()
    const adapter = h.createServerClient.mock.calls[0][2].cookies
    expect(() => adapter.setAll([{ name: 'x', value: 'y', options: {} }])).not.toThrow()
  })
})

describe('getUser', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the user from supabase.auth.getUser', async () => {
    const user = { id: '1', email: 'agent@dabdoob.com' }
    h.getUser.mockResolvedValue({ data: { user } })
    await expect(getUser()).resolves.toEqual(user)
  })

  it('returns null when there is no session', async () => {
    h.getUser.mockResolvedValue({ data: { user: null } })
    await expect(getUser()).resolves.toBeNull()
  })
})

describe('requireAuth', () => {
  beforeEach(() => vi.clearAllMocks())

  it('returns the user when authenticated', async () => {
    const user = { id: '2', email: 'tl@dabdoob.com' }
    h.getUser.mockResolvedValue({ data: { user } })
    await expect(requireAuth()).resolves.toEqual(user)
  })

  it("throws 'Unauthorized' when no user is signed in", async () => {
    h.getUser.mockResolvedValue({ data: { user: null } })
    await expect(requireAuth()).rejects.toThrow('Unauthorized')
  })
})

describe('getViewAsUser', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    h.viewAsRow = null
  })

  it("queries view_as for the owner's latest 'start' row", async () => {
    h.viewAsRow = { target_email: 'agent@dabdoob.com' }
    await getViewAsUser('tl@dabdoob.com')
    expect(h.eq).toHaveBeenCalledWith('owner_email', 'tl@dabdoob.com')
    expect(h.eq).toHaveBeenCalledWith('action', 'start')
  })

  it('returns the target_email of an active view-as row', async () => {
    h.viewAsRow = { target_email: 'agent@dabdoob.com' }
    await expect(getViewAsUser('tl@dabdoob.com')).resolves.toBe('agent@dabdoob.com')
  })

  it('returns null when no view-as row exists', async () => {
    h.viewAsRow = null
    await expect(getViewAsUser('tl@dabdoob.com')).resolves.toBeNull()
  })

  it('returns null when the row has no target_email', async () => {
    h.viewAsRow = { target_email: null }
    await expect(getViewAsUser('tl@dabdoob.com')).resolves.toBeNull()
  })
})

describe('requireRole', () => {
  it('is re-exported from platform/identity', () => {
    expect(typeof requireRole).toBe('function')
  })
})
