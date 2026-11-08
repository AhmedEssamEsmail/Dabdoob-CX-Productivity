import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { cacheClear } from '@/features/shared/platform/repo'
import { pwToday } from '@/features/shared/platform/time'
import { qaCtlReminders } from '@/features/cx-quality/lib/server'
import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'

function seed(enabled: boolean) {
  hubDbReset()
  hubSetUser('') // cron caller: no session
  hubSetTables({
    config: [
      { key: 'reminders_enabled', value: String(enabled) },
      { key: 'admin_emails', value: 'boss@dabdoob.com' },
      { key: 'mail_dry_run', value: 'true' },
      { key: 'allowed_domain', value: 'dabdoob.com' },
    ],
    roster: [
      { email: 'tl@dabdoob.com', name: 'TL One', role: 'tl', team: 'cx', tl_email: 'boss@dabdoob.com', active: 'true' },
      { email: 'a@dabdoob.com', name: 'Agent One', role: 'agent', team: 'cx', tl_email: 'tl@dabdoob.com', active: 'true' },
    ],
    qa_ctls: [
      { ctl_id: 'C1', tl_email: 'tl@dabdoob.com', agent_email: 'a@dabdoob.com', status: 'open', due_date: '2020-01-01', reminded_date: '' },
    ],
    qa_audits: [],
    popups: [],
    mail_log: [],
    health: [],
    view_as: [],
  })
  cacheClear()
}

describe('qaCtlReminders reminders_enabled gate', () => {
  beforeEach(() => seed(false))

  it('marks due CTLs while off without popups or mail, then does not remind retroactively', async () => {
    const off = await qaCtlReminders()
    expect(off).toMatchObject({ reminded: 1, popups: 0, skipped: 'off' })
    expect(hubDb.tables.popups).toEqual([])
    expect(hubDb.tables.mail_log).toEqual([])
    expect(hubDb.tables.qa_ctls[0].reminded_date).toBe(pwToday())

    hubDb.tables.config[0].value = 'true'
    cacheClear()
    const on = await qaCtlReminders()
    expect(on).toMatchObject({ reminded: 0, popups: 1 })
    expect(on.skipped).toBeUndefined()
    expect(hubDb.tables.popups).toHaveLength(1)
    expect(hubDb.tables.popups[0]).toMatchObject({ recipient: 'tl@dabdoob.com', kind: 'qa_ctl_due', ref: 'C1' })
    expect(hubDb.tables.mail_log).toEqual([])
  })

  it('runs normally when enabled', async () => {
    hubDb.tables.config[0].value = 'true'
    cacheClear()
    const on = await qaCtlReminders()
    expect(on).toMatchObject({ reminded: 1, popups: 1 })
    expect(on.skipped).toBeUndefined()
    expect(hubDb.tables.popups).toHaveLength(1)
    expect(hubDb.tables.popups[0]).toMatchObject({ recipient: 'tl@dabdoob.com', kind: 'qa_ctl_due', ref: 'C1' })
    expect(hubDb.tables.mail_log).toHaveLength(1)
    expect(hubDb.tables.mail_log[0]).toMatchObject({ to: 'tl@dabdoob.com', kind: 'qa_ctl_reminder', status: 'dry_run' })
    expect(hubDb.tables.qa_ctls[0].reminded_date).toBe(pwToday())
  })
})
