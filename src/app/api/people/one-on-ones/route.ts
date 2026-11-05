import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { oneOnOnesPage, oneOnOnesSubmit } from '@/features/cx-people/lib/one-on-ones-page'

/** oneOnOnesPage: the 1:1 list + booker payload (TLs: their agents; admin: all TL pairs). */
export async function GET() {
  try {
    return NextResponse.json(await oneOnOnesPage())
  } catch (e) {
    return apiError(e)
  }
}

/** oneOnOnesSubmit: the 1:1 record (topics + reviews + new actions + private note). */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    return NextResponse.json(await oneOnOnesSubmit(body))
  } catch (e) {
    return apiError(e)
  }
}
