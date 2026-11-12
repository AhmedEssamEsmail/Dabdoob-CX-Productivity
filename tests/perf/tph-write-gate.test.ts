import { describe, it, expect, vi } from 'vitest'

// Minimal mocks so importing write.ts does not touch Supabase/auth.
vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({ from: () => ({}) }),
  readAllPaged: async () => [],
}))
vi.mock('@/features/shared/platform/settings', () => ({
  configAll: async () => ({}),
  getConfig: async (_k: string, f?: unknown) => f,
  ccApp: () => '',
}))
vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({ auth: { getClaims: async () => ({ data: null }) } }),
}))
vi.mock('@/features/shared/platform/viewas', () => ({
  viewAsState: () => null,
  assertWritable: () => undefined,
}))

import { tphCheckAgent_ } from '@/features/cx-productivity/lib/tph/write'

type Person = { email: string; name: string; tlEmail?: string; active?: boolean; role?: string; position?: string }
const dirOf = (...people: Person[]) => ({
  by: Object.fromEntries(people.map((p) => [p.email.toLowerCase(), p])),
  name: (e: string) => people.find((p) => p.email === e)?.name || '',
})

const CX_AGENT = 'Customer Experience Agent'

describe('tphCheckAgent_ keys on position, not access role', () => {
  it('accepts an active CX Agent regardless of role', () => {
    const dir = dirOf({ email: 'a@dabdoob.com', name: 'A', role: 'admin', active: true, position: CX_AGENT })
    expect(tphCheckAgent_(dir as never, 'A@dabdoob.com')).toBe('a@dabdoob.com')
  })

  it('rejects an inactive CX Agent even with role agent', () => {
    const dir = dirOf({ email: 'a@dabdoob.com', name: 'A', role: 'agent', active: false, position: CX_AGENT })
    expect(() => tphCheckAgent_(dir as never, 'a@dabdoob.com')).toThrow('That person is not an active agent.')
  })

  it('rejects a specialist-titled row with role specialist', () => {
    const dir = dirOf({ email: 's@dabdoob.com', name: 'S', role: 'specialist', active: true, position: 'Enablemen Specialist' })
    expect(() => tphCheckAgent_(dir as never, 's@dabdoob.com')).toThrow('That person is not an active agent.')
  })

  it('rejects a CX Manager-titled row', () => {
    const dir = dirOf({ email: 'm@dabdoob.com', name: 'M', role: 'agent', active: true, position: 'Customer Experience Manager' })
    expect(() => tphCheckAgent_(dir as never, 'm@dabdoob.com')).toThrow('That person is not an active agent.')
  })

  it('rejects an unknown email', () => {
    const dir = dirOf({ email: 'a@dabdoob.com', name: 'A', role: 'agent', active: true, position: CX_AGENT })
    expect(() => tphCheckAgent_(dir as never, 'nobody@dabdoob.com')).toThrow('That person is not an active agent.')
  })
})
