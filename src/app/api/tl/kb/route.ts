import { NextResponse } from 'next/server'
import { kbTrackerPage, kbTrackerSave } from '@/features/cx-desk/lib/tlperformance'
import { apiError } from '@/features/shared/lib/api-error'

/** kbTrackerPage (GET) / kbTrackerSave (POST, { id?, topic, requestedAt, doneAt, accurate, ownerEmail, note }). */
export async function GET() {
  try {
    return NextResponse.json(await kbTrackerPage())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await kbTrackerSave(body as Parameters<typeof kbTrackerSave>[0]))
  } catch (e) {
    return apiError(e)
  }
}
