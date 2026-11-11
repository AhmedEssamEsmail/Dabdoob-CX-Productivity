import { describe, it, expect, vi, beforeEach } from 'vitest'

type QueryResult = { data: unknown; error: { message: string } | null }
type Call = { table: string; select: string; ops: string[] }

// Chainable roster stub: records select()/eq()/ilike() per query and resolves
// results FIFO. roleForEmail issues one eq query (ilike only on eq error);
// pwDirectory issues one select('*') per invocation.
const supa = vi.hoisted(() => ({
  results: [] as QueryResult[],
  calls: [] as Call[],
  from: (table: string): unknown => {
    const call: Call = { table, select: '', ops: [] }
    supa.calls.push(call)
    const b = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (
            f?: ((v: QueryResult) => unknown) | null,
            rj?: ((e: unknown) => unknown) | null
          ) => Promise.resolve(supa.results.shift() ?? { data: [], error: null }).then(f, rj)
        }
        if (prop === Symbol.toPrimitive) return () => ''
        return (...args: unknown[]) => {
          if (prop === 'select' && typeof args[0] === 'string') call.select = String(args[0])
          else if (prop === 'eq') call.ops.push(`eq:${String(args[0])}=${String(args[1])}`)
          else if (prop === 'ilike') call.ops.push(`ilike:${String(args[0])}=${String(args[1])}`)
          return b
        }
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

const cfg = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))
vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (key: string, fallback?: unknown) =>
    key in cfg.values ? cfg.values[key] : fallback,
  configAll: async () => ({}),
  remindersOn: async () => true,
}))

import { roleForEmail, pwDirectory } from '@/features/shared/platform/identity'

const DOMAIN = 'dabdoob.com'
const rosterCalls = () => supa.calls.filter((c) => c.select !== '')
const row = (over: Record<string, unknown>) => ({
  email: 'a@dabdoob.com',
  name: 'Agent A',
  role: 'agent',
  tl_email: null,
  active: true,
  ...over,
})

describe('roleForEmail eq path', () => {
  beforeEach(() => {
    supa.results = []
    supa.calls = []
    cfg.values = { allowed_domain: DOMAIN, admin_emails: '' }
  })

  it('uses .eq with literal email — underscores carry no wildcard semantics', async () => {
    const email = 'a_b@dabdoob.com'
    supa.results = [{ data: [row({ email })], error: null }]
    const u = await roleForEmail(email)
    expect(u.role).toBe('agent')
    expect(rosterCalls()).toHaveLength(1)
    const c = rosterCalls()[0]
    expect(c.select).toBe('email,name,role,tl_email,active')
    expect(c.ops).toEqual([`eq:email=${email}`])
    expect(c.ops.some((o) => o.startsWith('ilike'))).toBe(false)
  })

  it('falls back to ilike when the eq query errors', async () => {
    supa.results = [
      { data: null, error: { message: 'boom' } },
      { data: [row({})], error: null },
    ]
    const u = await roleForEmail('a@dabdoob.com')
    expect(u.role).toBe('agent')
    const calls = rosterCalls()
    expect(calls).toHaveLength(2)
    expect(calls[1].ops.some((o) => o.startsWith('ilike'))).toBe(true)
  })

  it('verdicts match the fixture roster (admin/tl/agent/specialist/inactive/none)', async () => {
    cfg.values.admin_emails = 'boss@dabdoob.com'
    const cases: [string, Record<string, unknown> | null, string][] = [
      ['boss@dabdoob.com', null, 'admin'],
      ['tl@dabdoob.com', row({ email: 'tl@dabdoob.com', role: 'tl', tl_email: 'boss@dabdoob.com' }), 'tl'],
      ['a@dabdoob.com', row({}), 'agent'],
      ['s@dabdoob.com', row({ email: 's@dabdoob.com', role: 'specialist' }), 'agent'],
      ['i@dabdoob.com', row({ email: 'i@dabdoob.com', active: false }), 'unknown'],
      ['n@dabdoob.com', null, 'unknown'],
      ['x@other.com', null, 'unknown'],
    ]
    for (const [email, rosterRow, expected] of cases) {
      supa.results = [{ data: rosterRow ? [rosterRow] : [], error: null }]
      supa.calls = []
      const u = await roleForEmail(email)
      expect(u.role, email).toBe(expected)
    }
  })
})

