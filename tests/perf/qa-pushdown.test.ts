import { beforeEach, describe, expect, it, vi } from 'vitest'

// In-memory supabase double shared by the S08 pushdown leaves: records every
// from() query's ops and applies eq/in/is/gte/lte filters so rows outside a
// pushed predicate behave exactly like Postgres would.
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const reads: { table: string; ops: unknown[][] }[] = []
  const holds = new Set<string>()
  const heldStarted: string[] = []
  let releaseHeld: () => void = () => {}
  const heldGate = new Promise<void>((r) => {
    releaseHeld = r
  })

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
        const finish = (): Promise<unknown> => {
          try {
            return Promise.resolve({ data: run(), error: null }).then(resolve as never, reject as never)
          } catch (e) {
            return Promise.resolve({ data: null, error: e }).then(resolve as never, reject as never)
          }
        }
        if (holds.has(table)) {
          heldStarted.push(table)
          return heldGate.then(() => finish())
        }
        return finish()
      },
    }
    return b
  }

  return { tables, reads, holds, heldStarted, releaseHeld: () => releaseHeld(), mk }
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
import { pwToday } from '@/features/shared/platform/time'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import { backfillQaInteractionDates, backfillQaSampleBasis, getQaAnalyticsAudits, getQaAnalyticsPage, getQaKbGapsPage, getQaMyAuditsPage, getQaMyAuditorKpis, getQaScoresPage, qaCtlReminders, requestQaAudit, resendQaAuditEmail } from '@/features/cx-quality/lib/server'
import { qaAnalytics_, qaDeriveBasis_, qaDrill_, qaScoresRange_ } from '@/features/cx-quality/lib/analytics'
import { qaAuditorKpis_, qaForms_, qaWhen_ } from '@/features/cx-quality/lib/core'
import { qeLocal_, qeQuotaFor_, qeSettingsFrom_, qeWeekKeyFor_ } from '@/features/cx-quality/lib/engine'
import { QA_REQUEST_OPEN, qaPeriods_, qaTextTime_ } from '@/features/cx-quality/lib/pure'
import { normEmail } from '@/features/shared/platform/identity'

const FROM = '2026-01-01'
const TO = '2026-01-31'

const NAMES: Record<string, string> = { 'a@dabdoob.com': 'Agent A', 'b@dabdoob.com': 'Agent B', 'admin@dabdoob.com': 'Admin' }
const nameOf = (e: string) => NAMES[e] || e

function auditRow(over: Record<string, unknown>) {
  return {
    id: 0, audit_id: 'A' + Math.random().toString(36).slice(2, 8), kind: 'audit', status: 'acknowledged',
    agent_email: 'a@dabdoob.com', auditor_email: 'admin@dabdoob.com', channel: 'Email',
    audit_date: '2026-01-10', interaction_at: '', sample_basis: 'random', source: '', queue_id: '',
    score: 80, score_final: '', ticket_id: '100', fatal: '', ...over,
  }
}

function seed() {
  h.tables.config = [{ key: 'admin_emails', value: 'admin@dabdoob.com' }]
  h.tables.roster = [
    { email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', active: 'true' },
    { email: 'a@dabdoob.com', name: 'Agent A', role: 'agent', active: 'true' },
    { email: 'b@dabdoob.com', name: 'Agent B', role: 'agent', active: 'true' },
  ]
  h.tables.qa_audits = [
    auditRow({ audit_id: 'in1', audit_date: '2026-01-05', score: 80, interaction_at: "'2026-01-05 09:30" }),
    auditRow({ audit_id: 'in2', audit_date: '2026-01-20', score: 90, agent_email: 'b@dabdoob.com', interaction_at: "'2026-01-20" }),
    auditRow({ audit_id: 'in3', audit_date: '2026-01-31', score: 70, interaction_at: '' }),
    auditRow({ audit_id: 'out-old', audit_date: '2025-12-15', score: 100 }),
    auditRow({ audit_id: 'out-new', audit_date: '2026-02-10', score: 100 }),
    auditRow({ audit_id: 'blank-inter', audit_date: '2026-01-12', score: 60, interaction_at: '' }),
    auditRow({ audit_id: 'cal', kind: 'calibration', audit_date: '2026-01-15', score: 50 }),
  ]
  h.reads.length = 0
  cacheClear()
}

const auditReads = () => h.reads.filter((r) => r.table === 'qa_audits')
const stripVolatile = (o: Record<string, unknown>) => {
  const rest: Record<string, unknown> = { ...o }
  delete rest.asOf
  delete rest.cached
  return rest
}

describe('qaRowsWhere_ lte + readAllPaged (S08-01)', () => {
  beforeEach(seed)

  it('audit basis pushes audit_date gte+lte and matches the whole-table parity', async () => {
    const res = await getQaScoresPage(FROM, TO, 'audit')
    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['gte', 'audit_date', '2025-12-01'])
    expect(read?.ops).toContainEqual(['lte', 'audit_date', TO])

    const expected = qaScoresRange_(h.tables.qa_audits, FROM, TO, { basis: 'audit', weekStartsOn: 0, nameOf })
    expect(stripVolatile(res)).toEqual(expected)
  })

  it('interaction basis stays unbounded and returns apostrophe/blank interaction_at rows identically', async () => {
    const res = await getQaScoresPage(FROM, TO, 'interaction')
    for (const read of auditReads()) {
      expect(read.ops.filter((o) => o[1] === 'audit_date')).toEqual([])
    }

    const expected = qaScoresRange_(h.tables.qa_audits, FROM, TO, { basis: 'interaction', weekStartsOn: 0, nameOf })
    expect(stripVolatile(res)).toEqual(expected)
  })

  it('pages through readAllPaged so >1000 rows are not truncated', async () => {
    h.tables.qa_audits = Array.from({ length: 1005 }, (_, i) =>
      auditRow({ audit_id: 'p' + i, audit_date: '2026-01-10', score: 80 + (i % 10), interaction_at: "'2026-01-10 08:00" })
    )
    h.reads.length = 0
    cacheClear()

    const res = await getQaScoresPage(FROM, TO, 'audit')
    expect(auditReads().length).toBeGreaterThanOrEqual(2)
    const expected = qaScoresRange_(h.tables.qa_audits, FROM, TO, { basis: 'audit', weekStartsOn: 0, nameOf })
    expect(stripVolatile(res)).toEqual(expected)
  })
})

