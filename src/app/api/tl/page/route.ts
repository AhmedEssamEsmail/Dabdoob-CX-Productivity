import { NextResponse } from 'next/server'
import { tlPerformancePage } from '@/features/cx-desk/lib/tlperformance'
import { apiError } from '@/features/shared/lib/api-error'

/** tlPerformancePage: the TL performance page envelope (Desk app #/tl-performance). */
export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url)
    return NextResponse.json(await tlPerformancePage(searchParams.get('tl') || searchParams.get('tl_email') || ''))
  } catch (e) {
    return apiError(e)
  }
}
