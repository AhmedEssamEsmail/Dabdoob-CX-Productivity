import { describe, expect, it } from 'vitest'
import { qaScoreDate_, qaHasInteraction_ } from '../../src/features/cx-quality/lib/analytics'
import { qaWhen_ } from '../../src/features/cx-quality/lib/core'

// Regression: qa_audits.interaction_at for ~98% of prod rows is sheet-era
// 'M/D/YYYY H:mm:ss' text (prod census 2026-11-16: 6680/6817 rows, e.g.
// '10/15/2026 0:00:00'; second field >12 in most rows proves month-first).
// On the default 'interaction' basis the audit must bucket on the interaction
// date; today qaScoreDate_ silently falls back to audit_date, so the
// Agents-by-week counts measure audit completion day, not interaction day.
describe('qaScoreDate_ interaction basis on sheet-era M/D/YYYY interaction_at', () => {
  const a = { interaction_at: '10/15/2026 0:00:00', audit_date: '2026-10-19' }

  it('parses M/D/YYYY as the interaction date (month-first)', () => {
    expect(qaScoreDate_(a, 'interaction')).toBe('2026-10-15')
  })

  it('does not silently fall back to audit_date', () => {
    expect(qaScoreDate_(a, 'interaction')).not.toBe('2026-10-19')
  })

  it('qaHasInteraction_ recognizes the sheet-era format', () => {
    expect(qaHasInteraction_(a)).toBe(true)
  })
})

describe('qaWhen_ sheet-era M/D/YYYY normalization', () => {
  it('normalizes M/D/YYYY H:mm:ss to yyyy-MM-dd HH:mm', () => {
    expect(qaWhen_('10/15/2026 0:00:00')).toBe('2026-10-15 00:00')
    expect(qaWhen_('3/5/2026 13:45:20')).toBe('2026-03-05 13:45')
    expect(qaWhen_("'9/1/2026 8:05")).toBe('2026-09-01 08:05')
  })

  it('passes through values that are not month-first M/D/YYYY', () => {
    expect(qaWhen_('15/20/2026 0:00:00')).toBe('15/20/2026 0:00:00')
    expect(qaWhen_('garbage')).toBe('garbage')
    expect(qaWhen_('2026-03-01 10:30')).toBe('2026-03-01 10:30')
  })

  it('an invalid sheet date still falls back to audit_date', () => {
    expect(qaScoreDate_({ interaction_at: '15/20/2026 0:00:00', audit_date: '2026-10-19' }, 'interaction')).toBe('2026-10-19')
  })
})
