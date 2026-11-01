/**
 * runBackfill orchestration: per-date step order, honest skips (no month
 * workbook, no intervals), the resume cursor, and the !force done-check.
 * Engine internals are covered elsewhere — the seams are stubbed.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

const h = vi.hoisted(() => ({
  computeCalls: [] as string[],
  flagCalls: [] as string[],
  mirrorCalls: 0,
  stepCalls: [] as string[],
}))

vi.mock('@/lib/jobs/mirrors', () => ({
  syncAllMirrors: async () => {
    h.mirrorCalls++
    return {}
  },
}))
vi.mock('@/lib/jobs/productivity', () => ({
  prodComputeStep_: async (_env: never, dates: string[]) => {
    h.computeCalls.push(...dates)
    return dates.length * 3
  },
  prodFlagsStep_: async (_env: never, dates: string[]) => {
    h.flagCalls.push(...dates)
    return { flagged: 0, added: 1, voided: 0 }
  },
}))
vi.mock('@/lib/tph', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/lib/tph')>()
  return {
    ...orig,
    tphRunStep_: (d: string, step: string) => {
      h.stepCalls.push(`${d}|${step}`)
      if (step === 'touches' && d === '2026-07-02') throw new Error('fd_activities exploded')
      return { step, date: d, touchCells: step === 'touches' ? 2 : undefined, casesRebuilt: 1 }
    },
  }
})

import { runBackfill } from '@/lib/jobs/backfill'
import { stubEnv } from './helpers'

describe('runBackfill', () => {
  beforeEach(() => {
    h.computeCalls = []
    h.flagCalls = []
    h.mirrorCalls = 0
    h.stepCalls = []
  })

  it('syncs mirrors once, then runs every kind per date', async () => {
    const env = stubEnv({ now: Date.parse('2026-10-08T10:00:00Z') })
    const res = await runBackfill({ from: '2026-07-01', to: '2026-07-02', env })
    expect(h.mirrorCalls).toBe(1)
    // tph: 4 steps x 2 dates (the 07-02 touches failure skips its other 3)
    expect(h.stepCalls).toContain('2026-07-01|touches')
    expect(h.stepCalls).toContain('2026-07-01|cases_chats')
    expect(h.stepCalls).toContain('2026-07-02|touches')
    expect(h.stepCalls.filter((s) => s.startsWith('2026-07-02'))).toEqual(['2026-07-02|touches'])
    expect(res.failed.some((f) => f.step === 'touches' && f.error.includes('fd_activities exploded'))).toBe(true)
    // layers + flags skipped honestly: no month file, no intervals
    expect(res.skipped.some((s) => s.kind === 'layers' && s.reason.includes('productivity_files'))).toBe(true)
    expect(res.skipped.some((s) => s.kind === 'flags' && s.reason.includes('prod_intervals'))).toBe(true)
    expect(res.next).toBeNull()
  })

  it('layers run when the month has a productivity_files entry; flags run when intervals exist', async () => {
    const env = stubEnv({
      now: Date.parse('2026-10-08T10:00:00Z'),
      cfg: { productivity_files: { '2026-07': 'jul-book' } },
      tables: { prod_intervals: [{ date: '2026-07-01', agent_email: 'a@dabdoob.com' }] },
    })
    const res = await runBackfill({ from: '2026-07-01', to: '2026-07-01', kinds: ['layers', 'flags'], env })
    expect(h.computeCalls).toEqual(['2026-07-01'])
    expect(h.flagCalls).toEqual(['2026-07-01'])
    expect(res.done).toContainEqual({ date: '2026-07-01', kind: 'layers', rows: 3 })
    expect(res.done).toContainEqual({ date: '2026-07-01', kind: 'flags', rows: 1 })
    expect(res.mirrors).toBeUndefined() // mirrors not in kinds
  })

  it('returns a resume cursor when the budget runs out', async () => {
    const env = stubEnv({ now: Date.parse('2026-10-08T10:00:00Z') })
    const res = await runBackfill({ from: '2026-07-01', to: '2026-07-05', kinds: ['tph'], env, budgetMs: -1 })
    expect(res.next).toEqual({ date: '2026-07-01' })
    expect(h.stepCalls).toHaveLength(0)
    // resume: starts at the cursor and finishes the range
    const res2 = await runBackfill({ from: '2026-07-01', to: '2026-07-02', kinds: ['tph'], env, cursor: res.next })
    expect(res2.next).toBeNull()
    expect(h.stepCalls.filter((s) => s.startsWith('2026-07-01')).length).toBe(4)
    expect(h.mirrorCalls).toBe(0) // mirrors don't re-run on a resumed run
  })

  it('skips dates that already have outputs unless force', async () => {
    const env = stubEnv({
      now: Date.parse('2026-10-08T10:00:00Z'),
      tables: {
        prod_tph_touches: [{ date: '2026-07-01' }],
        prod_tph_calls: [{ date: '2026-07-01' }],
        prod_tph_cases: [{ date: '2026-07-01', source: 'rebuilt' }],
      },
    })
    const res = await runBackfill({ from: '2026-07-01', to: '2026-07-01', kinds: ['tph'], env })
    expect(h.stepCalls).toHaveLength(0)
    expect(res.skipped[0].reason).toContain('already computed')
    const res2 = await runBackfill({ from: '2026-07-01', to: '2026-07-01', kinds: ['tph'], env, force: true })
    expect(h.stepCalls.length).toBe(4)
    expect(res2.skipped.filter((s) => s.kind === 'tph')).toHaveLength(0)
  })

  it('grid: derives prod_tph_days from prod_intervals, keeps TL-logged rows, skips honestly', async () => {
    const env = stubEnv({
      now: Date.parse('2026-10-08T10:00:00Z'),
      tables: {
        prod_intervals: [
          { date: '2026-09-10', agent_email: 'a@dabdoob.com', status: 'Available', start_at: '2026-09-10T09:00:00+03:00', end_at: '2026-09-10T10:00:00+03:00' },
          { date: '2026-09-10', agent_email: 'b@dabdoob.com', status: 'Chats', start_at: '2026-09-10T09:00:00+03:00', end_at: '2026-09-10T09:30:00+03:00' },
        ],
        prod_tph_days: [{ date: '2026-09-10', agent_email: 'b@dabdoob.com', slots_json: '{"36":"internal"}' }],
      },
    })
    const res = await runBackfill({ from: '2026-09-10', to: '2026-09-10', kinds: ['grid'], env })
    expect(res.done[0].kind).toBe('grid')
    const days = env.tables.prod_tph_days
    // a@ written (4 slots internal 09:00-09:45), b@ kept (TL row untouched)
    const a = days.find((r) => r.agent_email === 'a@dabdoob.com')
    const b = days.find((r) => r.agent_email === 'b@dabdoob.com')
    expect(JSON.parse(String(a!.slots_json))['36']).toBe('internal')
    expect(JSON.parse(String(b!.slots_json))['36']).toBe('internal') // TL value, not overwritten to chats
    expect(res.done[0].rows).toContain('kept')
    // force overwrites the TL row too
    await runBackfill({ from: '2026-09-10', to: '2026-09-10', kinds: ['grid'], env, force: true })
    expect(JSON.parse(String(env.tables.prod_tph_days.find((r) => r.agent_email === 'b@dabdoob.com')!.slots_json))['36']).toBe('chats')
    // no intervals -> honest skip
    const env2 = stubEnv({ now: Date.parse('2026-10-08T10:00:00Z') })
    const res2 = await runBackfill({ from: '2026-07-05', to: '2026-07-05', kinds: ['grid'], env: env2 })
    expect(res2.skipped[0].reason).toContain('prod_intervals')
  })

  it('logs a backfill row to refresh_log', async () => {
    const env = stubEnv({ now: Date.parse('2026-10-08T10:00:00Z') })
    await runBackfill({ from: '2026-07-01', to: '2026-07-01', kinds: ['tph'], env })
    expect(env.refreshLog.some((r) => r.job === 'backfill')).toBe(true)
  })
})
