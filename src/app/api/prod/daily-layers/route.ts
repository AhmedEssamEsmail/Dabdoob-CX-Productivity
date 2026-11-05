import { supabase } from '@/features/shared/lib/supabase'
import { dbErr } from '@/features/shared/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const agentEmail = searchParams.get('agent_email')
  const layer = searchParams.get('layer') // 'raw' or 'effective'

  let query = supabase.from('prod_daily_layers').select('*')

  if (date) {
    query = query.eq('date', date)
  }
  if (agentEmail) {
    query = query.eq('email', agentEmail)
  }
  if (layer) {
    query = query.eq('layer', layer)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) return dbErr('prod_daily_layers', error)

  return NextResponse.json(data)
}
