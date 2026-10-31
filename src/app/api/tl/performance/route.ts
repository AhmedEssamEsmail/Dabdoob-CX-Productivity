import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { apiError, InputError } from '@/lib/api-error'
import { getTlPerformance } from '@/lib/queue/server'
import { dqDateKey_, normEmail_ } from '@/lib/prod/adapters'
import { configAll } from '@/lib/platform/settings'
import type { Cfg } from '@/lib/prod/adapters'

/**
 * GET /api/tl/performance?tl_email=&month= — the TlSnapshots.js snapshot rows for
 * one TL and month: tlp_team (month row), tlp_area_metrics (overlapping range),
 * tlp_queue_daily and tlp_shifts (tlsShifts_), plus the reader outputs the pages
 * compute (onShift/onQueue/mailDue at now). The page-level function itself lived
 * in TlPerformance.js / TlQueue.js (absent from the bundle), so the response is
 * the raw rows per table — nothing is invented.
 * TLs read their own; admins anyone's.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    const cfg = (await configAll()) as Cfg
    const today = dqDateKey_(new Date(), cfg)
    const tlEmail = normEmail_(searchParams.get('tl_email') || searchParams.get('tlEmail')) || user.email
    if (user.role === 'tl' && tlEmail !== user.email) {
      throw new InputError('TLs can only read their own performance.', 403)
    }
    const month = (searchParams.get('month') || today.slice(0, 7)).slice(0, 7)
    return NextResponse.json(await getTlPerformance(tlEmail, month))
  } catch (e) {
    return apiError(e)
  }
}
