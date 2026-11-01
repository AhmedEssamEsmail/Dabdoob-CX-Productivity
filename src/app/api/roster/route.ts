import { supabase } from '@/lib/supabase'
import { dbErr } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const active = searchParams.get('active')
  const role = searchParams.get('role')

  let query = supabase.from('roster').select('*')

  if (active) {
    query = query.eq('active', active === 'true')
  }
  if (role) {
    query = query.eq('role', role)
  }

  const { data, error } = await query.order('name', { ascending: true })

  if (error) return dbErr('roster', error)

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('roster')
    .insert(body)
    .select()
    .single()

  if (error) return dbErr('roster', error)

  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { email, ...updateData } = body

  const { data, error } = await supabase
    .from('roster')
    .update(updateData)
    .eq('email', email)
    .select()
    .single()

  if (error) return dbErr('roster', error)

  return NextResponse.json(data)
}
