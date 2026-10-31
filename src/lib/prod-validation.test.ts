import { describe, it, expect } from 'vitest'
import {
  checkDecision,
  effectiveStatus,
  statusChoices,
  flagView,
  ruleView,
  daysUntil,
  todayKey,
  addDays,
  settingList,
  PROD_DEFAULTS,
  type ProdFlagRow,
} from './prod-validation'

const pendingFlag = {
  decision: 'pending',
  raw_status: 'IDLE',
  suggested_status: 'Chats',
  validated_status: null,
}

const ctx = {
  statuses: ['Available', 'Chats', 'Inbound Calls', 'Waiting Address', 'Busy'],
  reasonStatuses: ['Busy'],
}

describe('checkDecision (prodCheckDecision_)', () => {
  it('rejects decisions on flags that are not pending', () => {
    expect(() =>
      checkDecision({ ...pendingFlag, decision: 'accepted' }, { action: 'accept', status: 'Chats' }, ctx)
    ).toThrow('already decided (accepted)')
    expect(() =>
      checkDecision({ ...pendingFlag, decision: 'auto' }, { action: 'revert', reason: 'was on break' }, ctx)
    ).toThrow('already decided (auto)')
  })

  it('reverts to the raw status and requires a reason of at least 5 characters', () => {
    expect(() => checkDecision(pendingFlag, { action: 'revert', reason: 'busy' }, ctx)).toThrow(
      'Reverting to the raw status needs a reason.'
    )
    const patch = checkDecision(pendingFlag, { action: 'revert', reason: 'training call' }, ctx)
    expect(patch).toEqual({ decision: 'reverted', validated_status: 'IDLE', reason: 'training call' })
  })

  it('accepts a replacement status from the list, canonicalizing casing', () => {
    const patch = checkDecision(pendingFlag, { action: 'accept', status: 'chats' }, ctx)
    expect(patch.decision).toBe('accepted')
    expect(patch.validated_status).toBe('Chats')
  })

  it('requires a status on accept', () => {
    expect(() => checkDecision(pendingFlag, { action: 'accept' }, ctx)).toThrow(
      'Choose the status this time counts as.'
    )
  })

  it('rejects statuses outside the replacement list', () => {
    expect(() => checkDecision(pendingFlag, { action: 'accept', status: 'Nap' }, ctx)).toThrow(
      '"Nap" is not on the status list'
    )
  })

  it('rejects accepting the raw status (must revert instead)', () => {
    const flag = { ...pendingFlag, raw_status: 'Available' }
    expect(() => checkDecision(flag, { action: 'accept', status: 'available' }, ctx)).toThrow(
      'That is the raw status: use Revert, with a reason.'
    )
  })

  it('requires a reason for reason-statuses like Busy', () => {
    expect(() => checkDecision(pendingFlag, { action: 'accept', status: 'Busy' }, ctx)).toThrow(
      '"Busy" needs a reason.'
    )
    const patch = checkDecision(pendingFlag, { action: 'accept', status: 'Busy', reason: 'team meeting' }, ctx)
    expect(patch.validated_status).toBe('Busy')
  })

  it('rejects unknown actions', () => {
    expect(() => checkDecision(pendingFlag, { action: 'void' }, ctx)).toThrow('Choose accept or revert.')
  })
})

describe('effectiveStatus (prodEffectiveStatus_)', () => {
  it('counts pending flags as the suggested status', () => {
    expect(effectiveStatus(pendingFlag)).toBe('Chats')
  })

  it('counts decided flags as the validated status', () => {
    expect(effectiveStatus({ ...pendingFlag, decision: 'accepted', validated_status: 'Busy' })).toBe('Busy')
    expect(effectiveStatus({ ...pendingFlag, decision: 'reverted', validated_status: 'IDLE' })).toBe('IDLE')
  })

  it('ignores void flags entirely', () => {
    expect(effectiveStatus({ ...pendingFlag, decision: 'void' })).toBeNull()
  })
})

describe('statusChoices (prodStatusChoices_)', () => {
  it('keeps the replacement list and appends unseen working statuses', () => {
    const choices = statusChoices(
      ['Available', 'Chats'],
      ['IDLE'],
      ['Offline'],
      ['IDLE', 'Offline', 'Prayer Break', 'chats']
    )
    expect(choices).toEqual(['Available', 'Chats', 'Prayer Break'])
  })
})

