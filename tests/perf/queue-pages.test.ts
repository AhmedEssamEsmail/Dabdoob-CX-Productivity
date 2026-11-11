import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Wraps the hub-fakes supabase client: records .gte(col, v) per table and the
// peak number of in-flight queries so the Promise.all grouping is observable.
const probe = vi.hoisted(() => ({
  gte: [] as { table: string; col: string; v: unknown }[],
  inFlight: 0,
  maxInFlight: 0,
}))

vi.mock('@/features/shared/lib/supabase', async () => {
  const hf = await import('../golden/hub-fakes')
  const mod = hf.supabaseModule()
  const settle = () => {
    probe.inFlight = Math.max(0, probe.inFlight - 1)
  }
  const wrapQ = (inner: Record<string, unknown>, table: string): unknown => {
    const p: unknown = new Proxy(inner, {
      get(t, prop) {
        const v = Reflect.get(t, prop) as unknown
        if (typeof v !== 'function') return v
        if (prop === 'then') {
          return (
            f?: ((x: unknown) => unknown) | null,
            r?: ((e: unknown) => unknown) | null
          ) =>
            (v as (...a: unknown[]) => unknown).call(
              t,
              (x: unknown) => {
                settle()
                return f ? f(x) : x
              },
              (e: unknown) => {
                settle()
                if (r) return r(e)
                throw e
              }
            )
        }
        if (prop === 'maybeSingle' || prop === 'single') {
          return (...args: unknown[]) =>
            (v as (...a: unknown[]) => Promise<unknown>).apply(t, args).finally(settle)
        }
        if (prop === 'gte') {
          return (col: string, val: unknown) => {
            probe.gte.push({ table, col, v: val })
            const res = (v as (...a: unknown[]) => unknown).call(t, col, val)
            return res === t ? p : res
          }
        }
        return (...args: unknown[]) => {
          const res = (v as (...a: unknown[]) => unknown).apply(t, args)
          return res === t ? p : res
        }
      },
    })
    return p
  }
  const from = (t: string) => {
    probe.inFlight++
    probe.maxInFlight = Math.max(probe.maxInFlight, probe.inFlight)
    return wrapQ(mod.supabase.from(t) as unknown as Record<string, unknown>, t)
  }
  return {
    supabase: { from },
    createClient: () => ({ from }),
  }
})
vi.mock('@/features/shared/lib/auth', async () => (await import('../golden/hub-fakes')).authModule())

import { hubDb, hubDbReset, hubSetTables, hubSetUser } from '../golden/hub-fakes'
import { getAgingPage, getAnalyticsPage } from '@/features/cx-queue/lib/pages'
import { cacheClear } from '@/features/shared/platform/repo'

const NOW_MS = Date.parse('2026-10-15T12:00:00Z') // 15:00 Kuwait -> today 2026-10-15

const SETTINGS: Record<string, unknown> = {
  business_tz: 'Asia/Kuwait',
  allowed_domain: 'dabdoob.com',
  admin_emails: 'boss@dabdoob.com',
  freshdesk_domain: 'freshdesk.example.com',
  inflow_excluded_groups: [],
  aging_bands_h: [4, 12, 24, 48, 72],
  dq_last_queue_aggregates: '2026-10-15T09:00:00Z',
  dq_last_freshdesk_sync: '2026-10-15T08:30:00Z',
  dq_last_inflow: '2026-10-15T07:00:00Z',
}

const cfgRows = () =>
  Object.entries(SETTINGS).map(([k, v]) => ({
    key: k,
    value: typeof v === 'string' ? v : JSON.stringify(v),
  }))

const ROSTER = [
  { email: 'tl@dabdoob.com', name: 'TL One', role: 'tl', tl_email: 'boss@dabdoob.com', active: true, position: '' },
  { email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: 'tl@dabdoob.com', active: true, position: '' },
]

const AGING = [
  {
    ticket_id: '101', queue: 'Ops QA Gift', status: 'Open', actionable: true, country: 'KW',
    age_h: 30, band: 2, agent_name: 'Agent One', agent_email: 'agent@dabdoob.com',
    tl_email: 'stale@x.com', tl_name: 'Old TL', contact_type_1: 'email',
  },
]

