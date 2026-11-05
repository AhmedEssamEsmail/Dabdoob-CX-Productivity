import { supabase } from '@/features/shared/lib/supabase'
import { dbErr } from '@/features/shared/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const agentEmail = searchParams.get('agent_email')

  let query = supabase.from('qa_audits').select('*')

  if (date) {
    query = query.eq('date', date)
  }
  if (agentEmail) {
    query = query.eq('agent_email', agentEmail)
  }

  const { data, error } = await query.order('at', { ascending: false })

  if (error) return dbErr('qa_audits', error)

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('qa_audits')
    .insert(body)
    .select()
    .single()

  if (error) return dbErr('qa_audits', error)

  return NextResponse.json(data)
}
