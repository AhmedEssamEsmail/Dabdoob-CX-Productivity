import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getOpenAgingFlags } from '@/features/cx-queue/lib/server'
import { agingFlagTicket, agingResolveFlag } from '@/features/cx-queue/lib/pages'

/**
 * GET /api/queue/aging-flags — dqOpenAgingFlags_ on dq_aging_flags joined to
 * the aging board (aging_open_tickets) when that store exists; flags only,
 * `aging:'unavailable'`, when it does not.
 *
 * POST — the AgingHelp.js pair, verbatim (roles are enforced inside the fns):
 *   { ticket_id|ticketId, note }        agingFlagTicket — admin/tl/agent
 *   { flag_id|flagId, resolved_note? }  agingResolveFlag — admin/tl
 */
export async function GET() {
  try {
    return NextResponse.json(await getOpenAgingFlags())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    const flagId = body.flag_id ?? body.flagId
    const out =
      flagId !== undefined && flagId !== null && String(flagId) !== ''
        ? await agingResolveFlag(flagId, body.resolved_note ?? body.resolvedNote ?? '')
        : await agingFlagTicket(body.ticket_id ?? body.ticketId, body.note)
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
