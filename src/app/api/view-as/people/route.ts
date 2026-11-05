import { NextResponse } from 'next/server'
import { getViewAsPeople } from '@/features/shared/platform'

/** getViewAsPeople: the roster people the owner can view as, by name. */
export async function GET() {
  try {
    return NextResponse.json(await getViewAsPeople())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
