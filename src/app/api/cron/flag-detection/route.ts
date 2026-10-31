import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const authHeader = req.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get configuration for flag detection
    const { data: config } = await supabase
      .from('config')
      .select('key, value')
      .in('key', ['prod_flag_auto_accept', 'prod_confidence_auto_threshold'])
    
    const autoAccept = config?.find(c => c.key === 'prod_flag_auto_accept')?.value === 'true'
    const autoThreshold = parseInt(config?.find(c => c.key === 'prod_confidence_auto_threshold')?.value || '50')

    // Get intervals for the last day
    const yesterday = new Date()
    yesterday.setDate(yesterday.getDate() - 1)
    const yesterdayStr = yesterday.toISOString().split('T')[0]

    const { data: intervals } = await supabase
      .from('prod_intervals')
      .select('*')
      .eq('date', yesterdayStr)
      .eq('status', 'IDLE')

    if (!intervals || intervals.length === 0) {
      return NextResponse.json({ message: 'No IDLE intervals to process' })
    }

    // Group intervals by agent and detect flags
    const flags = []
    const agentIntervals = new Map()

    intervals.forEach(interval => {
      if (!agentIntervals.has(interval.agent_email)) {
        agentIntervals.set(interval.agent_email, [])
      }
      agentIntervals.get(interval.agent_email).push(interval)
    })

    // Flag detection logic: 2 cases in 10-minute window, 5-minute minimum interval
    for (const [agentEmail, agentIntervalsList] of agentIntervals) {
      // Sort by start time
      agentIntervalsList.sort((a: { start_at: string }, b: { start_at: string }) => new Date(a.start_at).getTime() - new Date(b.start_at).getTime())

      // Check for flags
      for (let i = 0; i < agentIntervalsList.length; i++) {
        const interval = agentIntervalsList[i]
        const windowStart = new Date(interval.start_at).getTime()
        const windowEnd = windowStart + 10 * 60 * 1000 // 10 minutes

        let caseCount = 0
        let totalMin = 0
        const spans = []

        for (let j = i; j < agentIntervalsList.length; j++) {
          const checkInterval = agentIntervalsList[j]
          const checkStart = new Date(checkInterval.start_at).getTime()

          if (checkStart > windowEnd) break

          caseCount++
          totalMin += parseFloat(checkInterval.minutes)
          spans.push({
            start: checkInterval.start_at,
            end: checkInterval.end_at,
            min: checkInterval.minutes
          })
        }

        if (caseCount >= 2 && totalMin >= 5) {
          // Calculate confidence score
          const confidenceScore = calculateConfidence({
            caseCount,
            totalMin,
            distinctCases: new Set(spans.map(s => s.start)).size
          })

          const flag = {
            flag_id: `${agentEmail}_${interval.date}_${Date.now()}`,
            date: interval.date,
            agent_email: agentEmail,
            agent_name: interval.agent_name,
            raw_status: interval.status,
            interval_start: interval.start_at,
            interval_end: interval.end_at,
            interval_min: interval.minutes,
            spans_json: { spans },
            flagged_min: totalMin,
            case_count: caseCount,
            distinct_cases: new Set(spans.map(s => s.start)).size,
            suggested_status: 'Available',
            decision: autoAccept && confidenceScore >= autoThreshold ? 'auto' : 'pending',
            confidence_score: confidenceScore,
            confidence_level: confidenceScore >= autoThreshold ? 'high' : 'low',
            created_at: new Date().toISOString()
          }

          flags.push(flag)

          // Log the detection
          await supabase.from('prod_flag_log').insert({
            log_id: `${flag.flag_id}_log`,
            flag_id: flag.flag_id,
            action: 'detected',
            by: 'system',
            at: new Date().toISOString()
          })
        }
      }
    }

    // Insert flags
    if (flags.length > 0) {
      await supabase.from('prod_flags').insert(flags)
    }

    return NextResponse.json({
      message: 'Flag detection completed',
      intervals_processed: intervals.length,
      flags_detected: flags.length
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}

function calculateConfidence({ caseCount, totalMin, distinctCases }: { caseCount: number; totalMin: number; distinctCases?: number }): number {
  let score = 50 // Base score

  // Case count factor
  if (caseCount >= 10) score += 20
  else if (caseCount === 1) score -= 10

  // Duration factor
  if (totalMin >= 30) score += 15
  else if (totalMin < 5) score -= 5

  // Density factor
  if (caseCount / (totalMin / 10) > 1.5) score += 10

  return Math.min(100, Math.max(0, score))
}
