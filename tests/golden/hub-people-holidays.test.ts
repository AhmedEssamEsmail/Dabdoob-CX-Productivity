/**
 * Golden: Hub People & holidays — dqRosterFromHct_ / getRosterAdmin /
 * setPersonV2Fields / setPersonOverrides / addHoliday / removeHoliday /
 * syncRosterNow (RosterSync.js:170-460), oracle vs port.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('./hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('./hub-fakes')).authModule())

import {
  dqRosterFromHct_,
  getRosterAdmin,
  setPersonV2Fields,
  setPersonOverrides,
  addHoliday,
  removeHoliday,
  syncRosterNow,
  dqSyncRoster_,
} from '@/features/cx-hub/lib/roster'
import { hubInstall, hubCall, portCall, hubSheetRows, type HubFx } from './helpers-hub'
import { expectSame, diffPath, json } from './helpers-oracle'
import { hubDb } from './hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'

const NOW = Date.parse('2026-05-06T10:00:00Z')

/** HCT records in the dqReadHct_ output shape (the dq_hct mirror columns). */
const HCT = [
  {
    name: 'Admin One', email: 'admin@dabdoob.com', position: 'Customer Experience Manager',
    department: 'Operations', section: 'Customer Experience', manager: '-', status: 'current', lwd: '',
    hiringDate: '2020-01-05', fdId: '11', fdName: 'Admin One', maqsamName: '',
  },
  {
    name: 'Lead One', email: 'tl@dabdoob.com', position: 'Team Leader',
    department: 'Operations', section: 'Customer Experience', manager: 'Admin One', status: 'current', lwd: '',
    hiringDate: '@@ms:' + Date.parse('2021-02-15T00:00:00Z'), fdId: '12', fdName: 'Lead One', maqsamName: '',
  },
  {
    name: 'Agent One', email: 'agent@dabdoob.com', position: 'CX Agent',
    department: 'Operations', section: 'Customer Experience', manager: 'Lead One', status: 'current', lwd: '',
    hiringDate: '', fdId: '13', fdName: 'Agent One', maqsamName: 'Agent One',
  },
  {
    name: 'Ghost', email: 'gone@dabdoob.com', position: 'CX Agent',
    department: 'Operations', section: 'Customer Experience', manager: 'Lead One', status: 'current', lwd: '2026-01-01',
    hiringDate: '', fdId: '', fdName: '', maqsamName: '',
  },
  {
    name: 'Outside', email: 'out@dabdoob.com', position: 'PM',
    department: 'Product', section: 'Other Section', manager: 'Someone Else', status: 'current', lwd: '',
    hiringDate: '', fdId: '', fdName: '', maqsamName: '',
  },
  {
    name: 'Unresolved Manager Row', email: 'un@dabdoob.com', position: 'CX Agent',
    department: 'Operations', section: 'Customer Experience', manager: 'No Such Person', status: 'current', lwd: '',
    hiringDate: '', fdId: '', fdName: '', maqsamName: '',
  },
]

const ROSTER = [
  {
    email: 'admin@dabdoob.com', name: 'Admin One', role: 'admin', tl_email: '', country: 'Kuwait', active: true,
    hct_role: 'admin', hct_tl_email: '', source: 'hct', section: 'Customer Experience', position: 'Customer Experience Manager',
    based_in_country: 'Kuwait', days_off: '',
  },
  {
    email: 'tl@dabdoob.com', name: 'Lead One', role: 'tl', tl_email: 'admin@dabdoob.com', country: 'Egypt', active: true,
    hct_role: 'tl', hct_tl_email: 'admin@dabdoob.com', source: 'hct', section: 'Customer Experience', position: 'Team Leader',
    based_in_country: 'Egypt', days_off: '',
  },
  {
    email: 'agent@dabdoob.com', name: 'Agent One', role: 'agent', tl_email: 'tl@dabdoob.com', country: 'Egypt', active: true,
    hct_role: 'agent', hct_tl_email: 'tl@dabdoob.com', source: 'hct', section: 'Customer Experience', position: 'CX Agent',
    based_in_country: '', days_off: 'Sat,Sun',
  },
  {
    email: 'manual@dabdoob.com', name: 'Manual Row', role: 'agent', tl_email: 'tl@dabdoob.com', country: '', active: true,
    source: 'manual', section: '', position: '',
  },
]

