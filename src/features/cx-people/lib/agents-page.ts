 
/**
 * getAgentsPage — port of Command_Center_V2_deprecated/Aggregates.js:535-558.
 * The agent scoreboard: cached agg_agent_perf / agg_agent_daily rows, TLs
 * filtered to their own team (tl_email on the perf row), verbatim column map.
 */

import 'server-only'
import { dqNum_ } from '@/features/shared/lib/adapters'
import { requireRole } from '@/features/shared/platform/identity'
import { dqCachedLive, dqLastRun } from '@/features/shared/platform/stores'

export async function getAgentsPage() {
  const user = await requireRole(['admin', 'tl'])
  let perf = await dqCachedLive('agg_agent_perf')
  let daily = await dqCachedLive('agg_agent_daily')
  if (user.role === 'tl') {
    const team: Record<string, boolean> = {}
    perf.forEach((r) => {
      if (r.tl_email === user.email) team[String(r.email)] = true
    })
    perf = perf.filter((r) => team[String(r.email)])
    daily = daily.filter((r) => team[String(r.email)])
  }
  const num = (v: unknown) => (v === '' || v === null || v === undefined ? null : Number(v))
  return {
    dataAsOf: await dqLastRun('agent_aggregates'),
    scope: user.role,
    agents: perf.map((r) => ({
      email: r.email, name: String(r.name), tlName: String(r.tl_name || ''), period: String(r.period),
      days: dqNum_(r.days), fromDate: String(r.from_date), toDate: String(r.to_date),
      overallPct: num(r.overall_pct), inboundPct: num(r.inbound_pct), textingPct: num(r.texting_pct),
      waPct: num(r.wa_pct), inboundAchieved: dqNum_(r.inbound_achieved), inboundMissed: dqNum_(r.inbound_missed),
      textingAchieved: dqNum_(r.texting_achieved), waAchieved: dqNum_(r.wa_achieved),
      productiveMin: dqNum_(r.productive_min), idleMin: dqNum_(r.idle_min),
      audits: dqNum_(r.audits), avgScore: num(r.avg_score),
    })),
    daily: daily.map((r) => [String(r.date), String(r.email), num(r.overall_pct)]),
  }
}
