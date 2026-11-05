import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksPreview } from '@/features/cx-people/lib/tasks'

/** tasksPreview: does the task fit the owner's shift hours in the window? */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(
      await tasksPreview(String(body.ownerEmail || ''), body.startAt, body.deadlineAt, body.estHours),
    )
  } catch (e) {
    return apiError(e)
  }
}
