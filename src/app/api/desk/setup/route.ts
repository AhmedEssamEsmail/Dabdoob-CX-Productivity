import { NextResponse } from 'next/server'
import { setupDesk, installDeskTriggers } from '@/features/cx-desk/lib/tlperformance'
import { apiError } from '@/features/shared/lib/api-error'

/** setupDesk (admin): seeds TLP/MD settings + tlp_tl_areas. installDeskTriggers via ?triggers=1. */
export async function POST(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    if (searchParams.get('triggers')) return NextResponse.json({ report: await installDeskTriggers() })
    return NextResponse.json({ report: await setupDesk() })
  } catch (e) {
    return apiError(e)
  }
}
