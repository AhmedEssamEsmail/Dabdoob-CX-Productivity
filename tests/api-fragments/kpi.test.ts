import { describe, it, expect } from 'vitest'
import { behaviourInput, leaveInput, olCaseInput } from '@/lib/kpi/server'
import { KPI_LEAVE_TYPES } from '@/lib/kpi'
import { InputError } from '@/lib/api-error'

describe('behaviourInput (kpi_behaviour_log)', () => {
  it('requires an email and a yyyy-MM-dd date', () => {
    expect(() => behaviourInput({ date: '2026-04-01' })).toThrow('A behaviour case needs an email.')
    expect(() => behaviourInput({ email: 'a@x.com' })).toThrow('Give the case date (yyyy-MM-dd).')
    expect(() => behaviourInput({ email: 'a@x.com', date: '01/04/2026' })).toThrow(InputError)
  })

  it('normalizes the email and keeps the note', () => {
    expect(behaviourInput({ email: ' A@X.com ', date: '2026-04-01', note: 'n' })).toEqual({
      email: 'a@x.com',
      date: '2026-04-01',
      note: 'n',
    })
  })
})

describe('leaveInput (kpi_leave_log)', () => {
  it('requires email and first day', () => {
    expect(() => leaveInput({})).toThrow('A leave needs an email.')
    expect(() => leaveInput({ email: 'a@x.com' })).toThrow('A leave needs its first day (from_date yyyy-MM-dd).')
  })

  it('defaults to_date to from_date and accepts camelCase', () => {
    expect(leaveInput({ email: 'a@x.com', fromDate: '2026-04-10', type: 'Sick' })).toEqual({
      email: 'a@x.com',
      from_date: '2026-04-10',
      to_date: '2026-04-10',
      type: 'Sick',
      note: '',
    })
  })

  it('rejects a to_date before from_date and a bad to_date', () => {
    expect(() =>
      leaveInput({ email: 'a@x.com', from_date: '2026-04-10', to_date: '2026-04-01', type: 'Sick' })
    ).toThrow('to_date cannot be before from_date.')
    expect(() =>
      leaveInput({ email: 'a@x.com', from_date: '2026-04-10', to_date: 'nope', type: 'Sick' })
    ).toThrow('to_date must be a date (yyyy-MM-dd).')
  })

  it('validates type against KPI_LEAVE_TYPES verbatim', () => {
    KPI_LEAVE_TYPES.forEach((t) => {
      expect(leaveInput({ email: 'a@x.com', from_date: '2026-04-01', type: t }).type).toBe(t)
    })
    expect(() => leaveInput({ email: 'a@x.com', from_date: '2026-04-01', type: 'Vacation' })).toThrow(
      'Leave type must be one of ' + KPI_LEAVE_TYPES.join(', ') + '.'
    )
  })
})

describe('olCaseInput (kpi_ol_cases)', () => {
  it('validates month, email and cases', () => {
    expect(() => olCaseInput({ email: 'a@x.com', cases: 1 })).toThrow('OL cases need a month (yyyy-MM).')
    expect(() => olCaseInput({ month: '2026-04', cases: 1 })).toThrow('OL cases need an email.')
    expect(() => olCaseInput({ month: '2026-04', email: 'a@x.com', cases: -1 })).toThrow(
      'cases is a non-negative whole number.'
    )
    expect(() => olCaseInput({ month: '2026-04', email: 'a@x.com', cases: 1.5 })).toThrow(InputError)
  })

  it('derives the upsert key as month|email when not given', () => {
    expect(olCaseInput({ month: '2026-04', email: 'A@X.com', cases: 2 })).toEqual({
      key: '2026-04|a@x.com',
      month: '2026-04',
      email: 'a@x.com',
      cases: 2,
    })
    expect(olCaseInput({ month: '2026-04', email: 'a@x.com', cases: 0, key: 'k1' }).key).toBe('k1')
  })
})
