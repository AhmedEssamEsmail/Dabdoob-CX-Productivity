import { NextResponse } from 'next/server'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { prodFlagsStep_ } from '@/features/cx-productivity/jobs/productivity'
import { dqStep_ } from '@/features/shared/jobs/steps'

export const maxDuration = 120

/**
 * Flag detection, now the shared 'prod_flags' step of the daily chain:
 * prodDetectDates_ over yesterday (business_tz) — a new flag starts pending
 * with its due date (or is auto-accepted when prod_flag_auto_accept is on), a
 * pending flag found again is refreshed, a decided flag is never touched and a
 * pending flag no longer found becomes void. Heartbeat-stamps prod_flags.
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
      const yesterday = dqAddDays_(prodToday_(env.cfg), -1)
      const det = await dqStep_(env, 'prod_flags', () => prodFlagsStep_(env, [yesterday]))
      if (!det) return NextResponse.json({ error: 'Flag detection failed' }, { status: 500 })
      return NextResponse.json({
        message: 'Flag detection completed',
        intervals_processed: det.intervals || 0,
        flags_detected: det.added,
        flags_found: det.flagged,
        flags_voided: det.voided,
      })
    } finally {
      await env.hbFlush()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
