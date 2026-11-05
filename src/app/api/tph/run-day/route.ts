import { requireRole } from '@/features/shared/lib/auth'
import { viewAsGuard } from '@/features/shared/platform/viewas'
import { apiError } from '@/features/shared/lib/api-error'
import { prodReady_ } from '@/features/cx-productivity/lib/prod/engine'
import { tphLoadStore_ } from '@/features/cx-productivity/lib/tph/page'
import { tphPastDay_, tphRunStep_ } from '@/features/cx-productivity/lib/tph/run'
import { TPH_STEPS, TPH_TIME_GUARD_MS } from '@/features/cx-productivity/lib/tph'
import { NextResponse } from 'next/server'

/** runTphDay(date) — every step for one past day in one call. */
export async function POST(req: Request) {
  try {
    const user = await requireRole(['admin', 'tl'])
    await viewAsGuard()
    const body = await req.json()
    const store = await tphLoadStore_()
    if (!prodReady_(store.cfg)) throw new Error('Run setupProductivity first.')
    const d = tphPastDay_(store, body.date)
    const t0 = Date.now()
    const res: Record<string, unknown> = { date: d, steps: [], left: [], touchCells: 0, callsError: '', casesRebuilt: 0, casesReasons: {}, casesError: '' }
    for (const step of TPH_STEPS) {
      if (Date.now() - t0 > TPH_TIME_GUARD_MS) {
        ;(res.left as string[]).push(step)
        continue
      }
      const t = Date.now()
      try {
        const r = await tphRunStep_(store, d, step, String(user.email || '').toLowerCase())
        ;(res.steps as unknown[]).push({ step, ms: r.ms, error: '' })
        if (r.touchCells !== undefined) res.touchCells = r.touchCells
        if (r.casesRebuilt !== undefined) {
          res.casesRebuilt = (res.casesRebuilt as number) + r.casesRebuilt
          Object.keys(r.casesReasons || {}).forEach((c) => {
            ;(res.casesReasons as Record<string, string>)[c] = (r.casesReasons as Record<string, string>)[c]
          })
        }
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e)
        ;(res.steps as unknown[]).push({ step, ms: Date.now() - t, error: msg })
        if (step === 'calls') res.callsError = msg
        else if (step !== 'touches') res.casesError = res.casesError ? `${res.casesError}; ${msg}` : msg
        else throw e
      }
    }
    return NextResponse.json(res)
  } catch (e) {
    return apiError(e)
  }
}
