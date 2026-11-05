/**
 * /api/queue/heatmap — Heatmap.js page read + mutations.
 * GET            -> getHeatmapPage; GET ?input=<id>[&set=<id>] -> getHeatmapInput
 * POST {op:...}  -> saveHeatmapInput | parseHeatmapUpload | buildHeatmapFromSource |
 *                  runPriorHeatmapRegression | saveHeatmapAssumptions | setHeatmapCountries
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError } from '@/features/shared/lib/api-error'
import {
  buildHeatmapFromSource, getHeatmapInput, getHeatmapPage, parseHeatmapUpload,
  runPriorHeatmapRegression, saveHeatmapAssumptions, saveHeatmapInput, setHeatmapCountries,
} from '@/features/cx-queue/lib/heatmap'

export async function GET(req: NextRequest) {
  try {
    const input = req.nextUrl.searchParams.get('input')
    if (input) return NextResponse.json(await getHeatmapInput(input, req.nextUrl.searchParams.get('set') || undefined))
    return NextResponse.json(await getHeatmapPage())
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const op = String(body.op || 'save')
    const fn =
      op === 'parse' ? parseHeatmapUpload
      : op === 'build' ? buildHeatmapFromSource
      : op === 'regression' ? () => runPriorHeatmapRegression(body.inputId)
      : op === 'assumptions' ? saveHeatmapAssumptions
      : op === 'countries' ? () => setHeatmapCountries(body.countries)
      : saveHeatmapInput
    return NextResponse.json(await fn(body))
  } catch (e) {
    return apiError(e)
  }
}
