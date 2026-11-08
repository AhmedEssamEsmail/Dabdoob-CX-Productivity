/**
 * RMS-05: the missed-escalation direct sendMail in runMissedOneOnOneCheck_ is
 * gated on reminders_enabled. While off, the 2-working-day escalation still
 * writes its missed-esc:<schedule_id> dedupe rows (status 'skipped_off') but
 * never calls sendMail; missed/excused marking is untouched.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { hubDb, hubDbReset } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { runMissedOneOnOneCheck_ } from '@/features/cx-people/lib/reminders'

const TONIGHT = Date.parse('2025-11-20T20:00:00Z') // Thursday 23:00 Kuwait, past the 22:00 cutoff
const iso = (ms: number) => new Date(ms).toISOString()

const ROSTER = [
  { email: 'tl@dabdoob.com', name: 'Team Lead', role: 'tl', tl_email: 'admin@dabdoob.com', active: true, position: 'TL', based_in_country: 'Kuwait', days_off: '' },
  { email: 'a@dabdoob.com', name: 'Agent A', role: 'agent', tl_email: 'tl@dabdoob.com', active: true, position: 'Agent', based_in_country: 'Kuwait', days_off: '' },
  { email: 'admin@dabdoob.com', name: 'Admin', role: 'admin', tl_email: '', active: true, position: 'Manager', based_in_country: 'Kuwait', days_off: '' },
]

const sched = (id: string, scheduledAt: string, status: string) => ({
  schedule_id: id, kind: 'agent', manager_email: 'tl@dabdoob.com', report_email: 'a@dabdoob.com',
  scheduled_at: scheduledAt, duration_min: 30, status, log_id: '', rescheduled_to: '',
  reason: '', missed_at: '', deleted_at: '', deleted_by: '', delete_reason: '', prev_status: '',
  submitted_by: 'tl@dabdoob.com', submitted_at: iso(TONIGHT - 86400000), updated_by: '', updated_at: '',
})

beforeEach(() => {
  hubDbReset()
  cacheClear()
  hubDb.tables.roster = ROSTER.map((r) => ({ ...r }))
  hubDb.tables.config = [
    { key: 'reminders_enabled', value: 'false' },
    { key: 'admin_emails', value: 'admin@dabdoob.com' },
    { key: 'one_on_one_cutoff', value: '22:00' },
    { key: 'mail_dry_run', value: 'true' },
    { key: 'days_off_default', value: '[]' },
    { key: 'days_off_by_country', value: '{}' },
  ]
  hubDb.tables.holidays = []
  hubDb.tables.popups = []
  hubDb.tables.mail_log = []
  hubDb.tables.pw_reminder_log = []
  hubDb.tables.one_on_one_schedule = [
    sched('SC-TODAY', '2025-11-20T07:00:00Z', 'scheduled'), // 10:00 Kuwait today -> missed at 22:00
    sched('SC-OLD', '2025-11-17T07:00:00Z', 'missed'), // 3 working days back -> escalates
  ]
})

describe('runMissedOneOnOneCheck_ with reminders_enabled=false', () => {
  it('marks missed but sends nothing: no popups, no mail_log, all dedupe rows skipped_off', async () => {
    const res = await runMissedOneOnOneCheck_(TONIGHT)
    expect(res.marked).toBe(1)
    expect(res.escalated).toBe(1)

    const rows = hubDb.tables.one_on_one_schedule
    expect(rows.find((r) => r.schedule_id === 'SC-TODAY')).toMatchObject({ status: 'missed' })
    expect(rows.find((r) => r.schedule_id === 'SC-OLD')).toMatchObject({ status: 'missed' })

    expect(hubDb.tables.popups).toHaveLength(0)
    expect(hubDb.tables.mail_log).toHaveLength(0)

    const log = hubDb.tables.pw_reminder_log
    const keys = log.map((r) => String(r.dedupe_key))
    expect(keys).toContain('missed:tl@dabdoob.com:2025-11-20')
    expect(keys).toContain('missed-esc:SC-OLD')
    log.forEach((r) => expect(r.status).toBe('skipped_off'))
  })
})
