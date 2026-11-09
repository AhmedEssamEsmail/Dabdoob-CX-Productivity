/**
 * perf-2 regression: buildQueueAggregates_ must bound the tickets read
 * server-side — an `.or(...)` carrying one `status.ilike.*v*` term per
 * configured open status plus `created_at.gte` / `resolved_at.gte` window
 * terms — instead of an unfiltered full-table scan.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

const h = vi.hoisted(() => ({
  calls: [] as { table: string; method: string; args: unknown[] }[],
}))

vi.mock('@/features/shared/lib/supabase', () => {
  const makeBuilder = (table: string): Record<string, unknown> => {
    const b: Record<string, unknown> = {}
    const record =
      (m: string) =>
      (...args: unknown[]) => {
        h.calls.push({ table, method: m, args })
        return b
      }
    ;[
      'select', 'or', 'eq', 'neq', 'is', 'in', 'gte', 'lte', 'gt', 'lt',
      'not', 'order', 'limit', 'delete', 'insert', 'update', 'upsert',
      'maybeSingle', 'single', 'contains', 'filter', 'match', 'range',
    ].forEach((m) => {
      b[m] = record(m)
    })
    b.then = (
      f?: ((v: { data: unknown[]; error: null }) => unknown) | null,
      rj?: ((e: unknown) => unknown) | null
    ) => Promise.resolve({ data: [], error: null }).then(f, rj)
    return b
  }
  const client = { from: (t: string) => makeBuilder(t) }
  return { supabase: client, createClient: () => client }
})

vi.mock('@/features/shared/platform/settings', () => ({
  configAll: async () => ({
    business_tz: 'Asia/Kuwait',
    data_tz: 'Africa/Cairo',
    open_statuses: 'Open,Pending,Pending on CX',
    actionable_statuses: 'Open',
    aging_bands_h: [4, 12, 24],
    inflow_excluded_groups: [],
    queue_excluded_text: [],
    queue_map: {},
    chat_open_max_age_h: 48,
    daily_report_stale_after_min: 90,
  }),
  remindersOn: async () => true,
}))
vi.mock('@/features/shared/platform/stores', () => ({
  readStore: async () => ({ rows: [] }),
  dqCachedLive: async () => [],
  dqLastRun: async () => '',
}))
vi.mock('@/features/shared/platform/popups', () => ({ raisePopup: async () => ({}) }))
vi.mock('@/features/shared/platform/mail', () => ({
  sendMail: async () => ({ status: 'sent' }),
  escapeHtml: (s: string) => s,
}))
vi.mock('@/features/shared/platform/health', () => ({
  hbBeat: () => {},
  hbFlush: async () => 0,
}))
vi.mock('@/features/shared/platform/identity', () => ({ requireJobCaller: async () => {} }))
vi.mock('@/features/shared/jobs/freshdesk', () => ({
  dqSyncedTo_: async () => null,
  fdSyncIncremental_: async () => ({}),
  hasFreshdeskKey: () => false,
}))
vi.mock('@/features/cx-queue/lib/server', () => ({
  DQ_QUEUE_SUBMISSIONS_TABLE: 'queue_submissions',
}))

import { buildQueueAggregates_, buildAgentAggregates_ } from '@/features/cx-queue/lib/jobs'

describe('buildQueueAggregates_ tickets read bound (perf-2)', () => {
  beforeEach(() => {
    h.calls = []
  })

  it('applies an .or() bound with status.ilike terms and both gte window terms', async () => {
    await buildQueueAggregates_(new Date('2026-10-15T09:30:00Z'))
    const ticketsCalls = h.calls.filter((c) => c.table === 'tickets')
    expect(ticketsCalls.length).toBeGreaterThan(0)
    const ors = ticketsCalls.filter((c) => c.method === 'or').map((c) => String(c.args[0]))
    expect(ors.length).toBe(1)
    const or = ors[0]
    expect(or).toContain('status.ilike."*Open*"')
    expect(or).toContain('status.ilike."*Pending*"')
    expect(or).toContain('status.ilike."*Pending on CX*"')
    expect(or).not.toContain('status.in')
    expect(or).toContain('created_at.gte.')
    expect(or).toContain('resolved_at.gte.')
    // The bound is yesterday-midnight business-tz minus nothing extra: a
    // superset of the counters' today window.
    expect(or).toMatch(/created_at\.gte\.\d{4}-\d{2}-\d{2}T/)
  })
})

describe('buildAgentAggregates_ prod_daily_layers read bound (perf-5)', () => {
  beforeEach(() => {
    h.calls = []
  })

  it('bounds the prod_daily_layers read with .gte("date", today-45d)', async () => {
    await buildAgentAggregates_()
    const gtes = h.calls.filter((c) => c.table === 'prod_daily_layers' && c.method === 'gte')
    expect(gtes.length).toBe(1)
    expect(gtes[0].args[0]).toBe('date')
    expect(String(gtes[0].args[1])).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})
