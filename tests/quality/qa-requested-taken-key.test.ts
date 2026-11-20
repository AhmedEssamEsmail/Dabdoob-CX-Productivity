import { describe, expect, it } from 'vitest'
import { qaRequestedTakenFor_ } from '../../src/features/cx-quality/lib/pure'

const FULL = 'Abdelsamad Mohamed Abdelsamad Youssef'
const WEEK_START = '2026-03-09'

const row = (over: Record<string, unknown>): Record<string, unknown> => ({
  queue_id: 'q1', queue_date: '2026-03-10', ticket_id: 'T1', agent_email: 'a@x.com',
  agent_name: FULL, status: 'open', ...over,
})

describe('qaRequestedTakenFor_ agent key', () => {
  it('keys by the full roster agent_name, not the canon first+last form', () => {
    const out = qaRequestedTakenFor_([
      row({ source: 'request', queue_id: 'r1' }),
      row({ queue_id: 'n1', source: 'queue', audit_type: 'Cash refund', reference: 'ref-9', ticket_id: '' }),
    ], WEEK_START)
    expect(Object.keys(out)).toEqual([FULL])
    expect(out[FULL]).toBe(2)
    expect(out['Abdelsamad Youssef']).toBeUndefined()
  })

  it('excludes waived, passed and pre-weekStart rows', () => {
    const out = qaRequestedTakenFor_([
      row({ source: 'request', queue_id: 'r1', status: 'waived' }),
      row({ source: 'request', queue_id: 'r2', status: 'passed' }),
      row({ source: 'request', queue_id: 'r3', queue_date: '2026-03-08' }),
      row({ source: 'request', queue_id: 'r4', agent_name: '  ' }),
      row({ queue_id: 'r5', source: 'import' }),
    ], WEEK_START)
    expect(out).toEqual({})
  })

  it('trims surrounding whitespace but keeps the full roster name', () => {
    const out = qaRequestedTakenFor_([row({ source: 'request', agent_name: '  ' + FULL + '  ' })], WEEK_START)
    expect(out).toEqual({ [FULL]: 1 })
  })
})
