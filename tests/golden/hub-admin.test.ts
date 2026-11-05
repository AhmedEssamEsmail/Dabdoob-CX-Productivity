/**
 * Golden: Hub Admin — getConfig / setConfig / getConfigRows / saveConfigSetting
 * (Code.js:69-95) and setAppUrl (Apps.js:50-72), oracle vs port.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import {
  getAdminConfig,
  setAdminConfig,
  getConfigRows,
  saveConfigSetting,
  setAppUrl,
} from '@/features/cx-hub/lib/admin'
import { hubInstall, hubCall, portCall, type HubFx } from './helpers-hub'
import { expectSame, diffPath, json } from './helpers-oracle'
import { hubDb } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'

const NOW = Date.parse('2026-05-06T10:00:00Z')

function fx(over: HubFx = {}): HubFx {
  return {
    userEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    settings: {
      allowed_domain: 'dabdoob.com',
      admin_emails: 'admin@dabdoob.com',
      checkin_slots: ['09:30', '13:00'],
      prod_flag_cases_x: 4,
      app_url_hub: 'https://script.google.com/macros/s/ABC123_xyz-/exec',
      ...(over.settings || {}),
    },
    tables: {
      roster: [{ email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', tl_email: '', country: '', active: true }],
      view_as: [],
      ...(over.tables || {}),
    },
    ...(over.userEmail !== undefined ? { userEmail: over.userEmail } : {}),
  }
}

describe('hub admin — config surface (Code.js:69-95)', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('getConfig matches', async () => {
    const lf = hubInstall(fx())
    expectSame(await portCall(() => getAdminConfig()), hubCall('getConfig', [], lf), 'getConfig')
  })

  it('setConfig writes + returns the whole map, same as the oracle', async () => {
    const lf = hubInstall(fx())
    expectSame(
      await portCall(() => setAdminConfig('checkin_slots', '["09:00","13:00","18:00"]')),
      hubCall('setConfig', ['checkin_slots', '["09:00","13:00","18:00"]'], lf),
      'setConfig'
    )
    // both wrote the same stored value
    const stored = (hubDb.tables.config || []).find((r) => r.key === 'checkin_slots')
    expect(json(stored && stored.value)).toBe('["09:00","13:00","18:00"]')
  })

  it('setConfig validation errors match (unknown key, bad JSON, bad type, admin_emails self-lock)', async () => {
    const cases: [string, unknown][] = [
      ['no_such_setting', 'x'],
      ['checkin_slots', '{bad json'],
      ['prod_flag_cases_x', '0'],
      ['prod_flag_cases_x', '99'],
      ['prod_flag_cases_x', 'two'],
      ['admin_emails', 'someone.else@dabdoob.com'],
      ['admin_emails', 'not-an-email'],
      ['allowed_domain', 42],
    ]
    for (const [k, v] of cases) {
      const lf = hubInstall(fx())
      expectSame(await portCall(() => setAdminConfig(k, v)), hubCall('setConfig', [k, v], lf), 'setConfig ' + k + '=' + JSON.stringify(v))
    }
  })

  it('getConfigRows: every oracle row appears identically in the (superset) port list', async () => {
    const lf = hubInstall(fx())
    const legacy = hubCall('getConfigRows', [], lf)
    const port = await portCall(() => getConfigRows())
    if (legacy.err || port.err) throw new Error('err: ' + JSON.stringify({ legacy: legacy.err, port: port.err }))
    const portByKey = new Map((port.ok as Record<string, unknown>[]).map((r) => [String(r.key), r]))
    for (const row of legacy.ok as Record<string, unknown>[]) {
      const p = portByKey.get(String(row.key))
      const d = diffPath(row, p)
      if (d) throw new Error('getConfigRows row ' + row.key + ' differs: ' + d)
    }
  })

  it('saveConfigSetting returns the updated list incl. the stored row', async () => {
    const lf = hubInstall(fx())
    const legacy = hubCall('saveConfigSetting', ['checkin_slots', '["09:00","13:00","18:00"]'], lf)
    const port = await portCall(() => saveConfigSetting('checkin_slots', '["09:00","13:00","18:00"]'))
    if (legacy.err || port.err) throw new Error('err: ' + JSON.stringify({ legacy: legacy.err, port: port.err }))
    const portByKey = new Map((port.ok as Record<string, unknown>[]).map((r) => [String(r.key), r]))
    for (const row of legacy.ok as Record<string, unknown>[]) {
      const p = portByKey.get(String(row.key))
      const d = diffPath(row, p)
      if (d) throw new Error('saveConfigSetting row ' + row.key + ' differs: ' + d)
    }
  })

  it('non-admin callers get the identical refusal on every entry point', async () => {
    const f = fx({ userEmail: 'tl@dabdoob.com' })
    f.tables!.roster = [
      ...(f.tables!.roster || []),
      { email: 'tl@dabdoob.com', name: 'Lead One', role: 'tl', tl_email: 'admin@dabdoob.com', country: '', active: true },
    ]
    const lf = hubInstall(f)
    expectSame(await portCall(() => getAdminConfig()), hubCall('getConfig', [], lf), 'getConfig tl')
    expectSame(await portCall(() => setAdminConfig('checkin_slots', '[]')), hubCall('setConfig', ['checkin_slots', '[]'], lf), 'setConfig tl')
    expectSame(await portCall(() => getConfigRows()), hubCall('getConfigRows', [], lf), 'getConfigRows tl')
    expectSame(await portCall(() => saveConfigSetting('checkin_slots', '[]')), hubCall('saveConfigSetting', ['checkin_slots', '[]'], lf), 'saveConfigSetting tl')
    expectSame(await portCall(() => setAppUrl('quality', '')), hubCall('setAppUrl', ['quality', ''], lf), 'setAppUrl tl')
  })
})

describe('hub admin — connected apps (Apps.js:50-72)', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  const EXEC = 'https://script.google.com/macros/s/ABC123_xyz-/exec'
  const EXEC_A = 'https://script.google.com/a/macros/dabdoob.com/s/ABC123_xyz-/exec'
  const EXEC_B = 'https://script.google.com/a/dabdoob.com/macros/s/ABC123_xyz-/exec'

  it('valid URLs save and return the URL map', async () => {
    for (const u of [EXEC, EXEC_A, EXEC_B, '']) {
      const lf = hubInstall(fx())
      expectSame(await portCall(() => setAppUrl('quality', u)), hubCall('setAppUrl', ['quality', u], lf), 'setAppUrl ' + u)
    }
  })

  it('invalid URLs and unknown apps fail identically', async () => {
    const cases: [string, string][] = [
      ['quality', 'https://example.com/exec'],
      ['quality', 'https://script.google.com/macros/s/ABC/dev'],
      ['quality', 'ftp://script.google.com/macros/s/ABC123_xyz-/exec'],
      ['not-an-app', EXEC],
      ['', EXEC],
      ['quality', 'not a url'],
    ]
    for (const [app, url] of cases) {
      const lf = hubInstall(fx())
      expectSame(await portCall(() => setAppUrl(app, url)), hubCall('setAppUrl', [app, url], lf), 'setAppUrl ' + app + ' ' + url)
    }
  })
})
