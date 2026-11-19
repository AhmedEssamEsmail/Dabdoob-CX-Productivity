/**
 * Regression — qa-build-no-touches (debug-1).
 *
 * "Build the queue now" threw "No agent touches found in the 3-day window ...
 * 1000 performers unresolved, roster 50 users." Two proven defects:
 *
 *  A) roster.freshdesk_id/freshdesk_name are empty for all 50 prod rows —
 *     dqSyncRoster_ skips rows whose source !== 'hct' (every migrated row is
 *     'manual'), so the FD-identity columns never populate. With the roster
 *     directory empty, the mirror writer stores 'User <fd_id>' and the
 *     reader's byId is empty -> 100% unresolved.
 *  B) qeReadAgentRoster_ keys byName on `r.fd_name || r.name` — the
 *     `freshdesk_name` column is never indexed, yet the mirror writer stores
 *     freshdesk_name (the FD display name), which differs from roster.name
 *     for 30/43 prod agents ("Noha Hassan" vs "Noha Hassan Foaad Qandil").
 *     Even with (A) fixed, freshly-written rows stay unresolved.
 *
 * Fixture = the post-(A) data state: roster carries freshdesk_id +
 * freshdesk_name. 'User <id>' rows must resolve via byId; freshdesk_name
 * rows via byName — the second case fails until (B) is fixed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  settings: {} as Record<string, unknown>,
}))

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (key: string, dflt: unknown) =>
    key === 'qa_engine_settings' ? h.settings : dflt,
  setConfig: async () => undefined,
}))

vi.mock('@/features/shared/platform/repo', () => {
  const rowsFor = (table: string, inFilter: { col: string; vals: string[] } | null) => {
    let r = h.tables[table] || []
    if (inFilter) r = r.filter((x) => inFilter.vals.indexOf(String(x[inFilter.col])) >= 0)
    return r
  }
  return {
    db: () => ({
      from: (table: string) => {
        let inFilter: { col: string; vals: string[] } | null = null
        const b: Record<string, unknown> & { then?: unknown } = {
          select: () => b,
          gte: () => b,
          lt: () => b,
          order: () => b,
          limit: () => b,
          range: async () => ({ data: rowsFor(table, inFilter), error: null }),
          in: (col: string, vals: string[]) => {
            inFilter = { col, vals }
            return b
          },
          eq: () => b,
          neq: () => b,
          insert: async () => ({ error: null }),
          upsert: async () => ({ error: null }),
          delete: () => b,
          maybeSingle: async () => ({ data: null, error: null }),
          then: (res: (v: unknown) => unknown) => res({ data: rowsFor(table, inFilter), error: null }),
        }
        return b
      },
    }),
    readRows: async (table: string) => h.tables[table] || [],
    appendRow: async (_t: string, o: Record<string, unknown>) => o,
    newId: (p: string) => p + '_test',
    sanitizeInput: (o: unknown) => o,
  }
})

import { qeBuildQueue } from '@/features/cx-quality/lib/engine-live'

const NOW = new Date('2026-11-19T12:00:00.000Z')
const FD_ID = '501009694166'
const ROSTER = [
  {
    email: 'noha@dabdoob.com',
    name: 'Noha Hassan Foaad Qandil',
    freshdesk_id: FD_ID,
    freshdesk_name: 'Noha Hassan',
    role: 'agent',
    active: true,
  },
]
// One ticket, three in-window touches — enough for minTouches: 1.
const acts = (performerName: string) =>
  ['2026-11-18T08:00:00.000Z', '2026-11-18T09:00:00.000Z', '2026-11-18T10:00:00.000Z'].map((at, i) => ({
    ts_ms: Date.parse(at),
    performed_at: at,
    ticket_id: '9001',
    performer_name: performerName,
    performer_type: 'user',
    activity_type: 'Status Change',
    field_changed: 'status',
    new_value: 'Open',
    old_value: '',
    group_name: 'Kuwait Ops',
  }))
const TICKET = {
  ticket_id: '9001', group_name: 'Kuwait Ops', contact_type_1: 'Support',
  contact_type_2: 'Orders', contact_type_3: '', subject: 's', status: 'Open',
  country: 'KW', order_id: 'SO-1', channel: 'Tickets', source: 'Email',
  created_at: '2026-11-17T08:00:00.000Z',
}

function stage(performerName: string) {
  h.tables = {
    roster: ROSTER.map((r) => ({ ...r })),
    fd_activities: acts(performerName),
    tickets: [{ ...TICKET }],
    qe_queue_log: [],
    qe_candidates: [],
    qe_catalogue: [],
  }
  h.settings = { minTouches: 1, requireCustomerFacing: false }
}

describe('qeBuildQueue performer resolution (fd_activities performer_name vs roster)', () => {
  beforeEach(() => vi.clearAllMocks())

  it("resolves 'User <fd_id>' rows via roster.freshdesk_id", async () => {
    stage('User ' + FD_ID)
    const res = await qeBuildQueue('day', 'test', { skipMigrationCheck: true, now: NOW })
    expect(res.queued as number).toBeGreaterThanOrEqual(1)
    expect(res.touchesInWindow as number).toBe(3)
  })

  it('resolves freshdesk_name (FD display name) rows even when it differs from roster.name', async () => {
    stage('Noha Hassan') // what fdActivityToCells_ writes once the roster has fd columns
    const res = await qeBuildQueue('day', 'test', { skipMigrationCheck: true, now: NOW })
    expect(res.queued as number).toBeGreaterThanOrEqual(1)
    expect(res.touchesInWindow as number).toBe(3)
  })

  it('still reports an actionable error when no performer can be resolved', async () => {
    stage('User 999999999999') // fd id not on the roster
    await expect(
      qeBuildQueue('day', 'test', { skipMigrationCheck: true, now: NOW })
    ).rejects.toThrow('No agent touches')
  })
})
