import { NextResponse } from 'next/server'
import { requireRole, pwDirectory, pwIsManagerOf } from '@/features/shared/platform/identity'
import { apiError, InputError } from '@/features/shared/lib/api-error'
import { kpiPayoutFor } from '@/features/cx-people/lib/kpi/server'
import { dqDateKey_, normEmail_ } from '@/features/shared/lib/adapters'
import { configAll } from '@/features/shared/platform/settings'
import type { Cfg } from '@/features/shared/lib/adapters'

/**
 * GET /api/kpi/payout?email=&month= — kpiPayout_ (KpiPayout.js) verbatim, its
 * inputs assembled the way WorkCore.js scDerive_ does: sc_daily when the
 * scorecard store exists, else prod_daily_layers (effective layer) + fcr_daily;
 * behaviour from kpi_behaviour_log, OL from kpi_ol_cases, leave ineligibility
 * from kpi_leave_log, probation month from roster.hiring_date.
 * Agents see only their own; TLs their reports'; admins anyone's.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl', 'agent'])
    const { searchParams } = new URL(req.url)
    const cfg = (await configAll()) as Cfg
    const today = dqDateKey_(new Date(), cfg)
    const email = normEmail_(searchParams.get('email')) || user.email
    const month = (searchParams.get('month') || today.slice(0, 7)).slice(0, 7)
    if (email !== user.email && user.role !== 'admin') {
      const dir = await pwDirectory()
      if (!pwIsManagerOf(user, email, dir)) {
        throw new InputError('You can only read the payout of people you manage.', 403)
      }
    }
    return NextResponse.json(await kpiPayoutFor(email, month, today))
  } catch (e) {
    return apiError(e)
  }
}
