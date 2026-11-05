import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import {
  meetingsPage, meetingsCreateSeries, meetingsOpen, meetingsGet, meetingsSave,
  meetingsReview, meetingsAddActions, meetingsLogActions, meetingsClose, meetingsSendSummary,
} from '@/features/cx-people/lib/meetings'

/** meetingsPage / meetingsGet: the series and meetings the caller may see (chair/member/admin). */
export async function GET(req: Request) {
  try {
    const meetingId = new URL(req.url).searchParams.get('meetingId')
    if (meetingId) return NextResponse.json(await meetingsGet(meetingId))
    return NextResponse.json(await meetingsPage())
  } catch (e) {
    return apiError(e)
  }
}

/** The meeting writes, dispatched by op. Chair/admin rules live in the lib. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown> & {
      op?: string; seriesId?: string; meetingId?: string; heldAt?: unknown; nextMeetingAt?: unknown
      heldOn?: unknown; patch?: Record<string, unknown>; reviews?: Record<string, unknown>[]
      list?: Record<string, unknown>[]; attendance?: Record<string, boolean>
    }
    switch (String(body.op || '')) {
      case 'create_series':
        return NextResponse.json(await meetingsCreateSeries(body))
      case 'open':
        return NextResponse.json(await meetingsOpen(String(body.seriesId || ''), body.heldAt, body.nextMeetingAt))
      case 'save':
        return NextResponse.json(await meetingsSave(String(body.meetingId || ''), body.patch || {}))
      case 'review':
        return NextResponse.json(await meetingsReview(String(body.meetingId || ''), body.reviews || []))
      case 'add_actions':
        return NextResponse.json(await meetingsAddActions(String(body.meetingId || ''), body.list || []))
      case 'log_actions':
        return NextResponse.json(await meetingsLogActions(String(body.seriesId || ''), body.heldOn, body.list || []))
      case 'close':
        return NextResponse.json(await meetingsClose(String(body.meetingId || ''), body.attendance || {}))
      case 'send_summary':
        return NextResponse.json(await meetingsSendSummary(String(body.meetingId || '')))
      default:
        return NextResponse.json({ error: 'Unknown op' }, { status: 400 })
    }
  } catch (e) {
    return apiError(e)
  }
}