const day = (off: number) => {
  const [y, m, d] = pwToday().split('-').map(Number)
  return new Date(Date.UTC(y, m - 1, d + off)).toISOString().slice(0, 10)
}

describe('kb-gaps myAudits pushdown (S08-02)', () => {
  beforeEach(seed)

  it('pushes kind+auditor_email eq and audit_date gte; output matches whole-table parity', async () => {
    const since = dqAddDays_(pwToday(), -14)
    h.tables.qa_audits = [
      auditRow({ audit_id: 'mine-new', auditor_email: 'admin@dabdoob.com', audit_date: day(0), submitted_at: '2026-01-20T10:00:00Z', score: 90 }),
      auditRow({ audit_id: 'mine-edge', auditor_email: 'admin@dabdoob.com', audit_date: since, submitted_at: '2026-01-19T10:00:00Z', score: 70 }),
      auditRow({ audit_id: 'mine-old', auditor_email: 'admin@dabdoob.com', audit_date: day(-30), submitted_at: '2026-01-18T10:00:00Z', score: 60 }),
      auditRow({ audit_id: 'other', auditor_email: 'a@dabdoob.com', audit_date: day(0), submitted_at: '2026-01-21T10:00:00Z', score: 80 }),
      auditRow({ audit_id: 'cal', kind: 'calibration', auditor_email: 'admin@dabdoob.com', audit_date: day(0), submitted_at: '2026-01-22T10:00:00Z', score: 50 }),
    ]
    h.reads.length = 0
    cacheClear()

    const res = (await getQaKbGapsPage()) as { myAudits: Record<string, unknown>[] }
    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['eq', 'kind', 'audit'])
    expect(read?.ops).toContainEqual(['eq', 'auditor_email', 'admin@dabdoob.com'])
    expect(read?.ops).toContainEqual(['gte', 'audit_date', since])

    const expected = h.tables.qa_audits
      .filter((a) => a.kind === 'audit' && String(a.auditor_email).trim().toLowerCase() === 'admin@dabdoob.com' && String(a.audit_date) >= since)
      .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
      .map((a) => ({ auditId: String(a.audit_id), ticketId: '100', agentName: 'Agent A', auditDate: String(a.audit_date), score: Number(a.score) }))
    expect(res.myAudits).toEqual(expected)
    expect(res.myAudits.map((m) => m.auditId)).toEqual(['mine-new', 'mine-edge'])
  })
})

