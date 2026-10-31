import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { apiError } from '@/lib/api-error'
import { olCaseDelete, olCaseList, olCaseUpsert } from '@/lib/kpi/server'

/**
 * kpi_ol_cases — operational-loss cases per agent per month (legacy: written
 * hourly by the Hub's TL job; here upserted on key = month|email).
 *   GET    ?month=&email=             rows, by month then email
 *   POST   { month, email, cases, key? }   upsert on key, updated_at stamped
 *   DELETE ?key=                      remove the row (no removed_* cols)
 */
export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await olCaseList(searchParams.get('month'), searchParams.get('email')))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    return NextResponse.json(await olCaseUpsert(body))
  } catch (e) {
    return apiError(e)
  }
}

export async function DELETE(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    await olCaseDelete(String(searchParams.get('key') || ''))
    return NextResponse.json({ ok: true })
  } catch (e) {
    return apiError(e)
  }
}
