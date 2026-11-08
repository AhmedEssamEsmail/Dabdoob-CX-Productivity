import { NextResponse } from 'next/server'
import { getAppBootstrap } from '@/features/shared/platform/bootstrap'
import { qaBootFlags } from '@/features/cx-quality/lib/server'


export async function GET() {
  try {
    return NextResponse.json(await getAppBootstrap(qaBootFlags))
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: msg === 'Unauthorized' ? 401 : 403 })
  }
}
