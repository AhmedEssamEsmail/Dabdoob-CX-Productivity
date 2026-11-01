/**
 * mirrors.ts — the Sheet->Supabase mirror sync: row model (cols/ts_ms),
 * deterministic dedupe keys, watermark + 24h-overlap incremental runs, and
 * honest per-table errors (missing config/tab -> { error }, not zeros).
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  books: {} as Record<string, Record<string, unknown[][]>>,
  tables: {} as Record<string, Record<string, unknown>[]>,
  cfgStore: {} as Record<string, unknown>,
}))

vi.mock('@/lib/jobs/sheets', () => ({
  fetchWorkbookTabs: async (id: string, tabs: string[]) => {
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

vi.mock('@/lib/platform/repo', () => ({
  db: () => ({
    from: (table: string) => ({
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

vi.mock('@/lib/platform/settings', () => ({
  getConfig: async (k: string) => h.cfgStore[k],
  setConfig: async (k: string, v: unknown) => {
    h.cfgStore[k] = v
  },
}))

import { mirrorMonths, syncAllMirrors, syncMirror } from '@/lib/jobs/mirrors'
import type { Cfg } from '@/lib/prod/adapters'

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
  })

  it('mirrorMonths: incremental -> previous + current; full -> the window', () => {
    expect(mirrorMonths('2026-10-08', false)).toEqual(['2026-09', '2026-10'])
    const full = mirrorMonths('2026-10-08', true, 4)
    expect(full[0]).toBe('2026-07')
    expect(full[full.length - 1]).toBe('2026-10')
    expect(full).toContain('2026-08')
  })

  it('fd_activities: parses ts_ms, keeps A..J cols, skips unparseable rows', async () => {
    const res = await syncMirror(CFG, 'fd_activities', { full: true, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(res.written).toBe(2)
    expect(res.skipped).toBe(1)
    const rows = h.tables.fd_activities
    expect(rows).toHaveLength(2)
    const cells = rows[0].cols as unknown[]
    expect(cells).toHaveLength(10)
    expect(String(cells[1])).toBe('101')
    expect(rows[0].ts_ms).toBeGreaterThan(0)
    // watermark persisted for the incremental run
    expect((h.cfgStore.mirror_state_fd_activities as { last_ts_ms: number }).last_ts_ms).toBeGreaterThan(0)
  })

  it('maqsam_calls: slices D..J from the month workbook', async () => {
    const res = await syncMirror(CFG, 'maqsam_calls', { full: true, monthsBack: 1, now: Date.parse('2026-10-08T10:00:00Z') })
    expect(res.written).toBe(1)
    const cells = h.tables.maqsam_calls[0].cols as unknown[]
    expect(cells).toHaveLength(7)
    expect(String(cells[0])).toContain('2026-10-08')
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

  it('missing workbook config -> per-table error, not silent success', async () => {
    const res = await syncAllMirrors({ ...CFG, fd_activity_ss_id: '' } as Cfg, {
      full: true,
      monthsBack: 1,
      now: Date.parse('2026-10-08T10:00:00Z'),
    })
    const fd = res.fd_activities as { error?: string }
    // dqSetting_ falls back to the configured default workbook, which is
    // unreachable -> the failure is described, not swallowed into zeros.
    expect(fd.error).toBeTruthy()
    expect(fd.error).toContain('Spreadsheet not found')
  })

  it('missing tab -> per-table error describing the sheet failure', async () => {
    h.books['dr-book'] = {}
    const res = await syncAllMirrors(CFG, { full: true, monthsBack: 1, tables: ['freshchat'], now: Date.parse('2026-10-08T10:00:00Z') })
    const fc = res.freshchat as { error?: string }
    expect(fc.error).toBeTruthy()
    expect(fc.error).toContain('Freshchat')
  })
})
