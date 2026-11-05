/**
 * /api/queue/scheduler — Scheduler.js page read + mutations.
 * GET ?year&month -> schedulerPlan; POST {op:...} -> the save/decide/request fns.
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import * as sch from '@/features/cx-queue/lib/scheduler'

const OPS: Record<string, (p: Record<string, unknown>) => Promise<Record<string, unknown>>> = {
  save: sch.schedulerSave, saveSettings: sch.schedulerSaveSettings, saveTeamDates: sch.schedulerSaveTeamDates,
  offdays: (p) => sch.schedulerOffDays(p.year, p.month), saveOffDays: sch.schedulerSaveOffDays, setOverride: sch.schedulerSetOverride,
  setHourOverride: sch.schedulerSetHourOverride, requests: sch.schedulerRequests, submitRequest: sch.schedulerSubmitRequest,
  respondToSwap: sch.schedulerRespondToSwap, decide: sch.schedulerDecide, import: sch.schedulerImport,
  setupTables: sch.setupSchedulerTables, settings: sch.schedulerSettings, plan: sch.schedulerPlan,
}

export async function GET(req: NextRequest) {
  try {
    const q = req.nextUrl.searchParams
    if (q.get('view') === 'settings') return NextResponse.json(await sch.schedulerSettings())
    if (q.get('view') === 'requests') return NextResponse.json(await sch.schedulerRequests())
    if (q.get('view') === 'offdays') return NextResponse.json(await sch.schedulerOffDays(q.get('year'), q.get('month')))
    return NextResponse.json(await sch.schedulerPlan({ year: q.get('year'), month: q.get('month'), reshuffle: q.get('reshuffle') === '1', original: q.get('original') === '1', fresh: q.get('fresh') === '1' }))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const fn = OPS[String(body.op || 'plan')]
    if (!fn) return NextResponse.json({ error: 'Unknown op.' }, { status: 400 })
    return NextResponse.json(await fn(body))
  } catch (e) {
    return apiError(e)
  }
}
