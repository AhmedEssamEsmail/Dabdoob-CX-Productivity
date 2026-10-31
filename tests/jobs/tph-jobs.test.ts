/**
 * jobTphHourly / jobTphPastDays semantics: the hourly 'auto' queue capture
 * (first capture of an hour records stock + starting created, later ones
 * update the latest created) and the stale past-day rebuild.
 */
import { describe, expect, it } from 'vitest'
import { jobTphHourly, jobTphPastDays } from '@/lib/jobs/tph'
import { stubEnv } from './helpers'

const NOW = Date.parse('2026-10-08T07:00:00Z') // 10:00 Kuwait -> hour key '10|<channel>' today 2026-10-08

const QUEUE = [
  { kind: 'ticket', queue: 'Customer Support - Internal', created_today: 12, by_status_json: JSON.stringify({ Open: 4, 'Pending on CX': 3 }), stale: false },
  { kind: 'chat', queue: 'FreshChat', open: 5, created_today: 9, by_status_json: JSON.stringify({}), stale: false },
]

const BOOKS = {
  'fd-book': { Activities: [['t', 'id', 'name', 'f', 'old', 'new', 'p', 'g', 'grp', 's']] },
  'dr-book': { Freshchat: [['t', 'a', 'id', 'u', 'r', 'g', 'i']] },
  'month-book': { 'Maqsam Calls': [['x'], ['x'], ['x']] },
}

describe('jobTphHourly', () => {
  it('folds the fresh queue numbers into today\'s auto row; reruns update c1 only', async () => {
    const env = stubEnv({
      now: NOW,
      tables: {
        agg_queue_now: QUEUE.slice(),
        prod_tph_cases: [{ date: '2026-10-08', source: 'tl', cases_json: '{"10|internal":{"stock":99}}', by: 'tl@dabdoob.com', at: '2026-10-08T06:00:00.000Z' }],
      },
    })
    const r = await jobTphHourly(env)
    expect(r).toMatchObject({ rowsOut: 2 }) // internal + chats cells added
    const auto = env.tables.prod_tph_cases.find((x) => x.source === 'auto')
    expect(auto).toBeTruthy()
    const cases = JSON.parse(String(auto!.cases_json))
    expect(cases['10|internal']).toEqual({ stock: 7, c0: 12, c1: 12 })
    expect(cases['10|chats']).toEqual({ stock: 5, c0: 9, c1: 9 })
    // The TL-authored row is untouched.
    const tl = env.tables.prod_tph_cases.find((x) => x.source === 'tl')
    expect(tl!.by).toBe('tl@dabdoob.com')
    expect(JSON.parse(String(tl!.cases_json))['10|internal'].stock).toBe(99)

    // A second capture in the same hour updates the latest created count only.
    env.tables.agg_queue_now = [
      { kind: 'ticket', queue: 'Customer Support - Internal', created_today: 15, by_status_json: JSON.stringify({ Open: 4, 'Pending on CX': 3 }) },
      { kind: 'chat', queue: 'FreshChat', open: 5, created_today: 10, by_status_json: '{}' },
    ]
    const r2 = await jobTphHourly(env)
    expect(r2).toMatchObject({ rowsOut: 0 })
    const cases2 = JSON.parse(String(env.tables.prod_tph_cases.find((x) => x.source === 'auto')!.cases_json))
    expect(cases2['10|internal']).toEqual({ stock: 7, c0: 12, c1: 15 })
    expect(cases2['10|chats']).toEqual({ stock: 5, c0: 9, c1: 10 })
    expect(env.beats.map((b) => b.job)).toEqual(['prod_tph_cases', 'prod_tph_cases'])
  })

  it('reports "no fresh queue numbers" when the queue board is empty', async () => {
    const env = stubEnv({ now: NOW, tables: { agg_queue_now: [] } })
    const r = await jobTphHourly(env)
    expect(r!.rowsOut).toBe(0)
    expect(String(r!.note)).toContain('no fresh queue numbers')
    expect(env.tables.prod_tph_cases || []).toHaveLength(0)
  })

  it('skips when productivity is not set up', async () => {
    const env = stubEnv({ now: NOW, cfg: { ss_productivity_id: '' }, tables: { agg_queue_now: QUEUE.slice() } })
    const r = await jobTphHourly(env)
    expect(r).toMatchObject({ skipped: 'CC2 Productivity is not set up' })
  })
})

