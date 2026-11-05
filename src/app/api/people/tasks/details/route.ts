import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksEditDetails } from '@/features/cx-people/lib/tasks'

/** tasksEditDetails: title/description/priority/estimate edits. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await tasksEditDetails(String(body.actionId || ''), body))
  } catch (e) {
    return apiError(e)
  }
}
