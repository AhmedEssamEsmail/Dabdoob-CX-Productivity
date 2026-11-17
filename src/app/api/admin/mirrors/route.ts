import { NextResponse } from 'next/server'
import { requireAdminCaller } from '@/features/shared/lib/admin-auth'
import { apiError } from '@/features/shared/lib/api-error'
import { db } from '@/features/shared/platform/repo'
import { configAll } from '@/features/shared/platform/settings'
import { fdActivityCells_, freshchatCells_, maqsamCells_ } from '@/features/shared/jobs/mirror-cells'
import { syncAllMirrors, type MirrorTable, MIRROR_TABLES } from '@/features/shared/jobs/mirrors'
import { assertWritable } from '@/features/shared/platform/viewas'

export const maxDuration = 300

/* peek tab -> mirror table; rows map back to the legacy positional cell
 * layout via the mirror-cells emitters. */
const PEEK_SOURCES: Record<string, { table: MirrorTable; cells: (r: Record<string, unknown>) => unknown[] }> = {
  Activities: { table: 'fd_activities', cells: fdActivityCells_ },
  'Maqsam Calls': { table: 'maqsam_calls', cells: maqsamCells_ },
  Freshchat: { table: 'freshchat', cells: freshchatCells_ },
}

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
    /* diagnostics: {peek:{tab, head?, tail?, slice?}} returns the first/last N
     * rows of a DB mirror table (Activities by default) — no writes, no sheet
     * reads. `peek.ssId` is ignored: the oracle is the mirror table now. */
    if (body.peek && typeof body.peek === 'object') {
      const tab = body.peek.tab || 'Activities'
      const spec = PEEK_SOURCES[tab]
      if (!spec) {
        return NextResponse.json(
          { error: "Peek supports 'Activities' | 'Maqsam Calls' | 'Freshchat' (the DB mirror tables)." },
          { status: 400 }
        )
      }
      const supabase = db()
      const { count } = await supabase.from(spec.table).select('*', { count: 'exact', head: true })
      const totalRows = count ?? 0
      const head = Math.max(1, Math.min(50, Number(body.peek.head) || 5))
      const tail = Math.max(0, Math.min(50, Number(body.peek.tail) || 0))
      const { data: headRows } = await supabase
        .from(spec.table)
        .select('*')
        .order('ts_ms', { ascending: true })
        .limit(head)
      const headCells = (headRows ?? []).map(spec.cells)
      let tailCells: unknown[] | undefined
      if (tail) {
        const { data: tailRows } = await supabase
          .from(spec.table)
          .select('*')
          .order('ts_ms', { ascending: false })
          .limit(tail)
        tailCells = (tailRows ?? []).map(spec.cells).reverse()
      }
      const sl = Array.isArray(body.peek.slice) ? body.peek.slice : null
      let sliceCells: unknown[][] | undefined
      if (sl) {
        const s0 = Math.max(0, Number(sl[0]) || 0)
        const s1 = Math.min(s0 + 500, Math.max(0, Number(sl[1]) || 0))
        if (s1 > s0) {
          const { data: sliceRows } = await supabase
            .from(spec.table)
            .select('*')
            .order('ts_ms')
            .range(s0, s1 - 1)
          sliceCells = (sliceRows ?? []).map(spec.cells)
        }
      }
      return NextResponse.json({
        ok: true,
        table: spec.table,
        tab,
        totalRows,
        head: headCells,
        tail: tailCells,
        slice: sliceCells,
      })
    }
    await assertWritable()
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
    const supabase = db()
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
