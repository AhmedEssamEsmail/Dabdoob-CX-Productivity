import { supabase } from '@/features/shared/lib/supabase'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const authHeader = req.headers.get('authorization')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    // fail-closed in production; dev/no-secret mode still lets requireJobCaller gate the caller
    if (process.env.NODE_ENV === 'production') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
  } else if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Freshdesk integration placeholder
    return NextResponse.json({
      message: 'Freshdesk integration - placeholder',
      status: 'Freshdesk API integration needs API key',
      steps: [
        '1. Set up Freshdesk API credentials',
        '2. Fetch agent activity data',
        '3. Import to prod_intervals table'
      ]
    })
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    return NextResponse.json({ error: message }, { status: 500 })
  }
}
