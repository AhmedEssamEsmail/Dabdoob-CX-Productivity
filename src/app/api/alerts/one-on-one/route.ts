import { NextResponse } from 'next/server'
import { currentEmail, oneOnOneAlertsSeen } from '@/features/shared/platform'


/** oneOnOneAlertsSeen: dismiss alert keys (only the caller's own keys stick). */
export async function POST(req: Request) {
  try {
    await currentEmail()
    const body = (await req.json().catch(() => ({}))) as { keys?: unknown }
    return NextResponse.json(await oneOnOneAlertsSeen(body.keys))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 500 })
  }
}
