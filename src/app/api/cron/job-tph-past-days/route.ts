import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { jobTphPastDays } from '@/features/cx-productivity/jobs/tph'

export const maxDuration = 300

/**
 * jobTphPastDays ported: rebuilds stale (older than 6 h) or missing touches,
 * rebuilt cases and calls for yesterday plus the two days before it, until the
 * 270 s time guard trips. Every step/day outcome is refresh-logged; a failed
 * step does not stop the run.
 */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    await requireJobCaller()
    const env = await buildJobEnv()
    const out = await jobTphPastDays(env)
    return NextResponse.json(out || {})
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
