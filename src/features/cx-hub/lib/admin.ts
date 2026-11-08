/**
 * Admin read/write surface — the Hub Admin page's server calls
 * (Command_Center_V2_deprecated Code.js getConfig/getConfigRows/
 * saveConfigSetting and Apps.js setAppUrl).
 *
 * getDropdownOptions/addDropdownOption already exist as platform options
 * (optionsFor_/addOption_); getViewAsPeople/startViewAs/stopViewAs/
 * getViewAsState exist as platform viewas + /api/view-as routes; the
 * bootstrap comes from /api/bootstrap. Only the Hub-specific calls live here.
 */

import 'server-only'

import {
  appUrls,
  CC_APP_URL_RE,
  CC_APPS,
  configAll,
  configRows,
  requireRole,
  saveConfigValue,
  setConfig,
} from '@/features/shared/platform'
import { assertWritable } from '@/features/shared/platform/viewas'

/** getConfig (Code.js:69) — admin only; the whole Config object. */
export async function getAdminConfig(): Promise<Record<string, unknown>> {
  await requireRole(['admin'])
  return configAll()
}

/** setConfig (Code.js:75) — saves one setting, returns the whole object. */
export async function setAdminConfig(key: string, value: unknown): Promise<Record<string, unknown>> {
  const user = await requireRole(['admin'])
  await assertWritable()
  await saveConfigValue(key, value, user.email)
  return configAll()
}

/** getConfigRows (Code.js:81) — every setting, described, with last editor. */
export async function getConfigRows() {
  await requireRole(['admin'])
  return configRows()
}

/** saveConfigSetting (Code.js:87) — save one row, return the list (the page replaces it). */
export async function saveConfigSetting(key: string, value: unknown) {
  const user = await requireRole(['admin'])
  await assertWritable()
  await saveConfigValue(key, value, user.email)
  return configRows()
}

/**
 * setAppUrl (Apps.js:50) verbatim — saves one app's web-app URL (blank clears
 * it); saving another app's URL also records this app's own URL when unset.
 * In the umbrella app `ccSelfUrl_` has no GAS equivalent, so the hub's own
 * URL is the site origin when set (config app_url_hub stays the source of
 * truth the same way).
 */
export async function setAppUrl(app: string, url: string): Promise<Record<string, string>> {
  const user = await requireRole(['admin'])
  app = String(app || '')
  url = String(url || '').trim()
  if (CC_APPS.indexOf(app) === -1) throw new Error('Unknown app "' + app + '".')
  if (url && !CC_APP_URL_RE.test(url)) {
    throw new Error(
      'Paste the web app URL from Deploy > Manage deployments: it starts with https://script.google.com/ and ends with /exec.'
    )
  }
  // setConfig_ holds the viewAsGuard_ — it fires after the URL checks, as in legacy.
  await assertWritable()
  await setConfig(
    'app_url_' + app,
    url,
    'Web app URL of the ' + app + ' app (Hub Admin > Connected apps).',
    user.email
  )
  return appUrls()
}
