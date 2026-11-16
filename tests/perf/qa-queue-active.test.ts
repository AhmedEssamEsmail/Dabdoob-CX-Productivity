import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory supabase double — same pattern as tests/perf/qa-pushdown.test.ts.
// The active-toggle fixture is h.hct: the mocked readSheet returns its rows or
// throws its err, so qaActiveEmails_ can be exercised in both directions.
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const reads: { table: string; ops: unknown[][] }[] = []
  const hct: { rows?: Record<string, unknown>[]; err?: Error } = {}

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
          const d = String(a[orderCol]) < String(b[orderCol]) ? -1 : String(a[orderCol]) > String(b[orderCol]) ? 1 : 0
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
      lte(col: string, v: unknown) { rec.ops.push(['lte', col, v]); return cmp(col, v, (a, x) => a <= x) },
      or(expr: string) {
        rec.ops.push(['or', expr])
        const clauses = String(expr).split(',').map((c) => c.trim()).filter(Boolean)
        filters.push((r) => clauses.some((cl) => {
          const m = /^([^.]+)\.(is|eq|neq|gte|lte|lt|gt)\.(.*)$/.exec(cl)
          if (!m) return false
          const [, col, op, raw] = m
          const cv = r[col]
          if (op === 'is') return raw === 'null' ? cv === null || cv === undefined || cv === '' : cv === raw
          if (op === 'eq') return cv === raw || String(cv) === raw
          if (op === 'neq') return !(cv === raw || String(cv) === raw)
          const a = String(cv ?? ''), x = raw
          if (op === 'gte') return a >= x
          if (op === 'lte') return a <= x
          if (op === 'lt') return a < x
          if (op === 'gt') return a > x
          return false
        }))
        return b
      },
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

  return { tables, reads, hct, mk }
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
// HCT reads go through dqReadHct_ -> readSheet. h.hct switches between live
// rows (a@ current, b@ inactive) and a throw (fail-open -> unfiltered page).
vi.mock('@/features/shared/migration/engine', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@/features/shared/migration/engine')>()),
  readSheet: async () => {
    if (h.hct.err) throw h.hct.err
    return h.hct.rows || []
  },
}))

import { cacheClear } from '@/features/shared/platform/repo'
import { pwToday } from '@/features/shared/platform/time'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import { getQaQueuePage } from '@/features/cx-quality/lib/server'

const A = 'a@dabdoob.com'
const B = 'b@dabdoob.com'
const SENTINEL = '(no lead)'

const HCT = [
  { 'employee name': 'Agent A', email: A, status: 'current', lwd: '' },
  { 'employee name': 'Agent B', email: B, status: 'resigned', lwd: '2026-01-10' },
]

function qrow(id: string, over: Record<string, unknown> = {}) {
  return {
    queue_id: id, queue_date: pwToday(), status: 'open', agent_email: A, agent_name: 'Agent A',
    ticket_id: '10' + id.length, channel: 'Email', contact_type: 'General', source: '', audit_type: '',
    reference: '', interaction_at: pwToday() + ' 09:00', action_at: '', agent_status: '',
    agent_status_log: '', ticket_status: 'open', pass_reason: '', pass_note: '', passed_by: '',
    passed_at: '', tl_email: '', tier: '', auditor_email: '', started_at: '', audit_id: '',
    requested_by: '', requested_at: '', request_reason: '', ...over,
  }
}

