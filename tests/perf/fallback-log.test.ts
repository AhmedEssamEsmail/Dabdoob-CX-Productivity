import { describe, it, expect, vi, afterEach } from 'vitest'

// Same controllable supabase stub style as tests/perf/job-preload.test.ts:
// per-table result queues plus a chained-call log, so the constraint-fallback
// paths in repo.updateRows and env applyOp are observable.
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
import { updateRows } from '@/features/shared/platform/repo'

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
              pending = (queues[table] || []).shift() ?? { data: null, error: null }
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

const CONSTRAINT_ERR = { message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification (42P10)' }
const OK: QRes = { data: null, error: null }

const fallbackLogs = (spy: { mock: { calls: unknown[][] } }) =>
  spy.mock.calls.map((c) => String(c[0])).filter((m: string) => m.startsWith('upsert fallback:'))

afterEach(() => {
  vi.restoreAllMocks()
})

describe('upsert fallback log-once', () => {
  it('repo updateRows: two fallbacks on the same (table, keyField) log once; a different table logs again', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // Per updateRows call: select -> upsert(error) -> per update findRow + update.
    const oneCall = [
      { data: [{ k: 'a', v: 0 }, { k: 'b', v: 0 }] },
      { error: CONSTRAINT_ERR },
      { data: { k: 'a', v: 0 } },
      { data: { k: 'a', v: 1 } },
      { data: { k: 'b', v: 0 } },
      { data: { k: 'b', v: 2 } },
    ]
    const db = fakeDb({ fb_repo: [...oneCall, ...oneCall], fb_repo2: [...oneCall] })
    supa.from = db.from
    const opts = { actor: 'tester' }
    const updates = [
      { key: 'a', patch: { v: 1 } },
      { key: 'b', patch: { v: 2 } },
    ]

    const r1 = await updateRows('fb_repo', 'k', updates, opts)
    const r2 = await updateRows('fb_repo', 'k', updates, opts)
    await updateRows('fb_repo2', 'k', updates, opts)

    // Fallback behaviour unchanged: per-row updates still return the merged rows.
    expect(r1.map((r) => r && r.v)).toEqual([1, 2])
    expect(r2.map((r) => r && r.v)).toEqual([1, 2])

    const logs = fallbackLogs(spy)
    expect(logs.filter((m) => m === 'upsert fallback: fb_repo (k) — add unique index')).toHaveLength(1)
    expect(logs.filter((m) => m === 'upsert fallback: fb_repo2 (k) — add unique index')).toHaveLength(1)
    expect(logs).toHaveLength(2)
  })

  it('env applyOp: repeated upsert fallbacks on the same (table, keys) log once', async () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {})
    // Per op: upsert(error) -> delete().in() ok -> insert ok.
    const oneOp = [{ error: CONSTRAINT_ERR }, OK, OK]
    const db = fakeDb({
      env_fb: [...oneOp, ...oneOp],
      env_fb2: [...oneOp],
    })
    supa.from = db.from
    const env = await buildJobEnv({ roster: false, intervalSince: '2026-01-01', tables: [] })

    env.upsert('env_fb', ['k'], [{ k: 'a' }], null)
    env.upsert('env_fb', ['k'], [{ k: 'b' }], null)
    env.upsert('env_fb2', ['k'], [{ k: 'c' }], null)
    await env.flushWrites()

    const logs = fallbackLogs(spy)
    expect(logs.filter((m) => m === 'upsert fallback: env_fb (k) — add unique index')).toHaveLength(1)
    expect(logs.filter((m) => m === 'upsert fallback: env_fb2 (k) — add unique index')).toHaveLength(1)
    expect(logs).toHaveLength(2)
  })

  it('env applyOp dedupes upsert rows by key tuple, last wins', async () => {
    vi.spyOn(console, 'log').mockImplementation(() => {})
    const db = fakeDb({
      env_dedupe_ok: [{ data: null, error: null }],
      env_dedupe_fb: [{ error: CONSTRAINT_ERR }, OK, OK],
    })
    supa.from = db.from
    const env = await buildJobEnv({ roster: false, intervalSince: '2026-01-01', tables: [] })
    const rows = [
      { k: 'a', v: 1 },
      { k: 'a', v: 2 },
      { k: 'b', v: 3 },
    ]
    const deduped = [
      { k: 'a', v: 2 },
      { k: 'b', v: 3 },
    ]

    env.upsert('env_dedupe_ok', ['k'], rows, null)
    env.upsert('env_dedupe_fb', ['k'], rows, null)
    await env.flushWrites()

    const upsertCall = db.calls.find((c) => c.table === 'env_dedupe_ok' && c.m === 'upsert')
    const insertCall = db.calls.find((c) => c.table === 'env_dedupe_fb' && c.m === 'insert')
    expect(upsertCall?.args[0]).toEqual(deduped)
    expect(insertCall?.args[0]).toEqual(deduped)
  })
})
