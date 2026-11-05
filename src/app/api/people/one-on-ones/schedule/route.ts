import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesSchedule, oneOnOnesReschedule, oneOnOnesMarkNotHeld } from '@/features/cx-people/lib/one-on-ones'

/**
 * oneOnOnesSchedule / oneOnOnesReschedule / oneOnOnesMarkNotHeld — the booking
 * writes. op: 'book' | 'reschedule' | 'not_held'.
 */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const op = String(body.op || 'book')
    if (op === 'reschedule') {
      return NextResponse.json(
        await oneOnOnesReschedule(String(body.scheduleId || ''), body.when, String(body.reason || '')),
      )
    }
    if (op === 'not_held') {
      return NextResponse.json(
        await oneOnOnesMarkNotHeld(String(body.scheduleId || ''), String(body.reason || ''), body.newWhen),
      )
    }
    return NextResponse.json(await oneOnOnesSchedule(String(body.reportEmail || ''), body.when, body.durationMin))
  } catch (e) {
    return apiError(e)
  }
}
