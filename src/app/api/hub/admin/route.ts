/**
 * /api/hub/admin — the Hub Admin calls (Code.js/Apps.js): getConfigRows (GET),
 * getConfig (GET ?fn=config), and POST { action }: setConfig | saveConfig |
 * setAppUrl. Dropdown reads/writes use /api/options/[listKey]; view-as uses
 * /api/view-as*.
 */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import {
  getAdminConfig,
  getConfigRows,
  saveConfigSetting,
  setAdminConfig,
  setAppUrl,
} from '@/features/cx-hub/lib/admin'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('fn') === 'config') return NextResponse.json(await getAdminConfig())
    return NextResponse.json(await getConfigRows())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    switch (String(body.action || '')) {
      case 'setConfig':
        return NextResponse.json(await setAdminConfig(String(body.key || ''), body.value))
      case 'saveConfig':
        return NextResponse.json(await saveConfigSetting(String(body.key || ''), body.value))
      case 'setAppUrl':
        return NextResponse.json(await setAppUrl(String(body.app || ''), String(body.url ?? '')))
      default:
        return NextResponse.json({ error: 'Unknown action "' + String(body.action || '') + '".' }, { status: 400 })
    }
  } catch (e) {
    return apiError(e)
  }
}
