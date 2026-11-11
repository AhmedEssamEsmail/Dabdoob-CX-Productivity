import { beforeEach, describe, expect, it, vi } from 'vitest'

// Minimal supabase double for the S09-01 bulk-upsert leaf: records every
// write op (insert/update/upsert) and can fail the next upsert with a
// PostgREST-style error so the 42P10 fallback path is exercised.
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const writes: { table: string; op: string; rows?: unknown; opts?: unknown }[] = []
  let upsertError: { message: string; code?: string } | null = null

  function mk(table: string) {
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    let patch: Record<string, unknown> | null = null
    let ins: Record<string, unknown>[] | null = null
    let ups: { rows: Record<string, unknown>[]; opts: { onConflict?: string } } | null = null
    let lim: number | null = null
    let rangeFrom = 0
    let rangeTo: number | null = null

    function run() {
      let rows = (tables[table] || []).filter((r) => filters.every((f) => f(r)))
      if (rangeTo !== null) rows = rows.slice(rangeFrom, rangeTo + 1)
      if (lim !== null) rows = rows.slice(0, lim)
      if (ins) {
        ;(tables[table] = tables[table] || []).push(...ins)
        return ins
      }
      if (ups) {
        const cols = String(ups.opts.onConflict || '').split(',').map((c) => c.trim()).filter(Boolean)
        for (const row of ups.rows) {
          const hit = cols.length
            ? (tables[table] || []).find((r) => cols.every((c) => String(r[c]) === String(row[c])))
            : undefined
          if (hit) Object.assign(hit, row)
          else (tables[table] = tables[table] || []).push({ ...row })
        }
        return ups.rows
      }
      if (patch) rows.forEach((r) => Object.assign(r, patch))
      return rows
    }
    const b: Record<string, unknown> = {
      select() { return b },
      eq(col: string, v: unknown) { filters.push((r) => r[col] === v || String(r[col]) === String(v)); return b },
      neq(col: string, v: unknown) { filters.push((r) => !(r[col] === v || String(r[col]) === String(v))); return b },
      is(col: string, v: unknown) { filters.push((r) => (v === null ? r[col] === null || r[col] === undefined || r[col] === '' : r[col] === v)); return b },
      in(col: string, vs: unknown[]) { const s = (vs || []).map(String); filters.push((r) => s.includes(String(r[col]))); return b },
      gte(col: string, v: unknown) { filters.push((r) => String(r[col] ?? '') >= String(v)); return b },
      lte(col: string, v: unknown) { filters.push((r) => String(r[col] ?? '') <= String(v)); return b },
      or() { return b },
      order() { return b },
      limit(n: number) { lim = n; return b },
      range(a: number, z: number) { rangeFrom = a; rangeTo = z; return b },
      insert(rows: unknown) { ins = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]; writes.push({ table, op: 'insert', rows: ins }); return b },
      update(p: Record<string, unknown>) { patch = p; writes.push({ table, op: 'update', rows: p }); return b },
      upsert(rows: unknown, opts?: { onConflict?: string }) {
        ups = { rows: (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[], opts: opts || {} }
        writes.push({ table, op: 'upsert', rows: ups.rows, opts: ups.opts })
        return b
      },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        const finish = (): Promise<unknown> => {
          try {
            if (ups && upsertError) {
              const err = upsertError
              upsertError = null
              return Promise.resolve({ data: null, error: err }).then(resolve as never, reject as never)
            }
            return Promise.resolve({ data: run(), error: null }).then(resolve as never, reject as never)
          } catch (e) {
            return Promise.resolve({ data: null, error: e }).then(resolve as never, reject as never)
          }
        }
        return finish()
      },
    }
    return b
  }

  return {
    tables, writes,
    failNextUpsert(err: { message: string; code?: string }) { upsertError = err },
    mk,
  }
})

vi.mock('@/features/shared/lib/supabase', () => ({
  createClient: () => ({ from: (t: string) => h.mk(t) }),
  supabase: { from: (t: string) => h.mk(t) },
}))
vi.mock('@/features/shared/lib/auth', async () => ({
  createAuthClient: async () => ({
    auth: {
      getClaims: async () => ({ data: { claims: { email: 'admin@dabdoob.com' } }, error: null }),
      getUser: async () => ({ data: { user: { email: 'admin@dabdoob.com' } }, error: null }),
    },
  }),
  requireRole: async (roles: string[]) => (await import('@/features/shared/platform/identity')).requireRole(roles),
}))

import { cacheClear } from '@/features/shared/platform/repo'
import { backfillQaSampleBasis } from '@/features/cx-quality/lib/server'

function auditRow(over: Record<string, unknown>) {
  return {
    id: 0, audit_id: 'A' + Math.random().toString(36).slice(2, 8), kind: 'audit', status: 'acknowledged',
    agent_email: 'a@dabdoob.com', auditor_email: 'admin@dabdoob.com', channel: 'Email',
    audit_date: '2026-01-10', queue_id: 'Q1', source: '', sample_basis: '', ...over,
  }
}

function seed() {
  h.tables.config = [{ key: 'admin_emails', value: 'admin@dabdoob.com' }]
  h.tables.roster = [{ email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', active: 'true' }]
  h.tables.qa_audits = [
    auditRow({ audit_id: 'b1' }),
    auditRow({ audit_id: 'b2', queue_id: 'Q2' }),
    auditRow({ audit_id: 'done', sample_basis: 'random' }),
    auditRow({ audit_id: 'cal', kind: 'calibration' }),
  ]
  h.writes.length = 0
  cacheClear()
}

const auditWrites = (op: string) => h.writes.filter((w) => w.table === 'qa_audits' && w.op === op)

describe('qaUpsertIn_ bulk upsert + 42P10 fallback (S09-01)', () => {
  beforeEach(seed)

  it('writes N rows with ONE upsert onConflict call', async () => {
    const msg = await backfillQaSampleBasis()
    expect(msg).toContain('Sample basis written')

    const ups = auditWrites('upsert')
    expect(ups.length).toBe(1)
    expect((ups[0].rows as unknown[]).length).toBe(2)
    expect(ups[0].opts).toEqual({ onConflict: 'audit_id' })
    expect(auditWrites('insert').length).toBe(0)
    expect(auditWrites('update').length).toBe(0)
    expect(h.tables.qa_audits.find((r) => r.audit_id === 'b1')?.sample_basis).toBe('random')
  })

  it('falls back to the per-row loop on a 42P10-class upsert error', async () => {
    h.tables.qa_audits.push(auditRow({ audit_id: 'b3' }))
    h.failNextUpsert({ message: 'there is no unique or exclusion constraint matching the ON CONFLICT specification', code: '42P10' })

    const msg = await backfillQaSampleBasis()
    expect(msg).toContain('Sample basis written')

    expect(auditWrites('upsert').length).toBe(1)
    const upd = auditWrites('update')
    const ins = auditWrites('insert')
    expect(upd.length + ins.length).toBe(3)
    // existing rows update, the new one inserts
    expect(h.tables.qa_audits.find((r) => r.audit_id === 'b3')?.sample_basis).toBe('random')
  })

  it('propagates non-constraint upsert errors via described', async () => {
    h.failNextUpsert({ message: 'connection reset by peer', code: '08006' })
    await expect(backfillQaSampleBasis()).rejects.toThrow(/connection reset by peer/)
    expect(auditWrites('insert').length).toBe(0)
    expect(auditWrites('update').length).toBe(0)
  })
})
