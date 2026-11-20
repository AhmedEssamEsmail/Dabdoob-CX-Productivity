import { describe, expect, it } from 'vitest'
import { qaAnalytics_, qaDrill_, qaScoresRange_ } from '../../src/features/cx-quality/lib/analytics'

interface AgentRow {
  key: string
  audits: number
  avg: number | null
}
interface DrillRow {
  auditId: string
  basis: string
}

const AGENT = 'a@x.com'
const PERIOD = '2026-11'
const nameOf = (e: string) => e

const row = (over: Record<string, unknown>): Record<string, unknown> => ({
  agent_email: AGENT,
  audit_date: '2026-11-10',
  ...over,
})

// Six audit rows + one blank-score row: the all-bases rule counts exactly 4.
// random acknowledged (80), off-queue (90), non-ticket (70) and disputed (60)
// count; voided (50), calibration (40) and the blank score do not.
const rows = [
  row({ audit_id: 'R1', status: 'acknowledged', sample_basis: 'random', score: 80 }),
  row({ audit_id: 'O1', status: 'acknowledged', sample_basis: 'off-queue', score: 90 }),
  row({ audit_id: 'N1', status: 'acknowledged', audit_type: 'Cash refund', reference: 'R-7', score: 70 }),
  row({ audit_id: 'D1', status: 'disputed', sample_basis: 'random', score: 60 }),
  row({ audit_id: 'V1', status: 'voided', sample_basis: 'random', score: 50 }),
  row({ audit_id: 'C1', kind: 'calibration', status: 'acknowledged', sample_basis: 'random', score: 40 }),
  row({ audit_id: 'B1', status: 'acknowledged', sample_basis: 'random', score: '' }),
]

describe('all-bases counting: off-queue, non-ticket and disputed audits count', () => {
  const res = qaAnalytics_(rows, { list: [], byKey: {} }, [], [], [], [], 'month', PERIOD, '2026-11-30', nameOf, {
    basis: 'audit',
  })

  it('qaAnalytics_ counts the four eligible audits, not the voided/calibration/blank rows', () => {
    expect(res.audits).toBe(4)
    expect(res.blankScores).toBe(1)
  })

  it('byAgent counts all bases for the agent with the mean of every counted score', () => {
    const agents = res.byAgent as AgentRow[]
    const a = agents.find((r) => r.key === AGENT)
    expect(a).toBeDefined()
    expect(a!.audits).toBe(4)
    expect(a!.avg).toBe(75) // (80 + 90 + 70 + 60) / 4
  })

  it('still flags the disputed audit as a pending dispute', () => {
    const health = res.health as { pendingDisputes: number }
    expect(health.pendingDisputes).toBe(1)
  })

  it('surfaces the non-ticket audit in nonTicket and in the bases mix', () => {
    const nonTicket = res.nonTicket as { type: string; audits: number }[]
    expect(nonTicket).toHaveLength(1)
    expect(nonTicket[0].type).toBe('Cash refund')
    expect(nonTicket[0].audits).toBe(1)
    const bases = res.bases as { basis: string; audits: number }[]
    expect(bases.map((b) => b.basis)).toContain('non-ticket')
  })

  it('qaDrill_ returns the same four audits, disputed included', () => {
    const drill = qaDrill_(rows, { byKey: {} }, 'month', PERIOD, 0, '', '', nameOf, '', 'audit')
    const audits = drill.audits as DrillRow[]
    expect(audits.map((r) => r.auditId).sort()).toEqual(['D1', 'N1', 'O1', 'R1'])
    const disputed = audits.find((r) => r.auditId === 'D1')
    expect(disputed!.basis).toBe('random')
  })

  it('qaScoresRange_ counts the same four audits in the team total', () => {
    const range = qaScoresRange_(rows, '2026-11-01', '2026-11-30', { basis: 'audit', weekStartsOn: 0, nameOf })
    const team = range.team as { audits: number; pendingDisputes: number }
    expect(team.audits).toBe(4)
    expect(team.pendingDisputes).toBe(1)
  })
})
