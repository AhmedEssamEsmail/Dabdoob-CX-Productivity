/**
 * /api/hub/roster — RosterSync.js: getRosterAdmin (GET) and the admin writes
 * (POST { action }): setPerson | addHoliday | removeHoliday | syncRoster |
 * setOverrides — the same calls the legacy Vi api object made.
 */
import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import {
  addHoliday,
  getRosterAdmin,
  removeHoliday,
  setPersonOverrides,
  setPersonV2Fields,
  syncRosterNow,
} from '@/features/cx-hub/lib/roster'

export async function GET() {
  try {
    return NextResponse.json(await getRosterAdmin())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: Request) {
  try {
    const body = ((await req.json().catch(() => ({}))) || {}) as Record<string, unknown>
    const action = String(body.action || '')
    switch (action) {
      case 'setPerson':
        return NextResponse.json(
          await setPersonV2Fields(String(body.email || ''), (body.fields || {}) as never)
        )
      case 'addHoliday':
        return NextResponse.json(await addHoliday((body.h || body) as never))
      case 'removeHoliday':
        return NextResponse.json(await removeHoliday(String(body.id || '')))
      case 'syncRoster':
        return NextResponse.json(await syncRosterNow())
      case 'setOverrides':
        return NextResponse.json(
          await setPersonOverrides(String(body.email || ''), (body.o || {}) as never)
        )
      default:
        return NextResponse.json({ error: 'Unknown action "' + action + '".' }, { status: 400 })
    }
  } catch (e) {
    return apiError(e)
  }
}
