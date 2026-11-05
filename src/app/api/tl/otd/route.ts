import { NextResponse } from 'next/server'
import { otdSave } from '@/features/cx-desk/lib/tlperformance'
import { apiError } from '@/features/shared/lib/api-error'

/** otdSave: { month: 'yyyy-MM', values: one % per warehouse in otd_warehouses order }. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { month?: string; values?: unknown[] }
    return NextResponse.json(await otdSave(String(body.month || ''), body.values || []))
  } catch (e) {
    return apiError(e)
  }
}
