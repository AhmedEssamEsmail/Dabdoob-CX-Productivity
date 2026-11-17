/**
 * /api/queue/heatmap — Heatmap.js page read + mutations.
 * GET            -> getHeatmapPage; GET ?input=<id> -> getHeatmapInput
 * POST {op:...}  -> saveHeatmapInput | parseHeatmapUpload | buildHeatmapFromSource |
 *                  saveHeatmapAssumptions | setHeatmapCountries
 */
import { NextResponse, type NextRequest } from 'next/server'
import { apiError, InputError } from '@/features/shared/lib/api-error'
import {
  buildHeatmapFromSource, getHeatmapInput, getHeatmapPage, parseHeatmapUpload,
  saveHeatmapAssumptions, saveHeatmapInput, setHeatmapCountries,
} from '@/features/cx-queue/lib/heatmap'

export async function GET(req: NextRequest) {
  try {
    const input = req.nextUrl.searchParams.get('input')
    if (input) return NextResponse.json(await getHeatmapInput(input))
    return NextResponse.json(await getHeatmapPage(req.nextUrl.searchParams.get('page') || undefined))
  } catch (e) {
    return apiError(e)
  }
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Record<string, unknown>
    const op = String(body.op || 'save')
    if (op === 'regression') throw new InputError('Unknown op.')
    const out =
      op === 'parse'
        ? await parseHeatmapUpload(body.fileName ?? body.name, body.base64 ?? body.data)
        : op === 'build'
          ? await buildHeatmapFromSource(body.spreadsheetId, body.opts as Record<string, unknown> | undefined)
          : op === 'assumptions'
              ? await saveHeatmapAssumptions(body.name, body.assumptions)
              : op === 'countries'
                ? await setHeatmapCountries(body.countries, body.aliases)
                : await saveHeatmapInput(body.name, body.source, body.heatmap)
    return NextResponse.json(out)
  } catch (e) {
    return apiError(e)
  }
}