describe('auditor KPIs pushdown + Promise.all (S08-03)', () => {
  beforeEach(seed)

  it('bounds audits+disputes by auditor_email; KPI card matches whole-table parity', async () => {
    h.tables.qa_audits = [
      auditRow({ audit_id: 'k1', auditor_email: 'admin@dabdoob.com', audit_date: '2026-01-05', submitted_at: '2026-01-06T10:00:00Z', score: 80 }),
      auditRow({ audit_id: 'k2', auditor_email: 'admin@dabdoob.com', audit_date: '2026-01-20', submitted_at: '2026-01-21T10:00:00Z', score: 90 }),
      auditRow({ audit_id: 'k3', auditor_email: 'admin@dabdoob.com', audit_date: '2025-12-20', submitted_at: '2025-12-21T10:00:00Z', score: 70 }),
      auditRow({ audit_id: 'k4', kind: 'calibration', auditor_email: 'admin@dabdoob.com', audit_date: '2026-01-15', score: 50 }),
      auditRow({ audit_id: 'other', auditor_email: 'a@dabdoob.com', audit_date: '2026-01-10', submitted_at: '2026-01-11T10:00:00Z', score: 60 }),
    ]
    h.tables.qa_disputes = [
      { dispute_id: 'd1', audit_id: 'k1', auditor_email: 'admin@dabdoob.com', status: 'decided', decision: 'upheld', raised_date: '2026-01-07', decided_at: '2026-01-08' },
      { dispute_id: 'd2', audit_id: 'k2', auditor_email: 'admin@dabdoob.com', status: 'open', raised_date: '2026-01-22' },
      { dispute_id: 'd3', audit_id: 'other', auditor_email: 'a@dabdoob.com', status: 'open', raised_date: '2026-01-12' },
    ]
    h.tables.qa_calibrations = [
      { calibration_id: 'c1', auditor_email: 'admin@dabdoob.com', month: '2026-01', status: 'done', alignment_pct: '85' },
    ]
    h.tables.qa_kb_gaps = [
      { gap_id: 'g1', auditor_email: 'admin@dabdoob.com', created_date: '2026-01-09', same_day: 'true' },
      { gap_id: 'g2', auditor_email: 'a@dabdoob.com', created_date: '2026-01-09', same_day: 'false' },
    ]
    h.reads.length = 0
    cacheClear()

    const res = (await getQaMyAuditorKpis('2026-01')) as Record<string, unknown>

    const auditReadsKpi = auditReads()
    expect(auditReadsKpi.length).toBe(1)
    expect(auditReadsKpi[0].ops).toContainEqual(['eq', 'auditor_email', 'admin@dabdoob.com'])
    const dispReads = h.reads.filter((r) => r.table === 'qa_disputes')
    expect(dispReads.length).toBe(2)
    for (const r of dispReads) expect(r.ops).toContainEqual(['eq', 'auditor_email', 'admin@dabdoob.com'])

    const k = ((qaAuditorKpis_(h.tables.qa_audits, h.tables.qa_disputes, h.tables.qa_calibrations, h.tables.qa_kb_gaps, '2026-01') as Record<string, Record<string, unknown>>)['admin@dabdoob.com'] || {}) as Record<string, unknown>
    expect(res.audits).toBe(k.audits)
    expect(res.disputes).toBe(k.disputes)
    expect(res.disputesUpheld).toBe(k.upheld)
    expect(res.disputesOpen).toBe(k.open)
    expect(res.disputePct).toBe(k.disputePct)
    expect(res.alignmentPct).toBe(k.alignmentPct)
    expect(res.calibrations).toBe(k.calibrations)
    expect(res.kbGaps).toBe(k.kbGaps)
    expect(res.kbSameDay).toBe(k.kbSameDay)

    const S = qeSettingsFrom_({})
    const weeks: Record<string, number> = {}
    h.tables.qa_audits.forEach((a) => {
      if (String(a.kind || 'audit') !== 'audit' || normEmail(a.auditor_email) !== 'admin@dabdoob.com' || String(a.audit_date).slice(0, 7) !== '2026-01') return
      const p = String(a.audit_date).split('-').map(Number)
      const w = String(qeWeekKeyFor_(qeLocal_(p[0], p[1] - 1, p[2], 12), S)).slice(1)
      weeks[w] = (weeks[w] || 0) + 1
    })
    expect(res.weeks).toEqual(Object.keys(weeks).sort().map((w) => ({ weekStart: w, audits: weeks[w] })))

    const months: Record<string, boolean> = {}
    h.tables.qa_audits.forEach((a) => {
      if (normEmail(a.auditor_email) === 'admin@dabdoob.com') months[String(a.audit_date).slice(0, 7)] = true
    })
    months[pwToday().slice(0, 7)] = true
    expect(res.months).toEqual(Object.keys(months).filter((m) => /^\d{4}-\d{2}$/.test(m)).sort().reverse())

    const since = dqAddDays_(pwToday(), -90)
    const dispBy: Record<string, Record<string, unknown>> = {}
    h.tables.qa_disputes.forEach((d) => {
      if (normEmail(d.auditor_email) === 'admin@dabdoob.com') dispBy[String(d.audit_id)] = d
    })
    const ids = h.tables.qa_audits
      .filter((a) => {
        if (String(a.kind || 'audit') !== 'audit' || normEmail(a.auditor_email) !== 'admin@dabdoob.com') return false
        const d = dispBy[String(a.audit_id)]
        return String(a.audit_date) >= since || (!!d && (d.status === 'open' || d.status === 'escalated'))
      })
      .sort((a, b) => String(b.submitted_at).localeCompare(String(a.submitted_at)))
      .slice(0, 300)
      .map((a) => String(a.audit_id))
    expect((res.myAudits as { auditId: string }[]).map((m) => m.auditId)).toEqual(ids)
  })
})

