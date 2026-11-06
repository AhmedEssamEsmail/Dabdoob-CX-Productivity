import { NextResponse } from 'next/server'
import {
  currentUser, currentEmail, viewAsState, pendingPopupsFor, allOptions, appUrls,
  pwKwTime, pwKwDate, KUWAIT_TZ,
} from '@/features/shared/platform'
import { qaBootFlags } from '@/features/cx-quality/lib/server'


/**
 * getAppBootstrap_: the single bootstrap payload every app screen loads with.
 * Signed-in callers outside the roster still get the limited shape, like legacy.
 */
export async function GET() {
  try {
    const user = await currentUser()
    const st = await viewAsState()
    const email = await currentEmail()
    const now = Date.now()
    if (user.role === 'unknown') {
      return NextResponse.json({
        user,
        popups: [],
        options: {},
        serverTime: pwKwTime(now),
        serverDate: pwKwDate(now),
        serverAt: new Date(now).toISOString(),
        timeZone: KUWAIT_TZ,
        isOwner: false,
        app: 'hub',
        appUrls: {},
      })
    }
    const [popups, options, urls, quality] = await Promise.all([
      pendingPopupsFor(email), allOptions(), appUrls(),
      /* qaBootFlags_ (Quality.js): auditor / disputeOwner / kbEditor for the Quality page gates. */
      qaBootFlags(user),
    ])
    const out: Record<string, unknown> = {
      user,
      popups,
      options,
      serverTime: pwKwTime(now),
      serverDate: pwKwDate(now),
      serverAt: new Date(now).toISOString(),
      timeZone: KUWAIT_TZ,
      isOwner: st.owner,
      app: 'hub',
      appUrls: urls,
      quality,
    }
    /* Legacy viewAs.canUse = the owner gate; target stays null when off. */
    out.viewAs = { canUse: st.owner, target: st.target || null }
    return NextResponse.json(out)
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