const QUEUE_NOW = [
  {
    queue: 'Ops QA Gift', kind: 'ticket', open: 5, actionable: 4, unassigned: 1, oldest_h: 30,
    over_top: 0, created_today: 1, resolved_today: 0, as_of: '2026-10-15T10:00:00Z',
    source_as_of: '2026-10-15T10:00:00Z', stale: false,
    by_status_json: '{"Open":5}', bands_json: '[0,0,5,0,0,0]',
  },
]

const INFLOW_DAILY = [
  { date: '2026-10-14', channel: 'chat', country: 'KW', inflow: 3, partial: false },
  { date: '2026-10-15', channel: 'call', country: 'KW', inflow: 2, partial: true },
  { date: '2020-01-01', channel: 'chat', country: 'KW', inflow: 99, partial: false },
]

function seed() {
  hubDbReset()
  hubSetUser('tl@dabdoob.com')
  hubSetTables({
    roster: ROSTER,
    config: cfgRows(),
    aging_open_tickets: AGING,
    agg_queue_now: QUEUE_NOW,
    dq_aging_flags: [],
    agg_inflow_daily: INFLOW_DAILY,
    agg_inflow_weekly: [{ period: '2026-W42', channel: 'chat', country: 'KW', inflow: 9, partial: false }],
    agg_inflow_monthly: [{ period: '2026-10', channel: 'chat', country: 'KW', inflow: 12, partial: false }],
    view_as: [],
    health: [],
  })
}

beforeEach(() => {
  vi.setSystemTime(new Date(NOW_MS))
  cacheClear()
  probe.gte = []
  probe.inFlight = 0
  probe.maxInFlight = 0
  seed()
})
afterEach(() => {
  vi.useRealTimers()
})

describe('queue pages: Promise.all + inflow bound', () => {
  it('getAgingPage reads its stores concurrently and restamps TLs from pwDirectory', async () => {
    const page = await getAgingPage()
    expect(probe.maxInFlight).toBeGreaterThan(1)
    expect(page.you).toBe('tl@dabdoob.com')
    expect(page.scope).toBe('tl')
    expect(page.total).toBe(1)
    expect(page.dataAsOf).toBe('2026-10-15T09:00:00Z')
    expect(page.syncedAt).toBe('2026-10-15T08:30:00Z')
    const tickets = page.tickets as unknown[][]
    expect(tickets).toHaveLength(1)
    // roster tl_email/tl_name replaced the stale stored values (index.ts fields order)
    expect(tickets[0][8]).toBe('TL One')
    expect(tickets[0][9]).toBe(true) // mine: restamped tl_email === caller
    const queues = page.queues as Record<string, unknown>[]
    expect(queues).toHaveLength(1)
    expect(queues[0].queue).toBe('Ops QA Gift')
    expect(page.flags).toEqual([])
  })

  it('getAnalyticsPage bounds agg_inflow_daily with a SQL date gte', async () => {
    const page = await getAnalyticsPage()
    expect(probe.maxInFlight).toBeGreaterThan(1)
    const bound = probe.gte.filter((g) => g.table === 'agg_inflow_daily' && g.col === 'date')
    expect(bound).toHaveLength(1)
    expect(String(bound[0].v)).toMatch(/^\d{4}-\d{2}-\d{2}$/)
    const day = page.day as { rows: unknown[][]; periods: string[]; partial: string[] }
    expect(day.rows).toHaveLength(2) // the 2020 row never crosses the wire
    expect(day.periods).toEqual(['2026-10-14', '2026-10-15'])
    expect(day.partial).toEqual(['2026-10-15'])
    expect(day.rows[0]).toEqual(['2026-10-14', 1, 'KW', 3])
    expect(day.rows[1]).toEqual(['2026-10-15', 0, 'KW', 2])
    expect(page.today).toBe('2026-10-15')
    expect(page.dataAsOf).toBe('2026-10-15T07:00:00Z')
    expect(page.countries).toEqual(['KW'])
    const week = page.week as { rows: unknown[][] }
    const month = page.month as { rows: unknown[][] }
    expect(week.rows).toHaveLength(1)
    expect(month.rows).toHaveLength(1)
  })

  it('a second call inside the TTL still answers from cache (no regression)', async () => {
    await getAnalyticsPage()
    const reads = probe.gte.length
    await getAnalyticsPage()
    // daily is no longer dqCachedLive: it re-reads with the bound each call
    expect(probe.gte.length).toBe(reads + 1)
    expect(hubDb.tables['agg_inflow_daily']).toHaveLength(3)
  })
})
