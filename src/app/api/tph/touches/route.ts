import { createAuthClient, requireRole } from '@/lib/auth'
import { normEmail_ } from '@/lib/prod/adapters'
import { prodToday_ } from '@/lib/prod/engine'
import { prodNameToEmail_ } from '@/lib/prod/adapters'
import { tphTouchList_, tphHourMs_ } from '@/lib/tph'
import { tphChannels_, tphHours_, tphLoadStore_ } from '@/lib/tph/page'
import { NextResponse } from 'next/server'

/**
 * getTphTouchList(date, email) — touches behind a Touches total, read from the
 * fd_activities tail (the Supabase mirror of the Activities sheet rows: 10 cols).
 */
export async function GET(req: Request) {
  let user
  try {
    user = await requireRole(['admin', 'tl'])
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to authorize request'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : 403 })
  }
  void user
  const { searchParams } = new URL(req.url)
  const store = await tphLoadStore_()
  const d = String(searchParams.get('date') || '')
  if (!/^\d{4}-\d\d-\d\d$/.test(d) || d > prodToday_(store.cfg))
    return NextResponse.json({ error: 'Pick a day up to today (yyyy-MM-dd).' }, { status: 400 })
  const email = normEmail_(searchParams.get('email'))
  const supabase = await createAuthClient()
  const from = tphHourMs_(d, 0, 'Asia/Kuwait') - 1 * 86400000
  const { data: rows } = await supabase
    .from('fd_activities')
    .select('cols')
    .gte('ts_ms', from)
    .limit(20000)
  const tail = (rows || []).map((r: { cols: unknown[] }) => r.cols)
  const headcount = Object.values(store.dir.by).map((p) => ({ name: p.name, fdName: '', fdId: '', email: p.email }))
  const out = tphTouchList_(
    tail as unknown[][], d, email, prodNameToEmail_(headcount), 'Asia/Kuwait',
    tphChannels_(store.cfg), 'Asia/Kuwait', tphHours_(store.cfg)
  ) as Record<string, unknown>
  out.date = d
  out.email = email
  return NextResponse.json(out)
}
