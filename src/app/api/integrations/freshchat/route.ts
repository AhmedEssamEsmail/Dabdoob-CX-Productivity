import { NextResponse } from 'next/server'
import { configAll } from '@/features/shared/platform/settings'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { syncAllMirrors } from '@/features/shared/jobs/mirrors'
import { apiError } from '@/features/shared/lib/api-error'

export const maxDuration = 300

/**
 * POST /api/integrations/freshchat — pull conversations from the Freshchat API
 * into the freshchat mirror (incremental; {full:true} pages the whole history).
 * Caller: cron or ops — same Bearer CRON_SECRET convention as the other jobs.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    // WP-42: sessioned callers are gated too (admin / not-in-View-as) — the same
    // requireJobCaller convention the /api/cron/* routes carry.
    await requireJobCaller()
    const body = (await req.json().catch(() => ({}))) as { full?: boolean }
    const cfg = await configAll()
    const results = await syncAllMirrors(cfg, { tables: ['freshchat'], full: !!body.full })
    const r = results['freshchat']
    return NextResponse.json({ ok: !('error' in r), results }, { status: 'error' in r ? 503 : 200 })
  } catch (e) {
    return apiError(e)
  }
}
