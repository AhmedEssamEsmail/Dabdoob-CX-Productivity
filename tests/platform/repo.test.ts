import { describe, it, expect, vi, beforeEach } from 'vitest'

// Controllable supabase stub: each test installs a `from` impl whose awaited
// builders shift canned { data, error } responses off a queue, while recording
// every chained method call for assertions.
type QueryResult = { data: unknown; error: { message: string } | null }

interface FakeBuilder extends PromiseLike<QueryResult> {
  [key: string]: unknown
}

function thenable(result: QueryResult): FakeBuilder {
  const b = new Proxy(function () {}, {
    get(_t, prop) {
      if (prop === 'then') {
        return (
          f?: ((v: QueryResult) => unknown) | null,
          rj?: ((e: unknown) => unknown) | null
        ) => Promise.resolve(result).then(f, rj)
      }
      if (prop === Symbol.toPrimitive) return () => ''
      return () => b
    },
  })
  return b as unknown as FakeBuilder
}

const supa = vi.hoisted(() => ({
  from: (table: string): FakeBuilder => {
    void table
    return thenable({ data: null, error: null })
  },
}))
vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: { from: (t: string) => supa.from(t) },
  createClient: () => ({ from: (t: string) => supa.from(t) }),
}))
import {
  sanitizeInput, newId, normHeader, isTrue, toClientValue, toCellValue,
  cacheGet, cachePut, cacheRemove, cacheClear, STAMP_FIELDS,
  updateRows, updateRow,
} from '@/features/shared/platform/repo'

interface QRes {
  data?: unknown
  error?: { message: string } | null
}

function fakeDb(queue: QRes[]) {
  const calls: { table: string; m: string; args: unknown[] }[] = []
  let awaited = 0
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
              awaited += 1
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
  return { from, calls, awaited: () => awaited }
}

describe('sanitizeInput / stamping (Repo.js)', () => {
  it('drops client-supplied stamps and internal keys', () => {
    const clean = sanitizeInput({
      name: 'A',
      submitted_by: 'evil@x.com',
      submitted_at: '2000-01-01',
      updated_by: 'evil@x.com',
      _secret: 'x',
    })
    expect(clean).toEqual({ name: 'A' })
    STAMP_FIELDS.forEach((f) => expect(clean[f]).toBeUndefined())
  })

  it('keeps ordinary fields untouched', () => {
    expect(sanitizeInput({ a: 1, b: 'x' })).toEqual({ a: 1, b: 'x' })
    expect(sanitizeInput(null)).toEqual({})
  })
})

describe('formula-injection guard (toCellValue_)', () => {
  it('apostrophes =, +, @ and dash+non-digit', () => {
    expect(toCellValue('=1+1')).toBe("'=1+1")
    expect(toCellValue('+SUM(A1)')).toBe("'+SUM(A1)")
    expect(toCellValue('@cmd')).toBe("'@cmd")
    expect(toCellValue('-abc')).toBe("'-abc")
  })

  it('leaves negative numbers and ordinary text alone', () => {
    expect(toCellValue('-12')).toBe('-12')
    expect(toCellValue('-12.5')).toBe('-12.5')
    expect(toCellValue('hello')).toBe('hello')
  })

  it('serialises objects, keeps dates, empties null', () => {
    expect(toCellValue({ a: 1 })).toBe('{"a":1}')
    const d = new Date('2026-10-08T00:00:00Z')
    expect(toCellValue(d)).toBe(d)
    expect(toCellValue(null)).toBe('')
    expect(toCellValue(undefined)).toBe('')
  })
})

describe('small helpers', () => {
  it('normHeader collapses case and whitespace', () => {
    expect(normHeader('Promo  code ')).toBe('promo code')
    expect(normHeader('Promo Code')).toBe('promo code')
  })

  it('isTrue reads sheet-style booleans', () => {
    expect(isTrue(true)).toBe(true)
    expect(isTrue('TRUE')).toBe(true)
    expect(isTrue('false')).toBe(false)
    expect(isTrue('')).toBe(false)
  })

  it('toClientValue turns dates into ISO, invalid dates into empty', () => {
    expect(toClientValue(new Date('2026-10-08T00:00:00Z'))).toBe('2026-10-08T00:00:00.000Z')
    expect(toClientValue(new Date('junk'))).toBe('')
    expect(toClientValue('x')).toBe('x')
  })

  it('newId is prefixed and unique', () => {
    const a = newId('pop')
    const b = newId('pop')
    expect(a.startsWith('pop_')).toBe(true)
    expect(a).not.toBe(b)
    expect(newId().startsWith('id_')).toBe(true)
  })
})

