/**
 * S07-02: dqSyncRoster_ persists the FULL dqReadHct_() set to public.dq_hct
 * (every record incl. out-of-scope, <=500-row upsert batches on email,
 * synced_at = the run stamp, fail-closed) and jobRosterSync is manual-only
 * (requireRole(['admin']) + assertWritable — sessionless callers denied).
 * Reuses the golden hub-fakes supabase/auth/readSheet mocks.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('@/features/shared/lib/supabase', async () => (await import('../golden/hub-fakes')).supabaseModule())
vi.mock('@/features/shared/lib/auth', async () => (await import('../golden/hub-fakes')).authModule())
vi.mock('@/features/shared/migration/engine', async (importOriginal) => {
  const orig = await importOriginal<typeof import('@/features/shared/migration/engine')>()
  return {
    ...orig,
    readSheet: async (_id: string, name: string) => {
      const { hubDb } = await import('../golden/hub-fakes')
      const rows = hubDb.sheets[name]
      if (!rows) throw new Error('no sheet fixture: ' + name)
      if (rows.length < 2) return []
      let width = rows[0]?.length ?? 0
      for (const r of rows) if (r.length > width) width = r.length
      const keys = orig.headerKeys(Array.from({ length: width }, (_, i) => rows[0][i]))
      return rows.slice(1).map((row) => {
        const obj: Record<string, unknown> = {}
        keys.forEach((key, i) => {
          const v = row[i]
          obj[key] = typeof v === 'string' && v.indexOf('@@ms:') === 0 ? new Date(+v.slice(5)) : v
        })
        return obj
      })
    },
  }
})

import { dqReadHct_, dqSyncRoster_, jobRosterSync } from '@/features/cx-hub/lib/roster'
import { hubDb, hubDbReset, hubSetUser, hubSetSheet } from '../golden/hub-fakes'
import { cacheClear } from '@/features/shared/platform/repo'

const IN_SCOPE = 520
const OUT_OF_SCOPE = 3
const HEADER = [
  'Employee Name', 'Email', 'Position', 'Department', 'Section', 'Direct Repporter',
  'Status', 'LWD', 'Hiring Date', 'Fresh desk ID', 'Freshdesk Name', 'Maqsam Name',
  'Code', 'Gender', 'Contact Number',
]

function sheetRows(): unknown[][] {
  const rows: unknown[][] = [HEADER]
  for (let i = 0; i < IN_SCOPE; i++) {
    rows.push(['Agent ' + i, 'agent' + i + '@dabdoob.com', 'CX Agent', 'Operations', 'Customer Experience', '-', 'current', '', '', '', 'Agent ' + i, '', 'A' + i, 'Female', '+2010' + String(i).padStart(7, '0')])
  }
  for (let i = 0; i < OUT_OF_SCOPE; i++) {
    rows.push(['Outside ' + i, 'out' + i + '@dabdoob.com', 'PM', 'Product', 'Other Section', '-', 'current', '', '', '', 'Outside ' + i, '', 'O' + i, 'Male', '+9650000000' + i])
  }
  return rows
}

function install(email = 'admin@dabdoob.com') {
  hubDbReset()
  cacheClear()
  hubSetUser(email)
  hubSetSheet('Sheet1', sheetRows())
  hubDb.tables.config = [
    { key: 'allowed_domain', value: 'dabdoob.com' },
    { key: 'admin_emails', value: 'admin@dabdoob.com' },
    { key: 'roster_scope', value: '["Customer Experience"]' },
    { key: 'roster_manager_aliases', value: '{}' },
    { key: 'roster_admin_positions', value: '[]' },
    { key: 'roster_non_agent_positions', value: '[]' },
    { key: 'roster_non_agent_emails', value: '[]' },
    { key: 'data_tz', value: 'Africa/Cairo' },
  ]
  hubDb.tables.roster = []
  hubDb.tables.view_as = []
}

const HCT_COLS = [
  'name', 'email', 'position', 'department', 'section', 'manager', 'status', 'lwd',
  'hiringDate', 'fdId', 'fdName', 'maqsamName', 'code', 'gender', 'contactNumber',
]

describe('dqSyncRoster_ dq_hct snapshot', () => {
  beforeEach(() => install())
  afterEach(() => vi.useRealTimers())

  it('upserts the FULL record set (out-of-scope included) in <=500 batches with synced_at', async () => {
    const res = await dqSyncRoster_(undefined, 'admin@dabdoob.com')
    expect(res.synced).toBe(IN_SCOPE)

    const writes = hubDb.inserted.filter((w) => w.table === 'dq_hct')
    expect(writes.length).toBeGreaterThan(1) // 523 rows -> 500 + 23
    writes.forEach((w) => expect(w.rows.length).toBeLessThanOrEqual(500))
    const total = writes.reduce((n, w) => n + w.rows.length, 0)
    expect(total).toBe(IN_SCOPE + OUT_OF_SCOPE)

    const emails = new Set<string>()
    writes.forEach((w) =>
      w.rows.forEach((r) => {
        emails.add(String(r.email))
        expect(typeof r.synced_at).toBe('string')
        // the fake stamps a surrogate id on upserted rows — storage seam, not a snapshot column
        expect(Object.keys(r).every((k) => HCT_COLS.indexOf(k) !== -1 || k === 'synced_at' || k === 'id')).toBe(true)
      })
    )
    expect(emails.has('out0@dabdoob.com')).toBe(true)
    expect(emails.has('out2@dabdoob.com')).toBe(true)

    // the fake applied the upserts: dq_hct holds the whole snapshot
    expect((hubDb.tables.dq_hct || []).length).toBe(IN_SCOPE + OUT_OF_SCOPE)
  })

  it('dedupes snapshot rows that clean to the same email (last wins)', async () => {
    const rows = sheetRows()
    rows.push(
      ['Dup First', 'DUP@dabdoob.com ', 'CX Agent', 'Operations', 'Customer Experience', '-', 'current', '', '', '', 'Dup First', '', 'D1', 'Female', '+20100000001'],
      ['Dup Last', 'dup@dabdoob.com', 'CX Agent', 'Operations', 'Customer Experience', '-', 'current', '', '', '', 'Dup Last', '', 'D2', 'Female', '+20100000002']
    )
    hubSetSheet('Sheet1', rows)

    await dqSyncRoster_(undefined, 'admin@dabdoob.com')

    const writes = hubDb.inserted.filter((w) => w.table === 'dq_hct')
    for (const w of writes) {
      const emails = w.rows.map((r) => String(r.email))
      expect(new Set(emails).size).toBe(emails.length)
    }
    const dups = writes.flatMap((w) => w.rows.filter((r) => String(r.email) === 'dup@dabdoob.com'))
    expect(dups.length).toBe(1)
    expect(dups[0].name).toBe('Dup Last')
  })

  it('grants manualHct only inside dqSyncRoster_ — no violation log', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    try {
      await dqSyncRoster_(undefined, 'admin@dabdoob.com')
      const violations = err.mock.calls.filter((c) => String(c[0]).indexOf('[SHEETS_FREEZE_VIOLATION]') === 0)
      expect(violations.length).toBe(0)
    } finally {
      err.mockRestore()
    }
  })
})

describe('dqReadHct_ freeze boundary', () => {
  beforeEach(() => install())
  afterEach(() => vi.restoreAllMocks())

  it('logs [SHEETS_FREEZE_VIOLATION] when called without manualHct', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = await dqReadHct_()
    expect(rows.length).toBe(IN_SCOPE + OUT_OF_SCOPE)
    const violations = err.mock.calls.filter((c) => String(c[0]).indexOf('[SHEETS_FREEZE_VIOLATION]') === 0)
    expect(violations.length).toBe(1)
    expect(String(violations[0][0])).toContain('dqReadHct_')
  })

  it('does not log the violation with {manualHct:true}', async () => {
    const err = vi.spyOn(console, 'error').mockImplementation(() => {})
    const rows = await dqReadHct_({ manualHct: true })
    expect(rows.length).toBe(IN_SCOPE + OUT_OF_SCOPE)
    const violations = err.mock.calls.filter((c) => String(c[0]).indexOf('[SHEETS_FREEZE_VIOLATION]') === 0)
    expect(violations.length).toBe(0)
  })
})

describe('jobRosterSync manual-only gate', () => {
  beforeEach(() => install())
  afterEach(() => vi.useRealTimers())

  it('denies a sessionless (cron) caller before touching dqReadHct_', async () => {
    install('')
    await expect(jobRosterSync()).rejects.toThrow()
    expect(hubDb.inserted.filter((w) => w.table === 'dq_hct').length).toBe(0)
  })

  it('lets an admin session through to the sync', async () => {
    const res = await jobRosterSync()
    expect(res && res.synced).toBe(IN_SCOPE)
  })
})
