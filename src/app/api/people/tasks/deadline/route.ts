import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksSetDeadline } from '@/features/cx-people/lib/tasks'

/** tasksSetDeadline: deadline change (a reason is required). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(
      await tasksSetDeadline(String(body.actionId || ''), body.deadlineAt, String(body.reason || '')),
    )
  } catch (e) {
    return apiError(e)
  }
}
