import { describe, expect, it } from 'vitest'
import { qaCleanInteractionDate_ } from '../../src/features/cx-quality/lib/pure'

const NOW = Date.parse('2026-11-15T12:00:00+03:00')

describe('qaCleanInteractionDate_ (offqueue audits)', () => {
  it('returns the date with a leading quote', () => {
    expect(qaCleanInteractionDate_('2026-11-01', NOW)).toBe("'2026-11-01")
    expect(qaCleanInteractionDate_(' 2026-11-01 ', NOW)).toBe("'2026-11-01")
  })
  it('degrades a stray datetime to its date', () => {
    expect(qaCleanInteractionDate_('2026-11-01 14:30', NOW)).toBe("'2026-11-01")
    expect(qaCleanInteractionDate_('2026-11-01T14:30', NOW)).toBe("'2026-11-01")
  })
  it('rejects an empty value', () => {
    expect(() => qaCleanInteractionDate_('', NOW)).toThrow('Enter the interaction date (yyyy-MM-dd).')
    expect(() => qaCleanInteractionDate_(null, NOW)).toThrow('Enter the interaction date (yyyy-MM-dd).')
  })
  it('rejects non yyyy-MM-dd values', () => {
    expect(() => qaCleanInteractionDate_('01/11/2026', NOW)).toThrow('The interaction date is not valid (use yyyy-MM-dd).')
    expect(() => qaCleanInteractionDate_('2026-13-01', NOW)).toThrow('The interaction date is not valid (use yyyy-MM-dd).')
    expect(() => qaCleanInteractionDate_('2026-11-1', NOW)).toThrow('The interaction date is not valid (use yyyy-MM-dd).')
  })
  it('rejects a future date and a date older than 180 days', () => {
    expect(() => qaCleanInteractionDate_('2026-11-16', NOW)).toThrow('The interaction date is in the future.')
    expect(() => qaCleanInteractionDate_('2026-05-01', NOW)).toThrow('The interaction date is more than 180 days ago.')
  })
})
