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
import { scIo_, scReadRange_ } from '@/features/cx-people/lib/scorecard-server'

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
  h.tables.kpi_behaviour_log = [
    { id: 'l1', date: '2026-01-15', email: 'a@dabdoob.com', note: 'in' },
    { id: 'l2', date: '2026-01-25', email: 'a@dabdoob.com', note: 'after-to' },
    { id: 'l3', date: '2025-12-29', email: 'a@dabdoob.com', note: 'before-pf' },
    { id: 'l4', date: '2025-12-31', email: 'b@dabdoob.com', note: 'prev-window' },
    { id: 'l5', date: null, email: 'a@dabdoob.com', note: 'undated' },
  ]
  h.tables.sc_months = [{ id: 'm1', month: '2026-01', status: 'ok' }]
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

// perf3-01: scIo_(cfg, range) prefetches [pf, to] where pf = from - spanDays,
// covering the previous comparison window; sc_months stays a whole-table read.
describe('scIo_ range-bound prefetch (perf3-01)', () => {
  // spanDays = (TO - FROM)/86400000 + 1 = 11 -> pf = FROM - 11d = 2025-12-30.
  const PF = '2025-12-30'

  beforeEach(seed)

  it('pushes gte/lte/or bounds on the three date tables and keeps sc_months unbounded', async () => {
    await scIo_({}, { from: FROM, to: TO })
    const daily = h.reads.find((r) => r.table === 'sc_daily')
    const beh = h.reads.find((r) => r.table === 'sc_behaviour')
    const log = h.reads.find((r) => r.table === 'kpi_behaviour_log')
    const months = h.reads.find((r) => r.table === 'sc_months')
    expect(daily?.ops).toContainEqual(['gte', 'date', PF])
    expect(daily?.ops).toContainEqual(['lte', 'date', TO])
    expect(beh?.ops).toContainEqual(['or', `date.is.null,date.eq.,and(date.gte.${PF},date.lte.${TO})`])
    expect(log?.ops).toContainEqual(['gte', 'date', PF])
    expect(log?.ops).toContainEqual(['lte', 'date', TO])
    expect(months).toBeTruthy()
    expect(months?.ops.some((op) => op[0] === 'gte' || op[0] === 'lte' || op[0] === 'or')).toBe(false)
  })

  it('io.readRange and behaviourLogRows match the legacy whole-table filter', async () => {
    const io = await scIo_({}, { from: FROM, to: TO })
    expect(io.readRange('sc_daily', FROM, TO)).toEqual(legacyFilter('sc_daily', FROM, TO))
    expect(io.readRange('sc_behaviour', FROM, TO)).toEqual(legacyFilter('sc_behaviour', FROM, TO))
    // behaviourLogRows is the [pf, to] prefetch: undated log rows never surface.
    expect(io.behaviourLogRows).toEqual(legacyFilter('kpi_behaviour_log', PF, TO))
    expect(io.behaviourLogRows.map((r) => r.id)).toEqual(['l1', 'l4'])
  })
})
