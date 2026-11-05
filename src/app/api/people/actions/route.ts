import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { requireRole, pwDirectory } from '@/features/shared/platform/identity'
import { actionsMine, actionsCreate } from '@/features/cx-people/lib/actions'

/** actionsMine: the caller's own open actions, every source (Home and the 1:1 opener). */
export async function GET() {
  try {
    const user = await requireRole(['admin', 'tl', 'agent'])
    return NextResponse.json(await actionsMine(user, await pwDirectory()))
  } catch (e) {
    return apiError(e)
  }
}

/** actionsCreate: an adhoc action; TLs may assign to themselves or their agents. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await actionsCreate(body))
  } catch (e) {
    return apiError(e)
  }
}
