import { describe, it, expect } from 'vitest'
import {
  pwTxt, pwStr, pwMs, pwIso, pwKwDate, pwKwTime, pwDateOnly, pwAt, pwDow, pwAddDays, pwToday,
  dqAddDays, pwPrevMonth, pwIsOpenStatus, pwOpenSeriesActions, pwFit, pwRound1, scRound1,
  pwLatestPercent, d0num, scNum, scEmail, scNumRow, dqGroupKey, dqInList, dqNameHasText,
} from '@/lib/platform/time'

describe('Kuwait time helpers (PeopleCore.js)', () => {
  it('pwMs parses date-only and datetime-local strings as Kuwait time', () => {
    expect(pwMs('2026-10-08')).toBe(Date.parse('2026-10-08T00:00:00+03:00'))
    expect(pwMs('2026-10-08T14:00')).toBe(Date.parse('2026-10-08T14:00:00+03:00'))
    expect(pwMs('2026-10-08T14:00:30')).toBe(Date.parse('2026-10-08T14:00:30+03:00'))
    expect(pwMs('')).toBeNaN()
    expect(pwMs(null)).toBeNaN()
    expect(pwMs(1000)).toBe(1000)
  })

  it('pwKwDate/pwKwTime render in Asia/Kuwait (UTC+3)', () => {
    const utc = Date.parse('2026-10-08T21:30:00Z')
    expect(pwKwDate(utc)).toBe('2026-10-09') // 00:30 next day in Kuwait
    expect(pwKwTime(utc)).toBe('00:30')
    expect(pwKwDate('junk')).toBe('')
  })

  it('pwAt gives the instant of a Kuwait wall-clock time', () => {
    expect(pwAt('2026-10-08', '09:30')).toBe(Date.parse('2026-10-08T09:30:00+03:00'))
  })

  it('pwDow/pwAddDays/pwToday/dqAddDays/pwPrevMonth work on calendar dates', () => {
    expect(pwDow('2026-10-08')).toBe(4) // Thursday
    expect(pwAddDays('2026-10-31', 1)).toBe('2026-11-01')
    expect(pwAddDays('2026-01-01', -1)).toBe('2025-12-31')
    expect(dqAddDays('2026-02-28', 1)).toBe('2026-03-01')
    expect(pwPrevMonth('2026-01')).toBe('2025-12')
    expect(pwPrevMonth('2026-10')).toBe('2026-09')
    expect(pwToday(Date.parse('2026-10-08T22:00:00Z'))).toBe('2026-10-09')
  })

  it('pwDateOnly normalises text and date-ish values', () => {
    expect(pwDateOnly('2026-10-08')).toBe('2026-10-08')
    expect(pwDateOnly("'2026-10-08")).toBe('2026-10-08')
    expect(pwDateOnly('')).toBe('')
  })

  it('pwTxt/pwStr round-trip the apostrophe text marker', () => {
    expect(pwTxt('abc')).toBe("'abc")
    expect(pwTxt('')).toBe('')
    expect(pwStr("'abc")).toBe('abc')
    expect(pwStr('abc')).toBe('abc')
  })

  it('pwIso emits ISO or empty', () => {
    expect(pwIso('2026-10-08')).toBe('2026-10-07T21:00:00.000Z')
    expect(pwIso('nope')).toBe('')
  })
})

describe('WorkCore pure helpers', () => {
  it('pwIsOpenStatus: open and blocked only', () => {
    expect(pwIsOpenStatus('open')).toBe(true)
    expect(pwIsOpenStatus('blocked')).toBe(true)
    expect(pwIsOpenStatus('done')).toBe(false)
  })

  it('pwOpenSeriesActions filters the series to open actions', () => {
    const all = [
      { series_id: 's1', status: 'open' },
      { series_id: 's1', status: 'done' },
      { series_id: 's1', status: 'blocked' },
      { series_id: 's2', status: 'open' },
    ]
    expect(pwOpenSeriesActions('s1', all).map((a) => a.status)).toEqual(['open', 'blocked'])
  })

  it('pwFit: fits / tight / does_not_fit at the 80% edge', () => {
    expect(pwFit(0, 10)).toBe('fits')
    expect(pwFit(11, 10)).toBe('does_not_fit')
    expect(pwFit(9, 10)).toBe('tight')
    expect(pwFit(7, 10)).toBe('fits')
  })

  it('rounding and number parsing', () => {
    expect(pwRound1(1.26)).toBe(1.3)
    expect(scRound1).toBe(pwRound1)
    expect(d0num('')).toBeNull()
    expect(d0num('5')).toBe(5)
    expect(scNum('85%')).toBe(85)
    expect(scNum('')).toBe(0)
    expect(scNum('abc')).toBe(0)
    expect(scEmail(' A@B.COM ')).toBe('a@b.com')
  })

  it('pwLatestPercent: last non-empty wins', () => {
    expect(pwLatestPercent([{ percent_complete: 10 }, { percent_complete: '' }, { percent_complete: 40 }])).toBe(40)
    expect(pwLatestPercent([{ percent_complete: '' }])).toBe(0)
  })

  it('scNumRow normalises a scorecard row', () => {
    const row = scNumRow({ month: '2026-10', date: '2026-10-08', email: ' A@B.COM ', name: 'A', audits: '3', inb_target: '10' })
    expect(row.email).toBe('a@b.com')
    expect(row.audits).toBe(3)
    expect(row.inb_target).toBe(10)
    expect(row.fcr_passed).toBe(0)
  })
})

describe('QueueCore group-name helpers', () => {
  it('dqGroupKey ignores case, dash variants and spacing around "-"', () => {
    expect(dqGroupKey('Ops Qatar - Gift cards')).toBe('ops qatar-gift cards')
    expect(dqGroupKey('Ops  Qatar  –Gift cards')).toBe('ops qatar-gift cards')
    expect(dqGroupKey('OPS QATAR-GIFT CARDS')).toBe('ops qatar-gift cards')
    expect(dqGroupKey('')).toBe('')
  })

  it('dqInList matches by group key', () => {
    expect(dqInList('Ops Qatar - Gift cards', ['ops qatar-gift cards'])).toBe(true)
    expect(dqInList('Other', ['ops qatar-gift cards'])).toBe(false)
    expect(dqInList('x', null)).toBe(false)
  })

  it('dqNameHasText finds any word, case-insensitive', () => {
    expect(dqNameHasText('Ops Qatar - Gift cards', 'gift card')).toBe(true)
    expect(dqNameHasText('Customer Support', ['gift card', 'support'])).toBe(true)
    expect(dqNameHasText('Customer Support', 'gift card')).toBe(false)
  })
})