describe('pwDirectory', () => {
  beforeEach(() => {
    supa.results = []
    supa.calls = []
    cfg.values = { admin_emails: 'boss@dabdoob.com' }
  })

  it('is a memoized per-request function issuing one roster read per call', async () => {
    supa.results = [
      { data: [row({}), row({ email: 'tl@dabdoob.com', role: 'tl' })], error: null },
      { data: [row({}), row({ email: 'tl@dabdoob.com', role: 'tl' })], error: null },
    ]
    const d1 = await pwDirectory()
    const d2 = await pwDirectory()
    expect(d2.admins).toEqual(d1.admins)
    expect(d2.by).toEqual(d1.by)
    expect(d1.person('a@dabdoob.com')?.role).toBe('agent')
    expect(d1.admins).toEqual(['boss@dabdoob.com'])
    // React cache() scope: memoization is per-request; outside a request each
    // call executes once — hence 2 calls / 2 roster reads here, 1 per request.
    expect(rosterCalls()).toHaveLength(2)
    expect(rosterCalls().every((c) => c.select === '*')).toBe(true)
  })

  it('keeps roster-absent config admins out of dir.by but reachable via lookups', async () => {
    cfg.values.admin_emails = 'boss@dabdoob.com,ghost@dabdoob.com'
    supa.results = [{ data: [row({})], error: null }]
    const d = await pwDirectory()
    expect(Object.keys(d.by)).toEqual(['a@dabdoob.com'])
    expect(d.by['a@dabdoob.com'].role).toBe('agent')
    expect(d.admins).toEqual(['boss@dabdoob.com', 'ghost@dabdoob.com'])
    const ghost = d.person('ghost@dabdoob.com')
    expect(ghost).toEqual({
      email: 'ghost@dabdoob.com',
      name: 'ghost@dabdoob.com',
      role: 'admin',
      tlEmail: null,
      active: true,
      position: '',
    })
    expect(d.name('ghost@dabdoob.com')).toBe('ghost@dabdoob.com')
    expect(d.managerOf('ghost@dabdoob.com')).toBeNull()
    expect(d.person('nobody@dabdoob.com')).toBeNull()
    expect(d.name('nobody@dabdoob.com')).toBe('nobody@dabdoob.com')
  })
})

describe('cx-queue jobs roster read (P-21)', () => {
  beforeEach(() => {
    supa.results = []
    supa.calls = []
    cfg.values = {}
  })

  it('rosterPeople_ projects only the columns dqRosterPeople_ reads', async () => {
    const { buildAgentAggregates_ } = await import('@/features/cx-queue/lib/jobs')
    supa.results = [
      { data: [], error: null }, // prod_daily_layers
      {
        data: [
          {
            email: 'a@dabdoob.com',
            name: 'Agent A',
            role: 'agent',
            tl_email: null,
            active: true,
            freshdesk_id: '123',
            freshdesk_name: 'A FD',
            maqsam_name: 'A MQ',
            source: 'hct',
          },
        ],
        error: null,
      }, // roster
      { data: null, error: null }, // agg_agent_perf delete
      { data: null, error: null }, // agg_agent_daily delete
      { data: [], error: null }, // refresh_log insert
    ]
    await buildAgentAggregates_()
    const rosterReads = supa.calls.filter((c) => c.table === 'roster' && c.select)
    expect(rosterReads).toHaveLength(1)
    expect(rosterReads[0].select).toBe(
      'email,name,tl_email,freshdesk_id,freshdesk_name,maqsam_name,source'
    )
  })
})
