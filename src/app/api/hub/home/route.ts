/* GET /api/hub/home — getHomePage (Aggregates.js): the Hub home payload. */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getHomePage } from '@/features/cx-hub/lib/aggregates'

export async function GET() {
  try {
    return NextResponse.json(await getHomePage())
  } catch (e) {
    return apiError(e)
  }
}
