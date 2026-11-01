/**
 * run-step error propagation: a PGRST205 from the fd_activities mirror must
 * surface through the route as the { error, code:'missing_store', hint }
 * envelope — never a "done 0s" fake success. Also: the interactive 60-day
 * guard still rejects old dates (admin backfill bypasses it separately).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tableResults: {} as Record<string, { data: unknown; error: unknown }>,
}))

vi.mock('@/lib/auth', () => ({
  requireRole: async () => ({ email: 'admin@dabdoob.com', role: 'admin' }),
  createAuthClient: async () => ({
    from: (table: string) => {
      const r = h.tableResults[table] || { data: [], error: null }
      const chain: Record<string, unknown> = {}
      const thenable = { then: (resolve: (v: unknown) => void) => resolve(r) }
      for (const m of ['select', 'gte', 'lte', 'eq', 'order', 'limit', 'upsert', 'insert', 'not', 'in']) {
        chain[m] = () => Object.assign({}, chain, thenable)
      }
      return Object.assign(chain, thenable)
    },
  }),
}))
vi.mock('@/lib/platform/viewas', () => ({ viewAsGuard: async () => {}, VIEW_AS_READONLY: 'readonly' }))
vi.mock('@/lib/tph/page', () => ({
  tphLoadStore_: async () => ({
    cfg: { ss_productivity_id: 'prod-store', business_tz: 'Asia/Kuwait' },
    dir: { by: {}, name: () => '' },
    days: [],
    cases: [],
    touches: [],
    callsRows: [],
    tasks: [],
    refreshLog: [],
    storeErrors: [],
  }),
  tphChannels_: () => [],
  tphHours_: () => [8, 9],
  tphJson_: (_v: unknown, d: unknown) => d,
}))

import * as route from '@/app/api/tph/run-step/route'

const PGRST205 = { message: "Could not find the table 'public.fd_activities' in the schema cache", code: 'PGRST205' }

function req(date: string, step = 'touches'): Request {
  return new Request('http://localhost/api/tph/run-step', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ date, step }),
  })
}

describe('run-step errors', () => {
  beforeEach(() => {
    h.tableResults = {
      fd_activities: { data: null, error: PGRST205 },
      refresh_log: { data: null, error: null },
    }
  })

  it('PGRST205 on the mirror -> 503 { code: missing_store, hint }', async () => {
    const res = await route.POST(req('2026-10-07'))
    expect(res.status).toBe(503)
    const body = await res.json()
    expect(body.code).toBe('missing_store')
    expect(body.error).toContain('fd_activities')
    expect(body.hint).toContain('/api/admin/mirrors')
  })

  it('the interactive path still rejects dates older than 60 days', async () => {
    h.tableResults = {}
    const res = await route.POST(req('2026-07-01'))
    const body = await res.json()
    expect(res.status).toBe(500)
    expect(body.error).toContain('60 days')
  })
})
