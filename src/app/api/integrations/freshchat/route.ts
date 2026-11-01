import { NextResponse } from 'next/server'
import { configAll } from '@/lib/platform/settings'
import { syncAllMirrors } from '@/lib/jobs/mirrors'
import { apiError } from '@/lib/api-error'

export const maxDuration = 300

/**
 * POST /api/integrations/freshchat — pull conversations from the Freshchat API
 * into the freshchat mirror (incremental; {full:true} pages the whole history).
 * Caller: cron or ops — same Bearer CRON_SECRET convention as the other jobs.
 */
export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  try {
    const body = (await req.json().catch(() => ({}))) as { full?: boolean }
    const cfg = await configAll()
    const results = await syncAllMirrors(cfg, { tables: ['freshchat'], full: !!body.full })
    const r = results['freshchat']
    return NextResponse.json({ ok: !('error' in r), results }, { status: 'error' in r ? 503 : 200 })
  } catch (e) {
    return apiError(e)
  }
}
