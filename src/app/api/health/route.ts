import { NextResponse } from 'next/server'
import { requireRole, getEcosystemHealth, setupHealth } from '@/lib/platform'


/** getEcosystemHealth: the ecosystem health for Hub home / Admin (admin and TL). */
export async function GET() {
  try {
    await requireRole(['admin', 'tl'])
    return NextResponse.json(await getEcosystemHealth())
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}

/** setupHealth: create the heartbeat rows (idempotent). Admin only. */
export async function POST() {
  try {
    await requireRole(['admin'])
    return NextResponse.json({ message: await setupHealth() })
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
