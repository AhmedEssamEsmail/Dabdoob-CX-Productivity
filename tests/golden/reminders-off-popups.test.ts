/**
 * RMS-02: reminders_enabled master switch gates the popups delivery path.
 * While off: reminder kinds (missed_1on1, qa_ctl_due) write nothing,
 * pendingPopupsFor returns [], popupsPoll returns { popups: [] }
 * (existing rows hidden, not deleted); other kinds still append.
 * True or absent key = unchanged behaviour.
 */
import { beforeEach, describe, expect, it, vi } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import { hubDb, hubDbReset, hubSetTables, hubSetUser } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'
import { pendingPopupsFor, popupsPoll, raisePopup } from '@/features/shared/platform/popups'

const TL = 'tl@dabdoob.com'

function seed(remindersEnabled: boolean) {
  hubSetTables({
    config: [
      { key: 'reminders_enabled', value: remindersEnabled ? 'true' : 'false' },
      { key: 'admin_emails', value: 'admin@dabdoob.com' },
    ],
    popups: [
      {
        popup_id: 'p1',
        recipient: TL,
        kind: 'missed_1on1',
        title: 'Missed 1:1',
        body: 'b',
        link: '',
        ref: '2026-10-15|14:00',
        created_at: '2026-10-15T11:31:00Z',
        resolved_at: null,
      },
    ],
    view_as: [],
  })
}

beforeEach(() => {
  hubDbReset()
  cacheClear()
  hubSetUser(TL)
  seed(false)
})

describe('reminders_enabled master switch (popups)', () => {
  it('off: reminder kinds skip, reads return empty, row is untouched', async () => {
    const res = await raisePopup({ recipient: TL, kind: 'missed_1on1', title: 'x', ref: 'r2' }, 'system:test')
    expect(res).toEqual({ skipped: 'off' })
    expect(await raisePopup({ recipient: TL, kind: 'qa_ctl_due', title: 'x', ref: 'r3' }, 'system:test')).toEqual({ skipped: 'off' })
    expect(hubDb.tables.popups.length).toBe(1)
    expect(await pendingPopupsFor(TL)).toEqual([])
    expect(await popupsPoll(TL)).toEqual({ popups: [] })
  })

  it('off: non-reminder kinds still append and dedupe', async () => {
    const first = await raisePopup({ recipient: TL, kind: 'qa_ctl_confirm', title: 'x', ref: 'r-confirm' }, 'system:test')
    expect(first.skipped).toBeUndefined()
    expect(first.popup_id).toBeDefined()
    await raisePopup({ recipient: TL, kind: 'queue_checkin_missed', title: 'x', ref: 'r-checkin' }, 'system:test')
    const again = await raisePopup({ recipient: TL, kind: 'qa_ctl_confirm', title: 'x', ref: 'r-confirm' }, 'system:test')
    expect(again.popup_id).toBe(first.popup_id)
    expect(hubDb.tables.popups.length).toBe(3)
    expect(await pendingPopupsFor(TL)).toEqual([])
    expect(await popupsPoll(TL)).toEqual({ popups: [] })
  })

  it('on: pending popup is returned and raisePopup appends', async () => {
    const cfg = hubDb.tables.config.find((r) => r.key === 'reminders_enabled')
    cfg!.value = 'true'
    cacheClear()

    const pending = await pendingPopupsFor(TL)
    expect(pending.length).toBe(1)
    expect(pending[0].kind).toBe('missed_1on1')
    expect((await popupsPoll(TL)).popups.length).toBe(1)

    const res = await raisePopup({ recipient: TL, kind: 'missed_1on1', title: 'x', ref: 'r2' }, 'system:test')
    expect(res.skipped).toBeUndefined()
    expect(hubDb.tables.popups.length).toBe(2)
  })
})
