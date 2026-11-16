import { describe, expect, it } from 'vitest'
import { qaColumnTrend_ } from '../../src/features/cx-quality/lib/analytics'

interface Cell {
  avg: number | null
  audits: number
  history: number
}
interface Grain {
  periods: string[]
  team: Cell[]
  agents: { key: string; label: string; cells: Cell[] }[]
}
interface Columns {
  week: Grain
  month: Grain
  agentWeeks: Grain
}

const audit = (agent_email: string, audit_date: string, sample_basis = 'random', score = 80): Record<string, unknown> => ({
  agent_email,
  audit_date,
  sample_basis,
  score,
})

describe('qaColumnTrend_ agentWeeks grain', () => {
  const known = [
    audit('b@x.com', '2026-11-10', 'random', 80),
    audit('a@x.com', '2026-11-10', 'historical', 60),
    audit('b@x.com', '2026-06-01'), // older than the 12-week window
    audit('a@x.com', '2026-11-11', 'targeted', 90), // every basis counts
  ]
  const cols = qaColumnTrend_(known, '2026-11-14', 0, (e) => e) as unknown as Columns

  it('returns 12 weekly periods ending at the anchor quota week', () => {
    expect(cols.agentWeeks.periods).toHaveLength(12)
    expect(cols.agentWeeks.periods[11]).toBe('2026-11-08')
    expect(cols.agentWeeks.periods[0]).toBe('2026-08-23')
  })

  it('buckets a 2026-11-10 audit into the last cell', () => {
    const b = cols.agentWeeks.agents.find((g) => g.key === 'b@x.com')
    const last = b!.cells[11]
    expect(last.avg).toBe(80)
    expect(last.audits).toBe(1)
    expect(last.history).toBe(0)
    const a = cols.agentWeeks.agents.find((g) => g.key === 'a@x.com')
    expect(a!.cells[11].avg).toBe(75)
    expect(a!.cells[11].audits).toBe(2)
    expect(a!.cells[11].history).toBe(1)
  })

  it('excludes audits outside the window but counts every basis', () => {
    const total = cols.agentWeeks.team.reduce((s, c) => s + c.audits, 0)
    expect(total).toBe(3)
    expect(cols.week.periods).toHaveLength(8)
    expect(cols.month.periods).toHaveLength(6)
  })

  it('sorts agents by label', () => {
    expect(cols.agentWeeks.agents.map((g) => g.key)).toEqual(['a@x.com', 'b@x.com'])
  })
})
