import { createAuthClient, requireRole } from '@/lib/auth'
import { prodAnalyticsFor_, prodRuleView_, prodScope_ } from '@/lib/prod/engine'
import { prodAnalytics_, prodWeekStart_ } from '@/lib/prod/analytics'
import { prodToday_ } from '@/lib/prod/engine'
import { dqAddDays_ } from '@/lib/prod/adapters'
import type { Cfg } from '@/lib/prod/adapters'
import { NextResponse } from 'next/server'

/**
 * getProdAnalyticsPage(week) — admin sees the full week (heatmap + calibration),
 * a TL sees their team. Same prodAnalyticsFor_ composition as the legacy page.
 */
export async function GET(req: Request) {
  let user
  try {
    user = await requireRole(['admin', 'tl'])
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to authorize request'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : 403 })
  }
  const supabase = await createAuthClient()
  const today = prodToday_({})
  const weekParam = new URL(req.url).searchParams.get('week') || ''
  const week = /^\d{4}-\d\d-\d\d$/.test(weekParam) ? prodWeekStart_(weekParam) : prodWeekStart_(today)
  const full = user.role === 'admin'

  const [rosterRes, configRes] = await Promise.all([
    supabase.from('roster').select('email, name, tl_email'),
    supabase.from('config').select('key, value'),
  ])
  if (rosterRes.error) return NextResponse.json({ error: rosterRes.error.message }, { status: 500 })

  const cfg: Cfg = {}
  ;(configRes.data || []).forEach((r: { key: string; value: string }) => {
    cfg[r.key] = r.value
  })
  const dirBy: Record<string, { name: string; tlEmail: string }> = {}
  ;(rosterRes.data || []).forEach((r: { email: string; name: string; tl_email: string | null }) => {
    dirBy[String(r.email).toLowerCase()] = { name: r.name, tlEmail: r.tl_email || '' }
  })
  const dir = {
    by: dirBy,
    name: (e: string) => dirBy[String(e).toLowerCase()]?.name || '',
    managerOf: (e: string) => dirBy[String(e).toLowerCase()]?.tlEmail || null,
  }
  const u = { role: String(user.role), email: String(user.email || '').toLowerCase() }
  const scope = prodScope_(u, dir)

  const weeksFrom = dqAddDays_(week, -21)
  const to = dqAddDays_(week, 6)
  const [intervalsRes, flagsRes, layersRes, histRes] = await Promise.all([
    supabase.from('prod_intervals').select('*').gte('date', weeksFrom).lte('date', to).limit(50000),
    supabase.from('prod_flags').select('*').gte('date', weeksFrom).lte('date', to).limit(20000),
    supabase.from('prod_daily_layers').select('*').gte('date', weeksFrom).lte('date', to).limit(50000),
    full ? supabase.from('prod_window_hist').select('*').limit(50000) : Promise.resolve({ data: [] }),
  ])
  for (const r of [intervalsRes, flagsRes, layersRes])
    if (r.error) return NextResponse.json({ error: r.error.message }, { status: 500 })

  const tables: Record<string, Record<string, unknown>[]> = {
    prod_intervals: (intervalsRes.data || []) as Record<string, unknown>[],
    prod_flags: (flagsRes.data || []) as Record<string, unknown>[],
    prod_daily_layers: (layersRes.data || []) as Record<string, unknown>[],
    prod_window_hist: ((histRes as { data?: unknown[] }).data || []) as Record<string, unknown>[],
  }
  const io = { prodRows: (name: string) => tables[name] || [] }
  const out = prodAnalyticsFor_(
    cfg, io, dir, week, scope, full,
    prodAnalytics_ as (inp: unknown) => Record<string, unknown>
  )
  out.isAdmin = full
  out.rule = prodRuleView_(cfg)
  out.thisWeek = prodWeekStart_(today)
  return NextResponse.json(out)
}
