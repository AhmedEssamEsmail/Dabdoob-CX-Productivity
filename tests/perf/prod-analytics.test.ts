import { describe, it, expect, vi, beforeEach } from 'vitest'

// Controllable supabase stub (same style as tests/perf/read-all-paged.test.ts):
// each awaited builder shifts the next canned { data, error } off the per-table
// FIFO while recording calls for assertions.
type QueryResult = { data: unknown; error: { message: string } | null }

const supa = vi.hoisted(() => ({
  results: {} as Record<string, QueryResult[]>,
  calls: [] as { table: string; m: string; args: unknown[] }[],
  from: (_table: string): unknown => {
    throw new Error(`install fakeDb per test: from(${_table})`)
  },
}))

function fakeDb() {
  supa.calls = []
  supa.from = (table: string) => {
    const b = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (
            f?: ((v: QueryResult) => unknown) | null,
            rj?: ((e: unknown) => unknown) | null
          ) => {
            const r = supa.results[table]?.shift() ?? { data: [], error: null }
            return Promise.resolve(r).then(f, rj)
          }
        }
        if (prop === Symbol.toPrimitive) return () => ''
        return (...args: unknown[]) => {
          supa.calls.push({ table, m: String(prop), args })
          return b
        }
      },
    })
    return b
  }
}

vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: { from: (t: string) => supa.from(t) },
  createClient: () => ({ from: (t: string) => supa.from(t) }),
}))
vi.mock('@/features/shared/lib/auth', () => ({
  requireRole: async () => ({ email: 'admin@dabdoob.com', role: 'admin' }),
  createAuthClient: async () => ({ auth: { getClaims: async () => ({ data: null }) } }),
}))
const cfgBox = vi.hoisted(() => ({ values: {} as Record<string, unknown> }))
vi.mock('@/features/shared/platform/settings', () => ({
  configAll: async () => cfgBox.values,
  getConfig: async (key: string, fallback?: unknown) =>
    key in cfgBox.values ? cfgBox.values[key] : fallback,
  ccApp: () => '',
}))

import { GET } from '@/app/api/prod/analytics/route'
import { cacheClear } from '@/features/shared/platform/repo'
import {
  prodAnalyticsFor_,
  prodRuleView_,
  prodScope_,
  prodToday_,
} from '@/features/cx-productivity/lib/prod/engine'
import { prodAnalytics_, prodWeekStart_ } from '@/features/cx-productivity/lib/prod/analytics'
import { dqAddDays_ } from '@/features/shared/lib/adapters'

const CFG: Record<string, unknown> = {
  admin_emails: 'admin@dabdoob.com',
  business_tz: 'Asia/Kuwait',
  prod_flag_statuses: ['Idle'],
  prod_offline_statuses: ['Offline'],
  prod_channel_status: { ticket: 'Ticket', chat: 'Chat', wa: 'WhatsApp' },
}

const WEEK_PARAM = '2026-10-05'
const WEEK = prodWeekStart_(WEEK_PARAM)

const ROSTER = [
  {
    email: 'a@dabdoob.com',
    name: 'Agent A',
    role: 'agent',
    tl_email: 'tl@dabdoob.com',
    active: true,
    position: '',
  },
]

const TABLES: Record<string, Record<string, unknown>[]> = {
  prod_intervals: [
    {
      id: 1,
      interval_key: 'k1',
      date: WEEK,
      agent_email: 'a@dabdoob.com',
      agent_name: 'Agent A',
      status: 'Idle',
      source_status: 'Idle',
      start_at: WEEK + 'T08:00:00Z',
      end_at: WEEK + 'T09:00:00Z',
      minutes: 60,
      source: 'test',
      snapshot_at: WEEK + 'T09:00:00Z',
    },
  ],
  prod_flags: [],
  prod_daily_layers: [
    {
      id: 1,
      layer: 'raw',
      agentName: 'Agent A',
      date: WEEK,
      email: 'a@dabdoob.com',
      productiveMinResolution: 50,
      productiveMinAux: 100,
      idleMin: 0,
      computedAt: WEEK + 'T23:00:00Z',
    },
  ],
  prod_window_hist: [
    {
      date: dqAddDays_(WEEK, -14),
      class: 'idle',
      counts_json: '{"3":4}',
    },
  ],
}

