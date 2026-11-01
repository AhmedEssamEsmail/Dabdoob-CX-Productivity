import { supabase } from '@/lib/supabase'
import { dbErr } from '@/lib/api-error'
import { NextResponse } from 'next/server'

export async function GET() {
  const { data, error } = await supabase.from('config').select('*')

  if (error) return dbErr('config', error)

  return NextResponse.json(data)
}

export async function POST(req: Request) {
  const body = await req.json()

  const { data, error } = await supabase
    .from('config')
    .insert(body)
    .select()
    .single()

  if (error) return dbErr('config', error)

  return NextResponse.json(data)
}

export async function PUT(req: Request) {
  const body = await req.json()
  const { key, ...updateData } = body

  const { data, error } = await supabase
    .from('config')
    .update(updateData)
    .eq('key', key)
    .select()
    .single()

  if (error) return dbErr('config', error)

  return NextResponse.json(data)
}
