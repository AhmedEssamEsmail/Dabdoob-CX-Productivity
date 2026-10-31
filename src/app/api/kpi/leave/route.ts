import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { apiError } from '@/lib/api-error'
import { kpiLogAppend, kpiLogList, kpiLogRemove, leaveInput } from '@/lib/kpi/server'

/**
 * kpi_leave_log — unplanned leaves; one entry = one leave, counted on its first
 * day (KpiPayout.js header notes). Type is one of KPI_LEAVE_TYPES.
 *   GET    ?email=                          live rows, newest first
 *   POST   { email, from_date, to_date?, type, note? }
 *   DELETE ?log_id=                         soft delete (removed_by/at)
 */
export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await kpiLogList('kpi_leave_log', searchParams.get('email')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    return NextResponse.json(await kpiLogAppend('kpi_leave_log', 'kll', leaveInput(body), user.email))
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    const logId = String(searchParams.get('log_id') || searchParams.get('logId') || '')
    return NextResponse.json(await kpiLogRemove('kpi_leave_log', logId, user.email))
  } catch (e) {
    return apiError(e)
  }
}
