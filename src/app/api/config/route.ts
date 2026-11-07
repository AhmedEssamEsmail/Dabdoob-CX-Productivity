import { supabase } from '@/features/shared/lib/supabase'
import { apiError, dbErr } from '@/features/shared/lib/api-error'
import { requireRole } from '@/features/shared/platform/identity'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { saveConfigValue } from '@/features/shared/platform/settings'
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
    const user = await requireRole(['admin'])
    await viewAsGuard()
    const body = await req.json()
    /* Route through saveConfigValue (Code.js saveConfigSetting semantics):
       typed validation + updated_by/updated_at stamps — the raw update let an
       admin write unvalidated values with no stamps (incl. admin_emails). */
    const clean = await saveConfigValue(String(body.key || ''), body.value, user.email)
    return NextResponse.json({ key: String(body.key || ''), value: clean })
  } catch (e) {
    return apiError(e)
  }
}
