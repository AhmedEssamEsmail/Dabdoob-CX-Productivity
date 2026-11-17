/**
 * dbbook.ts — DB-backed sheet grids: header + positional rows for the three
 * mirror-backed tabs, ts_ms windows, K/L derivation on 'Maqsam Calls', and
 * month resolution via dbBookMonthForId_.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, Error>,
  calls: [] as { table: string; columns?: string; pk?: string; filters: [string, string, unknown][] }[],
}))

vi.mock('@/features/shared/platform/repo', () => ({
  readAllPaged: async (table: string, opts?: { columns?: string; pk?: string; build?: (q: never) => never }) => {
    const filters: [string, string, unknown][] = []
    const q = {
      gte: (c: string, v: unknown) => (filters.push(['gte', c, v]), q),
      lt: (c: string, v: unknown) => (filters.push(['lt', c, v]), q),
      lte: (c: string, v: unknown) => (filters.push(['lte', c, v]), q),
      eq: (c: string, v: unknown) => (filters.push(['eq', c, v]), q),
      order: () => q,
      range: () => q,
    }
    opts?.build?.(q as never)
    h.calls.push({ table, columns: opts?.columns, pk: opts?.pk, filters })
    const err = h.errors[table]
    if (err) throw err
    return h.tables[table] || []
  },
}))

import { dbBookMonthForId_, dbBookTabCells_ } from '@/features/shared/jobs/dbbook'
import { freshchatCells_, maqsamCells_, fdActivityCells_ } from '@/features/shared/jobs/mirror-cells'
import { tphHourMs_ } from '@/features/cx-productivity/lib/tph'
import type { Cfg } from '@/features/shared/lib/adapters'

const CFG = {
  data_tz: 'Africa/Cairo',
  productivity_fallback_id: 'fallback-book',
  productivity_files: { '2026-10': 'oct-book', '2026-11': 'nov-book' },
} as unknown as Cfg

const MAQSAM_ROW = {
  ts_ms: Date.parse('2026-10-08T09:00:00.000Z'),
  started_at: '2026-10-08T09:00:00.000Z',
  ended_at: '2026-10-08T09:02:00.000Z',
  duration: '0:02:00',
  agent_email: 'a@dabdoob.com',
  state: 'serviced',
  direction: 'inbound',
  handling: String(90 / 86400),
}
const FRESHCHAT_ROW = {
  ts_ms: Date.parse('2026-10-08T10:05:00.000Z'),
  initiated_at: '2026-10-08T10:00:00.000Z',
  status: 'resolved',
  ref_key: 'conv1-1793652000000',
  updated_at: '2026-10-08T10:05:00.000Z',
  resolved_at: '2026-10-08T10:06:00.000Z',
  channel: 'IG_app',
  conversation_id: 'conv1',
}
const ACTIVITY_ROW = {
  ts_ms: Date.parse('2026-10-07T09:00:00.000Z'),
  performed_at: '2026-10-07T09:00:00.000Z',
  ticket_id: '101',
  performer_name: 'Alice Agent',
  performer_type: 'user',
  activity_type: 'Status Change',
  field_changed: 'status',
  new_value: 'Open',
  old_value: 'Pending',
  group_name: 'Support',
}

const QUALITY_ROW = {
  agent_email: 'a@dabdoob.com',
  audit_date: '2026-10-08',
  score_final: null,
  score: '87.5',
}
const ROSTER_ROWS = [
  { hr_id: 'H1', name: 'Alice Agent', email: 'a@dabdoob.com', freshdesk_id: '501', freshdesk_name: 'Alice A', tl_email: 'tl@dabdoob.com' },
  { hr_id: 'H2', name: 'Boss TL', email: 'tl@dabdoob.com', freshdesk_id: '502', freshdesk_name: 'Boss T', tl_email: '' },
]
const TRACKER_ROW = {
  tracker_id: 'aux_exceptions',
  row_n: 7,
  values: { agent_mail: 'a@dabdoob.com', date: '2026-10-08', aux: 'Meeting', duration: '30' },
}
const AUX_SPAN_ROW = { cols: ['Agent X', 'Status Y', 'S', 'E', 'x@dabdoob.com', '12', '2026-10-08'] }

describe('dbbook', () => {
  beforeEach(() => {
    h.tables = {}
    h.errors = {}
    h.calls = []
  })

  it('dbBookMonthForId_: reverse prodFileFor_, fallback/unmatched -> null', () => {
    expect(dbBookMonthForId_('oct-book', CFG)).toBe('2026-10')
    expect(dbBookMonthForId_('nov-book', CFG)).toBe('2026-11')
    expect(dbBookMonthForId_('fallback-book', CFG)).toBeNull()
    expect(dbBookMonthForId_('nope', CFG)).toBeNull()
  })

  it("'Maqsam Calls': header + 12-cell rows, K is a Date, L numeric, ts_ms asc order", async () => {
    h.tables.maqsam_calls = [MAQSAM_ROW]
    const grid = await dbBookTabCells_('Maqsam Calls', { cfg: CFG, sinceMs: 0 })
    expect(grid).toHaveLength(2)
    expect(grid[0].length).toBe(12)
    const row = grid[1]
    expect(row.slice(0, 3)).toEqual(['', '', ''])
    expect(row.slice(3, 10)).toEqual(maqsamCells_(MAQSAM_ROW))
    expect(row[10]).toBeInstanceOf(Date)
    expect((row[10] as Date).toISOString()).toBe('2026-10-08T09:00:00.000Z')
    expect(row[11]).toBe(1.5)
    expect(h.calls[0].table).toBe('maqsam_calls')
    expect(h.calls[0].pk).toBe('ts_ms')
  })

  it("'Maqsam Calls': bad started_at -> K '', missing handling -> L duration fallback", async () => {
    h.tables.maqsam_calls = [{ ...MAQSAM_ROW, started_at: 'garbage', handling: undefined, duration: '0:02:00' }]
    const grid = await dbBookTabCells_('Maqsam Calls', { cfg: CFG })
    expect(grid[1][10]).toBe('')
    expect(grid[1][11]).toBe(2)
  })

  it("'Maqsam Calls': month ctx bounds ts_ms to the data_tz month window", async () => {
    await dbBookTabCells_('Maqsam Calls', { cfg: CFG, month: '2026-10' })
    const f = h.calls[0].filters
    expect(f).toContainEqual(['gte', 'ts_ms', tphHourMs_('2026-10-01', 0, 'Africa/Cairo')])
    expect(f).toContainEqual(['lt', 'ts_ms', tphHourMs_('2026-11-01', 0, 'Africa/Cairo')])
  })

  it("'Freshchat': header + freshchatCells_ rows, sinceMs bound", async () => {
    h.tables.freshchat = [FRESHCHAT_ROW]
    const since = Date.parse('2026-10-01T00:00:00Z')
    const grid = await dbBookTabCells_('Freshchat', { cfg: CFG, sinceMs: since })
    expect(grid[0]).toHaveLength(7)
    expect(grid[1]).toEqual(freshchatCells_(FRESHCHAT_ROW))
    expect(h.calls[0].table).toBe('freshchat')
    expect(h.calls[0].filters).toContainEqual(['gte', 'ts_ms', since])
  })

  it("'Activities': header + fdActivityCells_ rows, sinceMs bound", async () => {
    h.tables.fd_activities = [ACTIVITY_ROW]
    const grid = await dbBookTabCells_('Activities', { cfg: CFG, sinceMs: 123 })
    expect(grid[0]).toHaveLength(10)
    expect(grid[1]).toEqual(fdActivityCells_(ACTIVITY_ROW))
    expect(h.calls[0].table).toBe('fd_activities')
    expect(h.calls[0].filters).toContainEqual(['gte', 'ts_ms', 123])
  })

  it("'Quality': header + [email, audit_date, score_final ?? score] cells", async () => {
    h.tables.qa_audits = [QUALITY_ROW]
    const grid = await dbBookTabCells_('Quality', { cfg: CFG, sinceMs: Date.parse('2026-10-01T00:00:00Z') })
    expect(grid[0]).toHaveLength(3)
    expect(grid[1]).toEqual(['a@dabdoob.com', '2026-10-08', '87.5'])
    expect(h.calls[0].table).toBe('qa_audits')
    expect(h.calls[0].columns).toBe('agent_email,audit_date,score_final,score')
  })

  it("'Quality': month ctx bounds audit_date strings; score_final wins over score", async () => {
    h.tables.qa_audits = [{ ...QUALITY_ROW, score_final: '92' }]
    const grid = await dbBookTabCells_('Quality', { cfg: CFG, month: '2026-10' })
    expect(grid[1][2]).toBe('92')
    const f = h.calls[0].filters
    expect(f).toContainEqual(['gte', 'audit_date', '2026-10-01'])
    expect(f).toContainEqual(['lt', 'audit_date', '2026-11-01'])
  })

  it("'Headcount': roster -> 8 cells, tlName via email->name map", async () => {
    h.tables.roster = ROSTER_ROWS
    const grid = await dbBookTabCells_('Headcount', { cfg: CFG })
    expect(grid[0]).toHaveLength(8)
    expect(grid[1]).toEqual(['H1', 'Alice Agent', '', 'a@dabdoob.com', '501', 'Alice A', 'Boss TL', 'tl@dabdoob.com'])
    expect(grid[2]).toEqual(['H2', 'Boss TL', '', 'tl@dabdoob.com', '502', 'Boss T', '', ''])
    expect(h.calls[0].table).toBe('roster')
  })

  it("'Assumptions': 6x2 grid, B4:B6 from cfg.prod_assumptions; missing -> ''", async () => {
    const cfg = { ...CFG, prod_assumptions: { mq: 60, text: 30, wa: 10 } } as unknown as Cfg
    const grid = await dbBookTabCells_('Assumptions', { cfg })
    expect(grid).toHaveLength(7)
    expect(grid[0]).toEqual(['', ''])
    expect(grid[3][1]).toBe(60)
    expect(grid[4][1]).toBe(30)
    expect(grid[5][1]).toBe(10)
    const blank = await dbBookTabCells_('Assumptions', { cfg: CFG })
    expect(blank[3][1]).toBe('')
    expect(blank[5][1]).toBe('')
  })

  it("'AUXes Exceptions': tracker_records values -> A..D, row_n order, eq filter", async () => {
    h.tables.tracker_records = [TRACKER_ROW]
    const grid = await dbBookTabCells_('AUXes Exceptions', { cfg: CFG })
    expect(grid[0]).toHaveLength(4)
    expect(grid[1]).toEqual(['a@dabdoob.com', '2026-10-08', 'Meeting', '30'])
    expect(h.calls[0].table).toBe('tracker_records')
    expect(h.calls[0].pk).toBe('row_n')
    expect(h.calls[0].filters).toContainEqual(['eq', 'tracker_id', 'aux_exceptions'])
  })

  it("'FD_AUX': aux_spans cols verbatim, sinceMs bound; missing table -> header-only", async () => {
    h.tables.aux_spans = [AUX_SPAN_ROW]
    const since = Date.parse('2026-10-01T00:00:00Z')
    const grid = await dbBookTabCells_('FD_AUX', { cfg: CFG, sinceMs: since })
    expect(grid[0]).toHaveLength(7)
    expect(grid[1]).toEqual(AUX_SPAN_ROW.cols)
    expect(h.calls[0].table).toBe('aux_spans')
    expect(h.calls[0].pk).toBe('ts_ms')
    expect(h.calls[0].filters).toContainEqual(['gte', 'ts_ms', since])
    h.tables = {}
    const empty = await dbBookTabCells_('FD_AUX', { cfg: CFG })
    expect(empty).toHaveLength(1)
  })

  it('missing tables -> header-only grids; unknown tab throws', async () => {
    expect(await dbBookTabCells_('Freshchat', { cfg: CFG })).toHaveLength(1)
    expect(await dbBookTabCells_('Activities', { cfg: CFG })).toHaveLength(1)
    expect(await dbBookTabCells_('Maqsam Calls', { cfg: CFG })).toHaveLength(1)
    await expect(dbBookTabCells_('Nope', { cfg: CFG })).rejects.toThrow('unknown tab')
  })

  it('missing-relation error -> header-only grid (missing_store tolerance)', async () => {
    h.errors.freshchat = new Error("Could not find the table 'public.freshchat' in the schema cache")
    const grid = await dbBookTabCells_('Freshchat', { cfg: CFG })
    expect(grid).toHaveLength(1)
    expect(grid[0]).toHaveLength(7)
  })

  it('non-missing read error propagates (timeout/5xx not swallowed)', async () => {
    h.errors.fd_activities = new Error('fetch failed: timeout')
    await expect(dbBookTabCells_('Activities', { cfg: CFG })).rejects.toThrow('fetch failed: timeout')
  })
})
