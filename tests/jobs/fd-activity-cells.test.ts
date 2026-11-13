/**
 * fdActivityToCells_ — raw ticket_activities export object -> the 10-cell
 * 'Activities' mirror rows (Reference_Code.gs :236-253 expansion + :297-312
 * write). Pure mapper: roster names come in as a byId map, no fetch/db.
 */
import { describe, expect, it } from 'vitest'

import { fdActivityToCells_, parseFdActivityDate_ } from '@/features/shared/jobs/vendor-apis'

const ROSTER = { '7': 'Ahmed Agent', '12': 'Sara Tawil' }

const act = (activity: Record<string, unknown>, over: Record<string, unknown> = {}) => ({
  performed_at: '02/01/2026 10:00:00',
  ticket_id: 42,
  performer_id: 7,
  performer_type: 'user',
  activity,
  ...over,
})

describe('fdActivityToCells_', () => {
  it('maps a status change: code -> FD_STATUS_NAMES name, 10 cells with trailing blank', () => {
    const rows = fdActivityToCells_(act({ status: 4 }), ROSTER)
    expect(rows).toEqual([
      ['2026-01-02T10:00:00.000Z', '42', 'Ahmed Agent', 'user', 'Status Change', 'status', 'Resolved', '', '', ''],
    ])
  })

  it('maps a new_ticket activity to the Field Change row (boolean value kept)', () => {
    const rows = fdActivityToCells_(act({ new_ticket: true }), ROSTER)
    expect(rows).toEqual([
      ['2026-01-02T10:00:00.000Z', '42', 'Ahmed Agent', 'user', 'Field Change', 'new_ticket', true, '', '', ''],
    ])
  })

  it('expands one activity into both rows when new_ticket and status coexist (legacy order)', () => {
    const rows = fdActivityToCells_(act({ new_ticket: true, status: 2 }), ROSTER)
    expect(rows).toEqual([
      ['2026-01-02T10:00:00.000Z', '42', 'Ahmed Agent', 'user', 'Field Change', 'new_ticket', true, '', '', ''],
      ['2026-01-02T10:00:00.000Z', '42', 'Ahmed Agent', 'user', 'Status Change', 'status', 'Open', '', '', ''],
    ])
  })

  it('returns null for non-user performers and for activities the sheet never logged', () => {
    expect(fdActivityToCells_(act({ status: 4 }, { performer_type: 'system' }), ROSTER)).toBeNull()
    expect(fdActivityToCells_(act({ note: { id: 1, type: 4 } }), ROSTER)).toBeNull()
  })

  it('resolves performer names via roster freshdesk_id -> freshdesk_name, else User <id>', () => {
    expect(fdActivityToCells_(act({ status: 4 }, { performer_id: 12 }), ROSTER)![0][2]).toBe('Sara Tawil')
    expect(fdActivityToCells_(act({ status: 4 }, { performer_id: 99 }), ROSTER)![0][2]).toBe('User 99')
  })

  it('parses performed_at DD/MM/YYYY-first (day>12 ambiguity cannot flip) and ISO passthrough', () => {
    expect(parseFdActivityDate_('02/01/2026 10:00:00')!.toISOString()).toBe('2026-01-02T10:00:00.000Z')
    expect(parseFdActivityDate_('21-04-2017 09:33:38 +0000')!.toISOString()).toBe('2017-04-21T09:33:38.000Z')
    expect(parseFdActivityDate_('2026-01-03T08:00:00Z')!.toISOString()).toBe('2026-01-03T08:00:00.000Z')
    expect(parseFdActivityDate_('')).toBeNull()
    // a name-string status (documented export shape) passes through unmapped
    expect(fdActivityToCells_(act({ status: 'Open' }), ROSTER)![0][6]).toBe('Open')
  })

  it('fills old_value/group defensively: group name used, numeric group via groupNames, else blank', () => {
    // documented payload: activity.group is the NAME at activity time
    expect(fdActivityToCells_(act({ status: 4, group: 'Refunds' }), ROSTER)![0][8]).toBe('Refunds')
    // numeric group id resolves only when a groupNames map is passed
    expect(fdActivityToCells_(act({ status: 4, group: 900 }), ROSTER)![0][8]).toBe('')
    expect(fdActivityToCells_(act({ status: 4, group: 900 }), ROSTER, { '900': 'Ops' })![0][8]).toBe('Ops')
    // old value absent in the documented shape -> ''; candidate keys picked + status-mapped
    expect(fdActivityToCells_(act({ status: 4 }), ROSTER)![0][7]).toBe('')
    expect(fdActivityToCells_(act({ status: { from: 2, to: 4 } }), ROSTER)![0][7]).toBe('Open')
    expect(fdActivityToCells_(act({ status: { from: 2, to: 4 } }), ROSTER)![0][6]).toBe('Resolved')
  })
})
