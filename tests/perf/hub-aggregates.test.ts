import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

/**
 * P-04 parity: getHomePage must return identical output whether the daily
 * tables arrive whole (JS inDateRange/slot filters do the narrowing) or
 * pre-bounded by the pushed-down SQL filters. The fake applies eq/in/is/
 * gte/lte itself, so "wide" fixtures exercise the real bounds and "narrow"
 * fixtures hold exactly the rows those bounds keep.
 */

const NOW = Date.parse('2026-05-06T10:00:00Z') // 13:00 Kuwait -> key 2026-05-06

const store = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  calls: [] as { table: string; m: string; args: unknown[] }[],
}))

vi.mock('@/features/shared/lib/supabase', () => ({
  supabase: { from: (t: string) => mkQuery(t) },
  createClient: () => ({ from: (t: string) => mkQuery(t) }),
}))
vi.mock('@/features/shared/lib/auth', () => ({
  createAuthClient: async () => ({
    auth: {
      getClaims: async () => ({
        data: { claims: { email: 'admin@dabdoob.com', sub: 'u' } },
        error: null,
      }),
      getUser: async () => ({
        data: { user: { email: 'admin@dabdoob.com' } },
        error: null,
      }),
    },
  }),
  requireRole: async (roles: string[]) =>
    (await import('@/features/shared/platform/identity')).requireRole(roles),
  getViewAsUser: async () => null,
}))

import { getHomePage } from '@/features/cx-hub/lib/aggregates'
import { cacheClear } from '@/features/shared/platform/repo'

const cmp = (v: unknown) => String(v ?? '')

function mkQuery(table: string) {
  const filters: ((r: Record<string, unknown>) => boolean)[] = []
  let orderCol: string | null = null
  let orderAsc = true
  let lim: number | null = null
  let from = 0
  let to = Number.MAX_SAFE_INTEGER
  let selected = '*'
  const b: Record<string, unknown> = {}
  const rec = (m: string, args: unknown[]) => store.calls.push({ table, m, args })
  const chain =
    (m: string, fn: (...a: unknown[]) => void) =>
    (...args: unknown[]) => {
      rec(m, args)
      fn(...args)
      return b
    }
  b.select = (cols?: string) => {
    selected = cols || '*'
    return b
  }
  b.eq = chain('eq', (c, v) => {
    filters.push((r) => cmp(r[c as string]) === cmp(v))
  })
  b.neq = chain('neq', (c, v) => {
    filters.push((r) => cmp(r[c as string]) !== cmp(v))
  })
  b.is = chain('is', (c, v) => {
    filters.push((r) =>
      v === null
        ? r[c as string] === null || r[c as string] === undefined || r[c as string] === ''
        : r[c as string] === v
    )
  })
  b.ilike = chain('ilike', (c, v) => {
    const n = cmp(v).toLowerCase()
    filters.push((r) => cmp(r[c as string]).toLowerCase().indexOf(n) !== -1)
  })
  b.in = chain('in', (c, vs) => {
    const set = new Set(((vs as unknown[]) || []).map(cmp))
    filters.push((r) => set.has(cmp(r[c as string])))
  })
  b.gte = chain('gte', (c, v) => {
    filters.push((r) => cmp(r[c as string]) >= cmp(v))
  })
  b.lte = chain('lte', (c, v) => {
    filters.push((r) => cmp(r[c as string]) <= cmp(v))
  })
  b.or = () => b
  b.order = chain('order', (c, o) => {
    orderCol = c as string
    orderAsc = !(o as { ascending?: boolean }) || (o as { ascending?: boolean }).ascending !== false
  })
  b.limit = chain('limit', (n) => {
    lim = n as number
  })
  b.range = chain('range', (f, t) => {
    from = f as number
    to = t as number
  })
  b.insert = () => b
  b.update = () => b
  b.delete = () => b
  b.upsert = () => b

  const run = () => {
    let rows = (store.tables[table] || []).filter((r) => filters.every((f) => f(r)))
    if (orderCol) {
      const dir = orderAsc ? 1 : -1
      rows = rows.slice().sort((a, c) => {
        const av = cmp(a[orderCol as string])
        const bv = cmp(c[orderCol as string])
        return av === bv ? 0 : av < bv ? -dir : dir
      })
    }
    rows = rows.slice(from, to + 1)
    if (lim !== null) rows = rows.slice(0, lim)
    if (selected !== '*') {
      const names = selected
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
      rows = rows.map((r) => {
        const o: Record<string, unknown> = {}
        names.forEach((n) => {
          o[n] = r[n]
        })
        return o
      })
    }
    return rows
  }
  b.maybeSingle = () => Promise.resolve({ data: run()[0] || null, error: null })
  b.single = () => Promise.resolve({ data: run()[0] || null, error: null })
  b.then = (
    resolve: (v: { data: unknown; error: null }) => unknown,
    reject?: (e: unknown) => unknown
  ) => Promise.resolve({ data: run(), error: null }).then(resolve, reject)
  return b
}

