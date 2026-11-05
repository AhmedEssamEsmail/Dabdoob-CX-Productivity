import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { tasksPage, tasksCreate } from '@/features/cx-people/lib/tasks'

/** tasksPage: the caller's task list (agents own; TLs their agents'; admin all). */
export async function GET() {
  try {
    return NextResponse.json(await tasksPage())
  } catch (e) {
    return apiError(e)
  }
}

/** tasksCreate: a new task (manager/admin assignment rules inside). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await tasksCreate(body))
  } catch (e) {
    return apiError(e)
  }
}
