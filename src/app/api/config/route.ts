import { supabase } from '@/features/shared/lib/supabase'
import { apiError, dbErr } from '@/features/shared/lib/api-error'
import { requireRole } from '@/features/shared/platform/identity'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { NextResponse } from 'next/server'

export async function GET() {
  try {
    await requireRole(['admin'])
    const { data, error } = await supabase.from('config').select('*')

    if (error) return dbErr('config', error)

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
      .from('config')
      .insert(body)
      .select()
      .single()

    if (error) return dbErr('config', error)

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
    const { key, ...updateData } = body

    const { data, error } = await supabase
      .from('config')
      .update(updateData)
      .eq('key', key)
      .select()
      .single()

    if (error) return dbErr('config', error)

    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}
