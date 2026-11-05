import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { jobTphHourly } from '@/features/cx-productivity/jobs/tph'

export const maxDuration = 60

/**
 * jobTphHourly ported: folds the fresh agg_queue_now numbers into today's
 * 'auto' prod_tph_cases row (first capture of an hour records stock + starting
 * created; later ones update the latest created count). TL 'tl' rows are
 * never touched.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireJobCaller()
    const env = await buildJobEnv()
    const out = await jobTphHourly(env)
    return NextResponse.json(out || {})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
