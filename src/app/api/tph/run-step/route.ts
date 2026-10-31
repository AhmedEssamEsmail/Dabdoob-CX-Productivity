import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
import { prodReady_ } from '@/lib/prod/engine'
import { tphLoadStore_ } from '@/lib/tph/page'
import { tphRunStep_, tphPastDay_ } from '@/lib/tph/run'
import { NextResponse } from 'next/server'

/** runTphStep(date, step) — one past-day rebuild step, run from the page. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const body = await req.json()
    const store = await tphLoadStore_()
    if (!prodReady_(store.cfg)) throw new Error('Run setupProductivity first.')
    const out = await tphRunStep_(store, tphPastDay_(store, body.date), String(body.step || ''), String(user.email || '').toLowerCase())
    return NextResponse.json(out)
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to run'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : m === 'Forbidden' ? 403 : 400 })
  }
}
