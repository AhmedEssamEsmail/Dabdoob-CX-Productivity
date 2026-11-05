import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksSetStatus } from '@/features/cx-people/lib/tasks'

/** tasksSetStatus: task lifecycle write (blocked reason / delivery ref enforced inside). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(
      await tasksSetStatus(String(body.actionId || ''), String(body.status || ''), (body.info || {}) as Record<string, unknown>),
    )
  } catch (e) {
    return apiError(e)
  }
}
