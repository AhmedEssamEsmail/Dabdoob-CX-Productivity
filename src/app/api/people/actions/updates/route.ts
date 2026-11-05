import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { actionsPostUpdate } from '@/features/cx-people/lib/actions'

/** actionsPostUpdate: a status note on an action; the review closes it, not this. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { actionId?: string } & Record<string, unknown>
    return NextResponse.json(await actionsPostUpdate(String(body.actionId || ''), body))
  } catch (e) {
    return apiError(e)
  }
}
