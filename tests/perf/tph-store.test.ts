import { describe, it, expect, vi, beforeEach } from 'vitest'

// Controllable supabase stub (same style as tests/perf/prod-analytics.test.ts):
// each awaited builder shifts the next canned { data, error } off the per-table
// FIFO while recording chained calls for query-shape assertions.
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
const configAllSpy = vi.hoisted(() => vi.fn())
vi.mock('@/features/shared/platform/settings', () => ({
  configAll: (...a: unknown[]) => configAllSpy(...a),
  getConfig: async (key: string, fallback?: unknown) =>
    key in cfgBox.values ? cfgBox.values[key] : fallback,
  ccApp: () => '',
}))

const loadStoreSpy = vi.hoisted(() => vi.fn())
vi.mock('@/features/cx-productivity/lib/tph/page', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/cx-productivity/lib/tph/page')>()
  return {
    ...mod,
    tphLoadStore_: (...args: unknown[]) => {
      loadStoreSpy(...args)
      return (mod.tphLoadStore_ as unknown as (...a: unknown[]) => unknown)(...args)
    },
    getTphPage: () => ({ ok: true }),
  }
})
vi.mock('@/features/shared/platform/viewas', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/shared/platform/viewas')>()),
  viewAsGuard: async () => undefined,
}))
vi.mock('@/features/cx-productivity/lib/tph/write', () => ({
  saveTphSlots: async () => ({}),
  saveTphCases: async () => ({}),
  saveTphTask: async () => ({}),
}))

import { tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { dqAddDays_ } from '@/features/shared/lib/adapters'

const CFG: Record<string, unknown> = {
  admin_emails: 'boss@dabdoob.com',
  business_tz: 'Asia/Kuwait',
  tph_eligible_days: 28,
}
const TODAY = prodToday_(CFG as never)
const LO = dqAddDays_(TODAY, -28)

const ROSTER = [
  { email: 'A@dabdoob.com', name: 'Agent A', role: 'agent', tl_email: 'TL@dabdoob.com', active: true, position: '' },
  { email: 'boss@dabdoob.com', name: 'Boss', role: 'admin', tl_email: null, active: true, position: '' },
]

const FIXTURE: Record<string, Record<string, unknown>[]> = {
  prod_tph_days: [{ date: TODAY, agent_email: 'a@dabdoob.com', slots_json: {}, sources_json: {} }],
  prod_tph_cases: [{ date: TODAY, source: 'tl', cases_json: {}, at: 'x' }],
  prod_tph_touches: [{ date: TODAY, touches_json: {}, computed_at: 'x' }],
  prod_tph_calls: [{ date: TODAY, calls_json: {}, computed_at: 'x' }],
  prod_tph_tasks: [{ task_id: 't1', date: TODAY, agent_email: 'a@dabdoob.com', channel: 'chat', start: '09:00', end: '10:00', by: 'boss@dabdoob.com', removed: false }],
}
const LOG = [{ job: 'prod_tph_auto', note: 'n', status: 'ok', started_at: 's', finished_at: 'f' }]

function seed() {
  supa.results = {
    roster: [{ data: ROSTER, error: null }],
    prod_tph_days: [{ data: FIXTURE.prod_tph_days, error: null }],
    prod_tph_cases: [{ data: FIXTURE.prod_tph_cases, error: null }],
    prod_tph_touches: [{ data: FIXTURE.prod_tph_touches, error: null }],
    prod_tph_calls: [{ data: FIXTURE.prod_tph_calls, error: null }],
    prod_tph_tasks: [{ data: FIXTURE.prod_tph_tasks, error: null }],
    refresh_log: [{ data: LOG, error: null }],
  }
}

const TPH_TABLES = ['prod_tph_days', 'prod_tph_cases', 'prod_tph_touches', 'prod_tph_calls', 'prod_tph_tasks']

describe('tphLoadStore_ window/options (P-03)', () => {
  beforeEach(() => {
    fakeDb()
    cfgBox.values = { ...CFG }
    configAllSpy.mockReset()
    configAllSpy.mockImplementation(async () => cfgBox.values)
    seed()
  })

  it('day mode bounds every prod_tph_* read to date = dp and skips refresh_log', async () => {
    const store = await tphLoadStore_(TODAY, { window: 'day' })
    for (const t of TPH_TABLES) {
      const gte = supa.calls.find((c) => c.table === t && c.m === 'gte')
      const lte = supa.calls.find((c) => c.table === t && c.m === 'lte')
      expect(gte?.args, t).toEqual(['date', TODAY])
      expect(lte?.args, t).toEqual(['date', TODAY])
    }
    expect(supa.calls.some((c) => c.table === 'refresh_log')).toBe(false)
    expect(store.refreshLog).toEqual([])
  })

  it('projects per-table columns (no select(*)) on the prod_tph_* reads', async () => {
    await tphLoadStore_(TODAY, { window: 'day' })
    const selects = Object.fromEntries(
      TPH_TABLES.map((t) => [t, String(supa.calls.find((c) => c.table === t && c.m === 'select')?.args[0])])
    )
    expect(selects.prod_tph_days).toBe('date, agent_email, slots_json, sources_json')
    expect(selects.prod_tph_cases).toContain('cases_json')
    expect(selects.prod_tph_tasks).toContain('"start"')
    for (const t of TPH_TABLES) expect(selects[t]).not.toBe('*')
  })

  it('trend (default) keeps the gte(lo) window and loads refresh_log only when asked', async () => {
    const store = await tphLoadStore_(TODAY)
    for (const t of TPH_TABLES) {
      const gte = supa.calls.find((c) => c.table === t && c.m === 'gte')
      expect(gte?.args, t).toEqual(['date', LO])
      expect(supa.calls.some((c) => c.table === t && c.m === 'lte'), t).toBe(false)
    }
    expect(supa.calls.some((c) => c.table === 'refresh_log')).toBe(false)
    expect(store.refreshLog).toEqual([])
    seed()
    const withLog = await tphLoadStore_(TODAY, { window: 'trend', refreshLog: true })
    expect(withLog.refreshLog).toEqual(LOG)
    const logSel = supa.calls.find((c) => c.table === 'refresh_log' && c.m === 'select')
    expect(logSel?.args[0]).toBe('*')
  })

  it('serves config via configAll and roster via pwDirectory (select(*))', async () => {
    const store = await tphLoadStore_(TODAY, { window: 'day' })
    expect(configAllSpy).toHaveBeenCalled()
    expect(supa.calls.some((c) => c.table === 'config')).toBe(false)
    const rosterSel = supa.calls.find((c) => c.table === 'roster' && c.m === 'select')
    expect(rosterSel?.args[0]).toBe('*')
    expect(store.cfg).toEqual(CFG)
    expect(store.dir.by['a@dabdoob.com']).toEqual({
      email: 'a@dabdoob.com', name: 'Agent A', tlEmail: 'tl@dabdoob.com', role: 'agent', active: true,
    })
    expect(store.dir.name('a@dabdoob.com')).toBe('Agent A')
  })

  it('parity: same fixture yields the same TphStore rows/dir/storeErrors in trend mode', async () => {
    const store = await tphLoadStore_(TODAY, { window: 'trend', refreshLog: true })
    expect(store.days).toEqual(FIXTURE.prod_tph_days)
    expect(store.cases).toEqual(FIXTURE.prod_tph_cases)
    expect(store.touches).toEqual(FIXTURE.prod_tph_touches)
    expect(store.callsRows).toEqual(FIXTURE.prod_tph_calls)
    expect(store.tasks).toEqual(FIXTURE.prod_tph_tasks)
    expect(store.refreshLog).toEqual(LOG)
    expect(store.storeErrors).toEqual([])
  })

  it('a failed table read records a storeError and yields []', async () => {
    supa.results.prod_tph_cases = [{ data: null, error: { message: 'boom' } }]
    const store = await tphLoadStore_(TODAY, { window: 'day' })
    expect(store.cases).toEqual([])
    expect(store.storeErrors.length).toBe(1)
    expect(store.days).toEqual(FIXTURE.prod_tph_days)
  })
})

describe('tph routes forward window opts (P-03)', () => {
  const post = (body: unknown) =>
    new Request('http://t/api', { method: 'POST', body: JSON.stringify(body) })
  beforeEach(() => {
    fakeDb()
    cfgBox.values = { ...CFG }
    configAllSpy.mockReset()
    configAllSpy.mockImplementation(async () => cfgBox.values)
    loadStoreSpy.mockClear()
    seed()
  })

  it('slots/touches/cases/tasks/run-step pass { window: "day" }', async () => {
    const { POST: slots } = await import('@/app/api/tph/slots/route')
    const { POST: cases } = await import('@/app/api/tph/cases/route')
    const { POST: tasks } = await import('@/app/api/tph/tasks/route')
    const { POST: runStep } = await import('@/app/api/tph/run-step/route')
    await slots(post({ date: TODAY }))
    expect(loadStoreSpy).toHaveBeenLastCalledWith(TODAY, { window: 'day' })
    await cases(post({ date: TODAY }))
    expect(loadStoreSpy).toHaveBeenLastCalledWith(TODAY, { window: 'day' })
    await tasks(post({ date: TODAY }))
    expect(loadStoreSpy).toHaveBeenLastCalledWith(TODAY, { window: 'day' })
    await runStep(post({ date: TODAY, step: 'touches' }))
    expect(loadStoreSpy).toHaveBeenLastCalledWith(TODAY, { window: 'day' })
    const { GET: touches } = await import('@/app/api/tph/touches/route')
    await touches(new Request(`http://t/api/tph/touches?date=${TODAY}`))
    expect(loadStoreSpy).toHaveBeenLastCalledWith(TODAY, { window: 'day' })
  })

  it('/page keeps trend + refreshLog', async () => {
    const { GET: page } = await import('@/app/api/tph/page/route')
    await page(new Request(`http://t/api/tph/page?date=${TODAY}`))
    expect(loadStoreSpy).toHaveBeenCalledWith(TODAY, { window: 'trend', refreshLog: true })
  })
})
