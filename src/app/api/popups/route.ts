import { NextResponse } from 'next/server'
import { currentEmail, popupsPoll } from '@/lib/platform'


/** popupsPoll: the caller's open pop-ups (the client polls this). */
export async function GET() {
  try {
    const email = await currentEmail()
    return NextResponse.json(await popupsPoll(email))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
