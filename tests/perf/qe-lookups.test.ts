import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory supabase double: records every from() query's ops so the test can
// assert the qe_queue_log read is day-bounded, and applies eq/gte/lt/ilike
// filters so rows outside the window behave exactly like Postgres would.
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const reads: { table: string; ops: unknown[][] }[] = []

  function mk(table: string) {
    const rec = { table, ops: [] as unknown[][] }
    reads.push(rec)
    const filters: ((r: Record<string, unknown>) => boolean)[] = []
    let patch: Record<string, unknown> | null = null
    let ins: Record<string, unknown>[] | null = null
    let ups: { rows: Record<string, unknown>[]; opts: { onConflict?: string } } | null = null
    let orderCol = ''
    let orderAsc = true
    let lim: number | null = null
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
      if (lim !== null) rows = rows.slice(0, lim)
      if (ins) {
        ;(tables[table] = tables[table] || []).push(...ins)
        return ins
      }
      if (ups) {
        const all = (tables[table] = tables[table] || [])
        const keys = String(ups.opts.onConflict || 'id').split(',').map((s) => s.trim())
        for (const r of ups.rows) {
          const hit = all.find((x) => keys.every((k) => String(x[k]) === String(r[k])))
          if (hit) Object.assign(hit, r)
          else {
            if (r.id === undefined || r.id === null) r.id = all.length + 1
            all.push(r)
          }
        }
        return ups.rows
      }
      if (patch) rows.forEach((r) => Object.assign(r, patch))
      return rows
    }
    const b: Record<string, unknown> = {
      select() { return b },
      eq(col: string, v: unknown) { rec.ops.push(['eq', col, v]); filters.push((r) => r[col] === v || String(r[col]) === String(v)); return b },
      neq(col: string, v: unknown) { rec.ops.push(['neq', col, v]); filters.push((r) => !(r[col] === v || String(r[col]) === String(v))); return b },
      is(col: string, v: unknown) { rec.ops.push(['is', col, v]); filters.push((r) => (v === null ? r[col] === null || r[col] === undefined || r[col] === '' : r[col] === v)); return b },
      ilike(col: string, v: unknown) { const n = String(v).toLowerCase(); rec.ops.push(['ilike', col, v]); filters.push((r) => String(r[col] ?? '').toLowerCase().includes(n)); return b },
      in(col: string, vs: unknown[]) { const s = (vs || []).map(String); rec.ops.push(['in', col, vs]); filters.push((r) => s.includes(String(r[col]))); return b },
      gte(col: string, v: unknown) { rec.ops.push(['gte', col, v]); return cmp(col, v, (a, x) => a >= x) },
      lt(col: string, v: unknown) { rec.ops.push(['lt', col, v]); return cmp(col, v, (a, x) => a < x) },
      order(col: string, opts?: { ascending?: boolean }) { orderCol = col; orderAsc = !opts || opts.ascending !== false; return b },
      limit(n: number) { lim = n; return b },
      range(a: number, z: number) { rangeFrom = a; rangeTo = z; return b },
      insert(rows: unknown) { ins = (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[]; return b },
      update(p: Record<string, unknown>) { patch = p; return b },
      upsert(rows: unknown, opts?: { onConflict?: string }) {
        ups = { rows: (Array.isArray(rows) ? rows : [rows]) as Record<string, unknown>[], opts: opts || {} }
        rec.ops.push(['upsert', ups.opts.onConflict || 'id'])
        return b
      },
      maybeSingle() { return Promise.resolve({ data: run()[0] || null, error: null }) },
      single() { return Promise.resolve({ data: run()[0] || null, error: null }) },
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
import { passQaQueueItem, qeQueueValues_, qeReadOutcomes_ } from '@/features/cx-quality/lib/server'

const DAY = '2026-01-05'
const NEXT = '2026-01-06'

function logRow(key: string, d: string, state: string, tid: string, agent: string) {
  return {
    key, queued_date: d, state, ticket_id: tid, agent, agent_email: 'a@dabdoob.com',
    channel: 'Email', contact_type: 'Billing', iso_week: '2026-W02', slot: '1', group: 'CX',
    tier: 'T1', subject: 's', country: 'KW', status: 'Open', last_touch: '', touches: 0,
    audited_at: '', audited_by: '', interaction: '', agent_status: '', passed_to: '',
    action_time: '', agent_status_log: '', pass_reason: '', agent_fd_id: '',
  }
}

function seed() {
  h.tables.config = [
    { key: 'admin_emails', value: 'admin@dabdoob.com' },
    { key: 'qa_engine_live', value: 'true' },
  ]
  h.tables.roster = [{ email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', active: 'true' }]
  h.tables.view_as = []
  h.tables.qa_queue = [{
    queue_id: 'Q1', queue_date: DAY, ticket_id: '101', log_key: '101|Agent One',
    agent_email: 'a@dabdoob.com', agent_name: 'Agent One', status: 'open',
    source: 'engine', started_at: '', auditor_email: '',
  }]
  h.tables.qe_queue_log = [
    logRow('101|Agent One', DAY, 'pending', '101', 'Agent One'),
    logRow('102|Agent One', DAY, 'audited', '102', 'Agent One'),
    logRow('101|Agent Two', DAY, 'pending', '101', 'Agent Two'),
    logRow('103|Agent One', NEXT, 'pending', '103', 'Agent One'),
  ]
  h.tables.qe_candidates = [{
    id: 7, queued_date: DAY, agent: 'Agent One',
    candidates: JSON.stringify([
      { ticketId: '101', channel: 'Email' },
      { ticketId: '105', channel: 'Email', contactType: 'Billing', tier: 'T1', status: 'Open', country: 'KW', subject: 's', lastTouch: '2026-01-04 09:00', touches: 1, interactionAt: '', actionAt: '', agentStatus: '', statusLog: '', group: 'CX' },
      { ticketId: '106', channel: 'Chat', contactType: 'Chat', tier: 'T2' },
    ]),
  }]
  h.reads.length = 0
  cacheClear()
}

describe('qePassAndReplace_ day-bounded log read (P-06)', () => {
  beforeEach(seed)

  it('reads only the queued_date day and picks the same replacement as the whole-table path', async () => {
    const res = await passQaQueueItem('Q1', 'customer was rude but the ticket is resolved')
    expect(res).toMatchObject({ replaced: true, ticketId: '105', channel: 'Email' })

    const logRead = h.reads.find((r) => r.table === 'qe_queue_log' && r.ops.some((o) => o[0] === 'gte'))
    expect(logRead?.ops).toContainEqual(['gte', 'queued_date', DAY])
    expect(logRead?.ops).toContainEqual(['lt', 'queued_date', NEXT])
    expect(logRead?.ops.filter((o) => o[1] === 'state')).toEqual([])

    const passed = h.tables.qe_queue_log.find((r) => r.key === '101|Agent One')
    expect(passed?.state).toBe('passed')
    const inserted = h.tables.qe_queue_log.find((r) => r.key === '105|Agent One')
    expect(inserted?.queued_date).toBe(DAY)
  })
})

describe('qeQueueValues_ / qeReadOutcomes_ lower bounds (P-06)', () => {
  beforeEach(() => {
    seed()
    h.tables.qe_queue_log.push(logRow('999|Old Agent', '2025-12-31', 'pending', '999', 'Old Agent'))
    h.tables.qe_outcomes = [
      { queued_date: '2025-12-31', ran_at: '2025-12-31 01:00:00', mode: 'day', outcomes: '{"old":1}' },
      { queued_date: DAY, ran_at: '2026-01-05 01:00:00', mode: 'day', outcomes: '{"mid":2}' },
      { queued_date: NEXT, ran_at: '2026-01-06 01:00:00', mode: 'day', outcomes: '{"new":3}' },
    ]
  })

  it('qeReadOutcomes_ pushes the bound into SQL and still drops earlier rows', async () => {
    const rows = await qeReadOutcomes_(DAY)
    expect(rows.map((r) => r.date)).toEqual([DAY, NEXT])
    expect(rows.map((r) => r.outcomes)).toEqual([{ mid: 2 }, { new: 3 }])

    const read = h.reads.find((r) => r.table === 'qe_outcomes')
    expect(read?.ops).toContainEqual(['gte', 'queued_date', DAY])
  })

  it('qeQueueValues_ returns the same desc grid for rows inside the bound', async () => {
    const grid = await qeQueueValues_(DAY)
    expect(grid[0]).toEqual(expect.arrayContaining(['Agent', 'State', 'Queued Date']))
    expect(grid).toHaveLength(5)
    expect(grid.slice(1).map((r) => r[1])).toEqual([NEXT, DAY, DAY, DAY])

    const read = h.reads.find((r) => r.table === 'qe_queue_log' && r.ops.some((o) => o[0] === 'gte' && o[1] === 'queued_date'))
    expect(read?.ops).toContainEqual(['gte', 'queued_date', DAY])
  })
})
