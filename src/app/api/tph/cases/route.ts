import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
import { supabase } from '@/lib/supabase'
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

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

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
    const m = e instanceof Error ? e.message : 'Unable to save'
    return NextResponse.json({ error: m }, { status: m === 'Unauthorized' ? 401 : m === 'Forbidden' ? 403 : 400 })
  }
}
