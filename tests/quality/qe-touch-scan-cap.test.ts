/**
 * Regression — qa-build-missing-agents (debug-1).
 *
 * The 2026-11-20 14:49 build gave seven under-quota agents zero samples with
 * reason codes 'min'/'cf'/'none'. Root cause proven from qe_outcomes +
 * fd_activities: qeReadTouches_ issues ONE `.limit(QE_MAX_TOUCH_ROWS = 60000)`
 * query, but PostgREST silently caps every response at max-rows (1000 on
 * prod). The newest-first scan therefore saw only ~1000 activity rows
 * (2026-11-19 13:42..21:18 UTC out of a 7-day read window of ~16k rows) —
 * the per-agent pair counts in the build's own outcomes (t=24/25/33/30/12/5/0)
 * match the capped subset EXACTLY, while the real in-window counts are
 * 56..208 pairs per agent. The legacy 'chunked bottom-up scan' lost its
 * chunking in the port.
 *
 * This test emulates the PostgREST cap (any terminal response returns at
 * most MAX_ROWS rows; range() paging is honest). With the truncation, the
 * build sees only the newest MAX_ROWS activities.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const MAX_ROWS = 1000 // PostgREST max-rows on the linked project

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  settings: {} as Record<string, unknown>,
  reads: [] as { table: string; ops: unknown[][] }[],
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
        const ops: unknown[][] = []
        h.reads.push({ table, ops })
        let inFilter: { col: string; vals: string[] } | null = null
        let orderCol = ''
        let orderAsc = true
        let limitN = Infinity
        const apply = (): Record<string, unknown>[] => {
          let r = rowsFor(table, inFilter)
          if (orderCol) {
            r = r.slice().sort((a, b) => {
              const d = Number(a[orderCol]) - Number(b[orderCol])
              return orderAsc ? d : -d
            })
          }
          // PostgREST: ORDER + LIMIT then hard max-rows truncation.
          return r.slice(0, Math.min(limitN, MAX_ROWS))
        }
        const b: Record<string, unknown> & { then?: unknown } = {
          select: () => b,
          gte: () => b,
          lt: () => b,
          order: (col: string, o: { ascending?: boolean }) => {
            orderCol = col
            orderAsc = o?.ascending !== false
            ops.push(['order', col])
            return b
          },
          limit: (n: number) => {
            limitN = n
            ops.push(['limit', n])
            return b
          },
          range: async (from: number, to: number) => {
            // Honest paging: slice the ordered set, still capped per response.
            let r = rowsFor(table, inFilter)
            if (orderCol) {
              r = r.slice().sort((a, b2) => {
                const d = Number(a[orderCol]) - Number(b2[orderCol])
                return orderAsc ? d : -d
              })
            }
            return { data: r.slice(from, Math.min(to + 1, from + MAX_ROWS)), error: null }
          },
          in: (col: string, vals: string[]) => {
            inFilter = { col, vals }
            ops.push(['in', col])
            return b
          },
          eq: () => b,
          neq: () => b,
          insert: async () => ({ error: null }),
          upsert: async () => ({ error: null }),
          delete: () => b,
          maybeSingle: async () => ({ data: null, error: null }),
          then: (res: (v: unknown) => unknown) => res({ data: apply(), error: null }),
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

const NOW = new Date('2026-11-19T12:00:00.000Z') // Riyadh 15:00; draw window 11-18..11-19
const FD_ID = '501008259111'
const ACT_COUNT = 2500 // > MAX_ROWS: prod had ~16k in the read window

function stage() {
  const acts: Record<string, unknown>[] = []
  const tickets: Record<string, unknown>[] = []
  for (let i = 0; i < ACT_COUNT; i++) {
    const ts = Date.parse('2026-11-18T06:00:00.000Z') + i * 30000 // 30 s apart, ~21 h
    const tid = 'T' + String(700000 + i)
    acts.push({
      ts_ms: ts,
      performed_at: new Date(ts).toISOString(),
      ticket_id: tid,
      performer_name: 'User ' + FD_ID,
      performer_type: 'user',
      activity_type: 'Status Change',
      field_changed: 'status',
      new_value: 'Open',
      old_value: '',
      group_name: 'Kuwait Ops',
    })
    tickets.push({
      ticket_id: tid, group_name: 'Kuwait Ops', contact_type_1: 'Support',
      contact_type_2: 'Orders', contact_type_3: '', subject: 's', status: 'Open',
      country: 'KW', order_id: 'SO-' + i, channel: 'Tickets', source: 'Email',
      created_at: '2026-11-18T05:00:00.000Z',
    })
  }
  h.tables = {
    roster: [{
      email: 'maria.mamdouh@dabdoob.com', name: 'Maria Mamdouh Youssif Hanna',
      freshdesk_id: FD_ID, freshdesk_name: 'Maria Mamdouh Youssef Hanna',
      role: 'agent', active: true,
    }],
    fd_activities: acts,
    tickets,
    qe_queue_log: [],
    qe_candidates: [],
    qe_catalogue: [],
  }
  h.settings = { minTouches: 1, requireCustomerFacing: false }
  h.reads.length = 0
}

describe('qeReadTouches_ must page past the PostgREST max-rows cap', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    stage()
  })

  it('sees every in-window activity, not just the newest max-rows page', async () => {
    const res = await qeBuildQueue('day', 'test', { skipMigrationCheck: true, now: NOW })
    // Fails today: the single .limit(60000) query returns only 1000 rows.
    expect(res.touchesInWindow as number).toBe(ACT_COUNT)
    expect(res.poolSize as number).toBe(ACT_COUNT)
  })
})
