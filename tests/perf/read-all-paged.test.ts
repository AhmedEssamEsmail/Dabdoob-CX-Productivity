import { describe, it, expect, vi } from 'vitest'

// Same controllable supabase stub style as tests/platform/repo.test.ts:
// each awaited builder shifts the next canned { data, error } off a queue
// while recording chained calls (range/order/limit) for assertions.
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
import { readAllPaged, readRows } from '@/features/shared/platform/repo'
import { dqReadTail } from '@/features/shared/platform/stores'

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

describe('readAllPaged', () => {
  it('concatenates full pages plus a short page, ordered by pk asc', async () => {
    const db = fakeDb([
      { data: rows(2, 'a') },
      { data: rows(2, 'b') },
      { data: rows(1, 'c') },
    ])
    supa.from = db.from
    const out = await readAllPaged('things', { pageSize: 2 })
    expect(out).toHaveLength(5)
    expect(out.map((r) => r.id)).toEqual(['a0', 'a1', 'b0', 'b1', 'c0'])
    const ranges = db.calls.filter((c) => c.m === 'range')
    expect(ranges.map((c) => c.args)).toEqual([
      [0, 1],
      [2, 3],
      [4, 5],
    ])
    const orders = db.calls.filter((c) => c.m === 'order')
    expect(orders[0].args).toEqual(['id', { ascending: true }])
  })

  it('propagates query errors as Error(message)', async () => {
    const db = fakeDb([{ data: null, error: { message: 'boom' } }])
    supa.from = db.from
    await expect(readAllPaged('things')).rejects.toThrow('boom')
  })

  it('orders non-id PK tables by their override column', async () => {
    const db = fakeDb([{ data: [{ email: 'a@x.com' }] }])
    supa.from = db.from
    await readAllPaged('roster', { pageSize: 10 })
    const order = db.calls.find((c) => c.m === 'order')
    expect(order?.args[0]).toBe('email')
  })

  it('orders drift tables lacking id on their PK_OVERRIDES business key', async () => {
    const db = fakeDb([{ data: [{ queue_id: 'Q1' }] }])
    supa.from = db.from
    await readAllPaged('qa_queue', { pageSize: 5 })
    expect(db.calls.find((c) => c.m === 'order')?.args).toEqual(['queue_id', { ascending: true }])
  })

  it('orders composite-key drift tables by each key in sequence', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    await readAllPaged('prod_tph_days', { pageSize: 5 })
    const orders = db.calls.filter((c) => c.m === 'order').map((c) => c.args)
    expect(orders).toEqual([
      ['date', { ascending: true }],
      ['agent_email', { ascending: true }],
    ])
  })

  it('orders pk-scan-01 drift tables on their evidence keys', async () => {
    const cases: Record<string, unknown[][]> = {
      prod_intervals: [['interval_key', { ascending: true }]],
      prod_flag_log: [['log_id', { ascending: true }]],
      prod_flag_analytics: [
        ['date', { ascending: true }],
        ['agent_email', { ascending: true }],
      ],
      fcr_daily: [
        ['date', { ascending: true }],
        ['agent_email', { ascending: true }],
      ],
      fcr_weekly: [
        ['week', { ascending: true }],
        ['agent_email', { ascending: true }],
      ],
      fcr_monthly: [
        ['month', { ascending: true }],
        ['agent_email', { ascending: true }],
      ],
    }
    for (const [table, expected] of Object.entries(cases)) {
      const db = fakeDb([{ data: [] }])
      supa.from = db.from
      await readAllPaged(table)
      const orders = db.calls.filter((c) => c.m === 'order').map((c) => c.args)
      expect(orders, table).toEqual(expected)
    }
  })

  it('id-keyed drift tables keep the default id order (no override needed)', async () => {
    for (const table of ['qa_forms', 'freshchat', 'fd_activities', 'maqsam_calls']) {
      const db = fakeDb([{ data: [] }])
      supa.from = db.from
      await readAllPaged(table)
      expect(db.calls.find((c) => c.m === 'order')?.args, table).toEqual(['id', { ascending: true }])
    }
  })

  it('opts.pk wins over the id default but not over PK_OVERRIDES', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    await readAllPaged('things', { pk: 'sku', pageSize: 5 })
    expect(db.calls.find((c) => c.m === 'order')?.args[0]).toBe('sku')
    const db2 = fakeDb([{ data: [] }])
    supa.from = db2.from
    await readAllPaged('config', { pk: 'sku', pageSize: 5 })
    expect(db2.calls.find((c) => c.m === 'order')?.args[0]).toBe('key')
  })
})

describe('dqReadTail pk resolution', () => {
  it('orders id tables by id desc and returns the tail oldest-first', async () => {
    const db = fakeDb([{ data: [{ id: 'c' }, { id: 'b' }, { id: 'a' }] }])
    supa.from = db.from
    const out = await dqReadTail('things', 3)
    expect(out.map((r) => r.id)).toEqual(['a', 'b', 'c'])
    expect(db.calls.find((c) => c.m === 'order')?.args).toEqual(['id', { ascending: false }])
    expect(db.calls.find((c) => c.m === 'limit')?.args).toEqual([3])
  })

  it('resolves PK_OVERRIDES keys desc on drift tables', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    await dqReadTail('fcr_daily', 5)
    const orders = db.calls.filter((c) => c.m === 'order').map((c) => c.args)
    expect(orders).toEqual([
      ['date', { ascending: false }],
      ['agent_email', { ascending: false }],
    ])
    const single = fakeDb([{ data: [] }])
    supa.from = single.from
    await dqReadTail('prod_intervals', 2)
    expect(single.calls.find((c) => c.m === 'order')?.args).toEqual(['interval_key', { ascending: false }])
  })
})

describe('readRows paging', () => {
  it('unbounded readRows pages a >pageSize fixture table to completion', async () => {
    const db = fakeDb([
      { data: rows(1000, 'p') },
      { data: rows(3, 'q') },
    ])
    supa.from = db.from
    const out = await readRows('big_table')
    expect(out).toHaveLength(1003)
    expect(db.calls.filter((c) => c.m === 'range')).toHaveLength(2)
  })

  it('keeps the single-shot path byte-for-byte when opts.limit is set', async () => {
    const db = fakeDb([{ data: rows(2) }])
    supa.from = db.from
    const out = await readRows('things', { orderBy: 'name', limit: 5 })
    expect(out).toHaveLength(2)
    expect(db.calls.some((c) => c.m === 'range')).toBe(false)
    expect(db.calls.find((c) => c.m === 'limit')?.args).toEqual([5])
    expect(db.calls.find((c) => c.m === 'order')?.args).toEqual(['name', { ascending: true }])
  })

  it('orderBy becomes primary sort with pk as tiebreak on the paged path', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    await readRows('things', { orderBy: 'name', ascending: false })
    const orders = db.calls.filter((c) => c.m === 'order').map((c) => c.args)
    expect(orders).toEqual([
      ['name', { ascending: false }],
      ['id', { ascending: true }],
    ])
  })
})
