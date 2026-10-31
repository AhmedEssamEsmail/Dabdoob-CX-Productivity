import { NextResponse } from 'next/server'
import { dqAddDays_ } from '@/lib/prod/adapters'
import { prodReady_, prodToday_ } from '@/lib/prod/engine'
import { requireJobCaller } from '@/lib/platform/identity'
import { buildJobEnv } from '@/lib/jobs/env'
import { prodComputeStep_ } from '@/lib/jobs/productivity'
import { dqStep_ } from '@/lib/jobs/steps'

export const maxDuration = 300

/**
 * Daily productivity layers, now the shared 'productivity' step of the daily
 * chain: prodComputeDates_ over yesterday plus every date queued in
 * config.prod_dirty_dates (a TL decision marks its date), recomputing the raw
 * and effective prod_daily_layers rows and the effective rollup. The dirty
 * queue is cleared once taken. Heartbeat-stamps 'productivity'.
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
      const res = await dqStep_(env, 'productivity', async () => {
        const yesterday = dqAddDays_(prodToday_(env.cfg), -1)
        const dirty = prodReady_(env.cfg) ? env.takeDirty() : []
        const dates = [...new Set([yesterday, ...dirty])].sort()
        const n = await prodComputeStep_(env, dates)
        return { n, dates, dirtyCount: dirty.length }
      })
      if (!res) return NextResponse.json({ error: 'Daily layers failed' }, { status: 500 })
      return NextResponse.json({
        message: 'Effective productivity layers recomputed',
        dates_processed: res.dates.length,
        dirty_dates_cleared: res.dirtyCount,
        layers_written: res.n,
      })
    } finally {
      await env.hbFlush()
    }
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Daily layers failed' },
      { status: 500 }
    )
  }
}
