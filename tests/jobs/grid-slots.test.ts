/**
 * tphGridFromIntervals_ — prod_intervals AUX statuses -> prod_tph_days slots:
 * prod_channel_status inversion, dedicated statuses (calls/break/meeting/off),
 * unmapped statuses leave the slot unlogged (carry-forward), dominant
 * overlap wins, Kuwait-local slot indices.
 */
import { describe, expect, it } from 'vitest'
import { gridStatusChannel_, tphGridFromIntervals_, type IntervalRow } from '@/features/shared/jobs/grid-slots'
import type { Cfg } from '@/features/shared/lib/adapters'

const CFG = {
  tph_day_hours: [8, 24],
  prod_channel_status: { chat: 'Chats', ticket: 'Available', wa: 'Waiting Address' },
} as unknown as Cfg

// Kuwait is UTC+3: 09:00 Kuwait = 06:00 UTC
const iv = (agent: string, status: string, fromMin: number, toMin: number, date = '2026-09-10'): IntervalRow => ({
  date,
  agent_email: agent,
  status,
  start_at: `2026-09-10T${String(Math.floor(fromMin / 60)).padStart(2, '0')}:${String(fromMin % 60).padStart(2, '0')}:00+03:00`,
  end_at: `2026-09-10T${String(Math.floor(toMin / 60)).padStart(2, '0')}:${String(toMin % 60).padStart(2, '0')}:00+03:00`,
})

describe('gridStatusChannel_', () => {
  it('maps config channel statuses and the dedicated ones', () => {
    expect(gridStatusChannel_('Available', CFG)).toBe('internal')
    expect(gridStatusChannel_('Chats', CFG)).toBe('chats')
    expect(gridStatusChannel_('Waiting Address', CFG)).toBe('wa')
    expect(gridStatusChannel_('Inbound Calls', CFG)).toBe('calls')
    expect(gridStatusChannel_('Break', CFG)).toBe('break')
    expect(gridStatusChannel_('One to One', CFG)).toBe('meeting')
    expect(gridStatusChannel_('Logged out', CFG)).toBe('off')
  })
  it('unmapped statuses return null (carry-forward, not off)', () => {
    expect(gridStatusChannel_('IDLE', CFG)).toBeNull()
    expect(gridStatusChannel_('Unavailable', CFG)).toBeNull()
    expect(gridStatusChannel_('', CFG)).toBeNull()
  })
})

describe('tphGridFromIntervals_', () => {
  it('fills the interval-covered slots with the mapped channel', () => {
    // 09:00-10:00 Kuwait = slots 36..39 (9*4=36 .. 40)
    const out = tphGridFromIntervals_([iv('a@x.com', 'Available', 9 * 60, 10 * 60)], CFG)
    const day = out['2026-09-10|a@x.com']
    expect(day.slots[36]).toBe('internal')
    expect(day.slots[39]).toBe('internal')
    expect(day.slots[40]).toBeUndefined()
    expect(day.slots[35]).toBeUndefined()
  })

  it('clips to tph_day_hours and the day boundary', () => {
    // 07:30-08:15: grid starts at hour 8 -> only slots 32,33 (08:00,08:15? no: 08:15 is slot 33 covers 8:15-8:30)
    const out = tphGridFromIntervals_([iv('a@x.com', 'Available', 7.5 * 60, 8.5 * 60)], CFG)
    const day = out['2026-09-10|a@x.com']
    expect(Object.keys(day.slots).map(Number).sort((x, y) => x - y)).toEqual([32, 33])
  })

  it('dominant overlap wins when two statuses share a slot', () => {
    // 09:00-09:40 Available, 09:40-10:10 Chats -> slot 39 (09:45-10:00): chats 15m vs avail 0 -> chats
    const out = tphGridFromIntervals_(
      [iv('a@x.com', 'Available', 9 * 60, 9 * 60 + 40), iv('a@x.com', 'Chats', 9 * 60 + 40, 10 * 60 + 10)],
      CFG
    )
    const day = out['2026-09-10|a@x.com']
    expect(day.slots[36]).toBe('internal')
    expect(day.slots[38]).toBe('internal')
    expect(day.slots[39]).toBe('chats')
    expect(day.slots[40]).toBe('chats')
  })

  it('unmapped statuses produce no day row at all', () => {
    const out = tphGridFromIntervals_([iv('a@x.com', 'IDLE', 9 * 60, 10 * 60)], CFG)
    expect(out['2026-09-10|a@x.com']).toBeUndefined()
  })
})
