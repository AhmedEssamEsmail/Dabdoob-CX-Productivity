import { requireRole } from '@/features/shared/lib/auth'
import { readAllPaged, cacheGet, cachePut, type ReadAllPagedOptions } from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { pwDirectory } from '@/features/shared/platform/identity'
import { prodAnalyticsFor_, prodRuleView_, prodScope_ } from '@/features/cx-productivity/lib/prod/engine'
import { prodAnalytics_, prodWeekStart_ } from '@/features/cx-productivity/lib/prod/analytics'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { dqAddDays_ } from '@/features/shared/lib/adapters'
import type { Cfg } from '@/features/shared/lib/adapters'
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
  const today = prodToday_({})
  const weekParam = new URL(req.url).searchParams.get('week') || ''
  const week = /^\d{4}-\d\d-\d\d$/.test(weekParam) ? prodWeekStart_(weekParam) : prodWeekStart_(today)
  const full = user.role === 'admin'
  const cacheKey = `prod_an|${week}|${String(user.email).toLowerCase()}|${full}`
  const hit = cacheGet(cacheKey)
  if (hit) {
    try {
      return NextResponse.json({ ...(JSON.parse(hit) as Record<string, unknown>), cached: true })
    } catch {
      /* corrupt entry: fall through and recompute */
    }
  }
  try {
    const [cfg, dirAll] = await Promise.all([configAll(), pwDirectory()])
    const dirBy: Record<string, { name: string; tlEmail: string }> = {}
    Object.keys(dirAll.by).forEach((e) => {
      const p = dirAll.by[e]
      dirBy[e] = { name: p.name, tlEmail: p.tlEmail || '' }
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
    const inWindow = (q: Parameters<NonNullable<ReadAllPagedOptions['build']>>[0]) =>
      q.gte('date', weeksFrom).lte('date', to)
    const [intervals, flags, layers, hist] = await Promise.all([
      readAllPaged('prod_intervals', {
        columns: 'date,agent_email,agent_name,status,start_at,end_at,minutes',
        build: inWindow,
      }),
      readAllPaged('prod_flags', {
        columns:
          'agent_email,date,decision,tl_email,decided_at,created_at,review_open_ms,validated_status,suggested_status,raw_status,spans_json,interval_start',
        build: inWindow,
      }),
      readAllPaged('prod_daily_layers', {
        columns:
          'date,email,layer,"productiveMinResolution":productive_min_resolution,"productiveMinAux":productive_min_aux',
        build: inWindow,
      }),
      full
        ? readAllPaged('prod_window_hist', {
            columns: 'date,class,counts_json',
            build: inWindow,
          })
        : Promise.resolve([] as Record<string, unknown>[]),
    ])

    const tables: Record<string, Record<string, unknown>[]> = {
      prod_intervals: intervals,
      prod_flags: flags,
      prod_daily_layers: layers,
      prod_window_hist: hist,
    }
    const io = { prodRows: (name: string) => tables[name] || [] }
    const out = prodAnalyticsFor_(
      cfg as Cfg, io, dir, week, scope, full,
      prodAnalytics_ as (inp: unknown) => Record<string, unknown>
    )
    out.isAdmin = full
    out.rule = prodRuleView_(cfg as Cfg)
    out.thisWeek = prodWeekStart_(today)
    out.cached = false
    cachePut(cacheKey, JSON.stringify(out), 120)
    return NextResponse.json(out)
  } catch (e) {
    const m = e instanceof Error ? e.message : 'Unable to load analytics'
    return NextResponse.json({ error: m }, { status: 500 })
  }
}