function seed(tables: Record<string, Record<string, unknown>[]>) {
  supa.results = {
    roster: [{ data: ROSTER, error: null }],
    prod_intervals: [{ data: tables.prod_intervals, error: null }],
    prod_flags: [{ data: tables.prod_flags, error: null }],
    prod_daily_layers: [{ data: tables.prod_daily_layers, error: null }],
    prod_window_hist: [{ data: tables.prod_window_hist, error: null }],
  }
}

function req(week = WEEK_PARAM): Request {
  return new Request(`http://localhost/api/prod/analytics?week=${week}`)
}

/** The pre-S06-01 fetch shape over the same fixtures: full rows, same window. */
function legacyExpected() {
  const dirBy: Record<string, { name: string; tlEmail: string }> = {}
  ROSTER.forEach((r) => {
    dirBy[String(r.email).toLowerCase()] = { name: r.name, tlEmail: r.tl_email || '' }
  })
  const dir = {
    by: dirBy,
    name: (e: string) => dirBy[String(e).toLowerCase()]?.name || '',
    managerOf: (e: string) => dirBy[String(e).toLowerCase()]?.tlEmail || null,
  }
  const u = { role: 'admin', email: 'admin@dabdoob.com' }
  const scope = prodScope_(u, dir)
  const io = { prodRows: (name: string) => TABLES[name] || [] }
  const out = prodAnalyticsFor_(
    CFG as never, io, dir, WEEK, scope, true,
    prodAnalytics_ as (inp: unknown) => Record<string, unknown>
  )
  out.isAdmin = true
  out.rule = prodRuleView_(CFG as never)
  out.thisWeek = prodWeekStart_(prodToday_({}))
  return out
}

describe('prod analytics route (P-02 pushdown + 120s cache)', () => {
  beforeEach(() => {
    fakeDb()
    cacheClear()
    cfgBox.values = { ...CFG }
    seed(TABLES)
  })

  it('returns field-identical output to the legacy fetch shape, with cached:false', async () => {
    const res = await GET(req())
    expect(res.status).toBe(200)
    const body = await res.json()
    const expected = JSON.parse(JSON.stringify({ ...legacyExpected(), cached: false }))
    expect(body).toEqual(expected)
    expect(body.agents).toHaveLength(1)
    expect(body.agents[0].email).toBe('a@dabdoob.com')
    expect(body.cached).toBe(false)
    const cal = body.calibration as Record<string, Record<string, number>>
    expect(cal.idle['3']).toBe(4)
  })

  it('issues projected, bounded reads via readAllPaged (no select(*), date gte/lte)', async () => {
    await GET(req())
    const selects = supa.calls
      .filter((c) => c.m === 'select' && c.table.startsWith('prod_'))
      .map((c) => String(c.args[0]))
    expect(selects.some((s) => s === '*')).toBe(false)
    const intervals = supa.calls.find((c) => c.table === 'prod_intervals' && c.m === 'select')
    expect(String(intervals?.args[0])).toContain('agent_email')
    expect(String(intervals?.args[0])).not.toContain('source_status')
    for (const t of ['prod_intervals', 'prod_flags', 'prod_daily_layers', 'prod_window_hist']) {
      const gte = supa.calls.find((c) => c.table === t && c.m === 'gte')
      const lte = supa.calls.find((c) => c.table === t && c.m === 'lte')
      expect(gte?.args, t).toEqual(['date', dqAddDays_(WEEK, -21)])
      expect(lte?.args, t).toEqual(['date', dqAddDays_(WEEK, 6)])
    }
  })

  it('serves the second identical call from cache without touching the db', async () => {
    const first = await GET(req())
    const firstBody = await first.json()
    const callsAfterFirst = supa.calls.length
    expect(callsAfterFirst).toBeGreaterThan(0)
    const second = await GET(req())
    const secondBody = await second.json()
    expect(secondBody).toEqual({ ...firstBody, cached: true })
    expect(supa.calls.length).toBe(callsAfterFirst)
  })

  it('never caches error paths', async () => {
    supa.results.prod_flags = [{ data: null, error: { message: 'boom' } }]
    const bad = await GET(req())
    expect(bad.status).toBe(500)
    seed(TABLES)
    const good = await GET(req())
    expect(good.status).toBe(200)
    const goodBody = await good.json()
    expect(goodBody.cached).toBe(false)
  })
})
