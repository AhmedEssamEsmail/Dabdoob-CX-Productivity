/* GET /api/queue/analytics — QueuePages.js getAnalyticsPage verbatim via the port. */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getAnalyticsPage } from '@/features/cx-queue/lib/pages'

export async function GET() {
  try {
    return NextResponse.json(await getAnalyticsPage())
  } catch (e) {
    return apiError(e)
  }
}
