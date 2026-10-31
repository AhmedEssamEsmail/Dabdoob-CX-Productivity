import { NextResponse } from 'next/server'
import { dqAddDays_ } from '@/lib/prod/adapters'
import { prodToday_ } from '@/lib/prod/engine'
import { requireJobCaller } from '@/lib/platform/identity'
import { buildJobEnv } from '@/lib/jobs/env'
import { prodFlagAnalyticsStep_ } from '@/lib/jobs/productivity'
import { dqStep_ } from '@/lib/jobs/steps'

export const maxDuration = 120

/**
 * Flag analytics, now the shared 'prod_flag_analytics' step of the daily chain:
 * prodAggregateFlags_ over yesterday (business_tz) — per agent: total flags,
 * auto-accepted count, flagged minutes, avg cases per flag and the most common
 * raw / suggested statuses, upserted on (date, agent_email).
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
