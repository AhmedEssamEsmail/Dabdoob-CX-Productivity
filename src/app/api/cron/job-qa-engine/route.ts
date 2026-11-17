/**
 * Cron: jobQualityDaily + DB-only history steps (Quality.js) — build the
 * day's sample when the live engine is on (qeBuildQueue_ 'day'), then import
 * the Queue Log into qa_queue (qa_queue_import), reconcile the Queue Log
 * against qa_queue (DB-only — the Forms-history sheet import stays behind
 * the admin action), then CTL reminders (qa_ctl_reminders). Auth matches
 * the other cron routes: Bearer CRON_SECRET, no session, or an admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { requireJobCaller } from '@/features/shared/platform/identity'
import { qaQueueStep_, qaCtlReminders } from '@/features/cx-quality/lib/server'

export const maxDuration = 300

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return process.env.NODE_ENV !== 'production' // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
  return req.headers.get('authorization') === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    // WP-42: qaQueueStep_/qaCtlReminders carry no internal gate — the legacy
    // jobQualityDaily's requireJobCaller_ sits here, ahead of every step.
    await requireJobCaller()
    const out: Record<string, unknown> = {}
    out.import = await qaQueueStep_('cron:qa-engine')
    try {
      const { qaReconcileQueueLog_ } = await import('@/features/cx-quality/lib/migrate')
      out.history = await qaReconcileQueueLog_()
    } catch (e) {
      out.history = { skipped: (e as Error)?.message || String(e) }
    }
    try {
      out.ctlReminders = await qaCtlReminders()
    } catch (e) {
      out.ctlReminders = { error: (e as Error)?.message || String(e) }
    }
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}

export const POST = GET
