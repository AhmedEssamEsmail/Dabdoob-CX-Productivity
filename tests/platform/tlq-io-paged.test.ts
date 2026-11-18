/**
 * tlqIo_ paged reads (data3-03): tracker_records and tickets go through
 * readAllPaged — the PK-ordered .range pager — so PostgREST max-rows can't
 * silently truncate OL tracker rows or the texting-window tickets. Neither
 * table may appear in an unpaged db().from() call.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  pagedCalls: [] as { table: string; columns?: string; pk?: string | string[]; filters: [string, string, unknown][] }[],
  dbCalls: [] as string[],
}))

vi.mock('@/features/shared/platform/repo', () => ({
  readAllPaged: async (table: string, opts?: { columns?: string; pk?: string | string[]; build?: (q: never) => never }) => {
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
    return []
  },
  db: () => ({
    from: (table: string) => {
      h.dbCalls.push(table)
      throw new Error(`unpaged db().from('${table}')`)
    },
  }),
  appendRow: async () => ({}),
  findRow: async () => null,
  newId: (p: string) => p + '_x',
}))

vi.mock('@/features/shared/platform/settings', () => ({
  configAll: async () => ({}),
  getConfig: async (_key: string, dflt: unknown) => dflt,
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/stores', () => ({
  readStore: async () => ({ rows: [] }),
}))

import { tlqIo_ } from '@/features/cx-queue/lib/tlqueue'
import { FD_TICKET_HEADERS } from '@/features/cx-queue/lib/index'

describe('tlqIo_ paged reads', () => {
  beforeEach(() => {
    h.pagedCalls = []
    h.dbCalls = []
  })

  it('ticketsSince pages tickets with the created_at >= since filter and FD headers', async () => {
    const io = await tlqIo_()
    const rows = await io.ticketsSince('2026-10-01')
    expect(rows).toEqual([])
    const call = h.pagedCalls.find((c) => c.table === 'tickets')
    expect(call?.filters).toContainEqual(['gte', 'created_at', '2026-10-01'])
    expect(call?.columns).toBe(FD_TICKET_HEADERS.join(','))
    expect(h.dbCalls).not.toContain('tickets')
  })

  it('trackerRecords pages tracker_records pk [row_n, record_id] with the tracker_id filter', async () => {
    const io = await tlqIo_()
    const rows = await io.trackerRecords('operational_loss')
    expect(rows).toEqual([])
    const call = h.pagedCalls.find((c) => c.table === 'tracker_records')
    expect(call?.filters).toContainEqual(['eq', 'tracker_id', 'operational_loss'])
    expect(call?.pk).toEqual(['row_n', 'record_id'])
    expect(h.dbCalls).not.toContain('tracker_records')
  })
})
