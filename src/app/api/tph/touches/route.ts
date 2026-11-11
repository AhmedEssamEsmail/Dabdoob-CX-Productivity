import { requireRole } from '@/features/shared/lib/auth'
import { db } from '@/features/shared/platform/repo'
import { normEmail_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { prodNameToEmail_ } from '@/features/shared/lib/adapters'
import { apiError } from '@/features/shared/lib/api-error'
import { described } from '@/features/shared/lib/errors'
import { tphTouchList_, tphHourMs_ } from '@/features/cx-productivity/lib/tph'
import { tphChannels_, tphHours_, tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { NextResponse } from 'next/server'

/**
 * getTphTouchList(date, email) — touches behind a Touches total, read from the
 * fd_activities tail (the Supabase mirror of the Activities sheet rows: 10 cols).
 * A store read error surfaces through apiError instead of an empty list.
 */
export async function GET(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    void user
    const { searchParams } = new URL(req.url)
    const store = await tphLoadStore_(searchParams.get('date'), { window: 'day' })
    const d = String(searchParams.get('date') || '')
    if (!/^\d{4}-\d\d-\d\d$/.test(d) || d > prodToday_(store.cfg))
      return NextResponse.json({ error: 'Pick a day up to today (yyyy-MM-dd).' }, { status: 400 })
    const email = normEmail_(searchParams.get('email'))
    const supabase = db()
    const from = tphHourMs_(d, 0, 'Asia/Kuwait') - 1 * 86400000
    const { data: rows, error } = await supabase
      .from('fd_activities')
      .select('cols')
      .gte('ts_ms', from)
      .limit(20000)
    if (error) throw described(error, { table: 'fd_activities' })
    const tail = (rows || []).map((r: { cols: unknown[] }) => r.cols)
    const headcount = Object.values(store.dir.by).map((p) => ({ name: p.name, fdName: '', fdId: '', email: p.email }))
    const out = tphTouchList_(
      tail as unknown[][], d, email, prodNameToEmail_(headcount), 'Asia/Kuwait',
      tphChannels_(store.cfg), 'Asia/Kuwait', tphHours_(store.cfg)
    ) as Record<string, unknown>
    out.date = d
    out.email = email
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