function seed() {
  h.tables.config = [{ key: 'admin_emails', value: 'admin@dabdoob.com' }]
  h.tables.roster = [
    { email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', active: 'true', position: 'Customer Experience Manager' },
    { email: A, name: 'Agent A', role: 'agent', active: 'true', position: 'Customer Experience Agent' },
    // b@ is roster-active (still a quota agent) but HCT-inactive (resigned + lwd).
    { email: B, name: 'Agent B', role: 'agent', active: 'true', position: 'Customer Experience Agent' },
  ]
  h.tables.qa_queue = [
    qrow('a-open'),
    qrow('b-open', { agent_email: B, agent_name: 'Agent B' }),
    qrow('sent', { agent_email: SENTINEL, agent_name: '', ticket_id: '999' }),
    qrow('a-pass', { status: 'passed', queue_date: dqAddDays_(pwToday(), -1), passed_at: pwToday() + 'T10:00:00Z' }),
    qrow('b-pass', { agent_email: B, agent_name: 'Agent B', status: 'passed', queue_date: dqAddDays_(pwToday(), -1), passed_at: pwToday() + 'T10:00:00Z' }),
    qrow('a-req', { source: 'request', requested_by: 'admin@dabdoob.com', request_reason: 'please audit this one' }),
    qrow('b-req', { agent_email: B, agent_name: 'Agent B', source: 'request', requested_by: 'admin@dabdoob.com', request_reason: 'please audit this one' }),
  ]
  h.tables.qa_audits = []
  h.tables.qa_forms = []
  h.tables.qa_ctls = []
  h.hct = { rows: HCT }
  h.reads.length = 0
  cacheClear()
}

const emailsOf = (rows: Record<string, unknown>[]) => rows.map((r) => String(r.agentEmail ?? r.agent_email ?? ''))
const idsOf = (rows: Record<string, unknown>[]) => rows.map((r) => String(r.queueId))

type Page = Record<string, unknown> & {
  rows: Record<string, unknown>[]
  passed: Record<string, unknown>[]
  requests: Record<string, unknown>[]
  quota: Record<string, unknown>[]
  quotaWeeks: { weekStart: string; rows: Record<string, unknown>[] }[]
}

describe('getQaQueuePage active filter (S03 / qa-2-1)', () => {
  beforeEach(seed)

  it('active mode (default + explicit) drops the HCT-inactive agent but keeps the sentinel key', async () => {
    for (const mode of [undefined, 'active']) {
      const page = (await getQaQueuePage('*', mode as string)) as Page
      const rowEmails = emailsOf(page.rows)
      expect(rowEmails).toContain(A)
      expect(rowEmails).toContain(SENTINEL)
      expect(rowEmails).not.toContain(B)

      expect(idsOf(page.passed)).toContain('a-pass')
      expect(idsOf(page.passed)).not.toContain('b-pass')

      const reqEmails = emailsOf(page.requests)
      expect(reqEmails).toContain(A)
      expect(reqEmails).not.toContain(B)
    }
  })

  it("mode 'all' returns the inactive agent's rows, passed items and requests", async () => {
    const page = (await getQaQueuePage('*', 'all')) as Page
    expect(emailsOf(page.rows)).toContain(B)
    expect(idsOf(page.passed)).toContain('b-pass')
    expect(emailsOf(page.requests)).toContain(B)
  })

  it('filters b@ out of quota and every quotaWeeks[].rows only in active mode', async () => {
    const active = (await getQaQueuePage('*', 'active')) as Page
    for (const w of active.quotaWeeks) {
      const emails = w.rows.map((r) => String(r.email))
      expect(emails).toContain(A)
      expect(emails).not.toContain(B)
    }
    expect(active.quota.map((r) => String(r.email))).not.toContain(B)

    const all = (await getQaQueuePage('*', 'all')) as Page
    for (const w of all.quotaWeeks) expect(w.rows.map((r) => String(r.email))).toContain(B)
    expect(all.quota.map((r) => String(r.email))).toContain(B)
  })

  it('fails open when the HCT sheet read throws — page is unfiltered', async () => {
    h.hct = { err: new Error('test: sheet down') }
    const page = (await getQaQueuePage('*', 'active')) as Page
    expect(emailsOf(page.rows)).toContain(B)
    expect(idsOf(page.passed)).toContain('b-pass')
    expect(emailsOf(page.requests)).toContain(B)
    expect(page.quota.map((r) => String(r.email))).toContain(B)
  })

  it('leaves auditors / mine / untouched across modes', async () => {
    const active = (await getQaQueuePage('*', 'active')) as Page
    const all = (await getQaQueuePage('*', 'all')) as Page
    expect(active.mine).toEqual(all.mine)
    expect(active.auditors).toEqual(all.auditors)
    expect(active.unmatched).toEqual(all.unmatched)
  })
})
