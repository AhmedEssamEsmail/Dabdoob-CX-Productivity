/**
 * jobQuarterlyReport semantics: runs only in the month after a completed
 * quarter, reads quarterly_report_recipients, stores the report in
 * prod_quarterly_reports and sends it through the mail seam (dry-run safe).
 */
import { describe, expect, it } from 'vitest'
import { jobQuarterlyReport } from '@/features/cx-productivity/jobs/quarterly'
import { stubEnv } from './helpers'

// '2026-10-08T10:00:00Z' -> October 2026 -> Q3 2026 report.
const OCT = Date.parse('2026-10-08T10:00:00Z')
const NOV = Date.parse('2026-11-08T10:00:00Z')
const JAN = Date.parse('2027-01-08T10:00:00Z')

const ANALYTICS = [
  { date: '2026-07-05', agent_email: 'a@dabdoob.com', total_flags: 4, auto_accepted: 3, total_flagged_min: 30 },
  { date: '2026-08-20', agent_email: 'a@dabdoob.com', total_flags: 2, auto_accepted: 1, total_flagged_min: 12 },
  { date: '2026-09-30', agent_email: 'b@dabdoob.com', total_flags: 1, auto_accepted: 0, total_flagged_min: 5 },
  { date: '2026-10-02', agent_email: 'a@dabdoob.com', total_flags: 9, auto_accepted: 9, total_flagged_min: 40 }, // outside Q3
]

describe('jobQuarterlyReport', () => {
  it('does nothing outside a quarter-start month', async () => {
    const env = stubEnv({ now: NOV, cfg: { quarterly_report_recipients: 'a@dabdoob.com' }, tables: { prod_flag_analytics: ANALYTICS.slice() } })
    const r = await jobQuarterlyReport(env)
    expect(r).toEqual({ skipped: 'not a quarter-start month' })
    expect(env.tables.prod_quarterly_reports || []).toHaveLength(0)
    expect(env.sentMail).toHaveLength(0)
  })

  it('skips with the exact string when no recipients are configured', async () => {
    const env = stubEnv({ now: OCT, cfg: { quarterly_report_recipients: '' }, tables: { prod_flag_analytics: ANALYTICS.slice() } })
    const r = await jobQuarterlyReport(env)
    expect(r).toEqual({ skipped: 'No recipients configured' })
    expect(env.tables.prod_quarterly_reports || []).toHaveLength(0)
  })

  it('aggregates the completed quarter, stores the report and mails the recipients', async () => {
    const env = stubEnv({
      now: OCT,
      cfg: { quarterly_report_recipients: 'a@dabdoob.com, b@dabdoob.com' },
      tables: { prod_flag_analytics: ANALYTICS.slice() },
    })
    const r = await jobQuarterlyReport(env)
    expect(r.sent).toBe(2)
    // The stored report covers Q3 only (the 2026-10-02 row is excluded).
    const stored = env.tables.prod_quarterly_reports
    expect(stored).toHaveLength(1)
    expect(stored[0].quarter).toBe(3)
    expect(stored[0].year).toBe(2026)
    expect(stored[0].start_date).toBe('2026-07-01')
    expect(stored[0].end_date).toBe('2026-09-30')
    const report = JSON.parse(String(stored[0].report_json))
    expect(report.summary).toEqual({ totalFlags: 7, totalAutoAccepted: 4, totalMinutesCorrected: 47, uniqueAgents: 2 })
    expect(report.byAgent['a@dabdoob.com']).toEqual({ totalFlags: 6, autoAccepted: 4, minutesCorrected: 42 })
    // Mailed each recipient with the legacy subject (recipient strings are not trimmed —
    // the legacy split(',').map(String).filter(String) keeps them verbatim).
    expect(env.sentMail.map((m) => m.to)).toEqual(['a@dabdoob.com', ' b@dabdoob.com'])
    expect(env.sentMail[0].subject).toBe('Productivity Flag Report - Q3 2026')
    expect(env.sentMail[0].htmlBody).toContain('2026-07-01 to 2026-09-30')
    // The successful run is refresh-logged.
    expect(env.refreshLog.some((x) => x.job === 'quarterly_report' && x.status === 'ok')).toBe(true)
  })

  it('a dry-run send still logs and counts the recipients (mail seam reports status)', async () => {
    const env = stubEnv({
      now: OCT,
      cfg: { quarterly_report_recipients: 'a@dabdoob.com' },
      tables: { prod_flag_analytics: ANALYTICS.slice() },
    })
    env.sendMailStatus = 'dry_run'
    const r = await jobQuarterlyReport(env)
    expect(r.sent).toBe(1)
    expect(env.sentMail[0].status).toBe('dry_run')
    expect(env.tables.prod_quarterly_reports).toHaveLength(1)
  })

  it('a send failure is refresh-logged and rethrown', async () => {
    const env = stubEnv({
      now: OCT,
      cfg: { quarterly_report_recipients: 'a@dabdoob.com, b@dabdoob.com' },
      tables: { prod_flag_analytics: ANALYTICS.slice() },
    })
    env.sendMail = async () => ({ status: 'failed', error: 'SMTP exploded' }) as never
    await expect(jobQuarterlyReport(env)).rejects.toThrow('SMTP exploded')
    expect(env.refreshLog.some((x) => x.job === 'quarterly_report' && x.status === 'error')).toBe(true)
  })

  it('January reports Q4 of the previous year', async () => {
    const env = stubEnv({
      now: JAN,
      cfg: { quarterly_report_recipients: 'a@dabdoob.com' },
      tables: { prod_flag_analytics: [{ date: '2026-11-15', agent_email: 'a@dabdoob.com', total_flags: 3, auto_accepted: 2, total_flagged_min: 18 }] },
    })
    const r = await jobQuarterlyReport(env)
    expect(r.sent).toBe(1)
    const stored = env.tables.prod_quarterly_reports
    expect(stored[0].quarter).toBe(4)
    expect(stored[0].year).toBe(2026)
    expect(stored[0].start_date).toBe('2026-10-01')
    expect(stored[0].end_date).toBe('2026-12-31')
  })
})
