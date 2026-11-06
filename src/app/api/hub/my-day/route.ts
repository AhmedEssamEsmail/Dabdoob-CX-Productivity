/**
 * /api/hub/my-day — Assistant.js: GET ?part=&refresh=1 serves getMyDayPart
 * (no part = getMyDay). POST { action }: searchMail | focusBlock |
 * setSettings | followUpDone | installDigest | debug — the legacy Fs calls.
 */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { assertWritable } from '@/features/shared/platform/viewas'
import {
  createFocusBlock,
  debugMyDay,
  getMyDay,
  getMyDayPart,
  installAssistantDigestTrigger,
  markFollowUpDone,
  searchMyMail,
  setAssistantSettings,
} from '@/features/cx-hub/lib/myday'

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    const part = String(searchParams.get('part') || '')
    const refresh = searchParams.get('refresh') === '1' || searchParams.get('refresh') === 'true'
    return NextResponse.json(part ? await getMyDayPart(part, refresh) : await getMyDay(refresh))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    const action = String(body.action || '')
    if (action !== 'searchMail' && action !== 'debug') await assertWritable()
    switch (action) {
      case 'searchMail':
        return NextResponse.json(await searchMyMail(String(body.query || '')))
      case 'focusBlock':
        return NextResponse.json(
          await createFocusBlock(String(body.start || ''), String(body.end || ''), body.title as string)
        )
      case 'setSettings':
        return NextResponse.json(await setAssistantSettings((body.patch || {}) as Record<string, unknown>))
      case 'followUpDone':
        return NextResponse.json(await markFollowUpDone(String(body.threadId || ''), Number(body.lastAtMs)))
      case 'installDigest':
        return NextResponse.json(await installAssistantDigestTrigger())
      case 'debug':
        return NextResponse.json(await debugMyDay())
      default:
        return NextResponse.json({ error: 'Unknown action "' + String(body.action || '') + '".' }, { status: 400 })
    }
  } catch (e) {
    return apiError(e)
  }
}
