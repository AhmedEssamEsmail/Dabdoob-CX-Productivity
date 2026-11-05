import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksPostMilestone } from '@/features/cx-people/lib/tasks'

/** tasksPostMilestone: the owner posts a milestone update on their task. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await tasksPostMilestone(String(body.actionId || ''), body))
  } catch (e) {
    return apiError(e)
  }
}
