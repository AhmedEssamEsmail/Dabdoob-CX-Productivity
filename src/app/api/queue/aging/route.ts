/* GET /api/queue/aging — QueuePages.js getAgingPage verbatim via the port. */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getAgingPage } from '@/features/cx-queue/lib/pages'

export async function GET() {
  try {
    return NextResponse.json(await getAgingPage())
  } catch (e) {
    return apiError(e)
  }
}
