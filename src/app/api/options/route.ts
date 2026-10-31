import { NextResponse } from 'next/server'
import { currentEmail, allOptions } from '@/lib/platform'


/** getOptions_: every active choice grouped by dropdown key — any signed-in user. */
export async function GET() {
  try {
    await currentEmail()
    return NextResponse.json({ options: await allOptions() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
