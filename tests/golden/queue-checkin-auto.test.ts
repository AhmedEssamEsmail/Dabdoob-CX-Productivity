import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { cacheClear } from '@/features/shared/platform/repo'
import { dqCheckinTick_ } from '@/features/cx-queue/lib/jobs'
import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'

// 14:25 / 14:45 / 15:00 Kuwait on 2026-10-15 — slot '14:00' readAfter 11:20Z, dueAt 11:30Z (all UTC instants).
const NOW_ON_TIME = new Date('2026-10-15T11:25:00Z')
const NOW_LATE = new Date('2026-10-15T11:45:00Z')
const NOW_STALE = new Date('2026-10-15T12:00:00Z')
const CP_KEY = '2026-10-15|14:00'

const QUEUE_NOW = [
  { queue: 'Ops QA Gift', kind: 'ticket', open: 7, actionable: 5, unassigned: 1, oldest_h: 1.5, bands_json: '{}', over_top: 0, created_today: 2, resolved_today: 1, stale: false, by_status_json: '{}' },
  { queue: 'Inbox', kind: 'ticket', open: 3, actionable: 3, unassigned: 0, oldest_h: 0.5, bands_json: '{}', over_top: 0, created_today: 0, resolved_today: 0, stale: false, by_status_json: '{}' },
]

function seed(over: { submissions?: Record<string, unknown>[]; popups?: Record<string, unknown>[]; snapshots?: Record<string, unknown>[]; slot?: string } = {}) {
  hubDbReset()
  hubSetUser('tl@dabdoob.com')
  hubSetTables({
    config: [
      { key: 'business_tz', value: 'Asia/Kuwait' },
      { key: 'checkin_slots', value: JSON.stringify([over.slot || '14:00']) },
      { key: 'checkin_slot_names', value: JSON.stringify({ '14:00': 'Afternoon' }) },
      { key: 'checkin_read_delay_min', value: '20' },
      { key: 'checkin_open_before_min', value: '15' },
      { key: 'checkin_due_after_min', value: '30' },
      { key: 'checkin_owner_emails', value: '{}' },
      { key: 'reminders_enabled', value: 'true' },
      { key: 'mail_dry_run', value: 'true' },
      { key: 'admin_emails', value: 'boss@dabdoob.com' },
    ],
    agg_queue_now: QUEUE_NOW.map((r) => ({ ...r })),
    queue_snapshots: over.snapshots || [],
    queue_submissions: over.submissions || [],
    popups: over.popups || [],
    roster: [
      { email: 'tl@dabdoob.com', name: 'TL One', role: 'tl', team: 'cx', tl_email: 'boss@dabdoob.com', active: 'true' },
    ],
    mail_log: [],
    view_as: [],
  })
  cacheClear()
}

const subs = () => hubDb.tables['queue_submissions'] || []

