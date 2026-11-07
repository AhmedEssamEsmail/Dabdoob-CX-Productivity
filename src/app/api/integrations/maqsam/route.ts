import { NextResponse } from 'next/server'
import { configAll } from '@/features/shared/platform/settings'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { syncAllMirrors } from '@/features/shared/jobs/mirrors'
import { apiError } from '@/features/shared/lib/api-error'

export const maxDuration = 300

/**
 * POST /api/integrations/maqsam — pull calls from the Maqsam API into the
 * maqsam_calls mirror (incremental; {full:true} re-pulls the monthsBack window).
 * Caller: cron or ops — same Bearer CRON_SECRET convention as the other jobs.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // WP-42: sessioned callers are gated too (admin / not-in-View-as) — the same
    // requireJobCaller convention the /api/cron/* routes carry.
    await requireJobCaller()
    const body = (await req.json().catch(() => ({}))) as { full?: boolean; monthsBack?: number }
    const cfg = await configAll()
    const results = await syncAllMirrors(cfg, { tables: ['maqsam_calls'], full: !!body.full, monthsBack: body.monthsBack })
    const r = results['maqsam_calls']
    return NextResponse.json({ ok: !('error' in r), results }, { status: 'error' in r ? 503 : 200 })
  } catch (e) {
    return apiError(e)
  }
}
