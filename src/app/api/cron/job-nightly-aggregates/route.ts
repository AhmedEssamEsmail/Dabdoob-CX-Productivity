/**
 * Cron: jobNightlyAggregates (Aggregates.js) — daily ~09:30 Kuwait. Agent
 * aggregates, inflow incl. hourly, year rollover.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { jobNightlyAggregates } from '@/features/cx-queue/lib/jobs'

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production
  return req.headers.get('authorization') === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    return NextResponse.json(await jobNightlyAggregates())
  } catch (e) {
    return apiError(e)
  }
}

export const POST = GET
