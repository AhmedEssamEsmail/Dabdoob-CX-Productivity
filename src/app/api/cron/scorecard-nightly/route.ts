import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { dqStep_ } from '@/features/shared/jobs/steps'
import { sheetCreds } from '@/features/shared/jobs/sheets'
import { scNightly_ } from '@/features/cx-people/lib/scorecard-server'

export const maxDuration = 300

/**
 * PeopleTriggers.js jobScorecardNightly (heartbeat job 'scorecard', already
 * planned in HB_PLAN): scNightly_ refreshes this month's scorecard workbook —
 * and last month's on days 1-3 — into sc_daily / sc_behaviour / sc_months.
 * The workbook read needs the Google Sheets service account; with no creds
 * the run degrades honestly ({ configured:false, skipped }) instead of
 * writing error rows for a read that could never succeed.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await requireJobCaller()
    const env = await buildJobEnv()
    try {
      const res = await dqStep_(env, 'scorecard', async () => {
        if (!sheetCreds()) {
          return {
            configured: false,
            skipped:
              'Google Sheets credentials are not configured (GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY).',
            months: [],
          }
        }
        return { configured: true, months: await scNightly_() }
      })
      if (!res) return NextResponse.json({ error: 'Job failed' }, { status: 500 })
      return NextResponse.json(res)
    } finally {
      await env.hbFlush()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
