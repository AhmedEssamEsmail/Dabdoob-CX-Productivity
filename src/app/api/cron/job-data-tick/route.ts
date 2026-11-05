/**
 * Cron: jobDataTick (Aggregates.js) — every 15 min. Freshdesk delta sync,
 * queue + aging rebuild, hourly inflow, check-in snapshots.
 * Auth matches the other cron routes: Bearer CRON_SECRET, no session, or an admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { jobDataTick } from '@/features/cx-queue/lib/jobs'

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev/no-secret mode: requireJobCaller still gates the caller
  return req.headers.get('authorization') === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await jobDataTick())
  } catch (e) {
    return apiError(e)
  }
}

export const POST = GET
