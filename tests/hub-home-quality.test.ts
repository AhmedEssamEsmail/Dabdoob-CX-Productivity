/**
 * Home quality block (S01): getHomePage's additive `quality` key —
 * { month, monthDelta, week, openCtls } for admin & non-specialist TL,
 * absent for agent/specialist, null-safe when the qa stores are missing.
 *
 * Frozen clock 2026-05-06T10:00Z = 2026-05-06 13:00 Asia/Kuwait:
 *   today '2026-05-06', month '2026-05-01'.., prev month '2026-04-01'..'2026-04-30',
 *   quota week (weekStartsOn default 0 = Sunday) '2026-05-03'..'2026-05-06'.
 */
import { describe, expect, it, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () =>
  (await import('./golden/hub-fakes')).supabaseModule()
)
vi.mock('@/features/shared/lib/auth', async () => (await import('./golden/hub-fakes')).authModule())

import { getHomePage } from '@/features/cx-hub/lib/aggregates'
import { hubInstall, portCall, type HubFx } from './golden/helpers-hub'
import { hubDb } from './golden/hub-fakes'
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
    props: { ...(over.props || {}) },
    tables: {
      roster: [
        { email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', tl_email: '', country: 'Kuwait', active: true },
        { email: 'tl@dabdoob.com', name: 'Lead One', role: 'tl', tl_email: 'admin@dabdoob.com', country: 'Egypt', active: true },
        { email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
        { email: 'agent2@dabdoob.com', name: 'Agent Two', role: 'agent', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
        { email: 'spec@dabdoob.com', name: 'Spec One', role: 'specialist', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true },
      ],
      qa_audits: [
        // This month, in scope (a2 exercises score_final overriding score).
        { audit_id: 'a1', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-02', score: 80, status: 'acknowledged', kind: 'audit' },
        { audit_id: 'a2', agent_email: 'agent2@dabdoob.com', audit_date: '2026-05-04', score: 70, score_final: 90, status: 'rescored', kind: 'audit' },
        // This month, off the TL's team (admin sees it, TL does not).
        { audit_id: 'a3', agent_email: 'other@dabdoob.com', audit_date: '2026-05-05', score: 60, status: 'acknowledged', kind: 'audit' },
        // Previous month.
        { audit_id: 'a4', agent_email: 'agent@dabdoob.com', audit_date: '2026-04-15', score: 70, status: 'acknowledged', kind: 'audit' },
        { audit_id: 'a5', agent_email: 'other@dabdoob.com', audit_date: '2026-04-20', score: 50, status: 'acknowledged', kind: 'audit' },
        // Outside the bounded read window both ways.
        { audit_id: 'a6', agent_email: 'agent@dabdoob.com', audit_date: '2026-03-15', score: 40, status: 'acknowledged', kind: 'audit' },
        { audit_id: 'a7', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-10', score: 95, status: 'acknowledged', kind: 'audit' },
        // In-window but never counted by the rollup.
        { audit_id: 'a8', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-03', score: 95, status: 'acknowledged', kind: 'calibration' },
        { audit_id: 'a9', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-03', score: 95, status: 'voided', kind: 'audit' },
        { audit_id: 'a10', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-03', score: '', status: 'acknowledged', kind: 'audit' },
      ],
      qa_ctls: [
        { ctl_id: 'c1', status: 'open', tl_email: 'tl@dabdoob.com', agent_email: 'agent@dabdoob.com' },
        { ctl_id: 'c2', status: 'open', tl_email: 'other-tl@dabdoob.com', agent_email: 'other@dabdoob.com' },
        { ctl_id: 'c3', status: 'closed', tl_email: 'tl@dabdoob.com', agent_email: 'agent@dabdoob.com' },
      ],
      ...(over.tables || {}),
    },
    ...(over.userEmail ? { userEmail: over.userEmail } : {}),
    ...(over.nowMs !== undefined ? { nowMs: over.nowMs } : {}),
  }
}

type Quality = { month: number | null; monthDelta: number | null; week: number | null; openCtls: number }

async function qualityFor(email: string): Promise<Record<string, unknown>> {
  hubInstall(fx({ userEmail: email }))
  const res = (await portCall(() => getHomePage())) as { ok?: Record<string, unknown>; err?: string }
  expect(res.err, 'getHomePage ' + email).toBeUndefined()
  return res.ok || {}
}

describe('getHomePage quality block', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => {
    vi.useRealTimers()
  })

  it('admin: month/week means over the whole pool, delta vs prev month, all open CTLs', async () => {
    const q = (await qualityFor('admin@dabdoob.com')).quality as Quality
    // month: (80 + 90 + 60) / 3 -> 76.7 ; prev: (70 + 50) / 2 -> 60 ; week: (90 + 60) / 2 -> 75
    expect(q.month).toBe(76.7)
    expect(q.monthDelta).toBe(16.7)
    expect(q.week).toBe(75)
    expect(q.openCtls).toBe(2)
  })

  it('tl: scoped to self+team audits and own tl_email CTLs only', async () => {
    const q = (await qualityFor('tl@dabdoob.com')).quality as Quality
    // team = tl+agent+agent2(+spec): month (80+90)/2 -> 85 ; prev 70 ; week 90
    expect(q.month).toBe(85)
    expect(q.monthDelta).toBe(15)
    expect(q.week).toBe(90)
    expect(q.openCtls).toBe(1)
  })

  it.each(['agent@dabdoob.com', 'spec@dabdoob.com'])('quality key absent for %s', async (email) => {
    const ok = await qualityFor(email)
    expect('quality' in ok).toBe(false)
  })

  it('missing qa stores do not reject; quality is null or all-null metrics', async () => {
    hubInstall(fx())
    hubDb.missing.add('qa_audits')
    hubDb.missing.add('qa_ctls')
    const res = (await portCall(() => getHomePage())) as { ok?: { quality?: Quality | null }; err?: string }
    expect(res.err).toBeUndefined()
    const q = res.ok?.quality
    expect(
      q === null || (q?.month === null && q?.monthDelta === null && q?.week === null && q?.openCtls === 0)
    ).toBe(true)
  })

  it('malformed qa_engine_settings resolves with no error and quality === null', async () => {
    hubInstall(fx({ settings: { qa_engine_settings: '{not-json' } }))
    const res = (await portCall(() => getHomePage())) as { ok?: { quality?: Quality | null }; err?: string }
    expect(res.err).toBeUndefined()
    expect(res.ok?.quality).toBeNull()
  })

  it('weekStartsOn: 1 shifts the quota week to Monday, excluding a 05-03 audit', async () => {
    hubInstall(
      fx({
        settings: { qa_engine_settings: { weekStartsOn: 1 } },
        tables: {
          qa_audits: [
            // Countable audit on Sunday 05-03: inside a Sun-start week, outside a Mon-start week.
            { audit_id: 'w0', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-03', score: 90, status: 'acknowledged', kind: 'audit' },
            // In-window under either rule so the week is a number, not null.
            { audit_id: 'w1', agent_email: 'agent@dabdoob.com', audit_date: '2026-05-05', score: 50, status: 'acknowledged', kind: 'audit' },
          ],
        },
      })
    )
    const res = (await portCall(() => getHomePage())) as { ok?: { quality?: Quality }; err?: string }
    expect(res.err).toBeUndefined()
    // Mon-start window 05-04..05-06 counts only w1 -> 50; Sun-start would add w0 -> 70.
    expect(res.ok?.quality?.week).toBe(50)
  })
})
