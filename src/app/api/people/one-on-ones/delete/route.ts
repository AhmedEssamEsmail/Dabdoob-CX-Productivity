import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesDeletePreview, oneOnOnesDeleteLog, oneOnOnesDeleteBooking } from '@/features/cx-people/lib/one-on-ones-delete'

/** Admin-only: delete preview or soft-delete a log / booking. op: 'preview' | 'log' | 'booking'. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const op = String(body.op || 'preview')
    if (op === 'log') return NextResponse.json(await oneOnOnesDeleteLog(String(body.logId || ''), String(body.reason || '')))
    if (op === 'booking')
      return NextResponse.json(await oneOnOnesDeleteBooking(String(body.scheduleId || ''), String(body.reason || '')))
    return NextResponse.json(await oneOnOnesDeletePreview(String(body.logId || '')))
  } catch (e) {
    return apiError(e)
  }
}
