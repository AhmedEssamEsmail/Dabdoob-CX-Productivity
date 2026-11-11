import { describe, it, expect, vi } from 'vitest'

// Same controllable supabase stub style as tests/perf/flush-invalidate.test.ts,
// extended with per-table result queues and a chained-call log so bound and
// paging behaviour of buildJobEnv/prefetchTables/ensureIntervals is observable.
type QueryResult = { data: unknown; error: { message: string } | null }

interface FakeBuilder extends PromiseLike<QueryResult> {
  [key: string]: unknown
}

const supa = vi.hoisted(() => ({
  from: (_table: string): FakeBuilder => {
    throw new Error(`install fakeDb per test: from(${_table})`)
  },
}))
vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: { from: (t: string) => supa.from(t) },
  createClient: () => ({ from: (t: string) => supa.from(t) }),
}))
import { buildJobEnv } from '@/features/shared/jobs/env'

interface QRes {
  data?: unknown
  error?: { message: string } | null
}

function fakeDb(queues: Record<string, QRes[]>) {
  const calls: { table: string; m: string; args: unknown[] }[] = []
  const from = (table: string): FakeBuilder => {
    let pending: QRes | undefined
    const b = new Proxy(function () {}, {
      get(_t, prop) {
        if (prop === 'then') {
          return (
            f?: ((v: QueryResult) => unknown) | null,
            rj?: ((e: unknown) => unknown) | null
          ) => {
            if (pending === undefined) {
              pending = (queues[table] || []).shift() ?? { data: [], error: null }
            }
            const result: QueryResult = {
              data: (pending as QRes).data ?? null,
              error: (pending as QRes).error ?? null,
            }
            return Promise.resolve(result).then(f, rj)
          }
        }
        if (prop === Symbol.toPrimitive) return () => ''
        return (...args: unknown[]) => {
          calls.push({ table, m: String(prop), args })
          return b
        }
      },
    })
    return b as unknown as FakeBuilder
  }
  return { from, calls }
}

const rows = (n: number, prefix = 'r') =>
  Array.from({ length: n }, (_, i) => ({ id: i, tag: `${prefix}${i}` }))

const gtes = (calls: { table: string; m: string; args: unknown[] }[], table: string) =>
  calls.filter((c) => c.table === table && c.m === 'gte').map((c) => c.args)

describe('buildJobEnv preload bounds + paging', () => {
  it('applies the per-table bound: prod_tph_cases on date, tickets on created_at -1d', async () => {
    const db = fakeDb({})
    supa.from = db.from
    const env = await buildJobEnv({
      roster: false,
      intervalSince: '2026-01-01',
      tables: ['prod_tph_cases', 'tickets', 'prod_flags'],
    })
    expect(gtes(db.calls, 'prod_tph_cases')).toEqual([['date', '2026-01-01']])
    expect(gtes(db.calls, 'tickets')).toEqual([['created_at', '2025-12-31']])
    // prod_flags is a verified exception: auto-accept scans every row.
    expect(gtes(db.calls, 'prod_flags')).toEqual([])
    expect(env.prodRows('prod_flags')).toEqual([])
  })

  it('concatenates >1 page for a bounded table and pages prefetchTables too', async () => {
    const db = fakeDb({
      prod_tph_cases: [{ data: rows(1000, 'a') }, { data: rows(3, 'b') }],
      prod_tph_touches: [{ data: [{ id: 1, date: '2026-01-02' }] }],
    })
    supa.from = db.from
    const env = await buildJobEnv({ roster: false, intervalSince: '2026-01-01' })
    await env.prefetchTables(['prod_tph_cases', 'prod_tph_touches'])
    expect(env.prodRows('prod_tph_cases')).toHaveLength(1003)
    expect(env.prodRows('prod_tph_touches')).toHaveLength(1)
    expect(gtes(db.calls, 'prod_tph_cases')).toEqual([
      ['date', '2026-01-01'],
      ['date', '2026-01-01'],
    ])
    expect(gtes(db.calls, 'prod_tph_touches')).toEqual([['date', '2026-01-01']])
    expect(db.calls.filter((c) => c.table === 'prod_tph_cases' && c.m === 'range')).toHaveLength(2)
  })

  it('unbounded tables still fetch fully across pages', async () => {
    const db = fakeDb({
      prod_flags: [{ data: rows(1000, 'f') }, { data: rows(2, 'g') }],
    })
    supa.from = db.from
    const env = await buildJobEnv({ roster: false })
    await env.prefetchTables(['prod_flags'])
    expect(env.prodRows('prod_flags')).toHaveLength(1002)
    expect(gtes(db.calls, 'prod_flags')).toEqual([])
  })

  it('ensureIntervals widens prod_intervals through readAllPaged', async () => {
    const db = fakeDb({
      prod_intervals: [
        { data: [] }, // initial opts.tables page (bound 2026-01-01)
        { data: [{ id: 7, date: '2025-06-01' }] }, // widened page (bound 2025-06-01)
      ],
    })
    supa.from = db.from
    const env = await buildJobEnv({
      roster: false,
      intervalSince: '2026-01-01',
      tables: ['prod_intervals'],
    })
    expect(gtes(db.calls, 'prod_intervals')).toEqual([['date', '2026-01-01']])
    await env.ensureIntervals(['2025-06-01', '2025-06-02'])
    expect(gtes(db.calls, 'prod_intervals')).toEqual([
      ['date', '2026-01-01'],
      ['date', '2025-06-01'],
    ])
    expect(env.prodRows('prod_intervals')).toHaveLength(1)
  })
})
