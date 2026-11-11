import { describe, it, expect, vi, beforeEach } from 'vitest'

// P-15: the four single-row lookups must go through readStoreFiltered with a
// bounded filter while returning the same hit/miss outcome as the old
// whole-table readStore + JS scan. The stores double below applies eq/in/is
// like Postgres so parity is exercised end to end.
type FilterArg = {
  eq?: Record<string, unknown>
  is?: Record<string, unknown>
  in?: Record<string, unknown>
}
const h = vi.hoisted(() => {
  const tables: Record<string, Record<string, unknown>[]> = {}
  const calls: { table: string; f: Record<string, unknown> }[] = []
  let rosterMisses = 0
  const match = (r: Record<string, unknown>, f: FilterArg = {}) =>
    Object.entries(f.eq || {}).every(([k, v]) => String(r[k]) === String(v)) &&
    Object.entries(f.is || {}).every(([k]) => r[k] === null || r[k] === undefined) &&
    Object.entries(f.in || {}).every(([k, vs]) => (vs as unknown[]).map(String).includes(String(r[k])))
  const readStoreFiltered = async (table: string, f: FilterArg = {}) => {
    calls.push({ table, f })
    return { rows: (tables[table] || []).filter((r) => match(r, f)), exists: true }
  }
  const readStore = async (table: string) => ({ rows: tables[table] || [], exists: true })
  return { tables, calls, readStore, readStoreFiltered, get rosterMisses() { return rosterMisses }, set rosterMisses(v: number) { rosterMisses = v } }
})

vi.mock('@/features/shared/platform/stores', () => ({
  readStore: h.readStore,
  readStoreFiltered: h.readStoreFiltered,
}))
vi.mock('@/features/shared/platform', () => ({
  readStore: h.readStore,
  readStoreFiltered: h.readStoreFiltered,
  requireRole: async () => ({ email: 'admin@dabdoob.com', role: 'admin' }),
  configAll: async () => ({}),
  getConfig: async () => ({}),
  setConfig: async () => ({}),
  appendRow: async (t: string, row: Record<string, unknown>) => {
    ;(h.tables[t] = h.tables[t] || []).push(row)
    return row
  },
  appendRows: async () => [],
  updateRow: async (t: string, col: string, val: unknown, patch: Record<string, unknown>) => {
    if (t === 'roster' && h.rosterMisses > 0) {
      h.rosterMisses--
      return null
    }
    const r = (h.tables[t] || []).find((x) => String(x[col]) === String(val))
    if (r) Object.assign(r, patch)
    return r || null
  },
  updateRows: async () => [],
}))
vi.mock('@/features/shared/platform/identity', () => ({
  requireRole: async () => ({ email: 'admin@dabdoob.com', role: 'admin' }),
  requireJobCaller: async () => ({ email: 'cron@dabdoob.com' }),
  normEmail: (e: unknown) => String(e || '').trim().toLowerCase(),
  pwDirectory: () => ({ name: (e: unknown) => String(e || '') }),
}))
vi.mock('@/features/shared/platform/viewas', () => ({ assertWritable: async () => {} }))
vi.mock('@/features/shared/platform/health', () => ({ hbBeat: () => {}, hbFlush: async () => {} }))
vi.mock('@/features/shared/platform/calendar', () => ({
  wcReset: () => {},
  dqParseDaysOff: (v: unknown) =>
    Array.isArray(v) ? v : String(v || '').split(',').map((s) => s.trim()).filter(Boolean),
}))
vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async () => ({}),
  configAll: async () => ({}),
}))
vi.mock('@/features/shared/platform/repo', () => ({
  newId: () => 'new-id',
  db: () => ({
    from: () => ({
      update: () => ({
        eq: () => ({ is: () => ({ select: async () => ({ data: [{}], error: null }) }) }),
      }),
    }),
  }),
}))
vi.mock('@/features/cx-people/lib/kpi', () => ({
  KPI_LEAVE_TYPES: ['annual'],
  kpiLogRows_: (rows: unknown[]) => rows,
}))
vi.mock('@/features/cx-desk/lib/tlperformance', () => ({ tlpAreasFor_: async () => [] }))
vi.mock('@/features/cx-queue/lib/jobs', () => ({ dqLogRun_: async () => {} }))