function fx(over: HubFx = {}): HubFx {
  return {
    userEmail: 'admin@dabdoob.com',
    nowMs: NOW,
    settings: {
      allowed_domain: 'dabdoob.com',
      admin_emails: 'admin@dabdoob.com',
      roster_scope: ['Customer Experience'],
      roster_manager_aliases: {},
      roster_admin_positions: ['Customer Experience Manager'],
      roster_non_agent_positions: ['Enablement Specialist', 'Enablemen Specialist'],
      days_off_default: [],
      days_off_by_country: { Egypt: ['Fri', 'Sat'] },
      dq_last_roster_sync: JSON.stringify({ synced: 4, added: 0, changed: 0, at: '2026-05-05T05:00:00Z' }),
      ...(over.settings || {}),
    },
    props: { dq_last_roster_sync: JSON.stringify({ synced: 4, added: 0, changed: 0, at: '2026-05-05T05:00:00Z' }), ...(over.props || {}) },
    tables: {
      roster: ROSTER.map((r) => ({ ...r })),
      holidays: [
        { id: 1, holiday_id: '1', country: 'Egypt', date: '2026-01-07', name: 'Coptic Christmas', deleted_at: '', submitted_by: 'admin@dabdoob.com' },
        { id: 2, holiday_id: '2', country: 'Kuwait', date: '2026-02-25', name: 'National Day', deleted_at: '', submitted_by: 'admin@dabdoob.com' },
        { id: 3, holiday_id: '3', country: 'Kuwait', date: '2025-02-25', name: 'Old deleted', deleted_at: '2025-03-01T00:00:00Z', submitted_by: 'admin@dabdoob.com' },
      ],
      options: [{ list_key: 'person.country', value: 'Kuwait', sort: 1, active: true }],
      view_as: [],
      ...(over.tables || {}),
    },
    ...(over.userEmail !== undefined ? { userEmail: over.userEmail } : {}),
  }
}

describe('dqRosterFromHct_ (pure HCT -> Roster conversion)', () => {
  it('matches the oracle row-for-row (incl. Date hiringDate, dupes, out-of-scope, unresolved managers)', () => {
    const lf = hubInstall(fx())
    const recs = HCT.map((r) => ({ ...r }))
    const scope = ['Customer Experience']
    const cfg = {
      aliases: {},
      adminPositions: ['Customer Experience Manager'],
      nonAgentPositions: ['Enablement Specialist', 'Enablemen Specialist'],
      nonAgentEmails: [],
    }
    // Port gets real Dates; oracle gets @@ms markers (both from the same records).
    const portRecs = recs.map((r) => ({
      ...r,
      hiringDate: typeof r.hiringDate === 'string' && r.hiringDate.indexOf('@@ms:') === 0
        ? new Date(+r.hiringDate.slice(5))
        : r.hiringDate,
    }))
    expectSame(
      { ok: json(dqRosterFromHct_(portRecs, scope, 'Africa/Cairo', cfg)) },
      hubCall('dqRosterFromHct_', [recs, scope, 'Africa/Cairo', cfg], lf),
      'dqRosterFromHct_'
    )
  })
})

describe('getRosterAdmin', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('matches the oracle payload (people + holidays + lastSync + defaults + literal countryList)', async () => {
    const lf = hubInstall(fx())
    expectSame(await portCall(() => getRosterAdmin()), hubCall('getRosterAdmin', [], lf), 'getRosterAdmin')
  })

  it('refuses non-admin identically', async () => {
    const f = fx({ userEmail: 'agent@dabdoob.com' })
    const lf = hubInstall(f)
    expectSame(await portCall(() => getRosterAdmin()), hubCall('getRosterAdmin', [], lf), 'getRosterAdmin agent')
  })
})

