import { NextResponse } from 'next/server'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { prodFlagAnalyticsStep_ } from '@/features/cx-productivity/jobs/productivity'
import { dqStep_ } from '@/features/shared/jobs/steps'

export const maxDuration = 120

/**
 * Flag analytics, now the shared 'prod_flag_analytics' step of the daily chain:
 * prodAggregateFlags_ over yesterday (business_tz) — per agent: total flags,
 * auto-accepted count, flagged minutes, avg cases per flag and the most common
 * raw / suggested statuses, upserted on (date, agent_email).
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
    try {
      const yesterday = dqAddDays_(prodToday_(env.cfg), -1)
      const total = await dqStep_(env, 'prod_flag_analytics', () => prodFlagAnalyticsStep_(env, [yesterday]))
      if (total === null) return NextResponse.json({ error: 'Analytics aggregation failed' }, { status: 500 })
      if (!total) return NextResponse.json({ message: 'No flags to aggregate' })
      return NextResponse.json({
        message: 'Analytics aggregation completed',
        agents_processed: total,
      })
    } finally {
      await env.hbFlush()
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
