import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/lib/platform/identity'
import { buildJobEnv } from '@/lib/jobs/env'
import { jobQuarterlyReport } from '@/lib/jobs/quarterly'

export const maxDuration = 120

/**
 * jobQuarterlyReport ported: on the first month after a completed quarter
 * (Jan -> Q4 prev year, Apr -> Q1, Jul -> Q2, Oct -> Q3) aggregates the
 * quarter's prod_flag_analytics into prod_quarterly_reports and emails it to
 * quarterly_report_recipients. Skips otherwise and when no recipients are
 * configured; send failures are logged and rethrown.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireJobCaller()
    const env = await buildJobEnv()
    const out = await jobQuarterlyReport(env)
    return NextResponse.json(out || {})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
