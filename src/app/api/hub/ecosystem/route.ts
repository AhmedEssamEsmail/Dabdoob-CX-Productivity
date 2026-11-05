/* GET /api/hub/ecosystem — getEcosystemHealth (Health.js): node/link states for the ecosystem diagram. Admin + TL only. */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { requireRole } from '@/features/shared/platform/identity'
import { ecosystemHealth } from '@/features/shared/platform/health'

export async function GET() {
  try {
    await requireRole(['admin', 'tl'])
    return NextResponse.json(await ecosystemHealth())
  } catch (e) {
    return apiError(e)
  }
}
