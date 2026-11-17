/**
 * W2-SC-01: scDailyRowsDb_ rebuilds one month's sc_daily rows from
 * prod_daily_layers (effective > raw/null per date|email) + qa_audits
 * (kind 'audit', not voided; score_final ?? score through scPct100_) +
 * roster names — no sheet reads, fcr_* stay 0.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const writes: { table: string; op: string; rows?: unknown }[] = []

  function mk(table: string) {
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    const orders: { col: string; asc: boolean }[] = []
    let rangeFrom = 0
    let rangeTo: number | null = null
    let head = false
    let writeOp: string | null = null
    let writePayload: unknown = null

    const cmp = (a: unknown, b: unknown) => {
      const as = String(a ?? '')
      const bs = String(b ?? '')
      const an = Number(as)
      const bn = Number(bs)
      if (as !== '' && bs !== '' && !Number.isNaN(an) && !Number.isNaN(bn)) return an < bn ? -1 : an > bn ? 1 : 0
      return as < bs ? -1 : as > bs ? 1 : 0
    }
    const b: Record<string, unknown> = {
      select(_cols?: unknown, opts?: { head?: boolean }) {
        if (opts && opts.head) head = true
        return b
      },
      eq(col: string, v: unknown) { filters.push((r) => cmp(r[col], v) === 0); return b },
      gte(col: string, v: unknown) { filters.push((r) => cmp(r[col], v) >= 0); return b },
      lt(col: string, v: unknown) { filters.push((r) => cmp(r[col], v) < 0); return b },
      order(col: string, opts?: { ascending?: boolean }) { orders.push({ col, asc: !opts || opts.ascending !== false }); return b },
      range(a: number, z: number) { rangeFrom = a; rangeTo = z; return b },
      delete() { writeOp = 'delete'; return b },
      insert(rows: unknown) { writeOp = 'insert'; writePayload = rows; return b },
      upsert(rows: unknown) { writeOp = 'upsert'; writePayload = rows; return b },
      then(resolve: (v: unknown) => unknown, reject?: (e: unknown) => unknown) {
        try {
          if (writeOp) {
            writes.push({ table, op: writeOp, rows: writePayload })
            return Promise.resolve({ data: null, error: null }).then(resolve as never, reject as never)
          }
          let rows = (tables[table] || []).filter((r) => filters.every((f) => f(r)))
          if (orders.length) {
            rows = rows.slice().sort((x, y) => {
              for (const o of orders) {
                const c = cmp(x[o.col], y[o.col])
                if (c !== 0) return o.asc ? c : -c
              }
              return 0
            })
          }
          if (rangeTo !== null) rows = rows.slice(rangeFrom, rangeTo + 1)
          const payload: Record<string, unknown> = { data: head ? null : rows, error: null }
          if (head) payload.count = rows.length
          return Promise.resolve(payload).then(resolve as never, reject as never)
        } catch (e) {
          return Promise.resolve({ data: null, error: e }).then(resolve as never, reject as never)
        }
      },
    }
    return b
  }

  return { tables, writes, mk }
})

vi.mock('@/features/shared/lib/supabase', () => ({
  createClient: () => ({ from: (t: string) => h.mk(t) }),
  supabase: { from: (t: string) => h.mk(t) },
}))

import { scDailyRowsDb_, scMergeFcr_, scRefreshMonth_ } from '@/features/cx-people/lib/scorecard-server'

const MONTH = '2026-10'

function layer(over: Record<string, unknown>): Record<string, unknown> {
  return {
    date: '2026-10-05', email: 'a@x.com', agent_name: 'Layer A', layer: 'raw',
    inbound_target: 100, inbound_achieved: 40, texting_target: 50, texting_achieved: 10,
    wa_target: 20, wa_achieved: 5, total_audits: 3, avg_score: 90,
    ...over,
  }
}

function audit(over: Record<string, unknown>): Record<string, unknown> {
  return {
    audit_id: 'x', agent_email: 'a@x.com', audit_date: '2026-10-05',
    kind: 'audit', status: null, score: 80, score_final: null, source: 'queue',
    ...over,
  }
}

function seed() {
  h.tables.prod_daily_layers = []
  h.tables.qa_audits = []
  h.tables.roster = []
}

describe('scDailyRowsDb_ layer rows', () => {
  beforeEach(seed)

  it('effective beats raw per date|email; raw/null fallback; month bounds applied', async () => {
    h.tables.prod_daily_layers = [
      layer({ layer: 'raw', inbound_target: 100, inbound_achieved: 40 }),
      layer({ layer: 'effective', inbound_target: 200, inbound_achieved: 90, texting_target: 60, texting_achieved: 30, wa_target: 30, wa_achieved: 15 }),
      layer({ email: 'b@x.com', date: '2026-10-06', agent_name: 'Layer B', layer: null, inbound_target: 10 }),
      layer({ email: 'c@x.com', date: '2026-11-02', layer: 'effective' }),
      layer({ email: 'd@x.com', date: '2026-09-30', layer: 'effective' }),
    ]
    h.tables.roster = [
      { email: 'a@x.com', name: 'Roster A' },
      { email: 'b@x.com', name: 'Roster B' },
    ]
    const { rows } = await scDailyRowsDb_(MONTH)
    expect(rows.length).toBe(2)
    const a = rows.find((r) => r.email === 'a@x.com')!
    expect(a.date).toBe('2026-10-05')
    expect(a.month).toBe(MONTH)
    expect(a.matrix_day).toBe(1)
    expect(a.inb_target).toBe(200) // effective won over raw's 100
    expect(a.inb_achieved).toBe(90)
    expect(a.txt_target).toBe(60)
    expect(a.wa_achieved).toBe(15)
    expect(a.name).toBe('Roster A') // roster beats agent_name
    expect(a.fcr_passed).toBe(0)
    const b = rows.find((r) => r.email === 'b@x.com')!
    expect(b.matrix_day).toBe(1)
    expect(b.inb_target).toBe(10)
    expect(b.name).toBe('Roster B')
    // sorted by date then email
    expect(rows.map((r) => r.email)).toEqual(['a@x.com', 'b@x.com'])
  })
})

describe('scDailyRowsDb_ audit aggregation', () => {
  beforeEach(seed)

  it('counts kind=audit non-voided/non-disputed rows; kind ""/absent counts; score_final ?? score via scPct100_; offqueue kept', async () => {
    h.tables.qa_audits = [
      audit({ audit_id: '1', status: null, score: 0.9, score_final: null }), // -> 90
      audit({ audit_id: '2', status: 'done', score: 80, score_final: 88 }), // -> 88
      audit({ audit_id: '3', status: 'voided', score: 50 }), // skipped
      audit({ audit_id: '4', kind: 'dispute', score: 70 }), // skipped
      audit({ audit_id: '5', status: null, source: 'offqueue', score: 0.92 }), // -> 92, kept
      audit({ audit_id: '6', agent_email: 'b@x.com', audit_date: '2026-11-05', score: 99 }), // next month, excluded
      audit({ audit_id: '7', status: 'disputed', score: 60 }), // skipped (canonical qaRollupAudits_)
      audit({ audit_id: '8', kind: '', score: 100 }), // kind '' counts as 'audit' -> 100
    ]
    const { rows } = await scDailyRowsDb_(MONTH)
    expect(rows.length).toBe(1)
    const a = rows[0]
    expect(a.email).toBe('a@x.com')
    expect(a.date).toBe('2026-10-05')
    expect(a.matrix_day).toBe(0) // audit-only key -> zero metrics
    expect(a.audits).toBe(4)
    expect(a.score_x_audits).toBe(370)
    expect(a.inb_target).toBe(0)
    expect(a.fcr_failed).toBe(0)
  })
})

describe('scDailyRowsDb_ names + union', () => {
  beforeEach(seed)

  it('audit-only agent-day gets a zero row; roster name beats layer agent_name', async () => {
    h.tables.prod_daily_layers = [
      layer({ email: 'f@x.com', date: '2026-10-07', agent_name: 'Layer F', layer: 'effective' }),
      layer({ email: 'g@x.com', date: '2026-10-08', agent_name: 'Layer G', layer: 'effective' }),
    ]
    h.tables.qa_audits = [
      audit({ audit_id: '1', agent_email: 'e@x.com', audit_date: '2026-10-07', score: 75 }),
      audit({ audit_id: '2', agent_email: 'f@x.com', audit_date: '2026-10-07', score: 60 }),
    ]
    h.tables.roster = [
      { email: 'e@x.com', name: 'Roster E' },
      { email: 'f@x.com', name: 'Roster F' },
    ]
    const { rows } = await scDailyRowsDb_(MONTH)
    expect(rows.length).toBe(3)
    const e = rows.find((r) => r.email === 'e@x.com')!
    expect(e.matrix_day).toBe(0)
    expect(e.audits).toBe(1)
    expect(e.score_x_audits).toBe(75)
    expect(e.name).toBe('Roster E')
    const f = rows.find((r) => r.email === 'f@x.com')!
    expect(f.matrix_day).toBe(1)
    expect(f.audits).toBe(1)
    expect(f.score_x_audits).toBe(60)
    expect(f.name).toBe('Roster F') // roster beats 'Layer F'
    const g = rows.find((r) => r.email === 'g@x.com')!
    expect(g.name).toBe('Layer G') // agent_name fallback when no roster row
    expect(g.audits).toBe(0)
  })
})

describe('scMergeFcr_', () => {
  const zero = (date: string, email: string, name = '') => ({
    month: MONTH, date, email, name, matrix_day: 0, inb_target: 0, inb_achieved: 0,
    txt_target: 0, txt_achieved: 0, wa_target: 0, wa_achieved: 0, audits: 0,
    score_x_audits: 0, fcr_passed: 0, fcr_failed: 0, fcr_excluded: 0,
  })

  it('stored fcr verdicts land on rebuilt rows; orphan keys kept as zero rows; sorted', () => {
    const built = [
      { ...zero('2026-10-06', 'b@x.com'), matrix_day: 1 },
      { ...zero('2026-10-05', 'a@x.com'), matrix_day: 1 },
    ]
    const stored = [
      { month: MONTH, date: '2026-10-05', email: 'a@x.com', name: 'A', fcr_passed: 2, fcr_failed: 1, fcr_excluded: 0 },
      { month: MONTH, date: '2026-10-09', email: 'old@x.com', name: 'Old Timer', fcr_passed: 0, fcr_failed: 3, fcr_excluded: 1 },
    ]
    const { rows, fcrRows } = scMergeFcr_(MONTH, built, stored)
    expect(fcrRows).toBe(7)
    const a = rows.find((r) => r.email === 'a@x.com')!
    expect(a.fcr_passed).toBe(2)
    expect(a.fcr_failed).toBe(1)
    expect(a.matrix_day).toBe(1) // rebuilt row kept its metrics
    const old = rows.find((r) => r.email === 'old@x.com')!
    expect(old.matrix_day).toBe(0)
    expect(old.fcr_failed).toBe(3)
    expect(old.fcr_excluded).toBe(1)
    expect(old.name).toBe('Old Timer')
    expect(old.audits).toBe(0)
    expect(rows.map((r) => r.date + '|' + r.email)).toEqual([
      '2026-10-05|a@x.com',
      '2026-10-06|b@x.com',
      '2026-10-09|old@x.com',
    ])
  })
})

describe('scRefreshMonth_ DB rebuild', () => {
  beforeEach(() => {
    seed()
    h.writes.length = 0
    h.tables.sc_months = []
    h.tables.sc_daily = []
    h.tables.sc_behaviour = []
  })

  it('rebuilds sc_daily from DB, preserves stored fcr_*, never writes sc_behaviour', async () => {
    h.tables.prod_daily_layers = [
      layer({ email: 'a@x.com', date: '2026-10-05', agent_name: 'Layer A', layer: 'effective' }),
    ]
    h.tables.qa_audits = [
      audit({ audit_id: '1', agent_email: 'a@x.com', audit_date: '2026-10-05', score: 80 }),
    ]
    h.tables.roster = [{ email: 'a@x.com', name: 'Roster A' }]
    h.tables.sc_daily = [
      { month: MONTH, date: '2026-10-05', email: 'a@x.com', name: 'Roster A', matrix_day: 1, fcr_passed: 2, fcr_failed: 0, fcr_excluded: 1 },
      { month: MONTH, date: '2026-10-09', email: 'old@x.com', name: 'Old Timer', matrix_day: 0, fcr_passed: 0, fcr_failed: 3, fcr_excluded: 0 },
      { month: '2026-09', date: '2026-09-30', email: 'z@x.com', name: 'Zed', matrix_day: 1, fcr_passed: 9, fcr_failed: 0, fcr_excluded: 0 },
    ]
    h.tables.sc_behaviour = [
      { month: MONTH, date: '2026-10-03', email: 'a@x.com', note: 'x' },
      { month: MONTH, date: '2026-10-04', email: 'b@x.com', note: 'y' },
      { month: '2026-09', date: '2026-09-03', email: 'c@x.com', note: 'z' },
    ]
    const res = (await scRefreshMonth_(MONTH, 'tester', {} as never)) as Record<string, unknown>
    expect(res.status).toBe('ok')
    expect(res.title).toBe('DB rebuild (prod_daily_layers + qa_audits)')
    expect(res.fcrRows).toBe(6)
    expect(res.behaviourFound).toBe(true)
    expect(res.behaviourCases).toBe(2)
    expect(res.behaviourNote).toBe('Managed via the admin behaviour form.')
    // sc_behaviour is never written by a refresh
    expect(h.writes.filter((w) => w.table === 'sc_behaviour')).toEqual([])
    // sc_daily: delete-then-insert of the merged month rows
    expect(h.writes.some((w) => w.table === 'sc_daily' && w.op === 'delete')).toBe(true)
    const ins = h.writes.find((w) => w.table === 'sc_daily' && w.op === 'insert')
    expect(ins).toBeTruthy()
    const rows = ins!.rows as Record<string, unknown>[]
    const a = rows.find((r) => r.email === 'a@x.com')!
    expect(a.matrix_day).toBe(1)
    expect(a.audits).toBe(1)
    expect(a.fcr_passed).toBe(2)
    expect(a.fcr_excluded).toBe(1)
    const old = rows.find((r) => r.email === 'old@x.com')!
    expect(old.matrix_day).toBe(0)
    expect(old.fcr_failed).toBe(3)
    expect(old.name).toBe('Old Timer')
    expect(rows.some((r) => r.email === 'z@x.com')).toBe(false) // other month's stored rows untouched
    const mUp = h.writes.find((w) => w.table === 'sc_months' && w.op === 'upsert')
    expect(mUp).toBeTruthy()
    const meta = mUp!.rows as Record<string, unknown>
    expect(meta.fcr_rows).toBe(6)
    expect(meta.fcr_dated).toBe(true) // stored verdicts exist in the fixture
    expect(typeof meta.fcr_dated).toBe('boolean')
  })

  it('upserts fcr_dated false when the refresh preserves zero stored fcr rows', async () => {
    h.tables.prod_daily_layers = [
      layer({ email: 'a@x.com', date: '2026-10-05', agent_name: 'Layer A', layer: 'effective' }),
    ]
    const res = (await scRefreshMonth_(MONTH, 'tester', {} as never)) as Record<string, unknown>
    expect(res.status).toBe('ok')
    const mUp = h.writes.find((w) => w.table === 'sc_months' && w.op === 'upsert')!
    const meta = mUp.rows as Record<string, unknown>
    expect(meta.fcr_rows).toBe(0)
    expect(meta.fcr_dated).toBe(false)
    expect(typeof meta.fcr_dated).toBe('boolean')
  })

  it('never wipes: no prod_daily_layers rows in the month -> error, no sc_daily write', async () => {
    const res = (await scRefreshMonth_(MONTH, 'tester', {} as never)) as Record<string, unknown>
    expect(res.status).toBe('error')
    expect(String(res.error)).toContain('No prod_daily_layers rows dated in ' + MONTH)
    expect(h.writes.filter((w) => w.table === 'sc_daily' && w.op === 'insert')).toEqual([])
    expect(h.writes.filter((w) => w.table === 'sc_behaviour')).toEqual([])
  })
})
