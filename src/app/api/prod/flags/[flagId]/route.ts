import { requireRole } from '@/features/shared/lib/auth'
import { db } from '@/features/shared/platform/repo'
import { flagInScope } from '@/features/cx-productivity/lib/prod-access'
import { flagView, type ProdFlagRow } from '@/features/cx-productivity/lib/prod-validation'
import { dbErr } from '@/features/shared/lib/api-error'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * getProdFlag port: one flag's detail and the time it was opened — the decide endpoint
 * turns that into review_open_ms, the same review-time signal the GAS app recorded (A4).
 */
export async function GET(_req: NextRequest, ctx: RouteContext<'/api/prod/flags/[flagId]'>) {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['admin', 'tl', 'agent'])
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to authorize request'
    return NextResponse.json(
      { error: message },
      { status: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500 }
    )
  }

  const { flagId } = await ctx.params
  const supabase = db()

  const { data, error } = await supabase
    .from('prod_flags')
    .select('*')
    .eq('flag_id', flagId)
    .maybeSingle()

  if (error) return dbErr('prod_flags', error)

  const flag = data as ProdFlagRow | null
  if (!flag || !(await flagInScope(supabase, user, flag))) {
    return NextResponse.json({ error: 'That flag does not exist or is not in your team.' }, { status: 404 })
  }

  // Score-effect proxy: the share of the agent's logged day this flag reclassifies.
  const { data: intervalRows, error: intervalError } = await supabase
    .from('prod_intervals')
    .select('interval_min')
    .eq('agent_email', flag.agent_email)
    .eq('date', flag.date)
  const dayMin = intervalError
    ? 0
    : (intervalRows || []).reduce(
        (sum, row) => sum + (Number((row as { interval_min?: number | string }).interval_min) || 0),
        0
      )
  const flaggedMin = Number(flag.flagged_min) || 0
  const scoreEffect = dayMin > 0 ? Math.round((flaggedMin / dayMin) * 1000) / 10 : null

  const { data: agent } = await supabase
    .from('roster')
    .select('name')
    .eq('email', flag.agent_email)
    .maybeSingle()
  const { data: tl } = flag.tl_email
    ? await supabase.from('roster').select('name').eq('email', flag.tl_email).maybeSingle()
    : { data: null }
  const { data: decider } =
    flag.decided_by && flag.decided_by !== 'auto'
      ? await supabase.from('roster').select('name').eq('email', flag.decided_by).maybeSingle()
      : { data: null }

  const nameOf = (e: string) => {
    const n = e.toLowerCase()
    if (n === String(flag.agent_email).toLowerCase()) return agent?.name || ''
    if (n === String(flag.tl_email || '').toLowerCase()) return tl?.name || ''
    if (n === String(flag.decided_by || '').toLowerCase()) return decider?.name || ''
    return ''
  }

  return NextResponse.json({
    flag: flagView(flag, nameOf),
    openedAt: new Date().toISOString(),
    scoreEffect,
  })
}