describe('analytics reads Promise.all, no pushdown (S08-04)', () => {
  beforeEach(seed)

  it('all seven reads start before any resolves; output matches whole-table qaAnalytics_', async () => {
    h.tables.qa_audits = h.tables.qa_audits.map((a) => (a.audit_id === 'in1' ? { ...a, queue_id: 'Q1' } : a))
    h.tables.qa_forms = []
    h.tables.qa_disputes = [
      { dispute_id: 'd1', audit_id: 'in1', auditor_email: 'admin@dabdoob.com', status: 'decided', decision: 'upheld', raised_date: '2026-01-07', decided_at: '2026-01-08' },
      { dispute_id: 'd2', audit_id: 'in2', auditor_email: 'a@dabdoob.com', status: 'open', raised_date: '2026-01-22' },
    ]
    h.tables.qa_ctls = [
      { ctl_id: 'c1', audit_id: 'in1', agent_email: 'a@dabdoob.com', status: 'open', opened_date: '2026-01-11' },
      { ctl_id: 'c2', audit_id: 'in3', agent_email: 'b@dabdoob.com', status: 'closed', opened_date: '2026-02-01' },
    ]
    h.tables.qa_calibrations = [{ calibration_id: 'c1', auditor_email: 'admin@dabdoob.com', month: '2026-01', status: 'done', alignment_pct: '85' }]
    h.tables.qa_kb_gaps = [{ gap_id: 'g1', auditor_email: 'admin@dabdoob.com', created_date: '2026-01-09', same_day: 'true' }]
    h.tables.qa_volume = []
    h.tables.qa_queue = [{ queue_id: 'Q1', interaction_at: '2026-01-10 08:00', ticket_id: '100', agent_email: 'a@dabdoob.com', status: 'done' }]
    h.reads.length = 0
    cacheClear()

    const HELD = ['qa_audits', 'qa_forms', 'qa_disputes', 'qa_ctls', 'qa_calibrations', 'qa_kb_gaps', 'qa_volume']
    h.holds.clear()
    h.heldStarted.length = 0
    HELD.forEach((t) => h.holds.add(t))

    const period = qaPeriods_('month', pwToday(), 0)[0]
    const pending = getQaAnalyticsPage('month', period, 'audit')
    await new Promise((r) => setTimeout(r, 0))
    expect(h.heldStarted.slice().sort()).toEqual(HELD.slice().sort())
    h.releaseHeld()
    const res = (await pending) as Record<string, unknown>

    const auditRead = h.reads.find((r) => r.table === 'qa_audits')
    expect(auditRead?.ops.filter((o) => ['eq', 'in', 'is', 'gte', 'lte'].includes(String(o[0])))).toEqual([])

    const S = qeSettingsFrom_({})
    const startsOn = Number(S.weekStartsOn) === 1 ? 1 : 0
    const at: Record<string, string> = {}
    ;(h.tables.qa_queue || []).forEach((q) => {
      const m = /^(\d{4}-\d{2}-\d{2})/.exec(String(q.interaction_at || ''))
      if (m && q.queue_id) at[String(q.queue_id)] = m[1]
    })
    const quota: Record<string, unknown> = {}
    for (const r of h.tables.roster || []) {
      if (r.active !== 'true' && r.active !== true) continue
      if (['agent', 'specialist', 'tl'].indexOf(String(r.role)) === -1) continue
      const email = normEmail(String(r.email))
      const q = qeQuotaFor_(String(r.name), S)
      quota[email] = { name: String(r.name), perWeek: q.perWeek, perDay: q.perDay }
    }
    const expected = qaAnalytics_(
      h.tables.qa_audits,
      qaForms_(h.tables.qa_forms || []),
      h.tables.qa_disputes || [],
      h.tables.qa_ctls || [],
      h.tables.qa_calibrations || [],
      h.tables.qa_kb_gaps || [],
      'month',
      period,
      pwToday(),
      nameOf,
      {
        weekStartsOn: startsOn,
        volume: h.tables.qa_volume || [],
        quota: quota as never,
        handledOf: (a: Record<string, unknown>) => at[String(a.queue_id)] || '',
        basis: 'audit',
      }
    ) as Record<string, unknown>

    const { periods, targets, coverage, asOf, cached, ...rest } = res
    expect(rest).toEqual(expected)
    expect(periods).toEqual(qaPeriods_('month', pwToday(), startsOn))
    expect(targets).toBeTruthy()
    expect(coverage).toBeTruthy()
    void asOf
    void cached
  })
})

