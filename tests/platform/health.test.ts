import { describe, it, expect, beforeEach } from 'vitest'
import {
  hbStatus, hbRowState, hbCombine, hbComputeHealth, hbHuman, hbBeat, hbPending, hbReset,
  hbPlanFor, hbWithEvidence, hbRowFromPlan, HB_PLAN, HB_SYSTEMS, HB_RANK,
} from '@/lib/platform/health'

const NOW = Date.parse('2026-10-08T12:00:00Z').valueOf()

function row(patch: Record<string, unknown>): Record<string, unknown> {
  return {
    job: 'x', system: 'queue', link: false, label: 'X job', expect_every_min: 60, grace_min: 30,
    active: true, last_run_at: null, last_status: '', last_note: '', last_ok_at: null,
    last_error_at: null, last_error: '', seeded_at: new Date(NOW - 100 * 60000).toISOString(), ...patch,
  }
}

describe('hbStatus', () => {
  it('normalises to ok / warn / error', () => {
    expect(hbStatus('ok')).toBe('ok')
    expect(hbStatus('error')).toBe('error')
    expect(hbStatus('failed')).toBe('error')
    expect(hbStatus('down')).toBe('error')
    expect(hbStatus('partial')).toBe('warn')
    expect(hbStatus('skipped')).toBe('warn')
    expect(hbStatus('')).toBe('warn')
  })
})

describe('hbRowState', () => {
  it('idle when switched off', () => {
    expect(hbRowState(row({ active: false }), NOW).state).toBe('idle')
  })

  it('no run yet: idle while inside the first deadline, down after', () => {
    const seededNow = row({ seeded_at: new Date(NOW - 30 * 60000).toISOString() })
    const s = hbRowState(seededNow, NOW)
    expect(s.state).toBe('idle')
    expect(s.awaiting).toBe(true)
    const seededOld = row({ seeded_at: new Date(NOW - 300 * 60000).toISOString() })
    expect(hbRowState(seededOld, NOW).state).toBe('down')
    expect(hbRowState(seededOld, NOW).note).toContain('no run recorded')
  })

  it('down when past expect+grace', () => {
    const r = row({ last_run_at: new Date(NOW - 91 * 60000).toISOString(), last_status: 'ok' })
    const s = hbRowState(r, NOW)
    expect(s.state).toBe('down')
    expect(s.note).toContain('nothing for')
  })

  it('down on error status even inside the window', () => {
    const r = row({ last_run_at: new Date(NOW - 10 * 60000).toISOString(), last_status: 'error', last_note: 'boom' })
    const s = hbRowState(r, NOW)
    expect(s.state).toBe('down')
    expect(s.note).toContain('failed')
  })

  it('warn when late (past expect, inside grace)', () => {
    const r = row({ last_run_at: new Date(NOW - 75 * 60000).toISOString(), last_status: 'ok' })
    const s = hbRowState(r, NOW)
    expect(s.state).toBe('warn')
    expect(s.note).toContain('late')
  })

  it('warn on partial run, ok on fresh ok run', () => {
    const r = row({ last_run_at: new Date(NOW - 5 * 60000).toISOString(), last_status: 'partial', last_note: 'some rows' })
    expect(hbRowState(r, NOW).state).toBe('warn')
    const ok = row({ last_run_at: new Date(NOW - 5 * 60000).toISOString(), last_status: 'ok' })
    expect(hbRowState(ok, NOW).state).toBe('ok')
  })
})

