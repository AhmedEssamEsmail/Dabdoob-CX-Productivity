import 'server-only'

import { currentUser, currentEmail, assistantOwnerEmail, type PlatformUser } from './identity'
import { viewAsState } from './viewas'
import { pendingPopupsFor } from './popups'
import { pwKwTime, pwKwDate, KUWAIT_TZ } from './time'
import { appUrls } from './settings'


export async function getAppBootstrap(
  loadQuality: (user: PlatformUser) => Promise<unknown>
): Promise<Record<string, unknown>> {
  const user = await currentUser()
  const st = await viewAsState()
  const email = await currentEmail()
  const now = Date.now()
  if (user.role === 'unknown') {
    return {
      user,
      popups: [],
      serverTime: pwKwTime(now),
      serverDate: pwKwDate(now),
      serverAt: new Date(now).toISOString(),
      timeZone: KUWAIT_TZ,
      isOwner: false,
      app: 'hub',
      appUrls: {},
    }
  }
  const [popups, urls, quality] = await Promise.all([
    pendingPopupsFor(email), appUrls(),
    /* qaBootFlags_ (Quality.js): auditor / disputeOwner / kbEditor for the Quality page gates. */
    loadQuality(user),
  ])
  const out: Record<string, unknown> = {
    user,
    popups,
    serverTime: pwKwTime(now),
    serverDate: pwKwDate(now),
    serverAt: new Date(now).toISOString(),
    timeZone: KUWAIT_TZ,
    isOwner: user.email === (await assistantOwnerEmail()),
    app: 'hub',
    appUrls: urls,
    quality,
  }
  /* Legacy viewAs.canUse = the owner gate; target stays null when off. */
  out.viewAs = { canUse: st.owner, target: st.target || null }
  return out
}
