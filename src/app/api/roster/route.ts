import { supabase } from '@/features/shared/lib/supabase'
import { apiError, dbErr } from '@/features/shared/lib/api-error'
import { requireRole } from '@/features/shared/platform/identity'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    await requireRole(['admin'])
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
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    await requireRole(['admin'])
    await viewAsGuard()
    const body = await req.json()

    const { data, error } = await supabase
      .from('roster')
      .insert(body)
      .select()
      .single()

    if (error) return dbErr('roster', error)

    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}

export async function PUT(req: Request) {
  try {
    await requireRole(['admin'])
    await viewAsGuard()
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
  } catch (e) {
    return apiError(e)
  }
}
