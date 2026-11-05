import { NextResponse } from 'next/server'
import { kpiLogsPage, kpiLogSave, kpiLogRemove } from '@/features/cx-desk/lib/kpilogs'
import { apiError } from '@/features/shared/lib/api-error'

/**
 * kpiLogsPage / kpiLogSave / kpiLogRemove — the Desk app's three hand-kept lists
 * (KpiLogs.js). Separate from /api/kpi/{behaviour,leave,ol-cases} which keep the
 * fragment shapes the People shard already shipped.
 *   GET    the page envelope (lists + agents + leave types + areas)
 *   POST   { kind: 'behaviour' | 'leave' | 'exclusion', input }
 *   DELETE ?kind=&id=
 */
export async function GET() {
  try {
    return NextResponse.json(await kpiLogsPage())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { kind?: string; input?: Record<string, unknown> }
    return NextResponse.json(await kpiLogSave(String(body.kind || ''), (body.input || {}) as Parameters<typeof kpiLogSave>[1]))
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await kpiLogRemove(String(searchParams.get('kind') || ''), String(searchParams.get('id') || '')))
  } catch (e) {
    return apiError(e)
  }
}
