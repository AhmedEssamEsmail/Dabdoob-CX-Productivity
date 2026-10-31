import { createAuthClient, requireRole } from '@/lib/auth'
import { prodAnalyticsFor_ } from '@/lib/prod/engine'
import { prodAnalytics_, prodWeekStart_ } from '@/lib/prod/analytics'
import type { Cfg } from '@/lib/prod/adapters'
import {
  addDays,
  flagView,
  PROD_DEFAULTS,
  ruleView,
  todayKey,
  type ProdFlagRow,
} from '@/lib/prod-validation'
import { NextResponse } from 'next/server'

function authError(error: unknown) {
  const message = error instanceof Error ? error.message : 'Unable to authorize request'
  return NextResponse.json(
    { error: message },
    { status: message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500 }
  )
}

/**
 * getProdMyPage port: the caller's own flags for 45 days (all three layers) and their
 * own analytics for the current week — mine card fields, trend points and the flag list.
 */
export async function GET() {
  let user: Awaited<ReturnType<typeof requireRole>>
  try {
    user = await requireRole(['admin', 'tl', 'agent'])
  } catch (error) {
    return authError(error)
  }

  const supabase = await createAuthClient()
  const today = todayKey()
  const email = String(user.email || '').toLowerCase()
  const flagsFrom = addDays(today, -45)
  const week = prodWeekStart_(today)

  const [flagsRes, rosterRes, configRes] = await Promise.all([
    supabase
      .from('prod_flags')
      .select('*')
      .ilike('agent_email', email)
      .neq('decision', 'void')
      .gte('date', flagsFrom)
      .order('interval_start', { ascending: false }),
    supabase.from('roster').select('email, name, tl_email'),
    supabase.from('config').select('key, value'),
  ])

  if (flagsRes.error) return NextResponse.json({ error: flagsRes.error.message }, { status: 500 })
  if (rosterRes.error) return NextResponse.json({ error: rosterRes.error.message }, { status: 500 })

  // Keep raw config strings: ruleView + prodSetting_ parse them like dqSetting_.
  const cfg: Cfg = {}
  ;(configRes.data || []).forEach((row: { key: string; value: string }) => {
    cfg[row.key] = row.value
  })

  const dirBy: Record<string, { name: string; tlEmail: string }> = {}
  ;(rosterRes.data || []).forEach((r: { email: string; name: string; tl_email: string | null }) => {
    dirBy[String(r.email).toLowerCase()] = { name: r.name, tlEmail: r.tl_email || '' }
  })
  const dir = { by: dirBy, name: (e: string) => dirBy[e.toLowerCase()]?.name || '' }
  const nameOf = (e: string) => dir.name(e)

  // prodAnalyticsFor_ reads these three stores through io.prodRows — the scope +
  // date filters inside the port do the narrowing; prefetch bounds by date only.
  const weeksFrom = addDays(week, -21)
  const [intervalsRes, layersRes] = await Promise.all([
    supabase
      .from('prod_intervals')
      .select('*')
      .ilike('agent_email', email)
      .gte('date', weeksFrom)
      .lte('date', addDays(week, 6))
      .limit(20000),
    supabase
      .from('prod_daily_layers')
      .select('*')
      .ilike('email', email)
      .gte('date', weeksFrom)
      .lte('date', addDays(week, 6))
      .limit(20000),
  ])
  if (intervalsRes.error) return NextResponse.json({ error: intervalsRes.error.message }, { status: 500 })
  if (layersRes.error) return NextResponse.json({ error: layersRes.error.message }, { status: 500 })

  const flagRows = (flagsRes.data || []) as ProdFlagRow[]
  const tables: Record<string, Record<string, unknown>[]> = {
    prod_intervals: (intervalsRes.data || []) as Record<string, unknown>[],
    prod_flags: flagRows as unknown as Record<string, unknown>[],
    prod_daily_layers: (layersRes.data || []) as Record<string, unknown>[],
  }
  const io = { prodRows: (name: string) => tables[name] || [] }

  const scope = (e: string) => e.trim().toLowerCase() === email
  const an = prodAnalyticsFor_(cfg, io, dir, week, scope, false,
    prodAnalytics_ as (inp: unknown) => Record<string, unknown>) as {
    agents: { email: string }[]
    trend: unknown[]
    week: string
  }

  const flags = flagRows.map((f) => flagView(f, nameOf))
  const mine = an.agents.find((a) => String(a.email).toLowerCase() === email) || null

  return NextResponse.json({
    today,
    rule: ruleView(cfg as unknown as Record<string, string>),
    ticketUrl: `https://${cfg.freshdesk_domain || PROD_DEFAULTS.freshdesk_domain}/a/tickets/`,
    flags,
    mine,
    trend: an.trend,
    week: an.week,
  })
}
