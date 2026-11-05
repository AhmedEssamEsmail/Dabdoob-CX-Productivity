import { NextResponse } from 'next/server'
import { requireAdminCaller } from '@/features/shared/lib/admin-auth'
import { apiError } from '@/features/shared/lib/api-error'
import { configAll } from '@/features/shared/platform/settings'
import { backfillDefaults, runBackfill, BACKFILL_KINDS, type BackfillCursor } from '@/features/cx-productivity/jobs/backfill'

export const maxDuration = 300

/**
 * POST /api/admin/backfill — chunked, resumable historical recompute (spec 03).
 *   { from?, to?, kinds?, cursor?, force?, budgetMs? }
 * Defaults: from '2026-07-01', to yesterday (business tz), all kinds,
 * 240s budget. The response carries `next`; call again with that cursor until
 * next is null. `force` recomputes dates that already have outputs.
 */
export async function POST(req: Request) {
  try {
    await requireAdminCaller(req)
    const body = (await req.json().catch(() => ({}))) as {
      from?: string
      to?: string
      kinds?: string[]
      cursor?: BackfillCursor
      force?: boolean
      budgetMs?: number
    }
    const cfg = await configAll()
    const dflt = backfillDefaults(cfg)
    const kinds = (body.kinds || BACKFILL_KINDS) as typeof BACKFILL_KINDS
    for (const k of kinds) {
      if (!BACKFILL_KINDS.includes(k))
        return NextResponse.json({ error: `Unknown kind '${k}'. Use: ${BACKFILL_KINDS.join(', ')}.` }, { status: 400 })
    }
    const result = await runBackfill({
      from: body.from || dflt.from,
      to: body.to || dflt.to,
      kinds,
      cursor: body.cursor || null,
      force: !!body.force,
      budgetMs: body.budgetMs,
    })
    return NextResponse.json(result)
  } catch (e) {
    return apiError(e)
  }
}