describe('flagView (prodFlagView_)', () => {
  const row: ProdFlagRow = {
    flag_id: 'PF1',
    date: '2026-10-29',
    agent_email: 'agent@dabdoob.com',
    agent_name: 'Agent A',
    tl_email: 'tl@dabdoob.com',
    raw_status: 'IDLE',
    interval_start: '2026-10-29T06:00:00.000Z',
    interval_end: '2026-10-29T06:32:00.000Z',
    interval_min: 32,
    spans_json: '[["2026-10-29T06:05:00.000Z","2026-10-29T06:15:00.000Z"]]',
    flagged_min: 18.5,
    case_count: 7,
    distinct_cases: 4,
    case_ids_json: '[["123","ticket"],["456","chat"]]',
    channel_mix_json: '{"ticket":1,"chat":1}',
    suggested_status: 'Chats',
    decision: 'pending',
    validated_status: null,
    decided_by: null,
    decided_at: null,
    reason: null,
    due_date: '2026-11-05',
  }

  it('maps a row into the camelCase view shape', () => {
    const v = flagView(row)
    expect(v.flagId).toBe('PF1')
    expect(v.spans).toEqual([['2026-10-29T06:05:00.000Z', '2026-10-29T06:15:00.000Z']])
    expect(v.cases).toEqual([
      { id: '123', channel: 'ticket' },
      { id: '456', channel: 'chat' },
    ])
    expect(v.channelMix).toEqual({ ticket: 1, chat: 1 })
    expect(v.effectiveStatus).toBe('Chats')
    expect(v.dueDate).toBe('2026-11-05')
  })

  it('resolves agent/TL/decider names through the directory', () => {
    const names = (e: string) => ({ 'agent@dabdoob.com': 'Agent Doe', 'tl@dabdoob.com': 'Lead Lee' })[e] || ''
    const v = flagView({ ...row, decided_by: 'tl@dabdoob.com' }, names)
    expect(v.agentName).toBe('Agent Doe')
    expect(v.tlName).toBe('Lead Lee')
    expect(v.decidedBy).toBe('Lead Lee')
    expect(flagView({ ...row, decided_by: 'auto' }).decidedBy).toBe('auto')
  })

  it('tolerates JSONB columns that arrive already parsed', () => {
    const v = flagView({ ...row, spans_json: [['a', 'b']], case_ids_json: [['1', 'ticket']], channel_mix_json: { ticket: 1 } })
    expect(v.spans).toEqual([['a', 'b']])
    expect(v.cases).toEqual([{ id: '1', channel: 'ticket' }])
  })
})

describe('ruleView + settings parsing', () => {
  it('falls back to the GAS defaults when config is empty', () => {
    const rule = ruleView({})
    expect(rule).toEqual({
      x: 2,
      windowMin: 10,
      minIntervalMin: 5,
      flagStatuses: ['IDLE'],
      channelStatus: { chat: 'Chats', ticket: 'Available', wa: 'Waiting Address' },
      reviewDays: 7,
      disputeDays: 3,
    })
  })

  it('reads JSON or comma-separated config values', () => {
    expect(settingList('["A","B"]', [])).toEqual(['A', 'B'])
    expect(settingList('A, B ,C', [])).toEqual(['A', 'B', 'C'])
    expect(settingList('', ['X'])).toEqual(['X'])
  })
})

describe('date helpers', () => {
  it('computes whole days between date keys', () => {
    expect(daysUntil('2026-11-05', '2026-10-29')).toBe(7)
    expect(daysUntil('2026-10-29', '2026-10-29')).toBe(0)
    expect(daysUntil('2026-10-28', '2026-10-29')).toBe(-1)
  })

  it('shifts date keys across month boundaries', () => {
    expect(addDays('2026-10-29', 7)).toBe('2026-11-05')
    expect(addDays('2026-11-01', -3)).toBe('2026-10-29')
  })

  it('returns a yyyy-MM-dd today key', () => {
    expect(todayKey(new Date('2026-10-29T22:30:00Z'))).toMatch(/^\d{4}-\d{2}-\d{2}$/)
  })
})

describe('PROD_DEFAULTS', () => {
  it('matches the legacy PROD_SETTINGS values used by the review flow', () => {
    expect(PROD_DEFAULTS.prod_replacement_statuses).toEqual([
      'Available',
      'Chats',
      'Inbound Calls',
      'Waiting Address',
      'Busy',
    ])
    expect(PROD_DEFAULTS.prod_reason_statuses).toEqual(['Busy'])
    expect(PROD_DEFAULTS.freshdesk_domain).toBe('dabdoobapp.freshdesk.com')
  })
})
