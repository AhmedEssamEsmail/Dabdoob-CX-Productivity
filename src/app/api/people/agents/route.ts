import { NextResponse } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import { getAgentsPage } from '@/features/cx-people/lib/agents-page'

/** getAgentsPage (Aggregates.js): the agent scoreboard, TLs filtered to their team. */
export async function GET() {
  try {
    return NextResponse.json(await getAgentsPage())
  } catch (e) {
    return apiError(e)
  }
}
