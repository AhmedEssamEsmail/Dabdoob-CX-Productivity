/**
 * Cron route handlers: Bearer CRON_SECRET auth (401 otherwise), the shared
 * job-env seam, and the response each route returns. buildJobEnv and
 * requireJobCaller are mocked — the jobs' internals are covered elsewhere.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({ env: null as import('./helpers').StubEnv | null }))
vi.mock('@/features/shared/jobs/env', () => ({ buildJobEnv: async () => h.env }))
vi.mock('@/features/shared/platform/identity', () => ({ requireJobCaller: async () => {} }))
vi.mock('@/features/shared/jobs/mirrors', () => ({ syncAllMirrors: async () => ({}) }))

import { stubEnv } from './helpers'
import * as routeDaily from '@/app/api/cron/job-productivity-daily/route'
import * as routeHourly from '@/app/api/cron/job-tph-hourly/route'
import * as routePastDays from '@/app/api/cron/job-tph-past-days/route'
import * as routeQuarterly from '@/app/api/cron/job-quarterly-report/route'
import * as routeNightly from '@/app/api/cron/job-nightly-aggregates/route'
import * as routeGmail from '@/app/api/integrations/gmail/route'

const ROUTES: Record<string, { GET: (req: Request) => Promise<Response> }> = {
  '/api/cron/job-productivity-daily': routeDaily,
  '/api/cron/job-tph-hourly': routeHourly,
  '/api/cron/job-tph-past-days': routePastDays,
  '/api/cron/job-quarterly-report': routeQuarterly,
}

const BOOKS = {
  'month-book': {
    Assumptions: [['x']],
    'Maqsam Calls': [['x']],
    FD_AUX: [['x']],
    'AUXes Exceptions': [['x']],
    Quality: [['x']],
    Headcount: [['x']],
  },
  'fd-book': { Activities: [['x']] },
  'dr-book': { Freshchat: [['x']] },
}

function authed(path: string): Request {
  return new Request('http://localhost' + path, { headers: { authorization: 'Bearer s3cr3t' } })
}

describe('cron routes', () => {
  beforeEach(() => {
    process.env.CRON_SECRET = 's3cr3t'
    h.env = stubEnv({ now: Date.parse('2026-10-08T10:00:00Z'), books: BOOKS })
  })

  it.each(Object.keys(ROUTES))('%s -> 401 without a Bearer token', async (path) => {
    const res = await ROUTES[path].GET(new Request('http://localhost' + path))
    expect(res.status).toBe(401)
    const res2 = await ROUTES[path].GET(new Request('http://localhost' + path, { headers: { authorization: 'Bearer wrong' } }))
    expect(res2.status).toBe(401)
  })

  it('job-productivity-daily runs the chain and answers the step map', async () => {
    const res = await routeDaily.GET(authed('/api/cron/job-productivity-daily'))
    expect(res.status).toBe(200)
    const out = await res.json()
    // prod_snapshot skipped (no gmail adapter); the rest of the chain ran.
    expect(out.prod_snapshot).toEqual({ skipped: 'gmail adapter not configured' })
    expect(out.prod_flags).toMatchObject({ flagged: 0, added: 0, voided: 0 })
    expect(out).toHaveProperty('productivity')
    expect(out).toHaveProperty('prod_tph_cases_rebuilt')
  })

  it('job-tph-hourly folds the queue into the auto row', async () => {
    h.env!.tables.agg_queue_now = [
      { kind: 'ticket', queue: 'Customer Support - Internal', created_today: 3, by_status_json: '{"Open":2}', stale: false },
    ]
    const res = await routeHourly.GET(authed('/api/cron/job-tph-hourly'))
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out.rowsOut).toBe(1)
    expect(h.env!.tables.prod_tph_cases[0].source).toBe('auto')
  })

  it('job-tph-past-days answers the rebuild summary', async () => {
    const res = await routePastDays.GET(authed('/api/cron/job-tph-past-days'))
    expect(res.status).toBe(200)
    const out = await res.json()
    expect(out).toHaveProperty('note')
  })

  it('job-nightly-aggregates fails closed with no CRON_SECRET in production', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', '')
    const res = await routeNightly.GET(new Request('http://localhost/api/cron/job-nightly-aggregates') as never)
    expect(res.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('fails closed with no CRON_SECRET in production: Bearer undefined rejected on cron GET and integration POST', async () => {
    vi.stubEnv('NODE_ENV', 'production')
    vi.stubEnv('CRON_SECRET', '')
    const hourly = await routeHourly.GET(
      new Request('http://localhost/x', { headers: { authorization: 'Bearer undefined' } }) as never,
    )
    expect(hourly.status).toBe(401)
    const gmail = await routeGmail.POST(
      new Request('http://localhost/x', { method: 'POST', headers: { authorization: 'Bearer undefined' } }) as never,
    )
    expect(gmail.status).toBe(401)
    const noAuth = await routeHourly.GET(new Request('http://localhost/x') as never)
    expect(noAuth.status).toBe(401)
    vi.unstubAllEnvs()
  })

  it('job-quarterly-report skips cleanly with no recipients configured', async () => {
    const res = await routeQuarterly.GET(authed('/api/cron/job-quarterly-report'))
    expect(res.status).toBe(200)
    expect(await res.json()).toEqual({ skipped: 'No recipients configured' })
  })
})
