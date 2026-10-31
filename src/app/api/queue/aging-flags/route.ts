import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { apiError } from '@/lib/api-error'
import {
  flagAgingTicket,
  getOpenAgingFlags,
  resolveAgingFlag,
} from '@/lib/queue/server'

/**
 * GET /api/queue/aging-flags — dqOpenAgingFlags_ on dq_aging_flags joined to
 * the aging board (aging_open_tickets) when that store exists; flags only,
 * `aging:'unavailable'`, when it does not.
 *
 * POST — two actions, like the legacy page calls:
 *   { ticket_id, note?, tl_email? }                 create an open flag
 *   { flag_id|flagId, resolved_note? }              resolve an open flag
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
    const user = await requireRole(['admin', 'tl'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    const flagId = body.flag_id ?? body.flagId
    const row =
      flagId !== undefined && flagId !== null && String(flagId) !== ''
        ? await resolveAgingFlag(body, user.email)
        : await flagAgingTicket(body, user.email)
    return NextResponse.json(row)
  } catch (e) {
    return apiError(e)
  }
}
