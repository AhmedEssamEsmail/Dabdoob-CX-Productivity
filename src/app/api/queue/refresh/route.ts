/* POST /api/queue/refresh — refreshQueueViaHub/refreshQueueNow (throttled 120 s). */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { refreshQueueNow } from '@/features/cx-queue/lib/pages'

export async function POST() {
  try {
    return NextResponse.json(await refreshQueueNow())
  } catch (e) {
    return apiError(e)
  }
}
