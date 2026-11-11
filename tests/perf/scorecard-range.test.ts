import { beforeEach, describe, expect, it, vi } from 'vitest'

// Own supabase double (hub-fakes .or() is a no-op): applies eq/gte/lte and the
// `date.is.null,date.eq.,and(date.gte.X,date.lte.Y)` or-form so pushed predicates behave
// like Postgres, and records every op for assertions.
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const reads: { table: string; ops: unknown[][] }[] = []

  function mk(table: string) {
    const rec = { table, ops: [] as unknown[][] }
    reads.push(rec)
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    let orderCol = ''
    let orderAsc = true
    let rangeFrom = 0
    let rangeTo: number | null = null

    const cmp = (col: string, v: unknown, f: (a: string, b: string) => boolean) => {
      filters.push((r) => f(String(r[col] ?? ''), String(v)))
      return b
    }
    function run() {
      let rows = (tables[table] || []).filter((r) => filters.every((f) => f(r)))
      if (orderCol) {
        rows = rows.slice().sort((a, b2) => {
          const d = String(a[orderCol]) < String(b2[orderCol]) ? -1 : String(a[orderCol]) > String(b2[orderCol]) ? 1 : 0
          return orderAsc ? d : -d
        })
      }
      if (rangeTo !== null) rows = rows.slice(rangeFrom, rangeTo + 1)
      return rows
    }
    const b: Record<string, unknown> = {
      select() { return b },
      eq(col: string, v: unknown) { rec.ops.push(['eq', col, v]); filters.push((r) => r[col] === v || String(r[col]) === String(v)); return b },
      is(col: string, v: unknown) { rec.ops.push(['is', col, v]); filters.push((r) => (v === null ? r[col] == null : r[col] === v)); return b },
      gte(col: string, v: unknown) { rec.ops.push(['gte', col, v]); return cmp(col, v, (a, x) => a >= x) },
      lte(col: string, v: unknown) { rec.ops.push(['lte', col, v]); return cmp(col, v, (a, x) => a <= x) },
      or(expr: string) {
        rec.ops.push(['or', expr])
        const m = /^date\.is\.null,date\.eq\.,and\(date\.gte\.([^,]+),date\.lte\.([^)]+)\)$/.exec(expr)
        if (!m) throw new Error('unsupported or() in test double: ' + expr)
        const [, lo, hi] = m
        filters.push((r) => {
          const d = r.date
          if (d === null || d === undefined || d === '') return true
          const s = String(d)
          return s >= lo && s <= hi
        })
        return b
      },
      order(col: string, opts?: { ascending?: boolean }) { orderCol = col; orderAsc = !opts || opts.ascending !== false; return b },
      range(a: number, z: number) { rangeFrom = a; rangeTo = z; return b },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          return Promise.resolve({ data: run(), error: null }).then(resolve as never, reject as never)
        } catch (e) {
          return Promise.resolve({ data: null, error: e }).then(resolve as never, reject as never)
        }
      },
    }
    return b
  }

  return { tables, reads, mk }
})

vi.mock('@/features/shared/lib/supabase', () => ({
  createClient: () => ({ from: (t: string) => h.mk(t) }),
  supabase: { from: (t: string) => h.mk(t) },
}))

import { dqKeyPart_ } from '@/features/shared/lib/adapters'
import { scReadRange_ } from '@/features/cx-people/lib/scorecard-server'

const FROM = '2026-01-10'
const TO = '2026-01-20'

// Local re-implementation of the pre-pushdown whole-table filter (the parity oracle).
function legacyFilter(name: string, from: string, to: string) {
  return (h.tables[name] || []).filter((r) => {
    const d = dqKeyPart_('date', r.date)
    return d === '' ? name === 'sc_behaviour' : d >= from && d <= to
  })
}

function seed() {
  h.tables.sc_daily = [
    { id: 'd1', date: '2026-01-10', email: 'a@dabdoob.com', prod: 1 },
    { id: 'd2', date: '2026-01-15', email: 'a@dabdoob.com', prod: 2 },
    { id: 'd3', date: '2026-01-20', email: 'b@dabdoob.com', prod: 3 },
    { id: 'd4', date: '2026-01-09', email: 'a@dabdoob.com', prod: 4 },
    { id: 'd5', date: '2026-01-21', email: 'b@dabdoob.com', prod: 5 },
    { id: 'd6', date: 'not-a-date', email: 'a@dabdoob.com', prod: 6 },
    { id: 'd7', date: null, email: 'a@dabdoob.com', prod: 7 },
  ]
  h.tables.sc_behaviour = [
    { id: 'b1', date: '2026-01-12', email: 'a@dabdoob.com', kpi: 'x' },
    { id: 'b2', date: '2026-01-25', email: 'a@dabdoob.com', kpi: 'y' },
    { id: 'b3', date: '', email: 'a@dabdoob.com', kpi: 'undated' },
    { id: 'b4', date: '2026-01-01', email: 'b@dabdoob.com', kpi: 'edge-old' },
  ]
  h.reads.length = 0
}

describe('scReadRange_ date pushdown (S03-01)', () => {
  beforeEach(seed)

  it('sc_daily pushes date gte/lte and matches the legacy whole-table filter', async () => {
    const rows = await scReadRange_('sc_daily', FROM, TO)
    const read = h.reads.find((r) => r.table === 'sc_daily')
    expect(read?.ops).toContainEqual(['gte', 'date', FROM])
    expect(read?.ops).toContainEqual(['lte', 'date', TO])
    expect(rows).toEqual(legacyFilter('sc_daily', FROM, TO))
    expect(rows.map((r) => r.id)).toEqual(['d1', 'd2', 'd3'])
  })

  it('sc_behaviour pushes the or() form and keeps undated rows like the legacy filter', async () => {
    const rows = await scReadRange_('sc_behaviour', FROM, TO)
    const read = h.reads.find((r) => r.table === 'sc_behaviour')
    expect(read?.ops).toContainEqual(['or', `date.is.null,date.eq.,and(date.gte.${FROM},date.lte.${TO})`])
    expect(rows).toEqual(legacyFilter('sc_behaviour', FROM, TO))
    expect(rows.map((r) => r.id)).toEqual(['b1', 'b3'])
  })
})
