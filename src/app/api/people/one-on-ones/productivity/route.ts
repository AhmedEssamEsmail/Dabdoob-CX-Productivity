import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesProductivity } from '@/features/cx-people/lib/one-on-ones-page'

/** oneOnOnesProductivity: the productivity card for the 1:1 opener. */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams
    return NextResponse.json(
      await oneOnOnesProductivity(q.get('reportEmail') || '', q.get('from') || '', q.get('to') || ''),
    )
  } catch (e) {
    return apiError(e)
  }
}
