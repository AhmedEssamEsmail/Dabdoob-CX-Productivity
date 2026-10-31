import { describe, it, expect } from 'vitest'
import { dqOpenAgingFlags_, dqAgingFlagOut_ } from '@/lib/queue'
import {
  agingFlagInput,
  agingResolveInput,
  checkinInput,
  dqSlotsForDate_,
} from '@/lib/queue/server'
import { InputError } from '@/lib/api-error'
import type { Cfg } from '@/lib/prod/adapters'

const CFG: Cfg = {
  business_tz: 'Asia/Kuwait',
  data_tz: 'Africa/Cairo',
  checkin_slots: ['09:30', '13:00', '18:30', '22:00'],
  checkin_slot_names: { '09:30': 'Start of day', '13:00': 'PM shift start', '18:30': 'End of overlap', '22:00': 'End of day' },
  checkin_read_delay_min: 20,
  checkin_open_before_min: 15,
  checkin_due_after_min: 30,
}

describe('checkinInput (POST /api/queue/checkins payload)', () => {
  it('accepts a full snake_case payload and normalizes it', () => {
    const out = checkinInput(
      {
        slot_date: '2026-04-01',
        slot: '09:30',
        status: 'ok',
        snapshot_key: 'snap1',
        queues_json: '{"Ops":3}',
        corrections_json: [{ queue: 'Ops' }],
        correction_reason: 'fix',
        general_note: 'note',
        help_needed: 'true',
        help_note: 'help',
      },
      CFG
    )
    expect(out.slot_date).toBe('2026-04-01')
    expect(out.slot).toBe('09:30')
    expect(out.queues_json).toEqual({ Ops: 3 })
    expect(out.corrections_json).toEqual([{ queue: 'Ops' }])
    expect(out.help_needed).toBe(true)
    expect(out.help_note).toBe('help')
  })

  it('accepts the camelCase aliases and a `date` key', () => {
    const out = checkinInput({ date: '2026-04-01', slot: '13:00', generalNote: 'g', helpNeeded: false }, CFG)
    expect(out.slot_date).toBe('2026-04-01')
    expect(out.general_note).toBe('g')
    expect(out.help_needed).toBe(false)
    expect(out.queues_json).toBeNull()
  })

  it('rejects a missing/bad slot date', () => {
    expect(() => checkinInput({ slot: '09:30' }, CFG)).toThrow(InputError)
    expect(() => checkinInput({ slot_date: 'April', slot: '09:30' }, CFG)).toThrow(InputError)
  })

  it('rejects an unconfigured slot like dqSlotIn_ (Unknown slot)', () => {
    expect(() => checkinInput({ slot_date: '2026-04-01', slot: '10:00' }, CFG)).toThrow('Unknown slot 10:00')
  })

  it('rejects queues_json text that is not JSON', () => {
    expect(() =>
      checkinInput({ slot_date: '2026-04-01', slot: '09:30', queues_json: 'not json' }, CFG)
    ).toThrow('queues_json must be valid JSON.')
  })
})

describe('dqSlotsForDate_ (checkins GET slot states)', () => {
  it('marks submitted slots done and the rest missed for a past date', () => {
    const subs = [
      { submission_id: 'qs_1', slot_date: '2026-04-01', slot: '09:30', submitted_by: 'tl@x.com', submitted_at: '2026-04-01T06:40:00Z' },
    ]
    const slots = dqSlotsForDate_('2026-04-01', Date.parse('2026-04-02T00:00:00Z'), CFG, subs)
    expect(slots).toHaveLength(4)
    expect(slots[0].slot).toBe('09:30')
    expect(slots[0].state).toBe('done')
    expect(slots[0].submittedBy).toBe('tl@x.com')
    expect(slots.slice(1).every((s) => s.state === 'missed')).toBe(true)
  })

  it('marks a slot within its window due and a later one upcoming', () => {
    // 09:30 Kuwait = 06:30 UTC; window opens 15 min before, due 30 min after.
    const now = Date.parse('2026-04-01T06:45:00Z') // 09:45 Kuwait
    const slots = dqSlotsForDate_('2026-04-01', now, CFG, [])
    expect(slots[0].state).toBe('due')
    expect(slots[1].state).toBe('upcoming')
  })
})

describe('agingFlagInput / agingResolveInput', () => {
  it('requires a ticket id and carries note/tl_email', () => {
    expect(() => agingFlagInput({})).toThrow('A flag needs a ticket id.')
    const out = agingFlagInput({ ticketId: ' 123 ', note: 'check', tlEmail: 'TL@X.com ' })
    expect(out).toEqual({ ticket_id: '123', note: 'check', tl_email: 'tl@x.com' })
  })

  it('requires a flag id to resolve', () => {
    expect(() => agingResolveInput({})).toThrow('Give the flag to resolve.')
    expect(agingResolveInput({ flag_id: 'af_1', resolved_note: 'done' })).toEqual({
      flag_id: 'af_1',
      resolved_note: 'done',
    })
  })
})

describe('dqOpenAgingFlags_ (QueueCore.js)', () => {
  const flagRows = [
    { flag_id: 'af_1', ticket_id: '1', note: 'n', tl_email: 'TL@X.com', submitted_by: 'Admin@X.com', submitted_at: 't1', resolved_at: '' },
    { flag_id: 'af_2', ticket_id: '2', note: '', tl_email: '', submitted_by: 'b@x.com', submitted_at: 't2', resolved_at: '' },
    { flag_id: 'af_3', ticket_id: '1', note: 'old', tl_email: '', submitted_by: 'b@x.com', submitted_at: 't3', resolved_at: 't4' },
  ]

  it('returns open flags still on the aging board, in the client shape', () => {
    const out = dqOpenAgingFlags_(flagRows, [{ ticket_id: '1' }, { ticket_id: '9' }])
    expect(out).toEqual([
      { flagId: 'af_1', ticketId: '1', note: 'n', tlEmail: 'tl@x.com', by: 'admin@x.com', at: 't1' },
    ])
  })

  it('returns [] when the flag store is absent (null)', () => {
    expect(dqOpenAgingFlags_(null, [{ ticket_id: '1' }])).toEqual([])
  })

  it('dqAgingFlagOut_ maps one row the same way', () => {
    expect(dqAgingFlagOut_(flagRows[1])).toEqual({
      flagId: 'af_2', ticketId: '2', note: '', tlEmail: '', by: 'b@x.com', at: 't2',
    })
  })
})
