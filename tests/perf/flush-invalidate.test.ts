import { describe, it, expect, vi, beforeEach } from 'vitest'

// Same controllable supabase stub style as tests/perf/dq-live-cache.test.ts:
// each awaited builder shifts the next canned { data, error } off a queue
// while recording chained calls; `failTables` forces an error per table.
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
import { cacheClear, cacheGet, cachePut } from '@/features/shared/platform/repo'

interface QRes {
  data?: unknown
  error?: { message: string } | null
}

function fakeDb(queue: QRes[] = [], failTables: Record<string, { message: string }> = {}) {
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
              pending = failTables[table]
                ? { data: null, error: failTables[table] }
                : queue.shift() ?? { data: null, error: null }
            }
            const result: QueryResult = {
              data: (pending as QRes).data ?? null,
              error: (pending as QRes).error ?? null,
            }
            return Promise.resolve(result).then(f, rj)
          }
        }
        if (prop === Symbol.toPrimitive) return () => ''
        return () => b
      },
    })
    return b as unknown as FakeBuilder
  }
  return { from }
}

describe('flushWrites live| invalidation', () => {
  beforeEach(() => {
    cacheClear()
  })

  it('drops live|<table> after a successful write op', async () => {
    supa.from = fakeDb().from
    const env = await buildJobEnv({ roster: false })
    cachePut('live|widgets', '[{"id":1}]', 45)
    env.upsert('widgets', ['id'], [{ id: 1 }], null)
    await env.flushWrites()
    expect(cacheGet('live|widgets')).toBeNull()
  })

  it('keeps live|<table> when the op fails (soft ops still drain)', async () => {
    supa.from = fakeDb([], { refresh_log: { message: 'insert denied' } }).from
    const env = await buildJobEnv({ roster: false })
    cachePut('live|refresh_log', '[]', 45)
    env.logRun('job-x', Date.now(), 'ok', {})
    await env.flushWrites()
    expect(cacheGet('live|refresh_log')).toBe('[]')
  })
})
