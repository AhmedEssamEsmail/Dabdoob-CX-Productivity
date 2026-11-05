import { NextResponse } from 'next/server'
import { getTrackersPage, createTracker } from '@/features/cx-operations/lib/trackers'
import { apiError } from '@/features/shared/lib/api-error'

/** getTrackersPage: the tracker list + the chosen (or first) tracker's data. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await getTrackersPage(searchParams.get('t') || ''))
  } catch (e) {
    return apiError(e)
  }
}

/** createTracker: { name, fields[] } — a new native tracker. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { name?: string; fields?: Record<string, unknown>[] }
    return NextResponse.json(await createTracker(body))
  } catch (e) {
    return apiError(e)
  }
}