import { kpiLogRemove } from '@/features/cx-desk/lib/kpilogs'
import { setPersonV2Fields, addHoliday, removeHoliday } from '@/features/cx-hub/lib/roster'

beforeEach(() => {
  for (const k of Object.keys(h.tables)) delete h.tables[k]
  h.calls.length = 0
  h.rosterMisses = 0
})

describe('P-15 bounded lookups', () => {
  it('kpiLogRemove filters by key + removed_at and keeps hit/miss outcomes', async () => {
    h.tables.kpi_behaviour_log = [
      { log_id: 'BH1', removed_at: null, logged_by: 'admin@dabdoob.com' },
      { log_id: 'BH2', removed_at: '2026-01-01T00:00:00Z', logged_by: 'admin@dabdoob.com' },
    ]
    await expect(kpiLogRemove('behaviour', 'BH1')).resolves.toEqual({ id: 'BH1' })
    await expect(kpiLogRemove('behaviour', 'BH2')).rejects.toThrow('no longer there')
    await expect(kpiLogRemove('behaviour', 'NOPE')).rejects.toThrow('no longer there')
    expect(h.calls[0].f).toEqual({ eq: { log_id: 'BH1' }, is: { removed_at: null } })
  })

  it('setPersonV2Fields email fallback uses eq email and still finds the row', async () => {
    h.tables.roster = [{ email: 'agent@dabdoob.com', name: 'Agent' }]
    h.rosterMisses = 1 // first updateRow misses -> fallback read runs
    const out = await setPersonV2Fields('agent@dabdoob.com', {
      basedInCountry: 'Kuwait',
      daysOff: ['Sat', 'Sun'],
    })
    expect(out.email).toBe('agent@dabdoob.com')
    expect(h.calls.find((c) => c.table === 'roster')?.f).toEqual({ eq: { email: 'agent@dabdoob.com' } })
    h.tables.roster = []
    await expect(
      setPersonV2Fields('ghost@dabdoob.com', { basedInCountry: 'Kuwait', daysOff: [] })
    ).rejects.toThrow('No roster row')
  })

  it('dqIsHoliday_ (via addHoliday) bounds by date and still guards country case-insensitively', async () => {
    h.tables.holidays = [
      { id: 1, country: 'Kuwait', date: '2026-01-01', deleted_at: null },
      { id: 2, country: 'Kuwait', date: '2026-02-01', deleted_at: '2026-01-05T00:00:00Z' },
    ]
    await expect(addHoliday({ country: 'Kuwait', date: '2026-01-01', name: 'New Year' })).rejects.toThrow(
      'already has a holiday'
    )
    await expect(addHoliday({ country: 'Kuwait', date: '2026-02-01', name: 'Re-add' })).resolves.toMatchObject({
      country: 'Kuwait',
    })
    expect(h.calls[0].f).toEqual({ eq: { date: '2026-01-01' }, is: { deleted_at: null } })
  })

  it('removeHoliday bounds by id, keeps repeat-removal, and misses unknown ids', async () => {
    h.tables.holidays = [
      { id: 7, country: 'Kuwait', date: '2026-01-01', name: 'NY', deleted_at: null },
      { id: 8, country: 'Kuwait', date: '2026-02-01', name: 'Old', deleted_at: '2026-01-01T00:00:00Z' },
    ]
    await expect(removeHoliday('8')).resolves.toEqual({ id: '8' })
    expect(h.calls[0].f).toEqual({ eq: { id: '8' } })
    await expect(removeHoliday('999')).rejects.toThrow('no longer exists')
  })
})
