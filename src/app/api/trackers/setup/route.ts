import { NextResponse } from 'next/server'
import { setupTrackers } from '@/features/cx-operations/lib/trackers'
import { apiError } from '@/features/shared/lib/api-error'

/** setupTrackers (admin): seeds dropdown choices from existing column values. */
export async function POST() {
  try {
    return NextResponse.json({ report: await setupTrackers() })
  } catch (e) {
    return apiError(e)
  }
}
