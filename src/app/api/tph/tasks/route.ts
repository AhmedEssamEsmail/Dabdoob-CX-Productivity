import { requireRole } from '@/lib/auth'
import { viewAsGuard } from '@/lib/platform/viewas'
import { supabase } from '@/lib/supabase'
import { tphLoadStore_ } from '@/lib/tph/page'
import { saveTphTask } from '@/lib/tph/write'
import { NextResponse } from 'next/server'

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const date = searchParams.get('date')
  const agentEmail = searchParams.get('agent_email')

  let query = supabase.from('prod_tph_tasks').select('*')

  if (date) {
    query = query.eq('date', date)
  }
  if (agentEmail) {
    query = query.eq('agent_email', agentEmail)
  }

  const { data, error } = await query.order('at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}


/** saveTphTask — { date, email, channel, calls, start, end } or { taskId, remove }. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const store = await tphLoadStore_()
    const out = await saveTphTask(
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
