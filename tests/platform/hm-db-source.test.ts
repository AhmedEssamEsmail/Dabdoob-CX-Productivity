/**
 * hmSourceCells_ / buildHeatmapFromSource — the DB-only heatmap source.
 * Fixture rows per mirror table -> exact header+rows grids (Cairo wall-clock
 * ts cells, '' country fallback, wa_parcels flag mapping), the absent
 * heatmap_excluded_groups config -> header-only grid, and the 56-day default
 * window bound on the maqsam ts_ms filter.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  configs: {} as Record<string, unknown>,
  pagedCalls: [] as { table: string; columns?: string; pk?: string; filters: [string, string, unknown][] }[],
  dbCalls: [] as { table: string; filters: [string, string, unknown][]; order?: string }[],
  stored: [] as Record<string, unknown>[],
}))

function cmp(a: unknown, b: unknown): number {
  const an = Number(a)
  const bn = Number(b)
  if (isFinite(an) && isFinite(bn) && String(a).trim() !== '' && String(b).trim() !== '') return an - bn
  const as = String(a ?? '')
  const bs = String(b ?? '')
  return as < bs ? -1 : as > bs ? 1 : 0
}

function applyFilters(rows: Record<string, unknown>[], filters: [string, string, unknown][]): Record<string, unknown>[] {
  return rows.filter((r) =>
    filters.every(([op, c, v]) => {
      const rv = r[c]
      if (op === 'eq') return cmp(rv, v) === 0
      if (op === 'gte') return cmp(rv, v) >= 0
      if (op === 'lt') return cmp(rv, v) < 0
      if (op === 'lte') return cmp(rv, v) <= 0
      return true
    })
  )
}

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
    h.pagedCalls.push({ table, columns: opts?.columns, pk: opts?.pk, filters })
    return applyFilters(h.tables[table] || [], filters)
  },
  db: () => ({
    from: (table: string) => ({
      select: () => {
        const filters: [string, string, unknown][] = []
        let orderCol: string | undefined
        const query = {
          eq: (c: string, v: unknown) => (filters.push(['eq', c, v]), query),
          gte: (c: string, v: unknown) => (filters.push(['gte', c, v]), query),
          lt: (c: string, v: unknown) => (filters.push(['lt', c, v]), query),
          order: (c: string) => ((orderCol = c), query),
          then: (res: (v: unknown) => unknown, rej?: (e: unknown) => unknown) => {
            h.dbCalls.push({ table, filters, order: orderCol })
            let rows = applyFilters(h.tables[table] || [], filters)
            if (orderCol) rows = rows.slice().sort((a, b) => cmp(a[orderCol!], b[orderCol!]))
            return Promise.resolve({ data: rows, error: null }).then(res, rej)
          },
        }
        return query
      },
    }),
  }),
  appendRow: async (table: string, row: Record<string, unknown>) => {
    h.stored.push({ table, ...row })
    return { input_id: 'hmi_x', ...row }
  },
  findRow: async () => null,
  newId: (p: string) => p + '_x',
}))

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (key: string, dflt: unknown) => (h.configs[key] !== undefined ? h.configs[key] : dflt),
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/identity', () => ({
  requireRole: async () => ({ role: 'admin', email: 'admin@test' }),
}))

vi.mock('@/features/shared/platform/viewas', () => ({
  assertWritable: async () => undefined,
  VIEW_AS_READONLY: 'view-as-readonly',
}))

import { buildHeatmapFromSource, hmSourceCells_ } from '@/features/cx-queue/lib/heatmap'
import { dqAddDays_, dqDateKey_, formatDate_ } from '@/features/shared/lib/adapters'

const cairo = (iso: string) => formatDate_(Date.parse(iso), 'Africa/Cairo', 'yyyy-MM-dd HH:mm:ss')

describe('hmSourceCells_', () => {
  beforeEach(() => {
    h.tables = {}
    h.configs = {}
    h.pagedCalls = []
    h.dbCalls = []
    h.stored = []
  })

  it('emits the five grids cell-for-cell from fixture rows', async () => {
    h.tables.maqsam_calls = [
      { started_at: '2026-10-08T09:00:00.000Z', state: 'serviced', direction: 'inbound', ts_ms: Date.parse('2026-10-08T09:00:00.000Z') },
      { started_at: '2026-10-08T10:00:00.000Z', state: 'out of hours', direction: 'inbound', ts_ms: Date.parse('2026-10-08T10:00:00.000Z') },
    ]
    h.tables.freshchat = [
      { initiated_at: '2026-10-09T08:30:00.000Z', status: 'resolved', channel: 'IG_app', ts_ms: Date.parse('2026-10-09T09:00:00.000Z') },
      { initiated_at: '2026-11-20T08:30:00.000Z', status: 'open', channel: 'web', ts_ms: Date.parse('2026-11-20T09:00:00.000Z') },
    ]
    h.tables.tickets = [
      { created_at: '2026-10-10T12:00:00.000Z', group_name: 'Support', country: 'Kuwait' },
      { created_at: '2026-10-10T13:00:00.000Z', group_name: 'Sales', country: '' },
    ]
    h.tables.tracker_records = [
      { tracker_id: 'wa_parcels', row_n: 2, values: { creation_date: '2026-10-11', status_3pl: 'Address Confirmed', country: 'KSA', confirmed: '1' } },
      { tracker_id: 'wa_parcels', row_n: 3, values: { creation_date: '2026-10-12', status_3pl: "Customer Didn't Answer", country: 'UAE' } },
      { tracker_id: 'wa_parcels', row_n: 4, values: { date_only: '2026-10-13', status_3pl: 'In transit', country: 'Qatar' } },
      { tracker_id: 'other_tracker', row_n: 1, values: { creation_date: '2026-10-11' } },
    ]
    h.configs.heatmap_excluded_groups = ['Ops Kuwait - Gift cards']

    const grids = await hmSourceCells_({ from: '2026-10-01', to: '2026-10-31' })

    expect(grids.Maqsam).toEqual([
      ['Start time', 'Call direction', 'Call state', 'Country'],
      [cairo('2026-10-08T09:00:00.000Z'), 'inbound', 'serviced', ''],
      [cairo('2026-10-08T10:00:00.000Z'), 'inbound', 'out of hours', ''],
    ])
    expect(grids.Freshchat).toEqual([
      ['Initiated At', 'Channel', 'Bot conversation flag', 'Status', 'Country'],
      [cairo('2026-10-09T08:30:00.000Z'), 'IG_app', '', 'resolved', ''],
    ])
    expect(grids.Freshdesk).toEqual([
      ['Created date', 'Group name', 'Group Check', 'Country'],
      [cairo('2026-10-10T12:00:00.000Z'), 'Support', '', 'Kuwait'],
      [cairo('2026-10-10T13:00:00.000Z'), 'Sales', '', ''],
    ])
    expect(grids.WA).toEqual([
      ['invoice_creation_date', 'Address Confirmed3', "Customer Didn't Answer3", 'Country_Name'],
      ['2026-10-11', 1, '', 'KSA'],
      ['2026-10-12', '', 1, 'UAE'],
      ['2026-10-13', '', '', 'Qatar'],
    ])
    expect(grids['Excluded Groups']).toEqual([
      ['Group name', 'In/excluded'],
      ['Ops Kuwait - Gift cards', 'Excluded'],
    ])

    const mq = h.pagedCalls.find((c) => c.table === 'maqsam_calls')
    expect(mq?.filters).toContainEqual(['gte', 'ts_ms', Date.parse('2026-10-01T00:00:00Z') - 86400000])
    expect(mq?.filters).toContainEqual(['lt', 'ts_ms', Date.parse('2026-11-01T00:00:00Z')])
    const fc = h.pagedCalls.find((c) => c.table === 'freshchat')
    expect(fc?.filters).toContainEqual(['gte', 'ts_ms', Date.parse('2026-10-01T00:00:00Z') - 7 * 86400000])
    expect(fc?.filters).toContainEqual(['lt', 'ts_ms', Date.parse('2026-11-01T00:00:00Z')])
    expect(fc?.pk).toBe('ts_ms')
    const fd = h.pagedCalls.find((c) => c.table === 'tickets')
    expect(fd?.filters).toContainEqual(['gte', 'created_at', new Date(Date.parse('2026-10-01T00:00:00Z')).toISOString()])
    expect(fd?.filters).toContainEqual(['lt', 'created_at', '2026-11-01T00:00:00.000Z'])
    const waCall = h.pagedCalls.find((c) => c.table === 'tracker_records')
    expect(waCall?.filters).toContainEqual(['eq', 'tracker_id', 'wa_parcels'])
    expect(waCall?.pk).toBe('row_n')
    expect(h.dbCalls.find((c) => c.table === 'tickets' || c.table === 'tracker_records')).toBeUndefined()
  })

  it('absent heatmap_excluded_groups -> header-only Excluded Groups grid', async () => {
    const grids = await hmSourceCells_({ from: '2026-10-01', to: '2026-10-31' })
    expect(grids['Excluded Groups']).toEqual([['Group name', 'In/excluded']])
  })
})

describe('buildHeatmapFromSource', () => {
  beforeEach(() => {
    h.tables = {}
    h.configs = {}
    h.pagedCalls = []
    h.dbCalls = []
    h.stored = []
  })

  it('defaults the window to the last 8 weeks and marks provenance db_mirrors', async () => {
    const now = new Date()
    h.tables.maqsam_calls = [
      { started_at: now.toISOString(), state: 'serviced', direction: 'inbound', ts_ms: now.getTime() },
    ]
    const res = await buildHeatmapFromSource(undefined, {})
    expect(((res.heatmap as { cells: unknown[] }).cells).length).toBeGreaterThan(0)
    const fromMs = Date.parse(dqAddDays_(dqDateKey_(now), -56) + 'T00:00:00Z')
    const mq = h.pagedCalls.find((c) => c.table === 'maqsam_calls')
    expect(mq?.filters).toContainEqual(['gte', 'ts_ms', fromMs - 86400000])
    const stored = h.stored[0]
    expect(stored?.source).toBe('db_mirrors')
    expect(String(stored?.notes)).toContain('Defaulted to the last 8 weeks')
    expect(String(stored?.notes)).not.toContain('Bot flag unavailable')
  })

  it('notes the missing bot flag when freshchat mirror rows exist', async () => {
    const now = new Date()
    h.tables.maqsam_calls = [
      { started_at: now.toISOString(), state: 'serviced', direction: 'inbound', ts_ms: now.getTime() },
    ]
    h.tables.freshchat = [
      { initiated_at: now.toISOString(), status: 'resolved', channel: 'web', ts_ms: now.getTime() },
    ]
    const res = await buildHeatmapFromSource(undefined, {})
    expect(((res.heatmap as { cells: unknown[] }).cells).length).toBeGreaterThan(0)
    expect(String(h.stored[0]?.notes)).toContain('Bot flag unavailable in the freshchat mirror')
  })
})
