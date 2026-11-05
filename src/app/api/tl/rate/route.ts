import { NextResponse } from 'next/server'
import { tlpRateArea, tlpRateProject } from '@/features/cx-desk/lib/tlperformance'
import { apiError } from '@/features/shared/lib/api-error'

/** tlpRateArea / tlpRateProject: { action: 'area' | 'project', ... } — manager-only ratings. */
export async function POST(req: Request) {
  try {
    const body = (await req.json().catch(() => ({}))) as Record<string, unknown>
    const action = String(body.action || '')
    if (action === 'area') {
      return NextResponse.json(await tlpRateArea(String(body.tlEmail || ''), String(body.area || ''), body.value, String(body.note || '')))
    }
    if (action === 'project') {
      return NextResponse.json(await tlpRateProject(String(body.actionId || ''), body.value, String(body.note || '')))
    }
    return NextResponse.json({ error: 'Unknown rating action.' }, { status: 400 })
  } catch (e) {
    return apiError(e)
  }
}
