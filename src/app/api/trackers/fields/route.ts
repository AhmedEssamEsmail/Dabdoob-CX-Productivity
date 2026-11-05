import { NextResponse } from 'next/server'
import { addTrackerField, updateTrackerField } from '@/features/cx-operations/lib/trackers'
import { apiError } from '@/features/shared/lib/api-error'

/** addTrackerField: { trackerId, def } — returns the tracker's fresh data. */
export async function POST(req: Request) {
  try {
    const body = (await req.json()) as { trackerId?: string; def?: Record<string, unknown> }
    return NextResponse.json(await addTrackerField(String(body.trackerId || ''), body.def || {}))
  } catch (e) {
    return apiError(e)
  }
}

/** updateTrackerField: { trackerId, fieldId, def }. */
export async function PATCH(req: Request) {
  try {
    const body = (await req.json()) as { trackerId?: string; fieldId?: string; def?: Record<string, unknown> }
    return NextResponse.json(await updateTrackerField(String(body.trackerId || ''), String(body.fieldId || ''), body.def || {}))
  } catch (e) {
    return apiError(e)
  }
}
