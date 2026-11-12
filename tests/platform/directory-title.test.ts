import { describe, it, expect, vi, beforeEach } from 'vitest'

type QueryResult = { data: unknown; error: { message: string } | null }

// Controllable supabase stub: each test sets `rosterRows`; every awaited query
// resolves to them (pwDirectory issues one select('*') per invocation).
const supa = vi.hoisted(() => ({
  rosterRows: [] as unknown[],
  from: (): unknown => {
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
  supabase: { from: () => supa.from() },
  createClient: () => ({ from: () => supa.from() }),
}))
vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({ auth: { getClaims: async () => ({ data: null }) } }),
}))

const cfg = vi.hoisted(() => ({
  values: {} as Record<string, unknown>,
}))
vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (key: string, fallback?: unknown) =>
    key in cfg.values ? cfg.values[key] : fallback,
}))

import {
  pwDirectory,
  dqTitleLevel_,
  isCxAgent_,
  CX_AGENT_POSITION,
} from '@/features/shared/platform/identity'

function rosterRow(over: Record<string, unknown>) {
  return {
    email: 'a@dabdoob.com',
    name: 'Agent A',
    role: 'agent',
    tl_email: null,
    active: true,
    position: '',
    ...over,
  }
}

describe('dqTitleLevel_', () => {
  it('maps position titles to org levels', () => {
    expect(dqTitleLevel_('Customer Experience Team Leader', 'agent')).toBe('tl')
    expect(dqTitleLevel_('Team Lead', 'agent')).toBe('tl')
    expect(dqTitleLevel_('team leader', 'agent')).toBe('tl')
    expect(dqTitleLevel_('CX Manager', 'agent')).toBe('manager')
    expect(dqTitleLevel_('Head of Customer Experience', 'agent')).toBe('manager')
    expect(dqTitleLevel_('Customer Experience Agent', 'agent')).toBe('agent')
    expect(dqTitleLevel_('Enablemen Specialist', 'specialist')).toBe('agent')
  })

  it('falls back to role when position is blank', () => {
    expect(dqTitleLevel_('', 'tl')).toBe('tl')
    expect(dqTitleLevel_('', 'admin')).toBe('manager')
    expect(dqTitleLevel_('', 'agent')).toBe('agent')
    expect(dqTitleLevel_('', 'specialist')).toBe('agent')
    expect(dqTitleLevel_(null, 'tl')).toBe('tl')
  })
})

describe('isCxAgent_', () => {
  it('requires active and the exact CX agent position', () => {
    expect(isCxAgent_({ active: true, position: CX_AGENT_POSITION })).toBe(true)
    expect(isCxAgent_({ active: 'true', position: CX_AGENT_POSITION })).toBe(true)
    expect(isCxAgent_({ active: true, position: ' Customer Experience Agent ' })).toBe(true)
    expect(isCxAgent_({ active: false, position: CX_AGENT_POSITION })).toBe(false)
    expect(isCxAgent_({ active: 'false', position: CX_AGENT_POSITION })).toBe(false)
    expect(isCxAgent_({ active: true, position: 'Customer Experience Team Leader' })).toBe(false)
    expect(isCxAgent_({ active: true, position: 'customer experience agent' })).toBe(false)
    expect(isCxAgent_(null)).toBe(false)
    expect(isCxAgent_({})).toBe(false)
  })
})

describe('pwDirectory titleLevel', () => {
  beforeEach(() => {
    supa.rosterRows = []
    cfg.values = { admin_emails: 'admin1@dabdoob.com,admin2@dabdoob.com' }
  })

  it('populates titleLevel on roster rows and the config-admin fallback', async () => {
    supa.rosterRows = [
      rosterRow({ email: 'lead@dabdoob.com', role: 'admin', position: 'Customer Experience Team Leader' }),
      rosterRow({ email: 'a@dabdoob.com', position: 'Customer Experience Agent', tl_email: 'lead@dabdoob.com' }),
      rosterRow({ email: 's@dabdoob.com', role: 'specialist', position: 'Enablemen Specialist', tl_email: 'lead@dabdoob.com' }),
      rosterRow({ email: 't@dabdoob.com', role: 'tl', position: '' }),
    ]
    const dir = await pwDirectory()
    expect(dir.by['lead@dabdoob.com'].titleLevel).toBe('tl')
    expect(dir.by['lead@dabdoob.com'].role).toBe('admin')
    expect(dir.by['a@dabdoob.com'].titleLevel).toBe('agent')
    expect(dir.by['s@dabdoob.com'].titleLevel).toBe('agent')
    expect(dir.by['t@dabdoob.com'].titleLevel).toBe('tl')
    expect(dir.person('admin1@dabdoob.com')?.titleLevel).toBe('manager')
  })

  it('tls()/agentsOf/managerOf follow titleLevel, not role', async () => {
    supa.rosterRows = [
      rosterRow({ email: 'lead@dabdoob.com', role: 'admin', position: 'Customer Experience Team Leader' }),
      rosterRow({ email: 'a@dabdoob.com', position: 'Customer Experience Agent', tl_email: 'lead@dabdoob.com' }),
      rosterRow({ email: 's@dabdoob.com', role: 'specialist', position: 'Enablemen Specialist', tl_email: 'lead@dabdoob.com' }),
      rosterRow({ email: 't@dabdoob.com', role: 'tl', position: '' }),
    ]
    const dir = await pwDirectory()
    const tls = dir.tls().map((p) => p.email)
    expect(tls).toContain('lead@dabdoob.com')
    expect(tls).toContain('t@dabdoob.com')
    expect(dir.managerOf('lead@dabdoob.com')).toBe('admin1@dabdoob.com')
    expect(dir.managerOf('a@dabdoob.com')).toBe('lead@dabdoob.com')
    expect(dir.managerOf('s@dabdoob.com')).toBe('lead@dabdoob.com')
    expect(dir.managerOf('admin1@dabdoob.com')).toBeNull()
    const agents = dir.agentsOf('lead@dabdoob.com').map((p) => p.email)
    expect(agents).toContain('a@dabdoob.com')
    expect(agents).toContain('s@dabdoob.com')
    expect(dir.agentsOf('a@dabdoob.com')).toHaveLength(0)
  })
})
