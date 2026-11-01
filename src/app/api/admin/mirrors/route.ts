import { NextResponse } from 'next/server'
import { requireAdminCaller } from '@/lib/admin-auth'
import { apiError } from '@/lib/api-error'
import { createAuthClient } from '@/lib/auth'
import { configAll } from '@/lib/platform/settings'
import { syncAllMirrors, type MirrorTable, MIRROR_TABLES } from '@/lib/jobs/mirrors'

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
    const body = (await req.json().catch(() => ({}))) as { table?: string; full?: boolean; monthsBack?: number }
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