describe('setPersonV2Fields / setPersonOverrides', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('valid + invalid field writes match', async () => {
    const cases: [string, Record<string, unknown>][] = [
      ['agent@dabdoob.com', { basedInCountry: '  Egypt  ', daysOff: ['fri', 'Sat'] }],
      ['agent@dabdoob.com', { basedInCountry: '', daysOff: [] }],
      ['agent@dabdoob.com', { basedInCountry: 'x'.repeat(61), daysOff: [] }],
      ['agent@dabdoob.com', { daysOff: ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri'] }],
      ['agent@dabdoob.com', { daysOff: ['Funday'] }],
      ['nobody@dabdoob.com', { basedInCountry: 'Egypt' }],
      ['AGENT@DABDOOB.COM', { basedInCountry: 'Kuwait', daysOff: 'Sun,Mon' }],
    ]
    for (const [email, fields] of cases) {
      const lf = hubInstall(fx())
      expectSame(
        await portCall(() => setPersonV2Fields(email, fields)),
        hubCall('setPersonV2Fields', [email, fields], lf),
        'setPersonV2Fields ' + email + ' ' + JSON.stringify(fields)
      )
    }
  })

  it('the write lands identically (based_in_country + days_off)', async () => {
    hubInstall(fx())
    await setPersonV2Fields('agent@dabdoob.com', { basedInCountry: 'Kuwait', daysOff: ['Sat', 'Sun'] })
    const row = (hubDb.tables.roster || []).find((r) => r.email === 'agent@dabdoob.com')
    expect(row && row.based_in_country).toBe('Kuwait')
    expect(row && row.days_off).toBe('Sun,Sat')
  })

  it('overrides: all branches match (valid, clear, self-report, loop, bad role, no row, inactive/non-TL manager)', async () => {
    const f = fx()
    f.tables!.roster = [
      // deep copies — the port's row id stamping/mutation must not pollute the
      // ROSTER const objects (shared rows would leak `id` into later fixtures).
      ...ROSTER.map((r) => ({ ...r })),
      { email: 'tl2@dabdoob.com', name: 'Lead Two', role: 'tl', tl_email: 'admin@dabdoob.com', active: true, source: 'hct' },
      { email: 'dead@dabdoob.com', name: 'Inactive TL', role: 'tl', tl_email: 'admin@dabdoob.com', active: false, source: 'hct' },
      { email: 'sub@dabdoob.com', name: 'Sub Agent', role: 'agent', tl_email: 'agent@dabdoob.com', active: true, source: 'hct' },
    ]
    const cases: [string, Record<string, unknown>][] = [
      ['agent@dabdoob.com', { role: 'tl', tlEmail: 'admin@dabdoob.com' }],
      ['agent@dabdoob.com', { role: '', tlEmail: '' }],
      ['agent@dabdoob.com', { role: 'tl2' }],
      ['nobody@dabdoob.com', { role: 'tl' }],
      ['agent@dabdoob.com', { tlEmail: 'agent@dabdoob.com' }],
      ['agent@dabdoob.com', { tlEmail: 'ghost@dabdoob.com' }],
      ['agent@dabdoob.com', { tlEmail: 'dead@dabdoob.com' }],
      ['agent@dabdoob.com', { tlEmail: 'manual@dabdoob.com' }],
      ['tl2@dabdoob.com', { tlEmail: 'sub@dabdoob.com' }], // would loop: sub reports to agent→tl; tl2 reporting under sub chain? sub->agent->tl->admin; tl2->sub is fine
      ['tl@dabdoob.com', { tlEmail: 'agent@dabdoob.com' }], // loop: agent reports to tl
    ]
    for (const [email, o] of cases) {
      const lf = hubInstall(f)
      expectSame(
        await portCall(() => setPersonOverrides(email, o)),
        hubCall('setPersonOverrides', [email, o], lf),
        'setPersonOverrides ' + email + ' ' + JSON.stringify(o)
      )
    }
  })

  it('override writes land on the roster row (role_override/tl_override + stamped base)', async () => {
    hubInstall(fx())
    await setPersonOverrides('manual@dabdoob.com', { role: 'tl', tlEmail: 'admin@dabdoob.com' })
    const row = (hubDb.tables.roster || []).find((r) => r.email === 'manual@dabdoob.com')
    expect(row && row.role_override).toBe('tl')
    expect(row && row.tl_override).toBe('admin@dabdoob.com')
    expect(row && row.role).toBe('tl')
    expect(row && row.tl_email).toBe('admin@dabdoob.com')
  })
})

describe('addHoliday / removeHoliday', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('validation failures match', async () => {
    const cases = [
      { country: '', date: '2026-06-01', name: 'X' },
      { country: 'Egypt', date: '06/01/2026', name: 'X' },
      { country: 'Egypt', date: '2026-06-01', name: '' },
      { country: 'Egypt', date: '2026-06-01', name: 'x'.repeat(81) },
      { country: 'Egypt', date: '2026-01-07', name: 'Duplicate Christmas' },
      { country: 'egypt', date: '2026-01-07', name: 'Duplicate case-insensitive' },
    ]
    for (const h of cases) {
      const lf = hubInstall(fx())
      expectSame(await portCall(() => addHoliday(h)), hubCall('addHoliday', [h], lf), 'addHoliday ' + JSON.stringify(h))
    }
  })

  it('a valid add returns the same envelope minus the generated id (schema seam) and writes the row', async () => {
    const lf = hubInstall(fx())
    const legacy = hubCall('addHoliday', [{ country: 'UAE', date: '2026-12-02', name: 'National Day' }], lf)
    const port = await portCall(() => addHoliday({ country: 'UAE', date: '2026-12-02', name: 'National Day' }))
    if (legacy.err || port.err) throw new Error(JSON.stringify({ l: legacy.err, p: port.err }))
    const l = legacy.ok as Record<string, unknown>
    const p = port.ok as Record<string, unknown>
    delete l.id
    delete p.id
    expectSame({ ok: p }, { ok: l }, 'addHoliday envelope')
    const written = hubDb.inserted.find((i) => i.table === 'holidays')
    expect(written && written.rows[0].country).toBe('UAE')
  })

  it('removeHoliday matches (existing, already-deleted, and unknown ids)', async () => {
    for (const id of ['1', '3', '999']) {
      const lf = hubInstall(fx())
      expectSame(await portCall(() => removeHoliday(id)), hubCall('removeHoliday', [id], lf), 'removeHoliday ' + id)
    }
  })
})

