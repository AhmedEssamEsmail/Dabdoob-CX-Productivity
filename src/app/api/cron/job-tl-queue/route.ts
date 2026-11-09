/**
 * Cron: jobTlQueueMetrics (TlQueue.js) — daily TL queue metrics rebuild for
 * [yesterday, today] (Kuwait). Auth matches the other cron routes: Bearer CRON_SECRET,
 * no session, or an admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { jobTlQueueMetrics, rebuildTlQueueMetricsEntry } from '@/features/cx-queue/lib/tlqueue'

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
  return req.headers.get('authorization') === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // WP-42: the ?dates= rebuild path (rebuildTlQueueMetricsEntry) has no
    // internal requireJobCaller — gate it here like the sibling cron routes.
    await requireJobCaller()
    const dates = req.nextUrl.searchParams.get('dates')
    return NextResponse.json(dates ? await rebuildTlQueueMetricsEntry(dates.split(',')) : await jobTlQueueMetrics())
  } catch (e) {
    return apiError(e)
  }
}

export const POST = GET
