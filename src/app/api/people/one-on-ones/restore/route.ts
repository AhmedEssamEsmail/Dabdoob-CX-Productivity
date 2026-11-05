import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesRestore } from '@/features/cx-people/lib/one-on-ones-delete'

/** Admin-only: restore a soft-deleted log or booking (rolls back its action reviews). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await oneOnOnesRestore(String(body.type || ''), String(body.id || '')))
  } catch (e) {
    return apiError(e)
  }
}