describe('syncRosterNow / dqSyncRoster_', () => {
  beforeEach(() => {
    cacheClear()
    vi.useFakeTimers({ now: NOW })
  })
  afterEach(() => vi.useRealTimers())

  it('with no HCT source both fail honestly (different seams, same refusal)', async () => {
    hubInstall(fx())
    const port = await portCall(() => syncRosterNow())
    if (!port.err) throw new Error('expected the port to refuse without dq_hct')
    // the oracle reaches dqReadHct_ -> book without a Sheet1 tab, also an error
    const lf = hubInstall(fx())
    lf.spreadsheets = {} // no hct-ss book: openSpreadsheet_ yields an empty Sheet1
    const legacy = hubCall('syncRosterNow', [], lf)
    if (!legacy.err) throw new Error('expected the oracle to fail without HCT rows')
  })

  it('an empty connected source fails identically (No HCT rows matched)', async () => {
    const base = fx()
    base.settings = { ...base.settings, roster_hct_ss_id: 'hct-ss' }
    base.tables = { ...base.tables, dq_hct: [] }
    const lf = hubInstall(base)
    lf.spreadsheets = {
      ...lf.spreadsheets,
      'hct-ss': { Sheet1: [['Employee Name', 'Email', 'Position', 'Department', 'Section', 'Direct Repporter', 'Status', 'LWD', 'Hiring Date', 'Fresh desk ID', 'Freshdesk Name', 'Maqsam Name']] },
    }
    expectSame(await portCall(() => dqSyncRoster_()), hubCall('dqSyncRoster_', [], lf), 'dqSyncRoster_ empty')
  })

  it('a connected source runs the full legacy pipeline identically (rows, writes, refresh_log, last-sync)', async () => {
    // Raw HCT Sheet1 for the oracle's dqReadHct_; the mapped records for the port's dq_hct.
    const SHEET1 = [
      ['Employee Name', 'Email', 'Position', 'Department', 'Section', 'Direct Repporter', 'Status', 'LWD', 'Hiring Date', 'Fresh desk ID', 'Freshdesk Name', 'Maqsam Name'],
      ['New Person', 'new@dabdoob.com', 'CX Agent', 'Operations', 'Customer Experience', 'Lead One', 'current', '', '@@ms:1773878400000', '', 'New Person', ''],
      ['Lead One', 'tl@dabdoob.com', 'Team Leader', 'Operations', 'Customer Experience', 'Admin One', 'current', '', '', '12', 'Lead One', ''],
      ['Agent One', 'agent@dabdoob.com', 'CX Agent', 'Operations', 'Customer Experience', 'Lead One', 'current', '', '', '13', 'Agent One', 'Agent One'],
      ['Gone Person', 'gone@dabdoob.com', 'CX Agent', 'Operations', 'Customer Experience', 'Lead One', 'current', '2026-01-01', '', '', '', ''],
      ['Outside', 'out@dabdoob.com', 'PM', 'Product', 'Other Section', 'Someone', 'current', '', '', '', '', ''],
      ['Admin One', 'admin@dabdoob.com', 'Customer Experience Manager', 'Operations', 'Customer Experience', '-', 'current', '', '', '11', 'Admin One', ''],
    ]
    const portHct = [
      { name: 'New Person', email: 'new@dabdoob.com', position: 'CX Agent', department: 'Operations', section: 'Customer Experience', manager: 'Lead One', status: 'current', lwd: '', hiringDate: new Date(1773878400000), fdId: '', fdName: 'New Person', maqsamName: '' },
      { name: 'Lead One', email: 'tl@dabdoob.com', position: 'Team Leader', department: 'Operations', section: 'Customer Experience', manager: 'Admin One', status: 'current', lwd: '', hiringDate: '', fdId: '12', fdName: 'Lead One', maqsamName: '' },
      { name: 'Agent One', email: 'agent@dabdoob.com', position: 'CX Agent', department: 'Operations', section: 'Customer Experience', manager: 'Lead One', status: 'current', lwd: '', hiringDate: '', fdId: '13', fdName: 'Agent One', maqsamName: 'Agent One' },
      { name: 'Gone Person', email: 'gone@dabdoob.com', position: 'CX Agent', department: 'Operations', section: 'Customer Experience', manager: 'Lead One', status: 'current', lwd: '2026-01-01', hiringDate: '', fdId: '', fdName: '', maqsamName: '' },
      { name: 'Outside', email: 'out@dabdoob.com', position: 'PM', department: 'Product', section: 'Other Section', manager: 'Someone', status: 'current', lwd: '', hiringDate: '', fdId: '', fdName: '', maqsamName: '' },
      { name: 'Admin One', email: 'admin@dabdoob.com', position: 'Customer Experience Manager', department: 'Operations', section: 'Customer Experience', manager: '-', status: 'current', lwd: '', hiringDate: '', fdId: '11', fdName: 'Admin One', maqsamName: '' },
    ]
    const base = fx()
    base.settings = { ...base.settings, roster_hct_ss_id: 'hct-ss', ss_live_id: 'live-store' }
    base.tables = { ...base.tables, dq_hct: portHct, refresh_log: [] }

    const lf = hubInstall(base)
    lf.spreadsheets = { 'hct-ss': { Sheet1: SHEET1 }, 'live-store': lf.spreadsheets?.['live-store'] || {} }

    const legacy = hubCall('dqSyncRoster_', [], lf)
    // actorEmail_() on the oracle = the session user; the port stamps the actor arg the same way.
    const port = await portCall(() => dqSyncRoster_(undefined, 'admin@dabdoob.com'))
    expectSame(port, legacy, 'dqSyncRoster_ result')

    // the roster writes land the same on both sides (read inside the vm — the oracle
    // writes to its in-vm copies, not the host's fixture arrays)
    const legacyRoster = hubSheetRows('Roster')
      .map((r) => {
        const o: Record<string, unknown> = {}
        Object.keys(r).forEach((k) => { if (k !== '_row' && r[k] !== '' && r[k] !== null) o[k] = r[k] })
        return o
      })
      .sort((a, b) => (a.email as string).localeCompare(b.email as string))
    const portRoster = (hubDb.tables.roster || [])
      .map((r) => {
        const o: Record<string, unknown> = {}
        Object.keys(r).forEach((k) => { if (k !== 'id' && r[k] !== '' && r[k] !== null) o[k] = r[k] })
        return o
      })
      .sort((a, b) => (a.email as string).localeCompare(b.email as string))
    const d = diffPath(legacyRoster, portRoster)
    if (d) throw new Error('roster rows differ: ' + d + '\nlegacy=' + JSON.stringify(legacyRoster).slice(0, 1200) + '\nport=' + JSON.stringify(portRoster).slice(0, 1200))

    // the refresh_log row exists on the port (dqLogRun_)
    const logged = hubDb.inserted.find((i) => i.table === 'refresh_log')
    expect(logged && logged.rows[0].job).toBe('roster_sync')
    expect(logged && ['ok', 'warn'].indexOf(String(logged.rows[0].status)) !== -1).toBe(true)
  })

})
