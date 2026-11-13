/**
 * mirror-cells adapter contract — typed mirror row -> the positional cell
 * arrays the shared TPH readers consume (S04-01). Repointed from the retired
 * one-shot backfill script (migration/, gitignored) to the shipped adapter;
 * the legacy DD/MM + tsMs parse direction died with the pre-Sep-2026 purge.
 */
import { describe, expect, it } from 'vitest'

import { fdActivityCells_, freshchatCells_, maqsamCells_ } from '@/features/shared/jobs/mirror-cells'

describe('mirror-cells adapters', () => {
  it('fd_activities typed row -> 10-cell Activities layout (J blank)', () => {
    const cells = fdActivityCells_({
      performed_at: '2026-11-05T08:30:00.000Z',
      ticket_id: '12345',
      performer_name: 'Agent A',
      performer_type: 'user',
      activity_type: 'status_change',
      field_changed: 'status',
      new_value: '2',
      old_value: '1',
      group_name: 'Cairo',
    })
    expect(cells).toEqual([
      '2026-11-05T08:30:00.000Z', '12345', 'Agent A', 'user',
      'status_change', 'status', '2', '1', 'Cairo', '',
    ])
  })

  it('fd_activities nulls -> "" cells', () => {
    const cells = fdActivityCells_({
      performed_at: null, ticket_id: null, performer_name: null,
      performer_type: 'user', activity_type: null, field_changed: null,
      new_value: null, old_value: null, group_name: null,
    })
    expect(cells).toEqual(['', '', '', 'user', '', '', '', '', '', ''])
  })

  it('maqsam_calls typed row -> 7-cell D..J layout', () => {
    const cells = maqsamCells_({
      started_at: '2026-10-01T09:00:00.000Z',
      ended_at: '2026-10-01T09:05:00.000Z',
      duration: '0:05:00', agent_email: 'a@b.com',
      state: 'ANSWERED', direction: 'inbound', handling: '0.0035',
    })
    expect(cells).toEqual([
      '2026-10-01T09:00:00.000Z', '2026-10-01T09:05:00.000Z',
      '0:05:00', 'a@b.com', 'ANSWERED', 'inbound', '0.0035',
    ])
  })

  it('freshchat typed row -> 7-cell A..G layout', () => {
    const cells = freshchatCells_({
      initiated_at: '2026-10-01T09:00:00.000Z', status: 'AGENT_RESOLVE',
      ref_key: 'conv1-1759300800000', updated_at: '2026-10-02T10:00:00.000Z',
      resolved_at: '2026-10-02T11:00:00.000Z', channel: 'EMAIL',
      conversation_id: 'conv1',
    })
    expect(cells).toEqual([
      '2026-10-01T09:00:00.000Z', 'AGENT_RESOLVE', 'conv1-1759300800000',
      '2026-10-02T10:00:00.000Z', '2026-10-02T11:00:00.000Z', 'EMAIL', 'conv1',
    ])
  })

  it('null timestamptz -> "" cell (blank-cell parity with legacy cols)', () => {
    const cells = freshchatCells_({
      initiated_at: '2026-10-01T09:00:00.000Z', status: null,
      ref_key: 'conv2-1759300800000', updated_at: '2026-10-02T10:00:00.000Z',
      resolved_at: null, channel: null, conversation_id: 'conv2',
    })
    expect(cells[1]).toBe('')
    expect(cells[4]).toBe('')
    expect(cells[5]).toBe('')
  })

  it('unparseable timestamp -> "" cell (readers see blank, not garbage)', () => {
    const cells = maqsamCells_({
      started_at: 'not-a-date', ended_at: '', duration: '0:00:10',
      agent_email: 'b@c.com', state: null, direction: null, handling: null,
    })
    expect(cells[0]).toBe('')
    expect(cells[1]).toBe('')
  })
})
