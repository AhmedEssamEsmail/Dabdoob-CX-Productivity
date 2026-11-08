import { requireRole } from '@/features/shared/lib/auth'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { supabase } from '@/features/shared/lib/supabase'
import { apiError, dbErr } from '@/features/shared/lib/api-error'
import { tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { saveTphCases } from '@/features/cx-productivity/lib/tph/write'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  try {
    await requireRole(['admin', 'tl'])
    const { searchParams } = new URL(req.url)
    const date = searchParams.get('date')
    const source = searchParams.get('source')

    let query = supabase.from('prod_tph_cases').select('*')

    if (date) {
      query = query.eq('date', date)
    }
    if (source) {
      query = query.eq('source', source)
    }

    const { data, error } = await query.order('date', { ascending: false })

    if (error) return dbErr('prod_tph_cases', error)

    return NextResponse.json(data)
  } catch (e) {
    return apiError(e)
  }
}


/** saveTphCases — { date, hour, channel, cases } ('' clears the TL number). */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const body = await req.json()
    const store = await tphLoadStore_(body?.date)
    const out = await saveTphCases(
      store,
      { role: String(user.role), email: String(user.email || '').toLowerCase() },
      body
    )
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
