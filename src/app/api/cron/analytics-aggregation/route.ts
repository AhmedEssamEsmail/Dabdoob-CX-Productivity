import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    // Aggregate flag analytics by agent
    const { data: flags } = await supabase
      .from('prod_flags')
      .select('agent_email, decision, flagged_min, case_count, suggested_status, raw_status')
      .eq('date', yesterdayStr)

    if (!flags || flags.length === 0) {
      return NextResponse.json({ message: 'No flags to aggregate' })
    }

    const agentStats = new Map()

    flags.forEach(flag => {
      if (!agentStats.has(flag.agent_email)) {
        agentStats.set(flag.agent_email, {
          total_flags: 0,
          auto_accepted: 0,
          total_flagged_min: 0,
          total_cases: 0,
          raw_statuses: new Map(),
          suggested_statuses: new Map()
        })
      }

      const stats = agentStats.get(flag.agent_email)
      stats.total_flags++
      stats.total_flagged_min += parseFloat(flag.flagged_min || 0)
      stats.total_cases += flag.case_count || 0

      if (flag.decision === 'auto') {
        stats.auto_accepted++
      }

      const rawCount = stats.raw_statuses.get(flag.raw_status) || 0
      stats.raw_statuses.set(flag.raw_status, rawCount + 1)

      const suggestedCount = stats.suggested_statuses.get(flag.suggested_status) || 0
      stats.suggested_statuses.set(flag.suggested_status, suggestedCount + 1)
    })

    // Insert analytics
    const analytics = []
    for (const [agentEmail, stats] of agentStats) {
      const mostCommonRaw = [...stats.raw_statuses.entries()].sort((a, b) => b[1] - a[1])[0]
      const mostCommonSuggested = [...stats.suggested_statuses.entries()].sort((a, b) => b[1] - a[1])[0]

      analytics.push({
        date: yesterdayStr,
        agent_email: agentEmail,
        total_flags: stats.total_flags,
        auto_accepted: stats.auto_accepted,
        total_flagged_min: stats.total_flagged_min,
        avg_cases_per_flag: stats.total_flags > 0 ? stats.total_cases / stats.total_flags : 0,
        most_common_raw_status: mostCommonRaw?.[0] || null,
        most_common_suggested_status: mostCommonSuggested?.[0] || null,
        updated_at: new Date().toISOString()
      })
    }

    // Upsert analytics
    for (const analytic of analytics) {
      await supabase
        .from('prod_flag_analytics')
        .upsert(analytic, { onConflict: 'date,agent_email' })
    }

    return NextResponse.json({
      message: 'Analytics aggregation completed',
      agents_processed: analytics.length
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
