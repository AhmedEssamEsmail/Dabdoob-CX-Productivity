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

    // Get all intervals for the date
    const { data: intervals } = await supabase
      .from('prod_intervals')
      .select('*')
      .eq('date', yesterdayStr)

    if (!intervals || intervals.length === 0) {
      return NextResponse.json({ message: 'No intervals to process' })
    }

    // Group by agent
    const agentData = new Map()

    intervals.forEach(interval => {
      if (!agentData.has(interval.agent_email)) {
        agentData.set(interval.agent_email, {
          name: interval.agent_name,
          available_min: 0,
          idle_min: 0,
          inbound_calls_min: 0,
          chats_min: 0,
          waiting_address_min: 0,
          offline_min: 0,
          flagged_min: 0
        })
      }

      const data = agentData.get(interval.agent_email)
      const minutes = parseFloat(interval.minutes)

      // Categorize by status
      if (interval.status === 'Available') {
        data.available_min += minutes
      } else if (interval.status === 'IDLE') {
        data.idle_min += minutes
      } else if (interval.status === 'Inbound Calls') {
        data.inbound_calls_min += minutes
      } else if (interval.status === 'Chats') {
        data.chats_min += minutes
      } else if (interval.status === 'Waiting Address') {
        data.waiting_address_min += minutes
      } else if (interval.status === 'Offline') {
        data.offline_min += minutes
      }
    })

    // Get flagged minutes for each agent
    const { data: flags } = await supabase
      .from('prod_flags')
      .select('agent_email, flagged_min, decision')
      .eq('date', yesterdayStr)

    const flaggedData = new Map()
    flags?.forEach(flag => {
      if (flag.decision !== 'void') {
        const current = flaggedData.get(flag.agent_email) || 0
        flaggedData.set(flag.agent_email, current + parseFloat(flag.flagged_min))
      }
    })

    // Calculate and insert raw layers
    const layers = []
    for (const [email, data] of agentData) {
      const totalWork = data.available_min + data.inbound_calls_min + data.chats_min + data.waiting_address_min
      const flaggedMin = flaggedData.get(email) || 0
      const effectiveIdle = Math.max(0, data.idle_min - flaggedMin)
      const effectiveAvailable = data.available_min + flaggedMin

      const productivityPct = totalWork > 0
        ? ((effectiveAvailable / totalWork) * 100).toFixed(2)
        : '0'

      layers.push({
        layer: 'raw',
        email,
        date: yesterdayStr,
        available_min: data.available_min,
        idle_min: data.idle_min,
        inbound_calls_min: data.inbound_calls_min,
        chats_min: data.chats_min,
        waiting_address_min: data.waiting_address_min,
        offline_min: data.offline_min,
        flagged_min: flaggedMin,
        effective_idle_min: effectiveIdle,
        productivity_pct: parseFloat(productivityPct),
        computed_at: new Date().toISOString()
      })

      layers.push({
        layer: 'effective',
        email,
        date: yesterdayStr,
        available_min: effectiveAvailable,
        idle_min: effectiveIdle,
        inbound_calls_min: data.inbound_calls_min,
        chats_min: data.chats_min,
        waiting_address_min: data.waiting_address_min,
        offline_min: data.offline_min,
        flagged_min: flaggedMin,
        effective_idle_min: effectiveIdle,
        productivity_pct: parseFloat(productivityPct),
        computed_at: new Date().toISOString()
      })
    }

    // Upsert layers
    for (const layer of layers) {
      await supabase
        .from('prod_daily_layers')
        .upsert(layer, { onConflict: 'layer,email,date' })
    }

    return NextResponse.json({
      message: 'Daily productivity layers calculated',
      agents_processed: agentData.size,
      layers_inserted: layers.length
    })
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }
}
