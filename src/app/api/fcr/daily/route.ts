import { supabase } from '@/lib/supabase'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const agentEmail = searchParams.get('agent_email')

  let query = supabase.from('fcr_daily').select('*')

  if (date) {
    query = query.eq('date', date)
  }
  if (agentEmail) {
    query = query.eq('agent_email', agentEmail)
  }

  const { data, error } = await query.order('date', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('fcr_daily')
    .insert(body)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