describe('analytics drill pushdown (S08-05)', () => {
  const TICKET_URL = 'https://help.example.com/a/tickets/'
  const drillExpected = (g: string, period: string, agent: string, qkey: string, basis: string) => {
    const startsOn = Number(qeSettingsFrom_({}).weekStartsOn) === 1 ? 1 : 0
    return qaDrill_(
      (h.tables.qa_audits || []).map((a) => ({ ...a })),
      qaForms_((h.tables.qa_forms || []) as never),
      g,
      period,
      startsOn,
      agent,
      qkey,
      nameOf,
      TICKET_URL,
      basis
    )
  }
  beforeEach(() => {
    seed()
    h.tables.config = [...(h.tables.config || []), { key: 'freshdesk_domain', value: 'help.example.com' }]
    h.reads.length = 0
    cacheClear()
  })

  it('month grain + audit basis pushes audit_date -01/-31 and agent_email eq; parity holds', async () => {
    const res = await getQaAnalyticsAudits('month', '2026-01', ' A@Dabdoob.com ', '', 'audit')
    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['gte', 'audit_date', '2026-01-01'])
    expect(read?.ops).toContainEqual(['lte', 'audit_date', '2026-01-31'])
    expect(read?.ops).toContainEqual(['eq', 'agent_email', 'a@dabdoob.com'])
    expect(res).toEqual(drillExpected('month', '2026-01', 'a@dabdoob.com', '', 'audit'))
  })

  it('range grain pushes the validated r[0]..r[1] bounds; empty agentEmail adds no eq', async () => {
    const res = await getQaAnalyticsAudits('range', '2026-01-05..2026-01-20', '', '', 'audit')
    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['gte', 'audit_date', '2026-01-05'])
    expect(read?.ops).toContainEqual(['lte', 'audit_date', '2026-01-20'])
    expect(read?.ops.filter((o) => o[0] === 'eq')).toEqual([])
    expect(res).toEqual(drillExpected('range', '2026-01-05..2026-01-20', '', '', 'audit'))
  })

  it('week grain issues no date bound but still bounds agent_email; parity holds', async () => {
    const startsOn = Number(qeSettingsFrom_({}).weekStartsOn) === 1 ? 1 : 0
    const period = qaPeriods_('week', pwToday(), startsOn)[0]
    const res = await getQaAnalyticsAudits('week', period, 'b@dabdoob.com', '', 'audit')
    const read = auditReads()[0]
    expect(read?.ops.filter((o) => ['gte', 'lte'].includes(String(o[0])))).toEqual([])
    expect(read?.ops).toContainEqual(['eq', 'agent_email', 'b@dabdoob.com'])
    expect(res).toEqual(drillExpected('week', period, 'b@dabdoob.com', '', 'audit'))
  })

  it('interaction basis keeps the read unbounded (audit_date is not a superset); parity holds', async () => {
    const res = await getQaAnalyticsAudits('month', '2026-01', 'a@dabdoob.com', '', 'interaction')
    const read = auditReads()[0]
    expect(read?.ops.filter((o) => ['gte', 'lte'].includes(String(o[0])))).toEqual([])
    expect(read?.ops).toContainEqual(['eq', 'agent_email', 'a@dabdoob.com'])
    expect(res).toEqual(drillExpected('month', '2026-01', 'a@dabdoob.com', '', 'interaction'))
  })
})

