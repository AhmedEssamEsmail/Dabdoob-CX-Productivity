import { requireRole } from '@/features/shared/lib/auth'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { apiError } from '@/features/shared/lib/api-error'
import { tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { saveTphSlots } from '@/features/cx-productivity/lib/tph/write'
import { NextResponse } from 'next/server'

/** saveTphSlots — paint a channel/activity or blend calls across slots. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const body = await req.json()
    const store = await tphLoadStore_(body?.date)
    const out = await saveTphSlots(store, { role: String(user.role), email: String(user.email || '').toLowerCase() }, body)
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
