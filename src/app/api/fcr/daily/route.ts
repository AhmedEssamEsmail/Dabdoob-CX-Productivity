import { NextResponse } from 'next/server'
import { requireRole } from '@/lib/platform/identity'
import { assertWritable } from '@/lib/platform/viewas'
import { apiError } from '@/lib/api-error'
import { fcrDailyInput } from '@/lib/scorecard/fcr'
import { db } from '@/lib/platform/repo'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const agentEmail = searchParams.get('agent_email')

  let query = db().from('fcr_daily').select('*')

  if (date) {
    query = query.eq('date', date)
  }
  if (agentEmail) {
    query = query.eq('agent_email', agentEmail)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

/**
 * POST — one scorecard FCR row: { date, email|agent_email, passed, failed,
 * excluded } (the sc_daily fcr_* counts; excluded stays out of the
 * passed+failed denominator). admin/tl, blocked in View as, stamped like every
 * repo write; the stamp is retried away when the table predates the
 * submitted_* columns (missing-column error only).
 */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await assertWritable()
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    const input = fcrDailyInput(body)
    const stamped = { ...input, submitted_by: user.email, submitted_at: new Date().toISOString() }
    let res = await db().from('fcr_daily').insert(stamped).select().maybeSingle()
    if (res.error && /submitted_(by|at)|PGRST204/i.test(res.error.message || '')) {
      // The table has no submitted_* columns: insert the validated row alone.
      res = await db().from('fcr_daily').insert(input).select().maybeSingle()
    }
    if (res.error) return NextResponse.json({ error: res.error.message }, { status: 500 })
    return NextResponse.json(res.data)
  } catch (e) {
    return apiError(e)
  }
}
