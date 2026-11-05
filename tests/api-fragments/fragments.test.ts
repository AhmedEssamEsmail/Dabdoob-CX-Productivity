import { describe, it, expect } from 'vitest'
import { holidayInput } from '@/features/shared/platform/holidays'
import { fcrDailyInput } from '@/features/cx-people/lib/scorecard/fcr'
import { monthRange, inDateRange, pick } from '@/features/shared/lib/fragments'
import { InputError } from '@/features/shared/lib/api-error'

describe('monthRange', () => {
  it('returns the inclusive from/to of a month (leap year)', () => {
    expect(monthRange('2024-02')).toEqual({ from: '2024-02-01', to: '2024-02-29' })
    expect(monthRange('2026-04')).toEqual({ from: '2026-04-01', to: '2026-04-30' })
  })

  it('throws InputError on a bad month', () => {
    expect(() => monthRange('2026-4')).toThrow('Give the month as yyyy-MM.')
    expect(() => monthRange('2026-13' as string)).toThrow(InputError)
  })
})

describe('inDateRange / pick', () => {
  it('bounds check on yyyy-MM-dd strings', () => {
    expect(inDateRange('2026-04-15', '2026-04-01', '2026-04-30')).toBe(true)
    expect(inDateRange('2026-05-01', '2026-04-01', '2026-04-30')).toBe(false)
    expect(inDateRange('', '2026-04-01', '2026-04-30')).toBe(false)
  })

  it('picks the first present field (snake/camel)', () => {
    expect(pick({ agent_email: 'a@x.com' }, 'agent_email', 'email')).toBe('a@x.com')
    expect(pick({ email: 'b@x.com' }, 'agent_email', 'email')).toBe('b@x.com')
    expect(pick({}, 'agent_email', 'email')).toBeUndefined()
  })
})

describe('holidayInput', () => {
  it('requires country and a yyyy-MM-dd date', () => {
    expect(() => holidayInput({ date: '2026-04-01' })).toThrow('A holiday needs a country.')
    expect(() => holidayInput({ country: 'Kuwait' })).toThrow('A holiday needs a date (yyyy-MM-dd).')
    expect(holidayInput({ country: ' Kuwait ', date: '2026-04-01T00:00:00Z', name: 'N' })).toEqual({
      country: 'Kuwait',
      date: '2026-04-01',
      name: 'N',
    })
  })
})

describe('fcrDailyInput (scorecard FCR rows)', () => {
  it('accepts the scorecard row shape and the agent_email alias', () => {
    expect(fcrDailyInput({ date: '2026-04-01', email: 'A@X.com ', passed: '3', failed: 1, excluded: 2 })).toEqual({
      date: '2026-04-01',
      agent_email: 'a@x.com',
      passed: 3,
      failed: 1,
      excluded: 2,
    })
  })

  it('requires date and email', () => {
    expect(() => fcrDailyInput({ email: 'a@x.com' })).toThrow('FCR rows need a date (yyyy-MM-dd).')
    expect(() => fcrDailyInput({ date: '2026-04-01' })).toThrow('FCR rows need an agent email.')
  })

  it('rejects negative counts and defaults missing ones to 0', () => {
    expect(() => fcrDailyInput({ date: '2026-04-01', email: 'a@x.com', passed: -1 })).toThrow(
      'passed is a non-negative number.'
    )
    expect(fcrDailyInput({ date: '2026-04-01', email: 'a@x.com' })).toEqual({
      date: '2026-04-01',
      agent_email: 'a@x.com',
      passed: 0,
      failed: 0,
      excluded: 0,
    })
  })
})
