import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { jobQuarterlyReport } from '@/features/cx-productivity/jobs/quarterly'

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
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (authHeader !== `Bearer ${secret}`) {
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
