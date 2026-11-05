import { NextResponse } from 'next/server'
import { jobMailDesk } from '@/features/cx-desk/lib/maildesk'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { apiError } from '@/features/shared/lib/api-error'

/** jobMailDesk — the 10-minute cron (was installDeskTriggers' time-driven trigger). */
export async function POST(req: Request) {
  try {
    await requireJobCaller()
    return NextResponse.json(await jobMailDesk())
  } catch (e) {
    return apiError(e)
  }
}
