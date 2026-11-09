import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ signInWithOAuth: vi.fn() }))
vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({ auth: { signInWithOAuth: h.signInWithOAuth } }),
}))

import { POST } from '@/app/api/auth/google/route'

function req(): Request {
  return new Request('http://localhost/api/auth/google', { method: 'POST' })
}

describe('POST /api/auth/google', () => {
  beforeEach(() => {
    h.signInWithOAuth.mockReset()
  })

  it('returns the provider URL with callback redirect and hd hint', async () => {
    h.signInWithOAuth.mockResolvedValue({
      data: { url: 'https://accounts.google.com/o/oauth2/auth?x=1' },
      error: null,
    })
    const res = await POST(req())
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({
      url: 'https://accounts.google.com/o/oauth2/auth?x=1',
    })
    const arg = h.signInWithOAuth.mock.calls[0][0]
    expect(arg.provider).toBe('google')
    expect(arg.options.redirectTo).toBe('http://localhost/auth/callback')
    expect(arg.options.queryParams.hd).toBe('dabdoob.com')
  })

  it('maps an OAuth error to 400 JSON', async () => {
    h.signInWithOAuth.mockResolvedValue({
      data: { url: null },
      error: { message: 'provider not configured' },
    })
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(await res.json()).toEqual({ error: 'provider not configured' })
  })

  it('maps a missing URL to 400 JSON', async () => {
    h.signInWithOAuth.mockResolvedValue({ data: {}, error: null })
    const res = await POST(req())
    expect(res.status).toBe(400)
    expect(await res.json()).toHaveProperty('error')
  })
})
