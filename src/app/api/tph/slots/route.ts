import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
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
    const m = e instanceof Error ? e.message : 'Unable to save'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : m === 'Forbidden' ? 403 : 400 })
  }
}
