import { NextResponse } from 'next/server'
import { requireRole } from '@/features/shared/platform/identity'
import { apiError } from '@/features/shared/lib/api-error'
import { behaviourInput, kpiLogAppend, kpiLogList, kpiLogRemove } from '@/features/cx-people/lib/kpi/server'

/**
 * kpi_behaviour_log — the Desk app's manual HR-confirmed behaviour cases
 * (KpiLogs.js, absent from the bundle; the shape is KPI_LOG_HEADERS).
 *   GET    ?email=            live rows (removed ones left out), newest first
 *   POST   { email, date, note? }  one case, logged_by/at stamped
 *   DELETE ?log_id=           soft delete (removed_by/at)
 */
export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await kpiLogList('kpi_behaviour_log', searchParams.get('email')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    return NextResponse.json(await kpiLogAppend('kpi_behaviour_log', 'kbl', behaviourInput(body), user.email))
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    const logId = String(searchParams.get('log_id') || searchParams.get('logId') || '')
    return NextResponse.json(await kpiLogRemove('kpi_behaviour_log', logId, user.email))
  } catch (e) {
    return apiError(e)
  }
}
