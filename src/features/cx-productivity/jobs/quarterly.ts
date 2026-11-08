/**
 * Quarterly report ports (ProductivityApp.js Enhancement 2): generates the
 * flag-analytics quarter report into prod_quarterly_reports and emails it to
 * quarterly_report_recipients. Legacy globals -> JobEnv seams; MailApp.sendEmail
 * -> platform sendMail (a 'failed' result throws, like MailApp did).
 */

import 'server-only'

import { dqSetting_, formatDate_ } from '@/features/shared/lib/adapters'
import type { JobEnv, Row } from '@/features/shared/jobs/env'

const QUARTER_START: Record<string, string> = { Q1: '-01-01', Q2: '-04-01', Q3: '-07-01', Q4: '-10-01' }
const QUARTER_END: Record<string, string> = { Q1: '-03-31', Q2: '-06-30', Q3: '-09-30', Q4: '-12-31' }

export interface QuarterlyReport {
  quarter: string
  year: number
  period: { start: string; end: string }
  summary: { totalFlags: number; totalAutoAccepted: number; totalMinutesCorrected: number; uniqueAgents: number }
  byAgent: Record<string, { totalFlags: number; autoAccepted: number; minutesCorrected: number }>
  skipped?: string
}

/**
 * prodQuarterlyReport_ verbatim (requireRole_ aside — the job caller check
 * happens at the route): the quarter's prod_flag_analytics rows -> a report
 * stored in prod_quarterly_reports. quarter is stored as its number
 * ('Q4' -> 4) because the column is integer.
 */
export function prodQuarterlyReport_(env: JobEnv, quarter: string, year: number): QuarterlyReport {
  const start = year + QUARTER_START[quarter]
  const end = year + QUARTER_END[quarter]
  const analytics = env.prodRows('prod_flag_analytics').filter((r) => String(r.date) >= start && String(r.date) <= end)

  const report: QuarterlyReport = {
    quarter,
    year,
    period: { start, end },
    summary: {
      totalFlags: analytics.reduce((s, r) => s + Number(r.total_flags), 0),
      totalAutoAccepted: analytics.reduce((s, r) => s + Number(r.auto_accepted), 0),
      totalMinutesCorrected: analytics.reduce((s, r) => s + Number(r.total_flagged_min), 0),
      uniqueAgents: Object.keys(
        analytics.reduce((m: Record<string, boolean>, r) => {
          m[String(r.agent_email)] = true
          return m
        }, {})
      ).length,
    },
    byAgent: {},
  }

  analytics.forEach((r) => {
    const e = String(r.agent_email)
    if (!report.byAgent[e]) report.byAgent[e] = { totalFlags: 0, autoAccepted: 0, minutesCorrected: 0 }
    report.byAgent[e].totalFlags += Number(r.total_flags)
    report.byAgent[e].autoAccepted += Number(r.auto_accepted)
    report.byAgent[e].minutesCorrected += Number(r.total_flagged_min)
  })

  const reportId = 'qr_' + year + '_' + quarter + '_' + Date.now().toString(36)
  env.append('prod_quarterly_reports', [
    {
      report_id: reportId,
      quarter: Number(quarter.slice(1)),
      year,
      start_date: start,
      end_date: end,
      report_json: JSON.stringify(report),
      created_at: new Date().toISOString(),
    } satisfies Row,
  ])
  return report
}

/** prodSendQuarterlyReport_ verbatim; sendMail 'failed' throws like MailApp did. */
export async function prodSendQuarterlyReport_(
  env: JobEnv,
  quarter: string,
  year: number,
  recipients: string[]
): Promise<{ sent: number; reportId: unknown }> {
  const report = prodQuarterlyReport_(env, quarter, year)

  const html =
    '<h2>Productivity Flag Report - ' +
    quarter +
    ' ' +
    year +
    '</h2>' +
    '<p>Period: ' +
    report.period.start +
    ' to ' +
    report.period.end +
    '</p>' +
    '<h3>Summary</h3>' +
    '<ul>' +
    '<li>Total Flags: ' +
    report.summary.totalFlags +
    '</li>' +
    '<li>Auto-Accepted: ' +
    report.summary.totalAutoAccepted +
    '</li>' +
    '<li>Minutes Corrected: ' +
    Math.round(report.summary.totalMinutesCorrected) +
    '</li>' +
    '<li>Unique Agents: ' +
    report.summary.uniqueAgents +
    '</li>' +
    '</ul>'

  for (const email of recipients) {
    const res = await env.sendMail(
      {
        to: email,
        subject: 'Productivity Flag Report - ' + quarter + ' ' + year,
        htmlBody: html,
        kind: 'quarterly_report',
        ref: quarter + '-' + year,
      },
      'system:trigger'
    )
    if (res.status === 'failed') throw new Error(res.error || 'sendMail failed')
  }
  return { sent: recipients.length, reportId: (report as unknown as Row).report_id }
}

/**
 * jobQuarterlyReport verbatim: runs on the first month after a completed
 * quarter (Jan -> Q4 prev year, Apr -> Q1, Jul -> Q2, Oct -> Q3), emails the
 * stored recipients, refresh-logs the outcome and rethrows failures.
 * The legacy date came from the script's project timezone; the business_tz
 * date is the same zone the rest of the app uses.
 */
export async function jobQuarterlyReport(env: JobEnv): Promise<{ skipped?: string; sent?: number; reportId?: unknown }> {
  const bizTz = String(dqSetting_(env.cfg, 'business_tz'))
  const now = env.nowMs === undefined ? new Date() : new Date(env.nowMs)
  const year = Number(formatDate_(now, bizTz, 'yyyy'))
  const month = Number(formatDate_(now, bizTz, 'MM'))

  let quarter = ''
  let reportYear = year
  if (month === 1) {
    quarter = 'Q4'
    reportYear = year - 1
  } else if (month === 4) quarter = 'Q1'
  else if (month === 7) quarter = 'Q2'
  else if (month === 10) quarter = 'Q3'
  else return { skipped: 'not a quarter-start month' }

  const recipients = String(dqSetting_(env.cfg, 'quarterly_report_recipients') || '')
    .split(',')
    .map(String)
    .filter(String)
  if (!recipients.length) return { skipped: 'No recipients configured' }

  try {
    const result = await prodSendQuarterlyReport_(env, quarter, reportYear, recipients)
    env.logRun('quarterly_report', Date.now(), 'ok', { quarter, year: reportYear, sent: result.sent })
    await env.flushWrites()
    return result
  } catch (e) {
    env.logRun('quarterly_report', Date.now(), 'error', { error: (e as Error)?.message || String(e) })
    await env.flushWrites().catch(() => {})
    throw e
  }
}
