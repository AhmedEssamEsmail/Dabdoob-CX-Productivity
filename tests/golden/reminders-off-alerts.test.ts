/**
 * RMS-03: oneOnOneAlerts honours the reminders_enabled master switch — while
 * false the poll returns { now, alerts: [] } even with a due alert; flipping
 * the config row back to 'true' restores the due alert for the signed-in TL.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () =>
  (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () =>
  (await import('./hub-fakes')).authModule())

import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { oneOnOneAlerts } from '@/features/shared/platform/notify'

const DAY = 86400000

function seed(remindersEnabled: string) {
  hubDbReset()
  hubSetUser('tl@dabdoob.com')
  hubSetTables({
    roster: [
      { email: 'tl@dabdoob.com', name: 'Team Lead', role: 'tl', tl_email: 'admin@dabdoob.com', active: true },
      { email: 'a@dabdoob.com', name: 'Agent A', role: 'agent', tl_email: 'tl@dabdoob.com', active: true },
    ],
    one_on_one_schedule: [
      {
        schedule_id: 'oo1', kind: 'agent',
        manager_email: 'tl@dabdoob.com', report_email: 'a@dabdoob.com',
        scheduled_at: new Date(Date.now() + 10 * 60000).toISOString(),
        duration_min: 30, status: 'scheduled',
        submitted_at: new Date(Date.now() - DAY).toISOString(),
      },
    ],
    config: [
      { key: 'one_on_one_inapp_15min', value: 'true' },
      { key: 'one_on_one_inapp_start', value: 'true' },
      { key: 'admin_emails', value: 'admin@dabdoob.com' },
      { key: 'reminders_enabled', value: remindersEnabled },
    ],
    view_as: [],
  })
  cacheClear()
}

beforeEach(() => cacheClear())
afterEach(() => cacheClear())

describe('oneOnOneAlerts — reminders_enabled master switch', () => {
  it('returns no alerts while reminders_enabled is false', async () => {
    seed('false')
    const res = await oneOnOneAlerts()
    expect(res.alerts).toEqual([])
  })

  it('returns the due alert for the TL once reminders_enabled flips to true', async () => {
    seed('false')
    const off = await oneOnOneAlerts()
    expect(off.alerts).toEqual([])

    const row = (hubDb.tables.config || []).find((r) => r.key === 'reminders_enabled')
    expect(row, 'config row seeded').toBeTruthy()
    row!.value = 'true'
    cacheClear()

    const on = await oneOnOneAlerts()
    expect(on.alerts.length).toBeGreaterThan(0)
    expect(on.alerts[0].withName).toBe('Agent A')
  })
})