const scRow = (date: string, email: string, tgt: number) => ({
  date,
  email,
  matrix_day: 1,
  inb_target: tgt,
  inb_achieved: tgt / 2,
  txt_target: 0,
  txt_achieved: 0,
  wa_target: 0,
  wa_achieved: 0,
  audits: 2,
  score_x_audits: 180,
  fcr_passed: 3,
  fcr_failed: 1,
  fcr_excluded: 0,
})

const prodRow = (date: string, email: string) => ({
  date,
  email,
  layer: 'raw',
  inboundTarget: 10,
  inboundAchieved: 8,
  textingTarget: 0,
  textingAchieved: 0,
  waTarget: 0,
  waAchieved: 0,
  totalAudits: 1,
  avgScore: 90,
})

const base = (): Record<string, Record<string, unknown>[]> => ({
  config: [
    { key: 'allowed_domain', value: 'dabdoob.com' },
    { key: 'admin_emails', value: 'admin@dabdoob.com' },
    { key: 'freshdesk_domain', value: 'help.example.com' },
  ],
  roster: [
    { email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', tl_email: '', active: true },
    { email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: '', active: true },
  ],
  view_as: [],
  health: [
    {
      job: 'queue_aggregates',
      last_ok_at: '2026-05-06T09:55:00Z',
      last_run_at: '2026-05-06T09:55:00Z',
      last_status: 'ok',
    },
  ],
  aging_open_tickets: [
    {
      ticket_id: '2001',
      queue: 'CS',
      status: 'Open',
      age_h: 30,
      band: 3,
      agent_email: 'agent@dabdoob.com',
      agent_name: 'Agent One',
      tl_email: '',
      actionable: true,
      group_name: 'CS',
      ours: true,
      created_at: '2026-05-05T04:00:00Z',
    },
  ],
  dq_aging_flags: [],
  agg_queue_now: [
    {
      queue: 'CS',
      open: 5,
      actionable: 4,
      unassigned: 1,
      oldest_h: 30,
      bands_json: '[0,0,0,1,0]',
      over_top: 0,
      created_today: 1,
      resolved_today: 0,
      by_status_json: '{"Open":5}',
      source_as_of: '2026-05-06T09:55:00Z',
      stale: false,
    },
  ],
  queue_snapshots: [
    {
      snapshot_key: '2026-05-06|09:30',
      slot_date: '2026-05-06',
      slot: '09:30',
      queue: 'CS',
      open: 5,
      over_top: 0,
      bands_json: '[0,0,0,1,0]',
      by_status_json: '{}',
      stale: false,
    },
    {
      snapshot_key: '2026-05-05|09:30',
      slot_date: '2026-05-05',
      slot: '09:30',
      queue: 'CS',
      open: 9,
      over_top: 3,
      bands_json: '[0,0,0,3,0]',
      by_status_json: '{}',
      stale: false,
    },
  ],
  queue_submissions: [
    {
      submission_id: 's1',
      slot_date: '2026-05-06',
      slot: '09:30',
      status: 'submitted',
      help_needed: false,
      submitted_by: 'tl@dabdoob.com',
      submitted_at: '2026-05-06T06:40:00Z',
    },
    {
      submission_id: 's2',
      slot_date: '2026-05-05',
      slot: '09:30',
      status: 'submitted',
      help_needed: true,
      help_note: 'yesterday only',
      submitted_by: 'tl@dabdoob.com',
      submitted_at: '2026-05-05T06:40:00Z',
    },
    {
      submission_id: 's3',
      slot_date: '2026-04-01',
      slot: '09:30',
      status: 'submitted',
      help_needed: true,
      help_note: 'old',
      submitted_by: 'tl@dabdoob.com',
      submitted_at: '2026-04-01T06:40:00Z',
    },
    {
      // data-2: a migrated 'YYYY-MM-DDT…' row — the prefix bound must return it
      // and dqSubmissionsFor_ (slice(0,10)) must match it to today.
      submission_id: 's4',
      slot_date: '2026-05-06T08:00',
      slot: '13:00',
      status: 'submitted',
      help_needed: true,
      help_note: 'prefix-row reached',
      submitted_by: 'tl@dabdoob.com',
      submitted_at: '2026-05-06T08:40:00Z',
    },
  ],
  sc_daily: [
    scRow('2026-05-06', 'agent@dabdoob.com', 10),
    scRow('2026-04-30', 'agent@dabdoob.com', 4), // window edge, in
    scRow('2026-04-29', 'agent@dabdoob.com', 99), // out
    scRow('2026-05-07', 'agent@dabdoob.com', 99), // future, out
  ],
  prod_daily_layers: [
    prodRow('2026-05-05', 'agent@dabdoob.com'),
    prodRow('2026-03-01', 'agent@dabdoob.com'), // out
  ],
  fcr_daily: [
    { date: '2026-05-06', email: 'agent@dabdoob.com', passed: 3, failed: 1, excluded: 0 },
    { date: '2026-01-01', email: 'agent@dabdoob.com', passed: 9, failed: 9, excluded: 0 }, // out
  ],
})

/** What the pushed-down bounds keep: the JS filters' exact row set. */
const narrow = (): Record<string, Record<string, unknown>[]> => {
  const t = base()
  t.sc_daily = t.sc_daily.filter((r) => String(r.date) >= '2026-04-30' && String(r.date) <= '2026-05-06')
  t.prod_daily_layers = t.prod_daily_layers.filter(
    (r) => String(r.date) >= '2026-04-30' && String(r.date) <= '2026-05-06'
  )
  t.fcr_daily = t.fcr_daily.filter(
    (r) => String(r.date) >= '2026-04-30' && String(r.date) <= '2026-05-06'
  )
  t.queue_submissions = t.queue_submissions.filter(
    (r) =>
      String(r.slot_date) >= '2026-05-06' &&
      String(r.slot_date) <= '2026-05-06' + String.fromCharCode(0xfffd)
  )
  t.queue_snapshots = t.queue_snapshots.filter((r) => r.slot_date === '2026-05-06')
  return t
}

describe('getHomePage pushed-down bounds (P-04)', () => {
  beforeEach(() => {
    store.calls = []
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns identical output for whole vs pre-bounded tables', async () => {
    store.tables = base()
    const wide = JSON.parse(JSON.stringify(await getHomePage()))
    cacheClear()
    store.tables = narrow()
    const bounded = JSON.parse(JSON.stringify(await getHomePage()))
    expect(bounded).toEqual(wide)
  })

  it('sends date/slot bounds to Postgres for the named reads', async () => {
    store.tables = base()
    await getHomePage()
    const has = (table: string, m: string, args: unknown[]) =>
      store.calls.some(
        (c) => c.table === table && c.m === m && JSON.stringify(c.args) === JSON.stringify(args)
      )
    for (const t of ['sc_daily', 'prod_daily_layers', 'fcr_daily']) {
      expect(has(t, 'gte', ['date', '2026-04-30']), t + ' gte').toBe(true)
      expect(has(t, 'lte', ['date', '2026-05-06']), t + ' lte').toBe(true)
    }
    expect(has('queue_submissions', 'gte', ['slot_date', '2026-05-06'])).toBe(true)
    expect(
      has('queue_submissions', 'lte', ['slot_date', '2026-05-06' + String.fromCharCode(0xfffd)])
    ).toBe(true)
    expect(has('queue_snapshots', 'eq', ['slot_date', '2026-05-06'])).toBe(true)
  })

  it("returns a stored 'YYYY-MM-DDT…' slot_date row to dqSubmissionsFor_ (data-2)", async () => {
    store.tables = base()
    const out = await getHomePage()
    const slots = out.slots as { slot: string; state: string; submittedBy: string }[]
    const at13 = slots.filter((s) => s.slot === '13:00')
    expect(at13.length).toBe(1)
    expect(at13[0].state).toBe('done')
    expect(at13[0].submittedBy).toBe('tl@dabdoob.com')
    const help = (out.needs as { id: string; who: string[] }[]).filter(
      (n) => n.id === 'checkin-help'
    )
    expect(help.length).toBe(1)
    expect(JSON.stringify(help[0].who)).toContain('13:00, tl: prefix-row reached')
  })
})
