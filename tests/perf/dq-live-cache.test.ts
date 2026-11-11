import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

// Same controllable supabase stub style as tests/perf/read-all-paged.test.ts:
// each awaited builder shifts the next canned { data, error } off a queue
// while recording chained calls; `fromCalls` counts table reads.
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
import { dqCachedLive } from '@/features/shared/platform/stores'
import { cacheClear, cacheGet } from '@/features/shared/platform/repo'

interface QRes {
  data?: unknown
  error?: { message: string } | null
}

function fakeDb(queue: QRes[]) {
  const calls: { table: string; m: string; args: unknown[] }[] = []
  const fromCalls: { table: string }[] = []
  const from = (table: string): FakeBuilder => {
    fromCalls.push({ table })
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
  return { from, calls, fromCalls }
}

const fixture = [{ id: 't1', channel: 'chat' }]

describe('dqCachedLive live| TTL cache', () => {
  beforeEach(() => {
    cacheClear()
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('second call inside the 45 s TTL issues no db() read', async () => {
    const db = fakeDb([{ data: fixture }, { data: fixture }])
    supa.from = db.from
    const a = await dqCachedLive('agg_queue_now')
    const b = await dqCachedLive('agg_queue_now')
    expect(a).toEqual(fixture)
    expect(b).toEqual(fixture)
    expect(db.fromCalls.filter((c) => c.table === 'agg_queue_now')).toHaveLength(1)
    expect(cacheGet('live|agg_queue_now')).not.toBeNull()
  })

  it('an expired entry re-reads the table', async () => {
    vi.useFakeTimers()
    const db = fakeDb([{ data: fixture }, { data: fixture }])
    supa.from = db.from
    await dqCachedLive('agg_queue_now')
    vi.advanceTimersByTime(46_000)
    await dqCachedLive('agg_queue_now')
    expect(db.fromCalls.filter((c) => c.table === 'agg_queue_now')).toHaveLength(2)
  })

  it('cacheClear resets the entry and [] results are cached too', async () => {
    const db = fakeDb([{ data: [] }])
    supa.from = db.from
    const first = await dqCachedLive('missing_store')
    expect(first).toEqual([])
    cacheClear()
    await dqCachedLive('missing_store')
    expect(db.fromCalls.filter((c) => c.table === 'missing_store')).toHaveLength(2)
  })
})
