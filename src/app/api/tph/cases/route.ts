import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
import { supabase } from '@/lib/supabase'
import { apiError, dbErr } from '@/lib/api-error'
import { tphLoadStore_ } from '@/lib/tph/page'
import { saveTphCases } from '@/lib/tph/write'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
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
}


/** saveTphCases — { date, hour, channel, cases } ('' clears the TL number). */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const store = await tphLoadStore_()
    const out = await saveTphCases(
      store,
      { role: String(user.role), email: String(user.email || '').toLowerCase() },
      await req.json()
    )
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
