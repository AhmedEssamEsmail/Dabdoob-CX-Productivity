import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesStart } from '@/features/cx-people/lib/one-on-ones-page'

/** oneOnOnesStart: the 1:1 opener payload (carried actions, topics, context). */
export async function GET(req: Request) {
  try {
    const reportEmail = new URL(req.url).searchParams.get('reportEmail') || ''
    return NextResponse.json(await oneOnOnesStart(reportEmail))
  } catch (e) {
    return apiError(e)
  }
}
