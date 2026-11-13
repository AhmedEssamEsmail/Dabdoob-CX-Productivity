/**
 * fdTicketToRow_ / dqUpsertTickets_ — the `tickets` mirror row shape on typed
 * Postgres columns. Regression: '' in a timestamptz/integer upsert threw
 * `invalid input syntax for type timestamp with time zone: ""`, killed every
 * freshdesk_sync batch after the typed-mirror cutover, and froze the mirror
 * (closed tickets stayed open on the aging board).
 */
import { describe, expect, it, vi } from 'vitest'

const upserts: { rows: Record<string, unknown>[]; onConflict: string }[] = []

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async () => undefined,
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({
    from: () => ({
      select: async () => ({ data: [], error: null }),
      upsert: async (rows: Record<string, unknown>[], opts: { onConflict: string }) => {
        upserts.push({ rows, onConflict: opts.onConflict })
        return { error: null }
      },
    }),
  }),
  appendRow: async () => undefined,
  cacheGet: () => null,
  cachePut: () => undefined,
  newId: (p: string) => p + '_x',
}))

import { dqUpsertTickets_, fdIso_, fdTicketToRow_ } from '@/features/shared/jobs/freshdesk'

describe('fdIso_', () => {
  it("returns null for missing/invalid input — '' breaks timestamptz inserts", () => {
    expect(fdIso_(undefined)).toBeNull()
    expect(fdIso_(null)).toBeNull()
    expect(fdIso_('')).toBeNull()
    expect(fdIso_('not-a-date')).toBeNull()
  })
  it('normalizes parseable input to ISO', () => {
    expect(fdIso_('2026-11-04T11:24:49Z')).toBe('2026-11-04T11:24:49.000Z')
  })
})

describe('fdTicketToRow_', () => {
  const groups = { '900': 'Refunds - CX Group' }
  it("emits null (not '') for absent stats/timestamps and priority", () => {
    const row = fdTicketToRow_(
      { id: 351136, status: 10, group_id: 900, custom_fields: {}, stats: {} },
      groups,
      '2026-11-13T00:00:00.000Z'
    )
    expect(row.resolved_at).toBeNull()
    expect(row.closed_at).toBeNull()
    expect(row.first_responded_at).toBeNull()
    expect(row.status_updated_at).toBeNull()
    expect(row.due_by).toBeNull()
    expect(row.fr_due_by).toBeNull()
    expect(row.priority).toBeNull()
    expect(row.status).toBe('Pending on 3PL')
    expect(row.group_name).toBe('Refunds - CX Group')
  })
  it('keeps present timestamps and priority', () => {
    const row = fdTicketToRow_(
      {
        id: 1, status: 5, priority: 2,
        created_at: '2026-11-01T00:00:00Z', updated_at: '2026-11-02T00:00:00Z',
        stats: { resolved_at: '2026-11-02T01:00:00Z', closed_at: '2026-11-03T01:00:00Z' },
      },
      groups,
      '2026-11-13T00:00:00.000Z'
    )
    expect(row.resolved_at).toBe('2026-11-02T01:00:00.000Z')
    expect(row.closed_at).toBe('2026-11-03T01:00:00.000Z')
    expect(row.priority).toBe(2)
    expect(row.status).toBe('Closed')
  })
})

describe('dqUpsertTickets_', () => {
  it('chunks large batches so a catch-up cannot exceed the payload cap', async () => {
    upserts.length = 0
    const rows = Array.from({ length: 1200 }, (_, i) => ({ ticket_id: String(i) }))
    const res = await dqUpsertTickets_(rows)
    expect(res.updated).toBe(1200)
    expect(upserts.length).toBe(3)
    expect(upserts.map((u) => u.rows.length)).toEqual([500, 500, 200])
    expect(upserts[0].onConflict).toBe('ticket_id')
  })
})
