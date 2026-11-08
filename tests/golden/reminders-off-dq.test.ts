import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { cacheClear } from '@/features/shared/platform/repo'
import { dqRemindMissedCheckins_ } from '@/features/cx-queue/lib/jobs'
import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'

const NOW = new Date('2026-10-15T12:00:00Z')
const CPS = [
  {
    slot: '14:00',
    name: 'Afternoon',
    date: '2026-10-15',
    at: new Date('2026-10-15T11:00:00Z'),
    readAfter: new Date('2026-10-15T11:20:00Z'),
    opensAt: new Date('2026-10-15T10:45:00Z'),
    dueAt: new Date('2026-10-15T11:30:00Z'),
    key: '2026-10-15|14:00',
  },
]
const CPS2 = [
  ...CPS,
  {
    slot: '15:00',
    name: 'Evening',
    date: '2026-10-15',
    at: new Date('2026-10-15T11:30:00Z'),
    readAfter: new Date('2026-10-15T11:50:00Z'),
    opensAt: new Date('2026-10-15T11:15:00Z'),
    dueAt: new Date('2026-10-15T11:45:00Z'),
    key: '2026-10-15|15:00',
  },
]

function seed(enabled: boolean) {
  hubDbReset()
  hubSetUser('tl@dabdoob.com')
  hubSetTables({
    config: [
      { key: 'reminders_enabled', value: String(enabled) },
      { key: 'business_tz', value: 'Asia/Kuwait' },
      { key: 'checkin_owner_emails', value: '{}' },
      { key: 'mail_dry_run', value: 'true' },
      { key: 'admin_emails', value: 'boss@dabdoob.com' },
    ],
    roster: [
      { email: 'tl@dabdoob.com', name: 'TL One', role: 'tl', team: 'cx', tl_email: 'boss@dabdoob.com', active: 'true' },
    ],
    queue_submissions: [],
    popups: [],
    mail_log: [],
    view_as: [],
  })
  cacheClear()
}

describe('dqRemindMissedCheckins_ reminders_enabled gate', () => {
  beforeEach(() => seed(false))

  it('writes the dedupe popup row but no mail while off, suppresses it on re-enable', async () => {
    await dqRemindMissedCheckins_(NOW, CPS)
    expect(hubDb.tables.popups).toHaveLength(1)
    expect(hubDb.tables.popups[0]).toMatchObject({
      recipient: 'tl@dabdoob.com',
      kind: 'queue_checkin_missed',
      ref: '2026-10-15|14:00',
    })
    expect(hubDb.tables.mail_log).toEqual([])

    hubDb.tables.config[0].value = 'true'
    cacheClear()
    await dqRemindMissedCheckins_(NOW, CPS2)

    expect(hubDb.tables.popups).toHaveLength(2)
    expect(hubDb.tables.popups[1]).toMatchObject({
      recipient: 'tl@dabdoob.com',
      kind: 'queue_checkin_missed',
      ref: '2026-10-15|15:00',
    })
    expect(hubDb.tables.mail_log).toHaveLength(1)
    expect(hubDb.tables.mail_log[0]).toMatchObject({
      to: 'tl@dabdoob.com',
      subject: 'The 15:00 queue check-in was not submitted',
      status: 'dry_run',
    })
  })
})
