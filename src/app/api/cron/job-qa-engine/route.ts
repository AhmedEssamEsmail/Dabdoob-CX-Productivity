/**
 * Cron: jobQaQueue (Quality.js) — build the day's sample when the live engine
 * is on (qeBuildQueue_ 'day'), then import the Queue Log into qa_queue, then
 * CTL reminders. Auth matches the other cron routes: Bearer CRON_SECRET, no
 * session, or an admin.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { qaQueueStep_, qaCtlReminders, qaReconcileQueueLog } from '@/features/cx-quality/lib/server'

function cronOk(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET
  if (!secret) return true // dev/no-secret mode: the server layer still role-gates
  return req.headers.get('authorization') === 'Bearer ' + secret
}

export async function GET(req: NextRequest) {
  try {
    if (!cronOk(req)) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const out: Record<string, unknown> = {}
    out.import = await qaQueueStep_('cron:qa-engine')
    try {
      out.reconcile = await qaReconcileQueueLog()
    } catch (e) {
      out.reconcile = { skipped: (e as Error)?.message || String(e) }
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
