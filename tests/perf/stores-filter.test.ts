import { describe, it, expect, vi } from 'vitest'

// Same controllable supabase stub style as tests/perf/read-all-paged.test.ts:
// each awaited builder shifts the next canned { data, error } off a queue
// while recording chained calls (eq/in/is/gte/lte/order/range) for assertions.
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
vi.mock('@/features/shared/platform/settings', () => ({
  configAll: async () => ({}),
}))
import { readStore, readStoreFiltered } from '@/features/shared/platform/stores'

interface QRes {
  data?: unknown
  error?: { message: string } | null
}

function fakeDb(queue: QRes[]) {
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
              pending = queue.shift() ?? { data: null, error: null }
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
  Array.from({ length: n }, (_, i) => ({ id: `${prefix}${i}` }))

describe('readStore', () => {
  it('pages a >1-page table to completion through readAllPaged', async () => {
    const db = fakeDb([{ data: rows(1000, 'a') }, { data: rows(3, 'b') }])
    supa.from = db.from
    const out = await readStore('big_table')
    expect(out.exists).toBe(true)
    expect(out.rows).toHaveLength(1003)
    expect(out.rows[1002].id).toBe('b2')
    const ranges = db.calls.filter((c) => c.m === 'range')
    expect(ranges.map((c) => c.args)).toEqual([
      [0, 999],
      [1000, 1999],
    ])
    expect(db.calls.find((c) => c.m === 'order')?.args).toEqual(['id', { ascending: true }])
  })

  it('returns exists:false when the read fails', async () => {
    const db = fakeDb([{ data: null, error: { message: 'missing table' } }])
    supa.from = db.from
    const out = await readStore('absent')
    expect(out).toEqual({ rows: [], exists: false })
  })
})

describe('readStoreFiltered', () => {
  it('applies eq/in/is/gte/lte inside the paged build', async () => {
    const db = fakeDb([{ data: [{ id: 'x' }] }])
    supa.from = db.from
    const out = await readStoreFiltered('things', {
      eq: { status: 'open' },
      in: { kind: ['a', 'b'] },
      is: { removed_at: null },
      gte: { date: '2026-01-01' },
      lte: { date: '2026-01-31' },
    })
    expect(out).toEqual({ rows: [{ id: 'x' }], exists: true })
    expect(db.calls.find((c) => c.m === 'eq')?.args).toEqual(['status', 'open'])
    expect(db.calls.find((c) => c.m === 'in')?.args).toEqual(['kind', ['a', 'b']])
    expect(db.calls.find((c) => c.m === 'is')?.args).toEqual(['removed_at', null])
    expect(db.calls.find((c) => c.m === 'gte')?.args).toEqual(['date', '2026-01-01'])
    expect(db.calls.find((c) => c.m === 'lte')?.args).toEqual(['date', '2026-01-31'])
    expect(db.calls.some((c) => c.m === 'range')).toBe(true)
  })

  it('returns every matching row across pages', async () => {
    const db = fakeDb([{ data: rows(1000, 'a') }, { data: rows(2, 'b') }])
    supa.from = db.from
    const out = await readStoreFiltered('things', { eq: { status: 'open' } })
    expect(out.exists).toBe(true)
    expect(out.rows).toHaveLength(1002)
    expect(db.calls.filter((c) => c.m === 'range')).toHaveLength(2)
    expect(db.calls.find((c) => c.m === 'eq')?.args).toEqual(['status', 'open'])
  })

  it('keeps empty in lists returning no rows', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    const out = await readStoreFiltered('things', { in: { kind: [] } })
    expect(out).toEqual({ rows: [], exists: true })
    expect(db.calls.find((c) => c.m === 'in')?.args).toEqual(['kind', []])
  })

  it('returns exists:false when the read fails', async () => {
    const db = fakeDb([{ data: null, error: { message: 'missing table' } }])
    supa.from = db.from
    const out = await readStoreFiltered('absent', { eq: { id: 'x' } })
    expect(out).toEqual({ rows: [], exists: false })
  })
})
