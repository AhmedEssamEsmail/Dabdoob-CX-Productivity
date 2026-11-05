/**
 * /api/queue/checkins-page — QueuePages.js getCheckinsPage / submitCheckin
 * verbatim via the port. ?slot= picks an earlier open slot.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getCheckinsPage, submitCheckin } from '@/features/cx-queue/lib/pages'

export async function GET(req: NextRequest) {
  try {
    return NextResponse.json(await getCheckinsPage(req.nextUrl.searchParams.get('slot')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    return NextResponse.json(await submitCheckin(await req.json()))
  } catch (e) {
    return apiError(e)
  }
}
