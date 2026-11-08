import { describe, it, expect } from 'vitest'
import {
  notifyHtml, pwOoDue, pwOoEmailApplies, pwOoUpcoming, OO_REM_WINDOW_MS, OO_REM_START_GRACE_MS,
} from '@/features/shared/platform/notify'
import { escapeHtml } from '@/features/shared/platform/mail'
import type { OoBooking } from '@/features/shared/platform/notify'

describe('notifyHtml (notifyHtml_)', () => {
  it('builds escaped paragraphs, a fact table and where guidance', () => {
    const html = notifyHtml(
      {
        to: 'a@dabdoob.com',
        subject: 'Hi',
        intro: 'You <b>missed</b> it',
        facts: [
          ['When', '2026-10-08 & noon'],
          ['Empty', ''],
        ],
        outro: 'Fix it > soon',
        where: 'People > 1:1s',
      },
      'https://app/exec'
    )
    expect(html).toContain('You &lt;b&gt;missed&lt;/b&gt; it')
    expect(html).toContain('2026-10-08 &amp; noon')
    expect(html).not.toContain('Empty')
    expect(html).toContain('Open Dabdoob CX (https://app/exec), then People &gt; 1:1s.')
  })

  it('escapeHtml covers the five entities', () => {
    expect(escapeHtml(`<a href="x">&'</a>`)).toBe('&lt;a href=&quot;x&quot;&gt;&amp;&#39;&lt;/a&gt;')
    expect(escapeHtml(null)).toBe('')
  })
})

describe('pwOoDue / pwOoEmailApplies / pwOoUpcoming (OneOnOneAlerts.js)', () => {
  const at = 1_760_000_000_000 // arbitrary instant
  const b: OoBooking = { id: 's1', m: 'm@d.com', r: 'r@d.com', at, dur: 30, bookedAt: at - 3600000 }

  it('email applies when booked at least 15 min ahead', () => {
    expect(pwOoEmailApplies(b)).toBe(true)
    expect(pwOoEmailApplies({ ...b, bookedAt: at - 5 * 60000 })).toBe(false)
    expect(pwOoEmailApplies({ ...b, bookedAt: NaN })).toBe(true)
  })

  it('fires soon/email inside [at-15m, at), start inside [at, at+15m), for both people', () => {
    const inside = pwOoDue([b], at - 10 * 60000)
    expect(inside.filter((d) => d.type === 'soon')).toHaveLength(2)
    expect(inside.filter((d) => d.type === 'email')).toHaveLength(2)
    expect(inside.filter((d) => d.type === 'start')).toHaveLength(0)
    expect(inside[0].key).toBe('oo15|s1|' + at + '|m@d.com') // email entry precedes the in-app 'soon'
    expect(inside[1].key).toBe('oosoon|s1|' + at + '|m@d.com')

    const started = pwOoDue([b], at + 5 * 60000)
    expect(started.filter((d) => d.type === 'start')).toHaveLength(2)
    expect(started.filter((d) => d.type === 'soon')).toHaveLength(0)

    const late = pwOoDue([b], at + OO_REM_START_GRACE_MS + 1)
    expect(late).toHaveLength(0)
    const early = pwOoDue([b], at - OO_REM_WINDOW_MS - 1)
    expect(early).toHaveLength(0)
  })

  it('pwOoUpcoming keeps scheduled rows inside [now-grace, now+24h]', () => {
    const now = at
    const rows = [
      { schedule_id: 'ok', manager_email: 'M@D.com', report_email: 'R@D.com', scheduled_at: new Date(at + 60000).toISOString(), duration_min: 30, status: 'scheduled' },
      { schedule_id: 'done', manager_email: 'm', report_email: 'r', scheduled_at: new Date(at + 60000).toISOString(), status: 'completed' },
      { schedule_id: 'old', manager_email: 'm', report_email: 'r', scheduled_at: new Date(at - 3600000).toISOString(), status: 'scheduled' },
      { schedule_id: 'far', manager_email: 'm', report_email: 'r', scheduled_at: new Date(at + 48 * 3600000).toISOString(), status: 'scheduled' },
    ]
    const out = pwOoUpcoming(now, rows)
    expect(out).toHaveLength(1)
    expect(out[0].id).toBe('ok')
    expect(out[0].m).toBe('m@d.com')
  })
})
