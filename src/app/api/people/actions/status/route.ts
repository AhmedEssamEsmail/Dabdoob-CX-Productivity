import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { actionsSetStatus } from '@/features/cx-people/lib/actions'

/** actionsSetStatus: owner or manager changes an action's status. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { actionId?: string; status?: string; note?: string }
    return NextResponse.json(await actionsSetStatus(String(body.actionId || ''), String(body.status || ''), body.note))
  } catch (e) {
    return apiError(e)
  }
}
