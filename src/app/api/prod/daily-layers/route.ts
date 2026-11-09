import { supabase } from '@/features/shared/lib/supabase'
import { apiError, dbErr } from '@/features/shared/lib/api-error'
import { requireRole } from '@/features/shared/platform/identity'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const agentEmail = searchParams.get('agent_email')
    const layer = searchParams.get('layer') // 'raw' or 'effective'

    let query = supabase.from('prod_daily_layers').select('*')

    if (date) {
      query = query.eq('date', date)
    } else {
      query = query.gte('date', new Date(Date.now() - 31 * 864e5).toISOString().slice(0, 10))
    }
    if (agentEmail) {
      query = query.eq('email', agentEmail)
    }
    if (layer) {
      query = query.eq('layer', layer)
    }

    const { data, error } = await query.order('date', { ascending: false }).limit(5000)

    if (error) return dbErr('prod_daily_layers', error)

    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}