describe('jobTphPastDays', () => {
  it('rebuilds missing/stale steps for the last three days and leaves fresh rows alone', async () => {
    const fresh = new Date(NOW).toISOString()
    const env = stubEnv({
      now: NOW,
      books: BOOKS,
      tables: {
        // d-3 is fully fresh -> no steps; d-1 and d-2 are missing -> all four steps each.
        prod_tph_touches: [{ date: '2026-10-05', touches_json: '{}', computed_at: fresh }],
        prod_tph_calls: [{ date: '2026-10-05', calls_json: '{}', computed_at: fresh }],
        prod_tph_cases: [{ date: '2026-10-05', source: 'rebuilt', cases_json: '{}', at: fresh }],
      },
    })
    const r = await jobTphPastDays(env)
    expect(r).toBeTruthy()
    const note = String(r!.note)
    // 4 steps x 2 stale days rebuilt; the fresh day is untouched.
    expect(r!.rowsOut).toBe(8)
    expect(note).toContain('2026-10-07 touches')
    expect(note).toContain('2026-10-06 calls')
    expect(note).not.toContain('2026-10-05')
    // Every step logged its own run + the aggregate.
    const jobs = env.refreshLog.map((x) => x.job)
    expect(jobs.filter((j) => j === 'prod_tph_touches')).toHaveLength(2)
    expect(jobs.filter((j) => j === 'prod_tph_calls')).toHaveLength(2)
    expect(jobs.filter((j) => j === 'prod_tph_cases_rebuilt')).toHaveLength(4)
    expect(jobs).toContain('prod_tph_auto')
    expect(env.beats.map((b) => b.job)).toEqual(['prod_tph_auto'])
    // Rebuilt rows were written for both stale days.
    expect(env.tables.prod_tph_touches.some((x) => x.date === '2026-10-07')).toBe(true)
    expect(env.tables.prod_tph_calls.some((x) => x.date === '2026-10-06')).toBe(true)
    expect(env.tables.prod_tph_cases.some((x) => x.date === '2026-10-07' && x.source === 'rebuilt')).toBe(true)
  })

  it('reports "nothing stale" when every day is fresh', async () => {
    const fresh = new Date(NOW).toISOString()
    const tables: Record<string, Record<string, unknown>[]> = {
      prod_tph_touches: [],
      prod_tph_calls: [],
      prod_tph_cases: [],
    }
    for (const d of ['2026-10-07', '2026-10-06', '2026-10-05']) {
      tables.prod_tph_touches.push({ date: d, touches_json: '{}', computed_at: fresh })
      tables.prod_tph_calls.push({ date: d, calls_json: '{}', computed_at: fresh })
      tables.prod_tph_cases.push({ date: d, source: 'rebuilt', cases_json: '{}', at: fresh })
    }
    const env = stubEnv({ now: NOW, books: BOOKS, tables })
    const r = await jobTphPastDays(env)
    expect(r).toEqual({ rowsOut: 0, note: 'nothing stale' })
    expect(env.refreshLog.filter((x) => x.job === 'prod_tph_auto')).toHaveLength(0)
  })

  it('a failing step is logged and the run continues', async () => {
    const env = stubEnv({ now: NOW, books: BOOKS, tables: {} })
    // Break only the 'calls' step: buildCallMinutes throws for a missing workbook.
    const orig = env.buildCallMinutes
    env.buildCallMinutes = (dates: string[]) => {
      if (dates[0] === '2026-10-07') throw new Error('calls exploded')
      return orig(dates)
    }
    const r = await jobTphPastDays(env)
    expect(String(r!.note)).toContain('failed')
    expect(String(r!.note)).toContain('2026-10-07 calls: calls exploded')
    // Other steps of the same day still ran.
    expect(String(r!.note)).toContain('2026-10-07 touches')
    expect(env.refreshLog.some((x) => x.status === 'error' && x.job === 'prod_tph_calls')).toBe(true)
  })
})
