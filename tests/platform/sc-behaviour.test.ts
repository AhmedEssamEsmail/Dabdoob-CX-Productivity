/**
 * W2-SC-03: addBehaviourCase — admin-only append into sc_behaviour
 * (month = date's month, submitted_by = caller), duplicate (23505) answers
 * {saved:false, duplicate:true}, validation rejects before any insert.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const writes: { table: string; op: string; rows?: unknown }[] = []
  const errors: Record<string, { code?: string; message?: string } | null> = {}

  function mk(table: string) {
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    const cmp = (a: unknown, b: unknown) => {
      const as = String(a ?? '')
      const bs = String(b ?? '')
      const an = Number(as)
      const bn = Number(bs)
      if (as !== '' && bs !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) return an < bn ? -1 : an > bn ? 1 : 0
      return as < bs ? -1 : as > bs ? 1 : 0
    }
    const b: Record<string, unknown> = {
      select() { return b },
      eq(col: string, v: unknown) { filters.push((r) => cmp(r[col], v) === 0); return b },
      insert(rows: unknown) {
        writes.push({ table, op: 'insert', rows })
        const err = errors[table] || null
        return Promise.resolve({ data: err ? null : rows, error: err }) as never
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        const rows = (tables[table] || []).filter((r) => filters.every((f) => f(r)))
        return Promise.resolve({ data: rows, error: null }).then(resolve as never, reject as never)
      },
    }
    return b
  }

  return { tables, writes, errors, mk }
})

vi.mock('@/features/shared/lib/supabase', () => ({
  createClient: () => ({ from: (t: string) => h.mk(t) }),
  supabase: { from: (t: string) => h.mk(t) },
}))

vi.mock('@/features/shared/platform/identity', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/shared/platform/identity')>()
  return { ...orig, requireRole: async () => ({ email: 'admin@test', role: 'admin' }) }
})

vi.mock('@/features/shared/platform/viewas', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/shared/platform/viewas')>()
  return { ...orig, assertWritable: async () => undefined }
})

import { addBehaviourCase } from '@/features/cx-people/lib/scorecard-server'

describe('addBehaviourCase', () => {
  beforeEach(() => {
    h.writes.length = 0
    for (const k of Object.keys(h.errors)) delete h.errors[k]
  })

  it('inserts the shaped sc_behaviour row and returns saved', async () => {
    const res = await addBehaviourCase({ email: ' Agent@X.com ', date: '2026-10-05', note: '  missed QA  ' })
    expect(res).toEqual({ saved: true, month: '2026-10', date: '2026-10-05', email: 'agent@x.com' })
    const ins = h.writes.find((w) => w.table === 'sc_behaviour' && w.op === 'insert')
    expect(ins).toBeTruthy()
    expect(ins!.rows).toEqual({
      month: '2026-10', date: '2026-10-05', email: 'agent@x.com',
      note: 'missed QA', submitted_by: 'admin@test',
    })
  })

  it('rejects invalid email / date / note before any insert', async () => {
    await expect(addBehaviourCase({ email: 'nope', date: '2026-10-05', note: 'x' })).rejects.toThrow('Give a valid agent email.')
    await expect(addBehaviourCase({ email: 'a@x.com', date: '10/05/2026', note: 'x' })).rejects.toThrow('Date is yyyy-MM-dd.')
    await expect(addBehaviourCase({ email: 'a@x.com', date: '2026-10-05', note: '   ' })).rejects.toThrow('Note the behaviour in one line (1-500 chars).')
    await expect(addBehaviourCase({ email: 'a@x.com', date: '2026-10-05', note: 'n'.repeat(501) })).rejects.toThrow('Note the behaviour in one line (1-500 chars).')
    expect(h.writes.filter((w) => w.table === 'sc_behaviour')).toEqual([])
  })

  it('23505 conflict -> {saved:false, duplicate:true}; other errors -> described throw', async () => {
    h.errors.sc_behaviour = { code: '23505', message: 'duplicate key value violates unique constraint' }
    const dup = await addBehaviourCase({ email: 'a@x.com', date: '2026-10-05', note: 'x' })
    expect(dup).toEqual({ saved: false, duplicate: true })

    h.errors.sc_behaviour = { code: 'XX000', message: 'boom' }
    await expect(addBehaviourCase({ email: 'a@x.com', date: '2026-10-05', note: 'y' })).rejects.toThrow()
  })
})
