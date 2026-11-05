import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesGetLog } from '@/features/cx-people/lib/one-on-ones-page'

/** oneOnOnesGetLog: one saved record for the viewer (admin sees deleted too). */
export async function GET(req: Request) {
  try {
    const id = new URL(req.url).searchParams.get('logId') || ''
    return NextResponse.json(await oneOnOnesGetLog(id))
  } catch (e) {
    return apiError(e)
  }
}
