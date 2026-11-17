/**
 * env.ts workbook seam — prefetchWorkbook fills SheetBookLike grids from
 * dbbook (mirror tables), never the Sheets API: no fetchWorkbookTabs /
 * googleapis reference remains in env.ts, month ids scope via
 * productivity_files, and unknown tabs surface as stored open errors.
 */
import { readFileSync } from 'node:fs'
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  tables: {} as Record<string, Record<string, unknown>[]>,
  errors: {} as Record<string, Error>,
  calls: [] as { table: string; filters: [string, string, unknown][] }[],
}))

vi.mock('@/features/shared/platform/repo', () => ({
  readAllPaged: async (table: string, opts?: { build?: (q: never) => never }) => {
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
    h.calls.push({ table, filters })
    const err = h.errors[table]
    if (err) throw err
    return h.tables[table] || []
  },
  readRows: async () => [],
  db: () => {
    throw new Error('no db in env-dbbook test')
  },
  cacheRemove: () => {},
  newId: (p: string) => p + '_t1',
}))

vi.mock('@/features/shared/platform/settings', async (importOriginal) => {
  const mod = await importOriginal<typeof import('@/features/shared/platform/settings')>()
  return {
    ...mod,
    configAll: async () => ({
      business_tz: 'Asia/Kuwait',
      data_tz: 'Africa/Cairo',
      activity_local_tz: 'Asia/Kuwait',
      prod_activity_tz: 'Africa/Cairo',
      fd_activity_ss_id: 'fd-book',
      daily_report_ss_id: 'dr-book',
      productivity_fallback_id: 'fallback-book',
      productivity_files: { '2026-10': 'oct-book' },
      admin_emails: 'admin@dabdoob.com',
    }),
  }
})

import { buildJobEnv } from '@/features/shared/jobs/env'
import { tphHourMs_ } from '@/features/cx-productivity/lib/tph'

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

const NOW = Date.parse('2026-10-20T12:00:00.000Z')

describe('env prefetchWorkbook -> dbbook', () => {
  beforeEach(() => {
    h.tables = {}
    h.errors = {}
    h.calls = []
  })

  it("FD 'Activities' opens with DB cells; activityRows reads the same grid", async () => {
    h.tables.fd_activities = [ACTIVITY_ROW]
    const env = await buildJobEnv({ roster: false, now: NOW })
    await env.prefetchWorkbook('fd-book', ['Activities'])
    const tab = env.openSpreadsheet('fd-book').getSheetByName('Activities')
    expect(tab).not.toBeNull()
    expect(tab!.getLastRow()).toBe(2)
    const row = tab!.getRange(2, 1, 1, 10).getValues()[0]
    expect(row[0]).toBe('2026-10-07T09:00:00.000Z')
    expect(row[1]).toBe('101')
    const memo = await env.activityRows()
    expect(memo).toHaveLength(1)
    expect(memo[0][0]).toBe('2026-10-07T09:00:00.000Z')
    expect(h.calls.some((c) => c.table === 'fd_activities')).toBe(true)
  })

  it("month id 'oct-book' scopes 'Maqsam Calls' to the 2026-10 data_tz window", async () => {
    h.tables.maqsam_calls = [MAQSAM_ROW]
    const env = await buildJobEnv({ roster: false, now: NOW })
    await env.prefetchWorkbook('oct-book', ['Maqsam Calls'])
    const call = h.calls.find((c) => c.table === 'maqsam_calls')
    expect(call).toBeDefined()
    expect(call!.filters).toContainEqual(['gte', 'ts_ms', tphHourMs_('2026-10-01', 0, 'Africa/Cairo')])
    expect(call!.filters).toContainEqual(['lt', 'ts_ms', tphHourMs_('2026-11-01', 0, 'Africa/Cairo')])
    const tab = env.openSpreadsheet('oct-book').getSheetByName('Maqsam Calls')
    expect(tab!.getLastRow()).toBe(2)
    expect(tab!.getRange(2, 12, 1, 1).getValues()[0][0]).toBe(1.5)
  })

  it("one tab error fails the whole book even when another tab synthesizes", async () => {
    h.tables.maqsam_calls = [MAQSAM_ROW]
    h.errors.freshchat = new Error('boom')
    const env = await buildJobEnv({ roster: false, now: NOW })
    await env.prefetchWorkbook('x-book', ['Maqsam Calls', 'Freshchat'])
    expect(() => env.openSpreadsheet('x-book')).toThrow(/boom/)
  })

  it('unknown tab -> stored Error surfaces via openSpreadsheet', async () => {
    const env = await buildJobEnv({ roster: false, now: NOW })
    await env.prefetchWorkbook('mystery-book', ['Nope'])
    expect(() => env.openSpreadsheet('mystery-book')).toThrow(/unknown tab/)
  })

  it('env.ts has zero sheet-read references (freeze pin)', () => {
    const src = readFileSync('src/features/shared/jobs/env.ts', 'utf8')
    expect(src).not.toContain('fetchWorkbookTabs')
    expect(src).not.toContain('googleapis')
  })
})
