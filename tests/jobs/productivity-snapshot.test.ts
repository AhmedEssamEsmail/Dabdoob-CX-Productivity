/**
 * prodSnapshotIntervals_ / the 'prod_snapshot' step semantics:
 * the newest "Agents Activity" email's CSV -> prod_intervals, replacing the
 * dates it holds. Exact legacy skip strings are asserted verbatim.
 */
import { describe, expect, it } from 'vitest'
import { prodSnapshotIntervals_ } from '@/lib/jobs/productivity'
import { activityCsv, gmailPayloadWithCsv, stubEnv, stubGmail } from './helpers'

const NOW = Date.parse('2026-10-08T10:00:00Z') // 13:00 Kuwait -> today 2026-10-08, yesterday 2026-10-07
const MAIL_MS = Date.parse('2026-10-08T06:00:00Z')
const ROSTER = [{ email: 'ahmed@dabdoob.com', name: 'Ahmed A', source: 'hct', tl_email: 'tl@dabdoob.com' }]

function mail(csv: string, id = 'm1') {
  return stubGmail({ id, internalDate: MAIL_MS, payload: gmailPayloadWithCsv(csv) })
}

const CSV_1007 = activityCsv([
  ['Ahmed A', 'Available', '2026-10-07 09:00:00', '2026-10-07 09:10:00'],
  ['Ahmed A', 'IDLE', '2026-10-07 09:10:00', '2026-10-07 09:15:00'],
])

describe('prodSnapshotIntervals_', () => {
  it('skips when productivity is not set up', async () => {
    const env = stubEnv({ cfg: { ss_productivity_id: '' }, now: NOW })
    const r = await prodSnapshotIntervals_(env)
    expect(r).toEqual({ skipped: 'CC2 Productivity is not set up: run setupProductivity' })
  })

  it('skips with the exact string when the gmail adapter is missing', async () => {
    const env = stubEnv({ now: NOW, gmail: null, rosterRows: ROSTER })
    const r = await prodSnapshotIntervals_(env)
    expect(r).toEqual({ skipped: 'gmail adapter not configured' })
  })

  it('skips when no email matches the query', async () => {
    const env = stubEnv({ now: NOW, gmail: stubGmail(null), rosterRows: ROSTER })
    const r = await prodSnapshotIntervals_(env)
    expect(r.skipped).toBe('no new email: none matches subject:"Agents Activity" has:attachment')
  })

  it('skips the already-imported email (idempotent by message id)', async () => {
    const env = stubEnv({
      now: NOW,
      rosterRows: ROSTER,
      gmail: mail(CSV_1007),
      cfg: { prod_last_mail: { id: 'm1', ms: MAIL_MS, importedAt: '2026-10-08T06:05:00.000Z', dates: ['2026-10-07'] } },
    })
    const r = await prodSnapshotIntervals_(env)
    expect(r.skipped).toBe(
      'no new email: the newest Agents Activity email (2026-10-08) was imported at 2026-10-08T06:05:00.000Z'
    )
    expect(env.tables.prod_intervals || []).toHaveLength(0)
  })

  it('skips an email whose data ends before yesterday', async () => {
    const stale = activityCsv([['Ahmed A', 'Available', '2026-10-05 09:00:00', '2026-10-05 09:10:00']])
    const env = stubEnv({ now: NOW, rosterRows: ROSTER, gmail: mail(stale, 'm9') })
    const r = await prodSnapshotIntervals_(env)
    expect(r.skipped).toBe(
      'no new email: the newest Agents Activity email (2026-10-08) holds 2026-10-05..2026-10-05, not 2026-10-07'
    )
    expect(env.tables.prod_intervals || []).toHaveLength(0)
  })

  it('throws and writes nothing when the email has no readable row', async () => {
    const env = stubEnv({ now: NOW, rosterRows: ROSTER, gmail: mail('garbage,more\ncolumns,only', 'm2') })
    await expect(prodSnapshotIntervals_(env)).rejects.toThrow(/has no readable row/)
    expect(env.tables.prod_intervals || []).toHaveLength(0)
    expect(env.lastMail()).toEqual({})
  })

  it('imports the newest email, replacing its dates and stamping prod_last_mail', async () => {
    const seeded = [
      { interval_key: 'old1', date: '2026-10-07', agent_email: 'ahmed@dabdoob.com', status: 'IDLE' },
      { interval_key: 'keep1', date: '2026-10-04', agent_email: 'ahmed@dabdoob.com', status: 'IDLE' },
    ]
    const env = stubEnv({
      now: NOW,
      rosterRows: ROSTER,
      gmail: mail(CSV_1007),
      tables: { prod_intervals: seeded.slice() },
    })
    const r = await prodSnapshotIntervals_(env)
    expect(r.dates).toEqual(['2026-10-07'])
    expect(r.rowsOut).toBe(2)
    expect(r.note).toContain('Email of 2026-10-08')
    const intervals = env.tables.prod_intervals
    expect(intervals).toHaveLength(3) // kept 10-04 row + 2 new rows; the old 10-07 row is replaced
    expect(intervals.filter((x) => x.interval_key === 'old1')).toHaveLength(0)
    expect(intervals.filter((x) => x.interval_key === 'keep1')).toHaveLength(1)
    const rows = intervals.filter((x) => x.date === '2026-10-07')
    expect(rows.every((x) => x.agent_email === 'ahmed@dabdoob.com' && x.source === 'email')).toBe(true)
    expect(env.lastMail()).toMatchObject({ id: 'm1', ms: MAIL_MS, dates: ['2026-10-07'] })

    // A second run with the same email is a skip, not a duplicate import.
    const r2 = await prodSnapshotIntervals_(env)
    expect(r2.skipped).toContain('was imported at')
    expect(env.tables.prod_intervals).toHaveLength(3)
  })

  it('an email holding multiple dates replaces each of them', async () => {
    const csv = activityCsv([
      ['Ahmed A', 'Available', '2026-10-06 09:00:00', '2026-10-06 09:10:00'],
      ['Ahmed A', 'Available', '2026-10-07 09:00:00', '2026-10-07 09:10:00'],
    ])
    const env = stubEnv({ now: NOW, rosterRows: ROSTER, gmail: mail(csv) })
    const r = await prodSnapshotIntervals_(env)
    expect(r.dates).toEqual(['2026-10-06', '2026-10-07'])
    expect(env.tables.prod_intervals).toHaveLength(2)
  })
})
