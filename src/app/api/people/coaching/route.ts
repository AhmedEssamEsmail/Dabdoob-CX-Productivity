import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { coachingPage, coachingSignal } from '@/features/cx-people/lib/coaching'

/** coachingPage: people, topic library, and the signals the caller may see. */
export async function GET() {
  try {
    return NextResponse.json(await coachingPage())
  } catch (e) {
    return apiError(e)
  }
}

/** coachingSignal: a suggested 1:1 topic lands in people_signals (and a pop-up at the TL). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await coachingSignal(body))
  } catch (e) {
    return apiError(e)
  }
}
