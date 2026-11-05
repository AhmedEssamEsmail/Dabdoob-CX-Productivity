import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import {
  getScorecardPage, getScorecardDetail, getScorecardAdmin,
  refreshScorecard, saveScorecardSource, removeScorecardSource,
} from '@/features/cx-people/lib/scorecard-server'

/** GET ?view=page|detail|admin plus the scorecard params (month, email, from, to). */
export async function GET(req: Request) {
  try {
    const q = new URL(req.url).searchParams
    const view = q.get('view') || 'page'
    const params: Record<string, unknown> = {}
    q.forEach((v, k) => {
      if (k !== 'view') params[k] = v
    })
    if (view === 'detail') return NextResponse.json(await getScorecardDetail(params))
    if (view === 'admin') return NextResponse.json(await getScorecardAdmin())
    return NextResponse.json(await getScorecardPage(params))
  } catch (e) {
    return apiError(e)
  }
}

/** POST op: refresh | save_source | remove_source (admin-only inside the lib). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    switch (String(body.op || '')) {
      case 'refresh':
        return NextResponse.json(await refreshScorecard(body.months))
      case 'save_source':
        return NextResponse.json(await saveScorecardSource(body.month, body.link))
      case 'remove_source':
        return NextResponse.json(await removeScorecardSource(body.month))
      default:
        return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
    }
  } catch (e) {
    return apiError(e)
  }
}
