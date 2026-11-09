import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { dqStep_ } from '@/features/shared/jobs/steps'
import { runOneOnOneReminders_ } from '@/features/cx-people/lib/one-on-one-reminders'

export const maxDuration = 120

/** PeopleTriggers.js job (oo_reminders), Kuwait-scheduled by the platform cron. */
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
      const res = await dqStep_(env, 'oo_reminders', () => runOneOnOneReminders_())
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
