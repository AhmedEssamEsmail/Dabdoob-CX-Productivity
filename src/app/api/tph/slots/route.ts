import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
import { apiError } from '@/lib/api-error'
import { tphLoadStore_ } from '@/lib/tph/page'
import { saveTphSlots } from '@/lib/tph/write'
import { NextResponse } from 'next/server'

/** saveTphSlots — paint a channel/activity or blend calls across slots. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const store = await tphLoadStore_()
    const out = await saveTphSlots(store, { role: String(user.role), email: String(user.email || '').toLowerCase() }, await req.json())
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
