import { NextResponse, type NextRequest } from 'next/server'
import { jobMailDesk } from '@/features/cx-desk/lib/maildesk'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { apiError } from '@/features/shared/lib/api-error'

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
  return req.headers.get('authorization') === 'Bearer ' + secret
}

/** jobMailDesk — the 10-minute cron (was installDeskTriggers' time-driven trigger). */
export async function POST(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    await requireJobCaller()
    return NextResponse.json(await jobMailDesk())
  } catch (e) {
    return apiError(e)
  }
}
