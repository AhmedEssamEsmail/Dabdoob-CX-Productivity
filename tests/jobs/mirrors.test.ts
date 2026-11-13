/**
 * mirrors.ts — the mirror sync: row model (ts_ms + typed columns),
 * deterministic dedupe keys, watermark + 24h-overlap incremental runs, and
 * honest per-table errors (missing config/tab -> { error }, not zeros).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  books: {} as Record<string, Record<string, unknown[][]>>,
  tables: {} as Record<string, Record<string, unknown>[]>,
  cfgStore: {} as Record<string, unknown>,
  apiRows: { maqsam: [] as unknown[][], freshchat: [] as unknown[][] },
  apiErr: { maqsam: null as Error | null, freshchat: null as Error | null },
  apiCalls: { maqsam: [] as { sinceMs?: number; untilMs?: number }[], freshchat: [] as { sinceMs?: number; untilMs?: number }[] },
  fdActs: {} as Record<string, Record<string, unknown>[]>,
  fdCalls: [] as string[],
  fdErr: null as Error | null,
  roster: [] as Record<string, unknown>[],
  rosterErr: null as Error | null,
  sheetCalls: 0,
}))

vi.mock('@/features/shared/jobs/sheets', () => ({
  fetchWorkbookTabs: async (id: string, tabs: string[]) => {
    h.sheetCalls++
    const book = h.books[id]
    if (!book) throw new Error(`Requested entity was not found. (${id})`)
    const out: Record<string, unknown[][]> = {}
    tabs.forEach((t) => {
      if (!(t in book)) throw new Error(`Unable to parse range: ${t}`)
      out[t] = book[t]
    })
    return out
  },
}))

vi.mock('@/features/shared/jobs/vendor-apis', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/shared/jobs/vendor-apis')>()
  return {
    ...orig,
    fetchMaqsamRows: async (sinceMs?: number, untilMs?: number) => {
      h.apiCalls.maqsam.push({ sinceMs, untilMs })
      if (h.apiErr.maqsam) throw h.apiErr.maqsam
      return h.apiRows.maqsam
    },
    fetchFreshchatRows: async (sinceMs?: number, untilMs?: number) => {
      h.apiCalls.freshchat.push({ sinceMs, untilMs })
      if (h.apiErr.freshchat) throw h.apiErr.freshchat
      return h.apiRows.freshchat
    },
  }
})

vi.mock('@/features/shared/jobs/freshdesk', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/shared/jobs/freshdesk')>()
  return {
    ...orig,
    fdActivityExport_: async (dateKey: string) => {
      h.fdCalls.push(dateKey)
      if (h.fdErr) throw h.fdErr
      return h.fdActs[dateKey] || []
    },
    fdGroups_: async () => ({}),
  }
})

vi.mock('@/features/shared/platform/repo', () => ({
  db: () => ({
    from: (table: string) => ({
      select: () => Promise.resolve({ data: table === 'roster' ? h.roster : [], error: table === 'roster' ? h.rosterErr : null }),
      upsert: async (rows: Record<string, unknown>[], opts: { onConflict: string }) => {
        const memo = (h.tables[table] = h.tables[table] || [])
        rows.forEach((r) => {
          const i = memo.findIndex((x) => x[opts.onConflict] === r[opts.onConflict])
          if (i === -1) memo.push(r)
          else memo[i] = r
        })
        return { error: null }
      },
    }),
  }),
}))

vi.mock('@/features/shared/platform/settings', () => ({
  getConfig: async (k: string) => h.cfgStore[k],
  setConfig: async (k: string, v: unknown) => {
    h.cfgStore[k] = v
  },
}))

import { mirrorMonths, syncAllMirrors, syncMirror } from '@/features/shared/jobs/mirrors'
import type { Cfg } from '@/features/shared/lib/adapters'

const CFG = {
  business_tz: 'Asia/Kuwait',
  data_tz: 'Africa/Cairo',
  activity_local_tz: 'Asia/Kuwait',
  fd_activity_ss_id: 'fd-book',
  daily_report_ss_id: 'dr-book',
  productivity_fallback_id: 'month-book',
} as unknown as Cfg

const BOOKS = {
  'fd-book': {
    Activities: [
      ['Time', 'Ticket', 'Agent'],
      ['2026-10-07 09:00:00', '101', 'A', '', '', '', '', '', 'g1', ''],
      ['2026-10-08 09:00:00', '102', 'B', '', '', '', '', '', 'g2', ''],
      ['not-a-date', '103', 'C'],
    ],
  },
  'dr-book': {
    Freshchat: [
      ['Initiated'],
      ['2026-10-08 10:00:00', '', 'conv-20261008100000', '2026-10-08 10:05:00', '', '', '1'],
    ],
  },
  'month-book': {
    'Maqsam Calls': [
      ['A', 'B', 'C', 'Start', 'E', 'F', 'G'],
      ['', '', '', '2026-10-08 11:00:00', '', '', 'a@dabdoob.com'],
    ],
  },
}

describe('mirrors', () => {
  beforeEach(() => {
    h.books = JSON.parse(JSON.stringify(BOOKS))
    h.tables = {}
    h.cfgStore = {}
    h.apiErr = { maqsam: null, freshchat: null }
    h.apiCalls = { maqsam: [], freshchat: [] }
    h.fdActs = {
      '2026-10-07': [
        { performed_at: '2026-10-07T09:00:00.000Z', ticket_id: 101, performer_id: '55', performer_type: 'user', activity: { status: 2, group: 'Support' } },
        { performed_at: '2026-10-07T09:05:00.000Z', ticket_id: 101, performer_id: '55', performer_type: 'user', activity: { new_ticket: true } },
        { performed_at: '2026-10-07T09:06:00.000Z', ticket_id: 102, performer_id: '77', performer_type: 'system', activity: { status: 3 } },
      ],
      '2026-10-08': [
        { performed_at: '2026-10-08T09:00:00.000Z', ticket_id: 102, performer_id: '55', performer_type: 'user', activity: { status: 'Open' } },
        { performed_at: 'not-a-date', ticket_id: 103, performer_id: '55', performer_type: 'user', activity: { status: 4 } },
      ],
    }
    h.fdCalls = []
    h.fdErr = null
    h.roster = [{ email: 'a@dabdoob.com', name: 'Alice', freshdesk_id: '55', freshdesk_name: 'Alice Agent' }]
    h.rosterErr = null
    h.sheetCalls = 0
    h.apiRows = {
      maqsam: [
        ['2026-10-08T09:00:00.000Z', '2026-10-08T09:02:00.000Z', '0:02:00', 'a@dabdoob.com', 'serviced', 'inbound', '0.0013888889'],
      ],
      freshchat: [
        ['2026-10-08T10:00:00.000Z', '', 'conv1-1793652000000', '2026-10-08T10:05:00.000Z', '', 'IG_app', 'conv1'],
      ],
    }
  })

  it('mirrorMonths: incremental -> previous + current; full -> the window', () => {
    expect(mirrorMonths('2026-10-08', false)).toEqual(['2026-09', '2026-10'])
    const full = mirrorMonths('2026-10-08', true, 4)
    expect(full[0]).toBe('2026-07')
    expect(full[full.length - 1]).toBe('2026-10')
    expect(full).toContain('2026-08')
  })

  it('fd_activities: export API -> typed columns, no cols payload, zero sheet reads', async () => {
    const res = await syncMirror(CFG, 'fd_activities', { full: true, monthsBack: 1, now: Date.parse('2026-10-08T10:00:00Z') })
    // 3 mappable user activities -> 3 rows; system activity never maps, bad date skipped on ts
    expect(res.written).toBe(3)
    expect(res.skipped).toBe(1)
    expect(h.sheetCalls).toBe(0)
    expect(h.fdCalls).toContain('2026-10-07')
    expect(h.fdCalls).toContain('2026-10-08')
    const rows = h.tables.fd_activities
    expect(rows).toHaveLength(3)
    expect(rows[0]).not.toHaveProperty('cols')
    expect(rows[0].ts_ms).toBe(Date.parse('2026-10-07T09:00:00.000Z'))
    // typed columns written; performer resolved via the roster fd-directory
    expect(rows[0].performed_at).toBe('2026-10-07T09:00:00.000Z')
    expect(rows[0].ticket_id).toBe('101')
    expect(rows[0].performer_name).toBe('Alice Agent')
    expect(rows[0].performer_type).toBe('user')
    expect(rows[0].activity_type).toBe('Status Change')
    expect(rows[0].field_changed).toBe('status')
    expect(rows[0].new_value).toBe('Open')
    expect(rows[0].group_name).toBe('Support')
    expect(rows[0].old_value).toBeNull()
    // watermark persisted for the incremental run
    expect((h.cfgStore.mirror_state_fd_activities as { last_ts_ms: number }).last_ts_ms).toBeGreaterThan(0)
  })

  it('maqsam_calls: API rows land as typed columns, start drives ts_ms', async () => {
    const res = await syncMirror(CFG, 'maqsam_calls', { full: true, monthsBack: 1, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(res.written).toBe(1)
    const row = h.tables.maqsam_calls[0]
    expect(row).not.toHaveProperty('cols')
    expect(row.started_at).toBe('2026-10-08T09:00:00.000Z')
    expect(row.ended_at).toBe('2026-10-08T09:02:00.000Z')
    expect(row.duration).toBe('0:02:00')
    expect(row.agent_email).toBe('a@dabdoob.com')
    expect(row.state).toBe('serviced')
    expect(row.direction).toBe('inbound')
    expect(row.handling).toBe('0.0013888889')
    // windowed walk: first call starts at the months bound, windows advance
    expect(h.apiCalls.maqsam[0].sinceMs).toBe(Date.parse('2026-10-01T00:00:00Z'))
    expect(h.apiCalls.maqsam.length).toBeGreaterThanOrEqual(2)
    expect(h.apiCalls.maqsam[0].untilMs).toBe(h.apiCalls.maqsam[1].sinceMs)
  })

  it('maqsam_calls: duplicate API rows in a window collapse by dedupe_key', async () => {
    h.apiRows.maqsam.push([...h.apiRows.maqsam[0]]) // identical cells -> same key
    const res = await syncMirror(CFG, 'maqsam_calls', { full: true, monthsBack: 1, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(res.written).toBe(1)
    expect(h.tables.maqsam_calls).toHaveLength(1)
  })

  it('freshchat: incremental watermark is passed to the API pull', async () => {
    h.cfgStore.mirror_state_freshchat = { last_ts_ms: Date.parse('2026-10-08T00:00:00Z') }
    await syncMirror(CFG, 'freshchat', { now: Date.parse('2026-10-09T10:00:00Z') })
    expect(h.apiCalls.freshchat[0].sinceMs).toBe(Date.parse('2026-10-08T00:00:00Z') - 86400000)
    // ts_ms tracks updated (cells[3]) so late resolutions move the watermark
    expect(h.tables.freshchat[0].ts_ms).toBe(Date.parse('2026-10-08T10:05:00.000Z'))
    // typed columns dual-written; blank cells -> null
    const row = h.tables.freshchat[0]
    expect(row.initiated_at).toBe('2026-10-08T10:00:00.000Z')
    expect(row.status).toBeNull()
    expect(row.ref_key).toBe('conv1-1793652000000')
    expect(row.updated_at).toBe('2026-10-08T10:05:00.000Z')
    expect(row.resolved_at).toBeNull()
    expect(row.channel).toBe('IG_app')
    expect(row.conversation_id).toBe('conv1')
  })

  it('dedupe keys make a re-sync idempotent', async () => {
    await syncMirror(CFG, 'fd_activities', { full: true, now: Date.parse('2026-10-08T10:00:00Z') })
    const first = h.tables.fd_activities.length
    await syncMirror(CFG, 'fd_activities', { full: true, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(h.tables.fd_activities).toHaveLength(first)
  })

  it('incremental: rows at/under the watermark (minus overlap) are not re-written', async () => {
    const first = await syncMirror(CFG, 'fd_activities', { full: true, now: Date.parse('2026-10-08T10:00:00Z') })
    const second = await syncMirror(CFG, 'fd_activities', { now: Date.parse('2026-10-09T10:00:00Z') })
    expect(second.full).toBe(false)
    // the newest row is inside the 24h overlap -> re-upserted; the older one skipped
    expect(second.written).toBeLessThan(first.written)
  })

  it('fd export failure -> per-table error, not silent success', async () => {
    h.fdErr = new Error('ticket_activities export exploded')
    const res = await syncAllMirrors(CFG, {
      full: true,
      monthsBack: 1,
      now: Date.parse('2026-10-08T10:00:00Z'),
    })
    const fd = res.fd_activities as { error?: string }
    expect(fd.error).toBeTruthy()
    expect(fd.error).toContain('ticket_activities export exploded')
  })

  it('roster select failure -> per-table error, not User <id> fallback rows', async () => {
    h.rosterErr = new Error('roster directory exploded')
    const res = await syncAllMirrors(CFG, {
      full: true,
      monthsBack: 1,
      now: Date.parse('2026-10-08T10:00:00Z'),
    })
    const fd = res.fd_activities as { error?: string }
    expect(fd.error).toBeTruthy()
    expect(fd.error).toContain('roster directory exploded')
    expect(h.tables.fd_activities || []).toHaveLength(0)
  })

  it('API failure -> per-table error, not silent success', async () => {
    h.apiErr.freshchat = new Error('FRESHCHAT_API_KEY / FRESHCHAT_DOMAIN are not configured')
    const res = await syncAllMirrors(CFG, { full: true, monthsBack: 1, tables: ['freshchat'], now: Date.parse('2026-10-08T10:00:00Z') })
    const fc = res.freshchat as { error?: string }
    expect(fc.error).toBeTruthy()
    expect(fc.error).toContain('FRESHCHAT_API_KEY')
  })

  it('retention floor: fd_activities full sync never fetches a pre-Sep day', async () => {
    // monthsBack spanning Jul->Oct: the first window must start at the floor.
    await syncMirror(CFG, 'fd_activities', { full: true, monthsBack: 4, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(h.fdCalls[0]).toBe('2026-09-01')
    expect(h.fdCalls.every((d) => d >= '2026-09-01')).toBe(true)
  })

  it('retention floor: maqsam windowed walk starts at the floor', async () => {
    await syncMirror(CFG, 'maqsam_calls', { full: true, monthsBack: 6, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(h.apiCalls.maqsam[0].sinceMs).toBe(Date.parse('2026-09-01T00:00:00Z'))
  })

  it('retention floor: a sub-floor row inside a fetched window is skipped, not written', async () => {
    // Aug freshchat row arrives inside a non-windowed fetch — skipped on ts.
    h.apiRows.freshchat.push(['2026-08-20T10:00:00.000Z', '', 'conv-aug-1787220000000', '2026-08-20T10:05:00.000Z', '', 'IG_app', 'conv-aug'])
    const res = await syncMirror(CFG, 'freshchat', { full: true, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(res.written).toBe(1)
    expect(res.skipped).toBe(1)
    expect(h.tables.freshchat).toHaveLength(1)
    expect(h.tables.freshchat[0].conversation_id).toBe('conv1')
  })
})
