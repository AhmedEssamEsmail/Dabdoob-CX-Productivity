import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { apiError } from '@/lib/api-error'
import { holidayDelete, holidayList, holidayUpsert } from '@/lib/platform/holidays'

/**
 * GET    /api/holidays?from&to   — active holidays (deleted_at is null), by date.
 * POST   /api/holidays           — upsert on (country, date): { country, date, name? }
 * DELETE /api/holidays?id=       — soft delete (deleted_at stamped).
 * Reads are admin+tl; writes are admin only and reset the working-calendar cache.
 */
export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await holidayList(searchParams.get('from'), searchParams.get('to')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    return NextResponse.json(await holidayUpsert(body, user.email))
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await requireRole(['admin'])
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await holidayDelete(String(searchParams.get('id') || ''), user.email))
  } catch (e) {
    return apiError(e)
  }
}
