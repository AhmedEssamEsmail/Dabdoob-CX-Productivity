/**
 * Golden: Hub home (getHomePage + dqEarliestAt_) — the whole /overview payload against
 * the V2 oracle fed the same fixture the ported reads see (hub-fakes).
 */
import { describe, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { getHomePage, dqEarliestAt_ } from '@/features/cx-hub/lib/aggregates'
import { hubInstall, hubCall, portCall, type HubFx } from './helpers-hub'
import { expectSame } from './helpers-oracle'
import { cacheClear } from '@/features/shared/platform/repo'

const NOW = Date.parse('2026-05-06T10:00:00Z') // Wednesday, 13:00 Kuwait

function fx(over: HubFx = {}): HubFx {
  return {
    userEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    settings: {
      allowed_domain: 'dabdoob.com',
      admin_emails: 'admin@dabdoob.com',
      ss_live_id: 'live-store',
      ss_data_2026_id: 'data-2026',
      ...(over.settings || {}),
    },
    props: { DQ_LAST_queue_aggregates: '2026-05-06T09:55:00Z', ...(over.props || {}) },
    tables: {
      roster: [
        { email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', tl_email: '', country: 'Kuwait', active: true },
        { email: 'tl@dabdoob.com', name: 'Lead One', role: 'tl', tl_email: 'admin@dabdoob.com', country: 'Egypt', active: true },
        { email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
        { email: 'agent2@dabdoob.com', name: 'Agent Two', role: 'agent', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
        { email: 'spec@dabdoob.com', name: 'Spec One', role: 'specialist', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
      ],
      view_as: [],
      health: [
        {
          job: 'queue_aggregates', system: 'queue', link: false, label: 'Queue aggregates',
          expect_every_min: 30, grace_min: 30, active: true,
          last_run_at: '2026-05-06T09:55:00Z', last_status: 'ok', last_note: '', last_ok_at: '2026-05-06T09:55:00Z',
        },
        {
          job: 'roster_sync', system: 'hub', link: false, label: 'Roster sync',
          expect_every_min: 1440, grace_min: 180, active: true,
          last_run_at: '2026-05-06T05:00:00Z', last_status: 'ok', last_note: '', last_ok_at: '2026-05-06T05:00:00Z',
        },
        ...(over.tables?.health || []),
      ],
      queue_submissions: [
        {
          submission_id: 's1', slot_date: '2026-05-06', slot: '09:30', status: 'submitted',
          help_needed: true, help_note: 'Need an admin on the gift card case', general_note: '',
          submitted_by: 'tl@dabdoob.com', submitted_at: '2026-05-06T06:40:00Z',
        },
      ],
      dq_aging_flags: [
        {
          flag_id: 'f1', ticket_id: '2001', note: 'Customer is angry, need a decision',
          tl_email: 'tl@dabdoob.com', resolved_at: '', resolved_by: '', resolved_note: '',
          submitted_by: 'agent@dabdoob.com', submitted_at: '2026-05-06T08:00:00Z',
        },
      ],
      aging_open_tickets: [
        { ticket_id: '2001', queue: 'Customer Support', status: 'Open', age_h: 260, band: 12, agent_email: 'agent@dabdoob.com', agent_name: 'Agent One', tl_email: 'tl@dabdoob.com', tl_name: 'Lead One', actionable: true, group_name: 'Customer Support', ours: true, created_at: '2026-04-25T10:00:00Z' },
        { ticket_id: '2002', queue: 'Customer Support', status: 'Pending', age_h: 250, band: 12, agent_email: 'agent2@dabdoob.com', agent_name: 'Agent Two', tl_email: 'tl@dabdoob.com', tl_name: 'Lead One', actionable: false, group_name: 'Customer Support', ours: true, created_at: '2026-04-26T10:00:00Z' },
        { ticket_id: '2003', queue: '3PL', status: 'Pending on 3PL', age_h: 245, band: 12, agent_email: '', agent_name: '', tl_email: '', tl_name: '', actionable: false, group_name: '3PL', ours: false, created_at: '2026-04-26T10:00:00Z' },
        { ticket_id: '2004', queue: 'Customer Support', status: 'Open', age_h: 30, band: 3, agent_email: 'agent@dabdoob.com', agent_name: 'Agent One', tl_email: 'tl@dabdoob.com', tl_name: 'Lead One', actionable: true, group_name: 'Customer Support', ours: true, created_at: '2026-05-05T04:00:00Z' },
        { ticket_id: '2005', queue: 'Ops Qatar', status: 'Open', age_h: 26, band: 3, agent_email: '', agent_name: '', tl_email: '', tl_name: '', actionable: false, group_name: 'Ops Qatar', ours: false, created_at: '2026-05-05T08:00:00Z' },
      ],
      agg_queue_now: [
        { kind: 'ticket', queue: 'Customer Support', open: 42, actionable: 30, unassigned: 5, oldest_h: 260, bands_json: '[2,4,10,8,6,4,3,2,1,0,1,0,1]', over_top: 2, created_today: 12, resolved_today: 9, by_status_json: '{"Open":30,"Pending":12}', source_as_of: '2026-05-06T09:55:00Z', stale: false },
        { kind: 'ticket', queue: '3PL', open: 9, actionable: 0, unassigned: 4, oldest_h: 245, bands_json: '[0,0,1,2,1,1,1,0,1,0,1,0,1]', over_top: 1, created_today: 3, resolved_today: 2, by_status_json: '{"Pending on 3PL":9}', source_as_of: '2026-05-06T09:55:00Z', stale: false },
        { kind: 'chat', queue: 'Freshchat', open: 7, actionable: 7, unassigned: 1, oldest_h: 5, bands_json: '[5,2,0,0,0,0,0,0,0,0,0,0,0]', over_top: 0, created_today: 6, resolved_today: 4, by_status_json: '{"Open":7}', source_as_of: '2026-05-06T09:55:00Z', stale: false },
      ],
      agg_snapshots_today: [
        { slot_date: '2026-05-06', slot: '09:30', queue: 'Customer Support', open: 40, over_top: 2, bands_json: '[3,4,10,8,5,4,3,2,1,0,1,0,1]', by_status_json: '{}', created_today: 12, resolved_today: 9, stale: false, as_of: '2026-05-06T06:35:00Z' },
        { slot_date: '2026-05-06', slot: '09:30', queue: '3PL', open: 8, over_top: 1, bands_json: '[0,0,1,2,1,1,1,0,1,0,1,0,0]', by_status_json: '{}', created_today: 3, resolved_today: 2, stale: false, as_of: '2026-05-06T06:35:00Z' },
      ],
      queue_snapshots: [
        { snapshot_key: '2026-05-06|09:30', year: 2026, slot_date: '2026-05-06', slot: '09:30', queue: 'Customer Support', open: 40, over_top: 2, bands_json: '[3,4,10,8,5,4,3,2,1,0,1,0,1]', by_status_json: '{}', created_today: 12, resolved_today: 9, stale: false, as_of: '2026-05-06T06:35:00Z' },
        { snapshot_key: '2026-05-06|09:30', year: 2026, slot_date: '2026-05-06', slot: '09:30', queue: '3PL', open: 8, over_top: 1, bands_json: '[0,0,1,2,1,1,1,0,1,0,1,0,0]', by_status_json: '{}', created_today: 3, resolved_today: 2, stale: false, as_of: '2026-05-06T06:35:00Z' },
      ],
      refresh_log: [
        { job: 'queue_aggregates', started_at: '2026-05-06T09:50:00Z', finished_at: '2026-05-06T09:55:00Z', rows_in: 120, rows_out: 48, status: 'ok', error: '', note: '' },
        { job: 'roster_sync', started_at: '2026-05-06T05:00:00Z', finished_at: '2026-05-06T05:00:05Z', rows_in: 120, rows_out: 0, status: 'ok', error: '', note: 'All managers resolved' },
      ],
      options: [{ list_key: 'person.country', value: 'Kuwait', sort: 1, active: true }],
      popups: [
        { popup_id: 'p1', recipient: 'agent@dabdoob.com', kind: 'escalation_1on1', title: '1:1 overdue', body: 'b', link: '#/x', ref: 'r', created_at: '2026-05-05T00:00:00Z', resolved_at: '' },
      ],
      actions: [
        { action_id: 'a1', title: 'Post the shrink review', owner_email: 'tl@dabdoob.com', assigned_by: 'admin@dabdoob.com', due_date: '2026-05-05', source_type: 'adhoc', source_id: '', series_id: 'ser1', topic: '', status: 'open', outcome_note: '', track_as_task: true, submitted_at: '2026-05-01T00:00:00Z' },
        { action_id: 'a2', title: 'Send the deck', owner_email: 'agent@dabdoob.com', assigned_by: 'tl@dabdoob.com', due_date: '2026-05-08', source_type: 'meeting', source_id: 'm1', series_id: 'ser1', status: 'open', submitted_at: '2026-05-01T00:00:00Z' },
      ],
      meeting_series: [{ series_id: 'ser1', title: 'Weekly BR', chair_email: 'tl@dabdoob.com', active: true }],
      meetings: [{ meeting_id: 'm1', series_id: 'ser1', held_at: '2026-05-07T09:00:00Z', status: 'open', notes: '', decisions: '' }],
      one_on_one_schedule: [
        { schedule_id: 'o1', manager_email: 'tl@dabdoob.com', report_email: 'agent@dabdoob.com', scheduled_at: '2026-05-07T11:00:00Z', duration_min: 30, status: 'scheduled' },
      ],
      one_on_one_logs: [],
      mail_log: [],
      follow_up_done: [],
      cache_stamps: [],
      ...(over.tables || {}),
    },
    ...(over.userEmail ? { userEmail: over.userEmail } : {}),
    ...(over.scriptTz ? { scriptTz: over.scriptTz } : {}),
    ...(over.nowMs !== undefined ? { nowMs: over.nowMs } : {}),
  }
}

describe('hub getHomePage (Aggregates.js:568-681)', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it.each(['admin@dabdoob.com', 'tl@dabdoob.com', 'agent@dabdoob.com', 'spec@dabdoob.com'])(
    'matches the oracle for user %s',
    async (email) => {
      const f = fx({ userEmail: email })
      const lf = hubInstall(f)
      expectSame(
        await portCall(() => getHomePage()),
        hubCall('getHomePage', [], lf),
        'getHomePage ' + email
      )
    }
  )

  it('matches with empty optional stores (no submissions/flags/1:1s/popups)', async () => {
    const f = fx()
    f.tables = {
      ...f.tables,
      queue_submissions: [],
      dq_aging_flags: [],
      actions: [],
      meetings: [],
      meeting_series: [],
      one_on_one_schedule: [],
      one_on_one_logs: [],
      popups: [],
    }
    const lf = hubInstall(f)
    expectSame(await portCall(() => getHomePage()), hubCall('getHomePage', [], lf), 'getHomePage minimal')
  })

  it('rejects non-roster users identically', async () => {
    const f = fx({ userEmail: 'stranger@dabdoob.com' })
    const lf = hubInstall(f)
    expectSame(await portCall(() => getHomePage()), hubCall('getHomePage', [], lf), 'getHomePage stranger')
  })

  it('rejects a signed-out caller identically', async () => {
    const f = fx({ userEmail: '' })
    const lf = hubInstall(f)
    expectSame(await portCall(() => getHomePage()), hubCall('getHomePage', [], lf), 'getHomePage signed out')
  })
})

describe('dqEarliestAt_', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('matches the oracle over inputs incl. unparsable dates', async () => {
    const subs = [
      { submitted_at: '2026-05-06T09:00:00Z' },
      { submitted_at: '2026-05-06T07:00:00Z' },
      { submitted_at: 'garbage' },
      { submitted_at: '' },
      {},
    ]
    const lf = hubInstall(fx())
    expectSame(await portCall(() => dqEarliestAt_(subs as never)), hubCall('dqEarliestAt_', [subs], lf), 'dqEarliestAt_')
  })

  it('falls back to now() on an empty list', async () => {
    const lf = hubInstall(fx())
    expectSame(await portCall(() => dqEarliestAt_([])), hubCall('dqEarliestAt_', [[]], lf), 'dqEarliestAt_ empty')
  })
})
