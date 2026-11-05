import { NextResponse } from 'next/server'
import { requireAdminCaller } from '@/features/shared/lib/admin-auth'
import { apiError } from '@/features/shared/lib/api-error'
import { createAuthClient } from '@/features/shared/lib/auth'
import { configAll } from '@/features/shared/platform/settings'
import { dqSetting_ } from '@/features/shared/lib/adapters'
import { fetchWorkbookTabs } from '@/features/shared/jobs/sheets'
import { syncAllMirrors, type MirrorTable, MIRROR_TABLES } from '@/features/shared/jobs/mirrors'

export const maxDuration = 300

/**
 * POST /api/admin/mirrors — sync the Google Sheet source tabs into the Supabase
 * mirror tables (migration 004) the interactive TPH path reads.
 *   { table?: 'fd_activities'|'maqsam_calls'|'freshchat', full?: boolean, monthsBack?: number }
 * Default: all three, incremental (watermark + 24 h overlap).
 * Each table's result is reported independently; failures list per-table errors.
 */
export async function POST(req: Request) {
  try {
    await requireAdminCaller(req)
    const body = (await req.json().catch(() => ({}))) as {
      table?: string
      full?: boolean
      monthsBack?: number
      peek?: { ssId?: string; tab?: string; head?: number; tail?: number; slice?: [number, number] }
    }
    /* diagnostics: {peek:{tab, head?, tail?}} returns the first/last N rows of
     * a source tab (Activities by default) — no writes. */
    if (body.peek && typeof body.peek === 'object') {
      const cfg0 = await configAll()
      const id = body.peek.ssId || String(dqSetting_(cfg0, 'fd_activity_ss_id'))
      const tab = body.peek.tab || 'Activities'
      const tabs = await fetchWorkbookTabs(id, [tab])
      const rows = tabs[tab] || []
      const head = Math.max(1, Math.min(50, Number(body.peek.head) || 5))
      const tail = Math.max(0, Math.min(50, Number(body.peek.tail) || 0))
      const sl = Array.isArray(body.peek.slice) ? body.peek.slice : null
      return NextResponse.json({
        ok: true,
        workbook: id,
        tab,
        totalRows: rows.length,
        head: rows.slice(0, head),
        tail: tail ? rows.slice(-tail) : undefined,
        slice: sl ? rows.slice(Math.max(0, Number(sl[0]) || 0), Math.min(rows.length, Number(sl[1]) || 0)) : undefined,
      })
    }
    const tables = body.table ? ([body.table] as MirrorTable[]) : MIRROR_TABLES
    for (const t of tables) {
      if (!MIRROR_TABLES.includes(t)) {
        return NextResponse.json(
          { error: `Unknown mirror table '${t}'. Use one of: ${MIRROR_TABLES.join(', ')}.` },
          { status: 400 }
        )
      }
    }
    const cfg = await configAll()
    const results = await syncAllMirrors(cfg, { tables, full: !!body.full, monthsBack: body.monthsBack })
    const errors = Object.values(results).filter((r) => 'error' in r)
    return NextResponse.json({ ok: errors.length === 0, results }, { status: errors.length === Object.keys(results).length ? 503 : 200 })
  } catch (e) {
    return apiError(e)
  }
}

/** GET — the sync state (watermarks) per mirror table, for the health page. */
export async function GET(req: Request) {
  try {
    await requireAdminCaller(req)
    const cfg = await configAll()
    const supabase = await createAuthClient()
    const state: Record<string, unknown> = {}
    for (const t of MIRROR_TABLES) {
      const { count, error } = await supabase.from(t).select('*', { count: 'exact', head: true })
      state[t] = {
        watermark: (cfg[`mirror_state_${t}`] as { last_ts_ms?: number; last_sync_at?: string })?.last_sync_at || '',
        last_ts_ms: (cfg[`mirror_state_${t}`] as { last_ts_ms?: number })?.last_ts_ms || 0,
        rows: error ? null : (count ?? 0),
        error: error ? error.message : '',
      }
    }
    return NextResponse.json({ ok: true, state })
  } catch (e) {
    return apiError(e)
  }
}
