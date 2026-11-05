import { NextResponse } from 'next/server'
import { getViewAsState, startViewAs, stopViewAs } from '@/features/shared/platform'

/**
 * The legacy View as surface (startViewAs / stopViewAs / getViewAsState):
 * GET answers the owner's current target, POST {email} starts or switches,
 * DELETE exits. Only the CX owner may call these — enforced inside the lib.
 */
export async function GET() {
  try {
    return NextResponse.json(await getViewAsState())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}

export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as { email?: string }
    return NextResponse.json(await startViewAs(body.email || ''))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 400 })
  }
}

export async function DELETE() {
  try {
    return NextResponse.json(await stopViewAs())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 400 })
  }
}
