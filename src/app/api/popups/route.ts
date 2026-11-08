import { NextResponse } from 'next/server'
import { currentEmail, oneOnOneAlertsFor, popupsPoll } from '@/features/shared/platform'


/** Merged poll: the caller's open pop-ups plus due 1:1 alerts, off ONE auth chain. */
export async function GET() {
  try {
    const email = await currentEmail()
    const [{ popups }, oo] = await Promise.all([popupsPoll(email), oneOnOneAlertsFor(email)])
    return NextResponse.json({ popups, alerts: oo.alerts, now: oo.now })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
