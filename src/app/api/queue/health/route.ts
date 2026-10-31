import { NextResponse } from 'next/server'
import { getQueueHealthPage } from '@/lib/queue/server'
import { apiError } from '@/lib/api-error'

/**
 * GET /api/queue/health — QueueCore.js getQueueHealthPage() verbatim on the
 * Postgres stores (agg_queue_now / agg_snapshots_today / queue_submissions /
 * refresh_log / config). admin + tl. A missing snapshot store yields
 * snaps={latest:null,prev:{},series:[]} and `snapshots:'unavailable'`.
 */
export async function GET() {
  try {
    return NextResponse.json(await getQueueHealthPage())
  } catch (e) {
    return apiError(e)
  }
}