describe('dqCheckinTick_ auto check-in submission', () => {
  beforeEach(() => seed())

  it('capture auto-inserts one system:job submission with real queue numbers', async () => {
    const captured = await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(captured).toBe(1)
    expect(subs()).toHaveLength(1)
    const s = subs()[0]
    expect(s).toMatchObject({
      snapshot_key: CP_KEY,
      slot_date: '2026-10-15',
      slot: '14:00',
      status: 'submitted',
      submitted_by: 'system:job',
      corrections_json: {},
      correction_reason: '',
      general_note: '',
      help_needed: false,
      help_note: '',
    })
    expect(String(s.submission_id)).toMatch(/^qs_/)
    expect(s.queues_json).toEqual([
      { queue: 'Ops QA Gift', agents: null, status: 'Auto', note: '', open: 7, oldestH: 1.5, unassigned: 1, stale: false, data_as_of: expect.any(String) },
      { queue: 'Inbox', agents: null, status: 'Auto', note: '', open: 3, oldestH: 0.5, unassigned: 0, stale: false, data_as_of: expect.any(String) },
    ])
  })

  it('retries an orphaned submission from the captured snapshot rows', async () => {
    seed({
      snapshots: QUEUE_NOW.map((q) => ({
        snapshot_key: CP_KEY, slot_date: '2026-10-15', slot: '14:00',
        captured_at: '2026-10-15T11:20:00Z', data_as_of: '2026-10-15T11:05:00Z', late: false,
        queue: q.queue, open: q.open, actionable: q.actionable, unassigned: q.unassigned,
        oldest_h: q.oldest_h, bands_json: q.bands_json, over_top: q.over_top,
        created_today: q.created_today, resolved_today: q.resolved_today, stale: q.stale,
        by_status_json: q.by_status_json, year: 2026,
      })),
    })
    const captured = await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(captured).toBe(0)
    expect(subs()).toHaveLength(1)
    const s = subs()[0]
    expect(s).toMatchObject({
      snapshot_key: CP_KEY,
      slot_date: '2026-10-15',
      slot: '14:00',
      status: 'submitted',
      submitted_by: 'system:job',
    })
    expect(s.queues_json).toEqual([
      { queue: 'Ops QA Gift', agents: null, status: 'Auto', note: '', open: 7, oldestH: 1.5, unassigned: 1, stale: false, data_as_of: '2026-10-15T11:05:00Z' },
      { queue: 'Inbox', agents: null, status: 'Auto', note: '', open: 3, oldestH: 0.5, unassigned: 0, stale: false, data_as_of: '2026-10-15T11:05:00Z' },
    ])
  })

  it('is idempotent across reruns and never overwrites an existing submission', async () => {
    await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(subs()).toHaveLength(1)

    seed({
      submissions: [{
        submission_id: 'qs_human', slot_date: '2026-10-15', slot: '14:00', snapshot_key: CP_KEY,
        status: 'submitted', queues_json: [], submitted_by: 'tl@dabdoob.com', submitted_at: '2026-10-15T11:10:00Z',
      }],
    })
    await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(subs()).toHaveLength(1)
    expect(subs()[0]).toMatchObject({ submission_id: 'qs_human', submitted_by: 'tl@dabdoob.com' })
  })

  it('stamps late past dueAt and resolves the open missed-checkin popup', async () => {
    seed({
      popups: [{
        popup_id: 'p1', recipient: 'tl@dabdoob.com', kind: 'queue_checkin_missed', title: 't', body: 'b',
        link: '#/checkins', ref: CP_KEY, created_at: '2026-10-15T11:31:00Z', resolved_at: null,
      }],
    })
    await dqCheckinTick_(NOW_LATE, { fresh: true })
    expect(subs()).toHaveLength(1)
    expect(subs()[0].status).toBe('late')
    const p = hubDb.tables['popups'][0]
    expect(p.resolved_at).toBeTruthy()
  })

  it('resolves the missed-checkin popup even when the submission already exists', async () => {
    seed({
      submissions: [{
        submission_id: 'qs_human', slot_date: '2026-10-15', slot: '14:00', snapshot_key: CP_KEY,
        status: 'submitted', queues_json: [], submitted_by: 'tl@dabdoob.com', submitted_at: '2026-10-15T11:10:00Z',
      }],
      popups: [{
        popup_id: 'p1', recipient: 'tl@dabdoob.com', kind: 'queue_checkin_missed', title: 't', body: 'b',
        link: '#/checkins', ref: CP_KEY, created_at: '2026-10-15T11:31:00Z', resolved_at: null,
      }],
    })
    await dqCheckinTick_(NOW_LATE, { fresh: true })
    expect(subs()).toHaveLength(1)
    expect(subs()[0].submission_id).toBe('qs_human')
    const p = hubDb.tables['popups'][0]
    expect(p.resolved_at).toBeTruthy()
  })

  it('does not re-capture a frozen Dec-31 snapshot on a Jan-1 tick (cross-year have)', async () => {
    const FROZEN_KEY = '2025-12-31|23:00'
    seed({
      slot: '23:00',
      snapshots: QUEUE_NOW.map((q) => ({
        snapshot_key: FROZEN_KEY, slot_date: '2025-12-31', slot: '23:00',
        captured_at: '2025-12-31T20:20:00Z', data_as_of: '2025-12-31T19:40:00Z', late: false,
        queue: q.queue, open: q.open, actionable: q.actionable, unassigned: q.unassigned,
        oldest_h: q.oldest_h, bands_json: q.bands_json, over_top: q.over_top,
        created_today: q.created_today, resolved_today: q.resolved_today, stale: q.stale,
        by_status_json: q.by_status_json, year: 2025,
      })),
    })
    // 03:30 Kuwait on Jan 1: the Dec-31 23:00 cp (at 20:00Z, readAfter 20:20Z) is inside the 6h window.
    const captured = await dqCheckinTick_(new Date('2026-01-01T00:30:00Z'), { fresh: true })
    expect(captured).toBe(0)
    const snaps = hubDb.tables['queue_snapshots'].filter((r) => r.snapshot_key === FROZEN_KEY)
    expect(snaps).toHaveLength(QUEUE_NOW.length)
    expect(snaps.every((r) => r.data_as_of === '2025-12-31T19:40:00Z')).toBe(true)
    expect(subs()).toHaveLength(1)
    expect(subs()[0]).toMatchObject({ snapshot_key: FROZEN_KEY, slot_date: '2025-12-31', slot: '23:00', submitted_by: 'system:job' })
    expect((subs()[0].queues_json as Record<string, unknown>[]).map((r) => r.data_as_of)).toEqual(QUEUE_NOW.map(() => '2025-12-31T19:40:00Z'))
  })

  it('aborts capture and auto-insert when the snapKeys select fails', async () => {
    seed({
      snapshots: QUEUE_NOW.map((q) => ({
        snapshot_key: CP_KEY, slot_date: '2026-10-15', slot: '14:00',
        captured_at: '2026-10-15T11:20:00Z', data_as_of: '2026-10-15T11:05:00Z', late: false,
        queue: q.queue, open: q.open, actionable: q.actionable, unassigned: q.unassigned,
        oldest_h: q.oldest_h, bands_json: q.bands_json, over_top: q.over_top,
        created_today: q.created_today, resolved_today: q.resolved_today, stale: q.stale,
        by_status_json: q.by_status_json, year: 2026,
      })),
    })
    hubDb.missing.add('queue_snapshots')
    const captured = await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(captured).toBe(0)
    expect(subs()).toEqual([])
    const snaps = hubDb.tables['queue_snapshots'].filter((r) => r.snapshot_key === CP_KEY)
    expect(snaps).toHaveLength(QUEUE_NOW.length)
    expect(snaps.every((r) => r.data_as_of === '2026-10-15T11:05:00Z')).toBe(true)
  })

  it('leaves agg_snapshots_today untouched when the todays select fails', async () => {
    seed({
      snapshots: QUEUE_NOW.map((q) => ({
        snapshot_key: CP_KEY, slot_date: '2026-10-15', slot: '14:00',
        captured_at: '2026-10-15T11:20:00Z', data_as_of: '2026-10-15T11:05:00Z', late: false,
        queue: q.queue, open: q.open, actionable: q.actionable, unassigned: q.unassigned,
        oldest_h: q.oldest_h, bands_json: q.bands_json, over_top: q.over_top,
        created_today: q.created_today, resolved_today: q.resolved_today, stale: q.stale,
        by_status_json: q.by_status_json, year: 2026,
      })),
    })
    hubDb.tables['agg_snapshots_today'] = [{ snapshot_key: CP_KEY, slot_date: '2026-10-15', slot: '14:00', queue: 'Ops QA Gift', open: 7 }]
    hubDb.missing.add('queue_snapshots')
    const captured = await dqCheckinTick_(NOW_ON_TIME, { fresh: true })
    expect(captured).toBe(0)
    const todayRows = hubDb.tables['agg_snapshots_today']
    expect(todayRows).toHaveLength(1)
    expect(todayRows[0]).toMatchObject({ queue: 'Ops QA Gift', open: 7 })
  })

  it('a non-fresh tick inserts nothing and still raises the missed reminder', async () => {
    await dqCheckinTick_(NOW_STALE, { fresh: false })
    expect(subs()).toEqual([])
    expect(hubDb.tables['queue_snapshots'] || []).toEqual([])
    const missed = (hubDb.tables['popups'] || []).filter((p) => p.kind === 'queue_checkin_missed')
    expect(missed).toHaveLength(1)
    expect(missed[0]).toMatchObject({ ref: CP_KEY, recipient: 'tl@dabdoob.com' })
  })
})