describe('in-memory TTL cache (CacheService)', () => {
  it('round-trips, expires and removes', () => {
    cacheClear()
    cachePut('k', 'v', 60)
    expect(cacheGet('k')).toBe('v')
    cacheRemove('k')
    expect(cacheGet('k')).toBeNull()
    cachePut('gone', 'x', -1) // already expired
    expect(cacheGet('gone')).toBeNull()
  })
})

describe('updateRows (batched upsert)', () => {
  const opts = { actor: 'agent@x.com' }
  const rows = [
    { id: 'a', name: 'A', submitted_by: 'orig@x.com', submitted_at: 't0' },
    { id: 'b', name: 'B', submitted_by: 'orig@x.com', submitted_at: 't0' },
  ]

  beforeEach(() => {
    supa.from = () => thenable({ data: null, error: null })
  })

  it('batches N updates into one .in() select + one upsert, preserving per-entry results', async () => {
    const db = fakeDb([{ data: rows }, { data: null, error: null }])
    supa.from = db.from
    const out = await updateRows(
      'things', 'id',
      [
        { key: 'a', patch: { name: 'A2', submitted_by: 'evil@x.com' } },
        { key: 'b', patch: { name: 'B2' } },
        { key: 'c', patch: { name: 'C2' } },
      ],
      opts
    )
    expect(out).toHaveLength(3)
    expect(out[0]).toMatchObject({ id: 'a', name: 'A2', submitted_by: 'orig@x.com', updated_by: 'agent@x.com' })
    expect(out[1]).toMatchObject({ id: 'b', name: 'B2', updated_by: 'agent@x.com' })
    expect(out[2]).toBeNull()
    expect(db.awaited()).toBe(2)
    const inCall = db.calls.find((c) => c.m === 'in')
    expect(inCall?.args[0]).toBe('id')
    expect(inCall?.args[1]).toEqual(['a', 'b', 'c'])
    const up = db.calls.find((c) => c.m === 'upsert')
    expect(up?.args[1]).toEqual({ onConflict: 'id' })
    expect(up?.args[0]).toHaveLength(2)
  })

  it('upsert sends key + patch + stamps only, not unpatched current columns', async () => {
    const wideRows = [
      { id: 'a', name: 'A', status: 'open', submitted_by: 'orig@x.com', submitted_at: 't0' },
      { id: 'b', name: 'B', status: 'open', submitted_by: 'orig@x.com', submitted_at: 't0' },
    ]
    const db = fakeDb([{ data: wideRows }, { data: null, error: null }])
    supa.from = db.from
    const out = await updateRows(
      'things', 'id',
      [
        { key: 'a', patch: { status: 'closed' } },
        { key: 'b', patch: { status: 'done' } },
      ],
      opts
    )
    expect(out[0]).toMatchObject({ id: 'a', name: 'A', status: 'closed' })
    const up = db.calls.find((c) => c.m === 'upsert')
    const payload = up?.args[0] as Record<string, unknown>[]
    expect(payload).toHaveLength(2)
    for (const p of payload) {
      expect(Object.keys(p).sort()).toEqual(['id', 'status', 'updated_at', 'updated_by'])
    }
    expect(payload.find((p) => p.id === 'a')).toMatchObject({ status: 'closed', updated_by: 'agent@x.com' })
  })

  it('groups heterogeneous patch key-sets into separate homogeneous upserts', async () => {
    const wideRows = [
      { id: 'a', name: 'A', status: 'open' },
      { id: 'b', name: 'B', status: 'open' },
    ]
    const db = fakeDb([{ data: wideRows }, { data: null, error: null }, { data: null, error: null }])
    supa.from = db.from
    await updateRows(
      'things', 'id',
      [
        { key: 'a', patch: { name: 'A2' } },
        { key: 'b', patch: { status: 'closed' } },
      ],
      opts
    )
    const upserts = db.calls.filter((c) => c.m === 'upsert')
    expect(upserts).toHaveLength(2)
    const signatures = upserts.map((up) => {
      const payload = up.args[0] as Record<string, unknown>[]
      expect(payload).toHaveLength(1)
      expect(up.args[1]).toEqual({ onConflict: 'id' })
      return Object.keys(payload[0]).sort()
    })
    expect(signatures).toContainEqual(['id', 'name', 'updated_at', 'updated_by'])
    expect(signatures).toContainEqual(['id', 'status', 'updated_at', 'updated_by'])
    const payloadA = (upserts[0].args[0] as Record<string, unknown>[])[0]
    const payloadB = (upserts[1].args[0] as Record<string, unknown>[])[0]
    expect(payloadA.id === 'a' ? 'name' in payloadA : 'status' in payloadA).toBe(true)
    expect(payloadB.id === 'b' ? 'status' in payloadB : 'name' in payloadB).toBe(true)
  })

  it('colliding join("") signatures still split into separate upserts', async () => {
    const wideRows = [
      { id: 'a', name: 'A', status: 'open' },
      { id: 'b', name: 'B', status: 'open' },
    ]
    const db = fakeDb([{ data: wideRows }, { data: null, error: null }, { data: null, error: null }])
    supa.from = db.from
    await updateRows(
      'things', 'id',
      [
        { key: 'a', patch: { a: 1, bc: 2 } },
        { key: 'b', patch: { ab: 1, c: 2 } },
      ],
      opts
    )
    const upserts = db.calls.filter((c) => c.m === 'upsert')
    expect(upserts).toHaveLength(2)
    const signatures = upserts.map((up) =>
      Object.keys((up.args[0] as Record<string, unknown>[])[0]).sort()
    )
    expect(signatures).toContainEqual(['a', 'bc', 'id', 'updated_at', 'updated_by'])
    expect(signatures).toContainEqual(['ab', 'c', 'id', 'updated_at', 'updated_by'])
  })

  it('a guard throw aborts before any upsert', async () => {
    const db = fakeDb([{ data: rows }])
    supa.from = db.from
    await expect(
      updateRows('things', 'id',
        [{ key: 'a', patch: { name: 'X' } }, { key: 'b', patch: { name: 'Y' } }],
        {
          ...opts,
          guard: () => { throw new Error('refused') },
        }
      )
    ).rejects.toThrow('refused')
    expect(db.calls.some((c) => c.m === 'upsert')).toBe(false)
  })

  it('falls back to per-row updates when the upsert lacks a conflict target', async () => {
    const db = fakeDb([
      { data: rows },
      { data: null, error: { message: '42P10: no unique constraint matching' } },
      { data: rows[0] },
      { data: { ...rows[0], name: 'A2', updated_by: 'agent@x.com' } },
      { data: null },
    ])
    supa.from = db.from
    const out = await updateRows(
      'things', 'id',
      [
        { key: 'a', patch: { name: 'A2' } },
        { key: 'b', patch: { name: 'B2' } },
      ],
      opts
    )
    expect(out[0]).toMatchObject({ id: 'a', name: 'A2' })
    expect(out[1]).toBeNull()
    expect(db.calls.filter((c) => c.m === 'update')).toHaveLength(1)
  })

  it('pages the .in() select so >pageSize matches all merge', async () => {
    const page1 = Array.from({ length: 1000 }, (_, i) => ({ id: `k${i}` }))
    const page2 = Array.from({ length: 500 }, (_, i) => ({ id: `k${1000 + i}` }))
    const db = fakeDb([{ data: page1 }, { data: page2 }, { data: null, error: null }])
    supa.from = db.from
    const updates = Array.from({ length: 1500 }, (_, i) => ({ key: `k${i}`, patch: { v: i } }))
    const out = await updateRows('things', 'id', updates, opts)
    expect(out).toHaveLength(1500)
    expect(out.every((r) => r !== null)).toBe(true)
    expect(out[1499]).toMatchObject({ id: 'k1499', v: 1499, updated_by: 'agent@x.com' })
    const inCalls = db.calls.filter((c) => c.m === 'in')
    expect(inCalls.length).toBeGreaterThanOrEqual(3)
    expect(inCalls.every((c) => c.args[0] === 'id')).toBe(true)
    expect((inCalls[0].args[1] as unknown[]).length).toBe(500)
    expect(db.awaited()).toBeGreaterThanOrEqual(4)
  })

  it('single updates keep the direct per-row path', async () => {
    const db = fakeDb([
      { data: rows[0] },
      { data: { ...rows[0], name: 'Solo', updated_by: 'me@x.com' } },
    ])
    supa.from = db.from
    const out = await updateRow('things', 'id', 'a', { name: 'Solo' }, { actor: 'me@x.com' })
    expect(out).toMatchObject({ id: 'a', name: 'Solo', updated_by: 'me@x.com' })
    expect(db.calls.some((c) => c.m === 'upsert' || c.m === 'in')).toBe(false)
  })
})
