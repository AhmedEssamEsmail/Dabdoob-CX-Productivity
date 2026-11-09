import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { jobProductivityDaily } from '@/features/cx-productivity/jobs/productivity'

export const maxDuration = 300

/**
 * jobProductivityDaily ported: Agents Activity email import -> flag detection
 * (auto-accept in manual mode) -> flag analytics -> daily productivity layers
 * -> TPH touches/calls/cases for yesterday and the day before. Each step is
 * heartbeat-stamped and refresh-logged; a step's failure does not stop the rest.
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
    const out = await jobProductivityDaily(env)
    return NextResponse.json(out)
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
