import { NextResponse } from 'next/server'
import { getTrackerRecords, addTrackerRecord } from '@/features/cx-operations/lib/trackers'
import { apiError } from '@/features/shared/lib/api-error'

/** getTrackerRecords: one tracker's records/fields/choices. */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await getTrackerRecords(String(searchParams.get('tracker') || '')))
  } catch (e) {
    return apiError(e)
  }
}

/** addTrackerRecord: { trackerId, values: { fieldId: text } }. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { trackerId?: string; values?: Record<string, unknown> }
    return NextResponse.json(await addTrackerRecord(String(body.trackerId || ''), body.values || {}))
  } catch (e) {
    return apiError(e)
  }
}
