import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  createAuthClient: vi.fn(),
  exchangeCodeForSession: vi.fn(),
  signOut: vi.fn(),
  roleForEmail: vi.fn(),
}))

vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: h.createAuthClient,
}))

vi.mock('@/features/shared/platform/identity', () => ({
  roleForEmail: h.roleForEmail,
  normEmail: (email: unknown) => String(email || '').trim().toLowerCase(),
}))

import { GET } from '@/app/auth/callback/route'

function callbackRequest(path = '/auth/callback?code=pkce-code') {
  return new Request(`http://localhost${path}`)
}

function location(response: Response) {
  return response.headers.get('location')
}

beforeEach(() => {
  vi.clearAllMocks()
  h.createAuthClient.mockResolvedValue({
    auth: {
      exchangeCodeForSession: h.exchangeCodeForSession,
      signOut: h.signOut,
    },
  })
})

describe('GET /auth/callback', () => {
  it('redirects provider errors to the login auth error', async () => {
    const response = await GET(callbackRequest('/auth/callback?error=access_denied'))

    expect(location(response)).toBe('http://localhost/auth/login?error=auth')
    expect(h.createAuthClient).not.toHaveBeenCalled()
  })

  it('redirects a missing code to the login auth error', async () => {
    const response = await GET(callbackRequest('/auth/callback'))

    expect(location(response)).toBe('http://localhost/auth/login?error=auth')
    expect(h.createAuthClient).not.toHaveBeenCalled()
  })

  it('signs out and redirects when the code exchange returns an error', async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: { user: null },
      error: { message: 'exchange failed' },
    })

    const response = await GET(callbackRequest())

    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(location(response)).toBe('http://localhost/auth/login?error=auth')
  })

  it('signs out and redirects when the verified email is unauthorized', async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: ' Person@DabDoob.com ' } },
      error: null,
    })
    h.roleForEmail.mockResolvedValue({
      email: 'person@dabdoob.com',
      name: 'Person',
      role: 'unknown',
      tlEmail: null,
    })

    const response = await GET(callbackRequest())

    expect(h.roleForEmail).toHaveBeenCalledWith('person@dabdoob.com')
    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(location(response)).toBe('http://localhost/auth/login?error=denied')
  })

  it('signs out and redirects to auth error when roleForEmail throws', async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'agent@dabdoob.com' } },
      error: null,
    })
    h.roleForEmail.mockRejectedValue(new Error('db down'))

    const response = await GET(callbackRequest())

    expect(h.signOut).toHaveBeenCalledTimes(1)
    expect(location(response)).toBe('http://localhost/auth/login?error=auth')
  })

  it('redirects an authorized user without signing out', async () => {
    h.exchangeCodeForSession.mockResolvedValue({
      data: { user: { email: 'agent@dabdoob.com' } },
      error: null,
    })
    h.roleForEmail.mockResolvedValue({
      email: 'agent@dabdoob.com',
      name: 'Agent',
      role: 'agent',
      tlEmail: null,
    })

    const response = await GET(callbackRequest())

    expect(h.signOut).not.toHaveBeenCalled()
    expect(location(response)).toBe('http://localhost/')
  })
})
