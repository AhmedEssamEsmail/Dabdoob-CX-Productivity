/**
 * qe_fd_cache populate inside qeReadTicketDetail_ (S01-03): every fetched
 * ticket-detail row is upserted on id with a fresh cached_at, rows older than
 * QE_FD_CACHE_KEEP_DAYS are pruned, and cache failures are logged to
 * refresh_log without breaking the queue build.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tickets: [] as Record<string, unknown>[],
  upserts: [] as { table: string; rows: Record<string, unknown>[]; onConflict: string }[],
  deletes: [] as { table: string; col: string; cutoff: string }[],
  logs: [] as Record<string, unknown>[],
  cacheErr: null as { message: string } | null,
}))

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({
    from: (table: string) => ({
      select: () => ({
        in: async (_col: string, ids: string[]) => ({
          data: table === 'tickets' ? h.tickets.filter((r) => ids.indexOf(String(r.ticket_id)) >= 0) : [],
          error: null,
        }),
      }),
      upsert: async (rows: Record<string, unknown>[], opts: { onConflict: string }) => {
        if (h.cacheErr) return { error: h.cacheErr }
        h.upserts.push({ table, rows, onConflict: opts.onConflict })
        return { error: null }
      },
      delete: () => ({
        lt: async (col: string, cutoff: string) => {
          if (h.cacheErr) return { error: h.cacheErr }
          h.deletes.push({ table, col, cutoff })
          return { error: null }
        },
      }),
    }),
  }),
  appendRow: async (table: string, obj: Record<string, unknown>) => {
    h.logs.push({ table, ...obj })
    return obj
  },
  readRows: async () => [],
  sanitizeInput: (o: unknown) => o,
}))

import { qeReadTicketDetail_ } from '@/features/cx-quality/lib/engine-live'
import { QE_FD_CACHE_KEEP_DAYS } from '@/features/cx-quality/lib/engine'

const TICKET = {
  ticket_id: '9001', group_name: 'CX Chat', contact_type_1: 'Support',
  contact_type_2: 'Order', contact_type_3: 'Late', subject: 'Where is my order?',
  status: 'Open', country: 'KW', order_id: 'SO-123', channel: 'Chat', source: 'Email',
  created_at: '2026-11-01T08:00:00.000Z',
}

const CACHE_KEYS = [
  'id', 'group_name', 'contact_type_1', 'contact_type_2', 'contact_type_3',
  'subject', 'status', 'country', 'order_id', 'channel', 'source', 'created_at', 'cached_at',
]

describe('qe_fd_cache populate in qeReadTicketDetail_', () => {
  beforeEach(() => {
    h.tickets = [{ ...TICKET }]
    h.upserts = []
    h.deletes = []
    h.logs = []
    h.cacheErr = null
  })

  it('upserts each fetched row on id in the 13-column cache shape', async () => {
    const res = await qeReadTicketDetail_({ '9001': true }, new Date('2026-11-10T00:00:00Z'))
    expect(res.index['9001'].subject).toBe('Where is my order?')
    expect(h.upserts).toHaveLength(1)
    const up = h.upserts[0]
    expect(up.table).toBe('qe_fd_cache')
    expect(up.onConflict).toBe('id')
    expect(up.rows).toHaveLength(1)
    const row = up.rows[0]
    expect(Object.keys(row).sort()).toEqual([...CACHE_KEYS].sort())
    expect(row.id).toBe('9001')
    expect(row.group_name).toBe('CX Chat')
    expect(row.order_id).toBe('SO-123')
    expect(row.created_at).toBe('2026-11-01T08:00:00.000Z')
  })

  it('stamps a fresh cached_at on every cached row', async () => {
    const before = new Date().toISOString()
    await qeReadTicketDetail_({ '9001': true }, new Date())
    const after = new Date().toISOString()
    const cachedAt = String(h.upserts[0].rows[0].cached_at)
    expect(cachedAt >= before && cachedAt <= after).toBe(true)
  })

  it('prunes cached_at older than QE_FD_CACHE_KEEP_DAYS', async () => {
    await qeReadTicketDetail_({ '9001': true }, new Date())
    expect(h.deletes).toHaveLength(1)
    const d = h.deletes[0]
    expect(d.table).toBe('qe_fd_cache')
    expect(d.col).toBe('cached_at')
    const cutoffMs = Date.parse(d.cutoff)
    const expectMs = Date.now() - QE_FD_CACHE_KEEP_DAYS * 86400000
    expect(Math.abs(cutoffMs - expectMs)).toBeLessThan(60000)
  })

  it('logs cache failures to refresh_log instead of throwing', async () => {
    h.cacheErr = { message: 'qe_fd_cache write denied' }
    const res = await qeReadTicketDetail_({ '9001': true }, new Date())
    expect(res.index['9001']).toBeTruthy()
    const log = h.logs.find((l) => l.table === 'refresh_log')
    expect(log).toBeTruthy()
    expect(log!.job).toBe('qe_fd_cache')
    expect(log!.status).toBe('error')
    expect(String(log!.error)).toContain('qe_fd_cache write denied')
  })

  it('is a cache no-op when no ticket ids are needed', async () => {
    const res = await qeReadTicketDetail_({}, new Date())
    expect(res.index).toEqual({})
    expect(h.upserts).toHaveLength(0)
    expect(h.deletes).toHaveLength(0)
  })
})