describe('qaCtlReminders CTL read pushdown (S08-06)', () => {
  beforeEach(() => {
    seed()
    h.tables.config = [...(h.tables.config || []), { key: 'reminders_enabled', value: 'false' }]
    h.reads.length = 0
    cacheClear()
  })

  it('bounds the open read to status=open and the re-read to due ctl_ids; same due/reminded write set', async () => {
    const today = pwToday()
    h.tables.qa_ctls = [
      { ctl_id: 'due-1', status: 'open', due_date: dqAddDays_(today, -1), reminded_date: '', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', audit_id: 'in1' },
      { ctl_id: 'due-2', status: 'open', due_date: today, reminded_date: dqAddDays_(today, -1), tl_email: 'admin@dabdoob.com', agent_email: 'b@dabdoob.com', audit_id: 'in2' },
      { ctl_id: 'not-today', status: 'open', due_date: dqAddDays_(today, -5), reminded_date: today, tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', audit_id: 'in3' },
      { ctl_id: 'closed', status: 'closed', due_date: dqAddDays_(today, -5), reminded_date: '', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', audit_id: 'in1' },
      { ctl_id: 'future', status: 'open', due_date: dqAddDays_(today, 3), reminded_date: '', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', audit_id: 'in2' },
    ]
    const before = h.tables.qa_ctls.map((c) => ({ ...c }))
    const expectedDueIds = before
      .filter((c) => c.status === 'open' && String(c.due_date) <= today && String(c.reminded_date) !== today)
      .map((c) => String(c.ctl_id))
      .sort()
    expect(expectedDueIds).toEqual(['due-1', 'due-2'])
    h.reads.length = 0
    cacheClear()

    const res = (await qaCtlReminders()) as Record<string, unknown>

    const ctlReads = h.reads.filter((r) => r.table === 'qa_ctls')
    const openRead = ctlReads.find((r) => r.ops.some((o) => o[0] === 'eq' && o[1] === 'status'))
    expect(openRead?.ops).toContainEqual(['eq', 'status', 'open'])
    const inRead = ctlReads.find((r) => r.ops.some((o) => o[0] === 'in' && o[1] === 'ctl_id'))
    const inOp = inRead?.ops.find((o) => o[0] === 'in' && o[1] === 'ctl_id')
    expect((inOp?.[2] as string[]).slice().sort()).toEqual(expectedDueIds)

    expect(res.reminded).toBe(expectedDueIds.length)
    expect(res.popups).toBe(0)
    expect(res.skipped).toBe('off')
    h.tables.qa_ctls.forEach((c) => {
      const was = before.find((b) => b.ctl_id === c.ctl_id)
      if (expectedDueIds.indexOf(String(c.ctl_id)) !== -1) expect(c.reminded_date).toBe(today)
      else expect(c.reminded_date).toBe(was?.reminded_date)
    })
  })
})

describe('qaEnsureCtlPopups_ read pushdown (S08-07)', () => {
  beforeEach(() => {
    seed()
    h.reads.length = 0
    cacheClear()
  })

  it('bounds the CTL read to status=open and the audits read to referenced audit_ids; same popups raised', async () => {
    const future = dqAddDays_(pwToday(), 5)
    h.tables.qa_ctls = [
      { ctl_id: 'c-open-1', status: 'open', audit_id: 'in1', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', due_date: future, reminded_date: '' },
      { ctl_id: 'c-open-2', status: 'open', audit_id: 'missing-id', tl_email: 'admin@dabdoob.com', agent_email: 'b@dabdoob.com', due_date: future, reminded_date: '' },
      { ctl_id: 'c-open-3', status: 'open', audit_id: 'in2', tl_email: '', agent_email: 'b@dabdoob.com', due_date: future, reminded_date: '' },
      { ctl_id: 'c-open-4', status: 'open', audit_id: 'in3', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', due_date: future, reminded_date: '' },
      { ctl_id: 'c-closed', status: 'closed', audit_id: 'in1', tl_email: 'admin@dabdoob.com', agent_email: 'a@dabdoob.com', due_date: future, reminded_date: '' },
    ]
    h.tables.popups = [
      { popup_id: 'p0', recipient: 'admin@dabdoob.com', kind: 'qa_ctl_due', ref: 'c-open-4', title: 'x', body: '', link: '', resolved_at: null },
      { popup_id: 'p1', recipient: 'admin@dabdoob.com', kind: 'qa_ctl_due', ref: 'c-old', title: 'x', body: '', link: '', resolved_at: '2026-01-01' },
    ]
    h.reads.length = 0
    cacheClear()

    const res = (await qaCtlReminders()) as Record<string, unknown>

    const ctlReads = h.reads.filter((r) => r.table === 'qa_ctls')
    expect(ctlReads[0]?.ops).toContainEqual(['eq', 'status', 'open'])
    const auditRead = auditReads()[0]
    const inOp = auditRead?.ops.find((o) => o[0] === 'in' && o[1] === 'audit_id')
    expect((inOp?.[2] as string[]).slice().sort()).toEqual(['in1', 'in2', 'in3', 'missing-id'])

    // parity: whole-table auditsBy would key every audit_id; the in-push returns the same lookups
    expect(res.popups).toBe(2)
    const raised = (h.tables.popups || []).filter((p) => p.kind === 'qa_ctl_due' && !p.resolved_at && ['c-open-1', 'c-open-2'].indexOf(String(p.ref)) !== -1)
    expect(raised.length).toBe(2)
    expect(String(raised.find((p) => p.ref === 'c-open-1')?.body)).toContain('ticket #100')
    expect(String(raised.find((p) => p.ref === 'c-open-2')?.body)).toContain('ticket # with')
  })
})

describe('backfillQaSampleBasis read pushdown (S08-08)', () => {
  beforeEach(() => {
    seed()
    h.reads.length = 0
    cacheClear()
  })

  it('reads only kind=audit rows; same sample_basis write set as whole-table parity', async () => {
    const fixture = [
      auditRow({ audit_id: 'blank-1', kind: 'audit', sample_basis: '', score: 80 }),
      auditRow({ audit_id: 'blank-2', kind: 'audit', sample_basis: '  ', score: 90 }),
      auditRow({ audit_id: 'filled', kind: 'audit', sample_basis: 'manual', score: 70 }),
      auditRow({ audit_id: 'cal', kind: 'calibration', sample_basis: '', score: 50 }),
    ]
    const expectedBasis: Record<string, string> = {}
    fixture.forEach((a) => {
      if (String(a.kind || 'audit') === 'audit' && !String(a.sample_basis || '').trim()) expectedBasis[String(a.audit_id)] = qaDeriveBasis_({ ...a })
    })
    h.tables.qa_audits = fixture
    h.reads.length = 0
    cacheClear()

    const msg = await backfillQaSampleBasis()

    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['eq', 'kind', 'audit'])

    const byId: Record<string, Record<string, unknown>> = {}
    h.tables.qa_audits.forEach((a) => (byId[String(a.audit_id)] = a))
    expect(Object.keys(expectedBasis).sort()).toEqual(['blank-1', 'blank-2'])
    for (const id of Object.keys(expectedBasis)) expect(byId[id].sample_basis).toBe(expectedBasis[id])
    expect(byId.filled.sample_basis).toBe('manual')
    expect(byId.cal.sample_basis).toBe('')
    expect(String(msg)).toContain('Sample basis written')
  })
})

describe('backfillQaInteractionDates read pushdown (S08-09)', () => {
  beforeEach(() => {
    seed()
    h.reads.length = 0
    cacheClear()
  })

  it('reads only interaction_at NULL/blank audits; same written/missing and upserted rows as whole-table parity', async () => {
    h.tables.qa_queue = [
      { queue_id: 'Q1', interaction_at: "'2026-01-05 09:30" },
      { queue_id: 'Q2', interaction_at: '' },
      { queue_id: 'Q3', interaction_at: "'2026-01-20 14:00" },
    ]
    const fixture = [
      auditRow({ audit_id: 'fill-1', queue_id: 'Q1', interaction_at: null }),
      auditRow({ audit_id: 'fill-2', queue_id: 'Q3', interaction_at: '' }),
      auditRow({ audit_id: 'no-match', queue_id: 'Q2', interaction_at: null }),
      auditRow({ audit_id: 'already', queue_id: 'Q1', interaction_at: "'2026-01-01 08:00" }),
      auditRow({ audit_id: 'no-queue', queue_id: '', interaction_at: null }),
      auditRow({ audit_id: 'dated', queue_id: 'Q1', interaction_at: '2026-11-01' }),
      auditRow({ audit_id: 'dated-time', queue_id: 'Q3', interaction_at: '2026-11-01 10:00' }),
    ]
    h.tables.qa_audits = fixture
    h.reads.length = 0
    cacheClear()

    const at: Record<string, string> = {}
    h.tables.qa_queue.forEach((q) => {
      const t = qaTextTime_(q.interaction_at)
      if (t && q.queue_id) at[String(q.queue_id)] = t
    })
    const blankExpected = fixture.filter((a) => String(a.queue_id || '') && !qaWhen_(a.interaction_at))
    const writtenExpected = blankExpected.filter((a) => at[String(a.queue_id)])
    const before: Record<string, unknown> = {}
    fixture.forEach((a) => (before[String(a.audit_id)] = a.interaction_at))

    const msg = await backfillQaInteractionDates()

    const read = auditReads()[0]
    expect(read?.ops).toContainEqual(['or', 'interaction_at.is.null,interaction_at.eq.'])
    expect(read?.ops.filter((o) => o[0] === 'is')).toEqual([])
    const queueRead = h.reads.find((r) => r.table === 'qa_queue')
    expect(queueRead?.ops.filter((o) => ['eq', 'in', 'is', 'gte', 'lte'].includes(String(o[0])))).toEqual([])

    expect(String(msg)).toBe('Interaction dates written: ' + writtenExpected.length + '. Queue row has none: ' + (blankExpected.length - writtenExpected.length) + '.')
    const byId: Record<string, Record<string, unknown>> = {}
    h.tables.qa_audits.forEach((a) => (byId[String(a.audit_id)] = a))
    for (const a of writtenExpected) expect(byId[String(a.audit_id)].interaction_at).toBe(at[String(a.queue_id)])
    for (const id of Object.keys(before)) {
      if (writtenExpected.map((a) => String(a.audit_id)).indexOf(id) === -1) expect(byId[id].interaction_at).toBe(before[id])
    }
  })
})

describe('my-audits CTL read pushdown (S08-10)', () => {
  beforeEach(() => {
    seed()
    h.reads.length = 0
    cacheClear()
  })

  it('bounds the qa_ctls read to agent_email eq; ctlBy/page output matches whole-table parity', async () => {
    h.tables.qa_audits = [
      auditRow({ audit_id: 'm1', agent_email: 'admin@dabdoob.com', submitted_at: '2026-01-20T10:00:00Z', score: 80 }),
      auditRow({ audit_id: 'm2', agent_email: 'admin@dabdoob.com', submitted_at: '2026-01-21T10:00:00Z', score: 90 }),
      auditRow({ audit_id: 'other', agent_email: 'a@dabdoob.com', submitted_at: '2026-01-22T10:00:00Z', score: 60 }),
    ]
    h.tables.qa_ctls = [
      { ctl_id: 'ctl-open', audit_id: 'm1', agent_email: 'admin@dabdoob.com', status: 'open', due_date: '2026-02-01', opened_date: '2026-01-21' },
      { ctl_id: 'ctl-cancelled', audit_id: 'm1', agent_email: 'admin@dabdoob.com', status: 'cancelled', due_date: '2026-02-02', opened_date: '2026-01-22' },
      { ctl_id: 'ctl-m2', audit_id: 'm2', agent_email: 'admin@dabdoob.com', status: 'closed', due_date: '2026-01-30', opened_date: '2026-01-23' },
      { ctl_id: 'ctl-other', audit_id: 'other', agent_email: 'a@dabdoob.com', status: 'open', due_date: '2026-02-01', opened_date: '2026-01-24' },
    ]
    h.reads.length = 0
    cacheClear()

    const res = (await getQaMyAuditsPage()) as { audits: Record<string, unknown>[]; average: unknown; today: string }
    const ctlRead = h.reads.find((r) => r.table === 'qa_ctls')
    expect(ctlRead?.ops).toContainEqual(['eq', 'agent_email', 'admin@dabdoob.com'])

    expect(res.audits.map((a) => a.auditId)).toEqual(['m2', 'm1'])
    const ctl1 = res.audits.find((a) => a.auditId === 'm1')?.ctl as Record<string, unknown>
    expect(ctl1.ctlId).toBe('ctl-open')
    expect(ctl1.status).toBe('open')
    const ctl2 = res.audits.find((a) => a.auditId === 'm2')?.ctl as Record<string, unknown>
    expect(ctl2.ctlId).toBe('ctl-m2')
    expect(res.today).toBe(pwToday())
  })
})

describe('resendQaAuditEmail CTL read pushdown (S08-11)', () => {
  beforeEach(() => {
    seed()
    h.tables.qa_audits = [
      auditRow({ audit_id: 'r1', agent_email: 'a@dabdoob.com', auditor_email: 'admin@dabdoob.com', tl_email: 'admin@dabdoob.com', score: 80 }),
      auditRow({ audit_id: 'r2', agent_email: 'b@dabdoob.com', auditor_email: 'admin@dabdoob.com', score: 90 }),
    ]
    h.tables.qa_ctls = [
      { ctl_id: 'ctl-open', audit_id: 'r1', agent_email: 'a@dabdoob.com', status: 'open', due_date: '2026-02-01', tl_email: 'admin@dabdoob.com' },
      { ctl_id: 'ctl-cancelled', audit_id: 'r1', agent_email: 'a@dabdoob.com', status: 'cancelled', due_date: '2026-02-02', tl_email: 'admin@dabdoob.com' },
      { ctl_id: 'ctl-other', audit_id: 'r2', agent_email: 'b@dabdoob.com', status: 'open', due_date: '2026-02-03', tl_email: 'admin@dabdoob.com' },
    ]
    h.tables.mail_log = []
    h.reads.length = 0
    cacheClear()
  })

  it('bounds the qa_ctls read to audit_id eq; same ctl pick and mail decision as whole-table parity', async () => {
    const res = (await resendQaAuditEmail('r1', false)) as Record<string, unknown>
    const ctlRead = h.reads.find((r) => r.table === 'qa_ctls')
    expect(ctlRead?.ops).toContainEqual(['eq', 'audit_id', 'r1'])

    const expectedCtl = h.tables.qa_ctls.filter((c) => c.audit_id === 'r1' && c.status !== 'cancelled')[0] || null
    expect(expectedCtl?.ctl_id).toBe('ctl-open')

    expect(res.needsConfirm).toBe(false)
    expect(res.mail).toBe('dry_run')
    expect(res.reason).toBe('')
    expect(res.last).toBeNull()
    const sent = (h.tables.mail_log || []).filter((m) => m.kind === 'qa_audit' && m.ref === 'r1')
    expect(sent.length).toBe(1)
    expect(sent[0].status).toBe('dry_run')
  })
})

describe('qaTicketClash_ queue read pushdown (S08-12)', () => {
  beforeEach(() => {
    seed()
    h.tables.tickets = ['201', '202', '203', '204'].map((id) => ({
      ticket_id: id, group_name: 'Support', responder_id: '',
      contact_type_1: '', contact_type_2: '', contact_type_3: '', status: 'open',
    }))
    h.tables.options = [{ list_key: 'qa.channel', value: 'Email', sort: 1, active: 'true' }]
    h.tables.qa_queue = [
      { queue_id: 'q-req', ticket_id: '201', status: 'open', source: 'request', requested_by: 'a@dabdoob.com', requested_at: '2026-01-05', queue_date: '2026-01-05' },
      { queue_id: 'q-req-closed', ticket_id: '201', status: 'waived', source: 'request', requested_by: 'a@dabdoob.com', requested_at: '2026-01-04', queue_date: '2026-01-04' },
      { queue_id: 'q-off', ticket_id: '202', status: 'in_progress', source: 'offqueue', requested_by: 'b@dabdoob.com', requested_at: '2026-01-06', queue_date: '2026-01-06' },
      { queue_id: 'q-plain', ticket_id: '203', status: 'open', source: 'manual', requested_by: 'admin@dabdoob.com', requested_at: '2026-01-07', queue_date: '2026-01-07' },
      { queue_id: 'q-done', ticket_id: '204', status: 'done', source: 'request', requested_by: 'a@dabdoob.com', requested_at: '2026-01-08', queue_date: '2026-01-08' },
      { queue_id: 'q-other', ticket_id: '999', status: 'open', source: 'request', requested_by: 'a@dabdoob.com', requested_at: '2026-01-09', queue_date: '2026-01-09' },
    ]
    h.reads.length = 0
    cacheClear()
  })

  const queueReadFor = (ticket: string) =>
    h.reads.filter((r) => r.table === 'qa_queue').find((r) => r.ops.some((o) => o[0] === 'eq' && o[1] === 'ticket_id' && o[2] === ticket))

  it('bounds the qa_queue read to ticket_id eq + status in QA_REQUEST_OPEN; same three throw branches + success', async () => {
    await expect(requestQaAudit({ ticketId: '201', agentEmail: 'a@dabdoob.com', channel: 'Email', reason: 'please audit this' })).rejects.toThrow('already requested')
    const r201 = queueReadFor('201')
    expect(r201?.ops).toContainEqual(['eq', 'ticket_id', '201'])
    expect(r201?.ops).toContainEqual(['in', 'status', QA_REQUEST_OPEN])

    await expect(requestQaAudit({ ticketId: '202', agentEmail: 'a@dabdoob.com', channel: 'Email', reason: 'please audit this' })).rejects.toThrow('already added off-queue')
    expect(queueReadFor('202')?.ops).toContainEqual(['eq', 'ticket_id', '202'])

    await expect(requestQaAudit({ ticketId: '203', agentEmail: 'a@dabdoob.com', channel: 'Email', reason: 'please audit this' })).rejects.toThrow('already in the audit queue')
    expect(queueReadFor('203')?.ops).toContainEqual(['eq', 'ticket_id', '203'])

    const res = (await requestQaAudit({ ticketId: '204', agentEmail: 'a@dabdoob.com', channel: 'Email', reason: 'please audit this' })) as Record<string, unknown>
    expect(queueReadFor('204')?.ops).toContainEqual(['in', 'status', QA_REQUEST_OPEN])
    expect(res.ticketId).toBe('204')
    expect(String(res.queueId)).toBeTruthy()
  })
})
