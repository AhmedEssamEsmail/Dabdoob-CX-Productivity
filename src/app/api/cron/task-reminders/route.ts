import { NextResponse } from 'next/server'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { buildJobEnv } from '@/features/shared/jobs/env'
import { dqStep_ } from '@/features/shared/jobs/steps'
import { runTaskReminders_ } from '@/features/cx-people/lib/reminders'

export const maxDuration = 120

/** PeopleTriggers.js job (task_reminders), Kuwait-scheduled by the platform cron. */
export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    await requireJobCaller()
    const env = await buildJobEnv()
    try {
      const res = await dqStep_(env, 'task_reminders', () => runTaskReminders_())
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