describe('hbCombine', () => {
  it('worst wins, newest run wins', () => {
    const a = { state: 'ok' as const, at: new Date(NOW - 60000) }
    const b = { state: 'warn' as const, note: 'late', at: new Date(NOW - 30000) }
    const c = { state: 'down' as const, note: 'dead', at: new Date(NOW - 120000) }
    const out = hbCombine([a, b, c])
    expect(out.state).toBe('down')
    expect(out.at).toBe(new Date(NOW - 30000).toISOString())
    expect(out.note).toBe('dead')
  })

  it('joins notes of the worst band and abbreviates at two', () => {
    const parts = [
      { state: 'warn' as const, note: 'n1' },
      { state: 'warn' as const, note: 'n2' },
      { state: 'warn' as const, note: 'n3' },
    ]
    expect(hbCombine(parts).note).toBe('n1; n2 (+1 more)')
  })

  it('all-idle parts awaiting first run say so; empty list is idle', () => {
    expect(hbCombine([{ state: 'idle', awaiting: true }]).note).toBe('Awaiting first run')
    expect(hbCombine([], 'none').state).toBe('idle')
    expect(hbCombine([], 'none').note).toBe('none')
  })
})

describe('hbComputeHealth', () => {
  it('a system with no rows is idle (not built), built systems with no rows await first run', () => {
    const out = hbComputeHealth([], NOW)
    expect(out.nodes.fcr.state).toBe('idle')
    expect(out.nodes.fcr.note).toContain('Not built')
    expect(out.nodes.operations.state).toBe('ok') // HB_NO_JOBS: healthy by definition
    expect(out.nodes.queue.state).toBe('idle')
    expect(out.nodes.queue.note).toContain('Awaiting first run')
    expect(Object.keys(out.nodes)).toEqual(HB_SYSTEMS)
  })

  it('a down row pulls its system and link down and creates an event', () => {
    const p = hbPlanFor('freshdesk_sync')!
    const r = hbRowFromPlan(p, new Date(NOW - 300 * 60000))
    r.last_run_at = new Date(NOW - 300 * 60000).toISOString()
    r.last_status = 'error'
    r.last_error = 'Freshdesk 500'
    const out = hbComputeHealth([r], NOW)
    expect(out.nodes.queue.state).toBe('down')
    expect(out.links.queue.state).toBe('down')
    expect(out.events.length).toBeGreaterThan(0)
    expect(out.events[0].system).toBe('queue')
  })

  it('hbHuman formats minutes, hours and days', () => {
    expect(hbHuman(45)).toBe('45 min')
    expect(hbHuman(200)).toBe('3 h')
    expect(hbHuman(3000)).toBe('2 d')
  })
})

describe('hbBeat queue (worst wins, notes join)', () => {
  beforeEach(() => hbReset())

  it('a later ok never hides an earlier error; notes join', () => {
    hbBeat('job_a', 'ok')
    hbBeat('job_a', 'error', 'first failure')
    hbBeat('job_a', 'ok', 'recovered')
    const q = hbPending().job_a
    expect(q.status).toBe('error')
    expect(q.note).toBe('first failure; recovered')
  })

  it('hbBeat never throws on garbage', () => {
    expect(() => hbBeat('j', undefined, undefined)).not.toThrow()
    expect(HB_RANK.ok).toBe(1)
    expect(HB_PLAN.length).toBe(23)
    expect(hbPlanFor('prod_flags')!.system).toBe('productivity')
  })
})

describe('hbWithEvidence', () => {
  it('backfills missing rows from the run log and adds absent plan rows', () => {
    const existing = hbRowFromPlan(hbPlanFor('roster_sync')!, new Date())
    const ev = {
      roster_sync: { at: new Date(NOW - 60000), status: 'ok', note: 'log row' },
      queue_aggregates: { at: new Date(NOW - 120000), status: 'warn', note: '' },
    }
    const out = hbWithEvidence([existing], ev)
    expect(out.length).toBe(HB_PLAN.length)
    const r = out.find((r) => r.job === 'roster_sync')!
    expect(r.last_run_at).toEqual(ev.roster_sync.at)
    const q = out.find((r) => r.job === 'queue_aggregates')!
    expect(q.last_status).toBe('warn')
    const unbacked = out.find((r) => r.job === 'year_rollover')!
    expect(unbacked.last_run_at).toBeNull()
  })
})
