import { NextResponse } from 'next/server'
import { requireRole } from '@/features/shared/platform/identity'
import { apiError } from '@/features/shared/lib/api-error'
import { getQueueCheckins, submitQueueCheckin } from '@/features/cx-queue/lib/server'

/**
 * GET /api/queue/checkins?date=yyyy-MM-dd — { date, slots, submissions } for one
 * business date (default: today in business_tz). Slots carry dqSlotState_.
 *
 * POST — one submission per (slot_date, slot) on queue_submissions:
 *   { slot_date, slot, status, snapshot_key?, queues_json?, corrections_json?,
 *     correction_reason?, general_note?, help_needed?, help_note? }
 * A resubmission updates the stored row in place (updated_* stamped).
 */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await getQueueCheckins(searchParams.get('date')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    return NextResponse.json(await submitQueueCheckin(body, user.email))
  } catch (e) {
    return apiError(e)
  }
}
