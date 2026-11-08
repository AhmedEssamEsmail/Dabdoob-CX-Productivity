import { requireRole } from '@/features/shared/lib/auth'
import { getTphPage, tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { NextResponse } from 'next/server'

/** getTphPage(date) — the TPH page's full payload for one day. */
export async function GET(req: Request) {
  let user
  try {
    user = await requireRole(['admin', 'tl'])
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to authorize request'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : 403 })
  }
  const { searchParams } = new URL(req.url)
  const store = await tphLoadStore_(searchParams.get('date'))
  return NextResponse.json(getTphPage(store, { role: String(user.role), email: String(user.email || '').toLowerCase() }, searchParams.get('date')))
}
