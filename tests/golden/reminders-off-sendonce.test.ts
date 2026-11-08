/**
 * RMS-04: pwSendOnce_ gates on reminders_enabled. While off it writes the
 * pw_reminder_log dedupe row with status 'skipped_off' and returns 'skipped'
 * without touching mail_log; after re-enable the same key set sends normally.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { hubDb, hubDbReset } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { pwSendOnce_ } from '@/features/cx-people/lib/one-on-one-reminders'

const MSG = {
  to: 'tl@dabdoob.com', kind: 'daily_digest', ref: 'r1',
  subject: 's', htmlBody: '<p>x</p>',
}

function seedConfig(remindersEnabled: string) {
  hubDb.tables.config = [
    { key: 'reminders_enabled', value: remindersEnabled },
    { key: 'admin_emails', value: 'admin@dabdoob.com' },
    { key: 'mail_dry_run', value: 'true' },
  ]
  hubDb.tables.pw_reminder_log = []
  hubDb.tables.mail_log = []
}

beforeEach(() => {
  hubDbReset()
  cacheClear()
  seedConfig('false')
})

describe('pwSendOnce_ reminders_enabled gate', () => {
  it('off: writes skipped_off dedupe row, no mail_log, returns skipped', async () => {
    const sent: Record<string, boolean> = {}
    const res = await pwSendOnce_(sent, 'dg|1', MSG, 'system:trigger')
    expect(res).toBe('skipped')
    expect(sent['dg|1']).toBe(true)
    expect(hubDb.tables.mail_log).toHaveLength(0)
    const rows = hubDb.tables.pw_reminder_log
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({
      dedupe_key: 'dg|1', kind: 'daily_digest', ref: 'r1',
      recipient: 'tl@dabdoob.com', status: 'skipped_off',
    })
  })

  it('on: sends via dry-run mail and logs mail_log normally', async () => {
    hubDb.tables.config.find((r) => r.key === 'reminders_enabled')!.value = 'true'
    cacheClear()
    const sent: Record<string, boolean> = {}
    const res = await pwSendOnce_(sent, 'dg|2', MSG, 'system:trigger')
    expect(res).toBe('dry_run')
    expect(hubDb.tables.mail_log).toHaveLength(1)
    expect(hubDb.tables.mail_log[0]).toMatchObject({
      to: 'tl@dabdoob.com', kind: 'daily_digest', ref: 'r1', status: 'dry_run',
    })
    const rows = hubDb.tables.pw_reminder_log
    expect(rows).toHaveLength(1)
    expect(rows[0]).toMatchObject({ dedupe_key: 'dg|2', status: 'dry_run' })
  })
})
