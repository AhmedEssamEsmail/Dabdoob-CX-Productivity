import { describe, it, expect, vi } from 'vitest'

// Empty-store supabase stub: every chained call returns the query proxy, which
// awaits to { data: [], error: null } — so calendar code sees an empty roster,
// no holidays and config defaults, without any network.
vi.mock('@/lib/supabase', () => {
  const res = Promise.resolve({ data: [], error: null })
  const proxy: Record<string, unknown> = new Proxy(
    {},
    {
      get: (_t, prop) => (prop === 'then' ? res.then.bind(res) : () => proxy),
    }
  )
  return { supabase: { from: () => proxy }, createClient: () => ({ from: () => proxy }) }
})
import {
  dqParseDaysOff, dqIsHoliday, pwDayHours, getWorkingCalendar, wcReset, setTlScheduleSource,
  WC_WEEKDAYS,
} from '@/lib/platform/calendar'
import { pwAt } from '@/lib/platform/time'

describe('dqParseDaysOff', () => {
  it('parses "Fri,Sat" and arrays into week order', () => {
    expect(dqParseDaysOff('Sat,Fri')).toEqual(['Fri', 'Sat']) // re-ordered to week order
    expect(dqParseDaysOff(['fri', 'SUN'])).toEqual(['Sun', 'Fri'])
    expect(dqParseDaysOff('')).toEqual([])
    expect(dqParseDaysOff(null)).toEqual([])
  })

  it('rejects non-weekday tokens', () => {
    expect(() => dqParseDaysOff('Funday')).toThrow('weekday')
    expect(() => dqParseDaysOff('Fr')).toThrow('weekday')
  })
})

describe('dqIsHoliday', () => {
  const idx = { 'egypt|2026-10-08': 'Armed Forces Day' }
  it('matches country+date case-insensitively on the country', () => {
    expect(dqIsHoliday('Egypt', '2026-10-08', idx)).toBe(true)
    expect(dqIsHoliday('Kuwait', '2026-10-08', idx)).toBe(false)
    expect(dqIsHoliday('', '2026-10-08', idx)).toBe(false)
    expect(dqIsHoliday('Egypt', '2026-10-09', idx)).toBe(false)
  })
})

describe('pwDayHours (WorkCore.js)', () => {
  const defs = { AM: { start: '09:30', end: '18:30' }, PM: { start: '13:00', end: '22:00' } }

  it('full AM window inside the day = 8 paid hours (9 h - 1 h break)', () => {
    const from = pwAt('2026-10-08', '00:00')
    const to = pwAt('2026-10-09', '00:00')
    const day = { date: '2026-10-08', working: true, reason: null, shift: 'AM', estimated: false }
    expect(pwDayHours(day, from, to, defs, 1)).toBeCloseTo(8)
  })

  it('scales the break into partial overlaps', () => {
    // 09:30-11:30 inside a 9h shift with 1h break -> 2 * 8/9
    const day = { date: '2026-10-08', working: true, reason: null, shift: 'AM', estimated: false }
    const h = pwDayHours(day, pwAt('2026-10-08', '09:30'), pwAt('2026-10-08', '11:30'), defs, 1)
    expect(h).toBeCloseTo((2 * 8) / 9, 5)
  })

  it('overnight shifts (end <= start) roll past midnight', () => {
    const night = { AM: { start: '22:00', end: '02:00' } }
    const day = { date: '2026-10-08', working: true, reason: null, shift: 'AM', estimated: false }
    const from = pwAt('2026-10-08', '22:00')
    const to = pwAt('2026-10-09', '03:00')
    // shift 22:00->02:00 next day (4h, no break): overlap = 4h
    expect(pwDayHours(day, from, to, night, 0)).toBeCloseTo(4)
  })

  it('non-working days and missing shifts give 0', () => {
    const off = { date: '2026-10-08', working: false, reason: 'off', shift: null, estimated: false }
    expect(pwDayHours(off as never, 0, 86400000, defs, 1)).toBe(0)
    const noShift = { date: '2026-10-08', working: true, reason: null, shift: null, estimated: true }
    expect(pwDayHours(noShift as never, 0, 86400000, defs, 1)).toBe(0)
  })
})

describe('getWorkingCalendar with unreachable storage', () => {
  it('everyone works the default pattern: no days off, no holidays, estimated', async () => {
    wcReset()
    setTlScheduleSource(async () => ({ shifts: {}, offDays: {} }))
    const days = await getWorkingCalendar('ghost@dabdoob.com', '2026-10-05', '2026-10-09')
    expect(days.map((d) => d.date)).toEqual(['2026-10-05', '2026-10-06', '2026-10-07', '2026-10-08', '2026-10-09'])
    expect(days.every((d) => d.working && d.estimated && d.reason === null)).toBe(true)
    expect(WC_WEEKDAYS[5]).toBe('Fri') // 2026-10-09 is a Friday
  }, 30000)
})
