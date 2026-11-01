/**
 * Drive the admin endpoints on the deployed app:
 *   1. per-table mirror sync (each within one 300s invocation)
 *   2. backfill cursor loop for grid+tph+layers+flags
 * Usage: npx tsx scripts/ops/run-backfill-remote.ts [mirrors|backfill|all]
 */
const BASE = 'https://dabdoob-cx-productivity.vercel.app'
const KEY = 'prod-migrate-2024-secure-key'

interface BackfillRes {
  done?: { date: string; kind: string; rows: number | string }[]
  failed?: { date: string; kind: string; step?: string; error: string }[]
  skipped?: { date: string; kind?: string; reason: string }[]
  next?: unknown
  ms?: number
  fatal?: string
  httpStatus?: number
  raw?: string
}

async function post(path: string, body: unknown, tries = 3): Promise<BackfillRes> {
  for (let i = 0; i < tries; i++) {
    try {
      const res = await fetch(BASE + path, {
        method: 'POST',
        headers: { 'content-type': 'application/json', 'x-migration-key': KEY },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(295000),
      })
      const text = await res.text()
      try {
        return JSON.parse(text) as BackfillRes
      } catch {
        return { httpStatus: res.status, raw: text.slice(0, 400) }
      }
    } catch (e) {
      console.log(`  attempt ${i + 1} failed: ${(e as Error).message.slice(0, 120)}`)
      if (i === tries - 1) return { fatal: (e as Error).message }
    }
  }
  return { fatal: 'exhausted retries' }
}

async function main() {
  const what = process.argv[2] || 'all'

  if (what === 'all' || what === 'mirrors') {
    for (const table of ['fd_activities', 'maqsam_calls', 'freshchat']) {
      console.log(`--- mirrors ${table} ---`)
      const r = await post('/api/admin/mirrors', { table, full: true, monthsBack: 5 })
      console.log(JSON.stringify(r).slice(0, 800))
    }
  }

  if (what === 'all' || what === 'backfill') {
    let cursor: unknown = null
    const totals = { done: 0, failed: 0, skipped: 0 }
    for (let round = 1; round <= 60; round++) {
      const res = await post('/api/admin/backfill', {
        from: '2026-07-01',
        to: '2026-10-31',
        kinds: ['grid', 'tph', 'layers', 'flags'],
        cursor,
        budgetMs: 240000,
      })
      totals.done += (res.done || []).length
      totals.failed += (res.failed || []).length
      totals.skipped += (res.skipped || []).length
      console.log(
        `round ${round}: done+${(res.done || []).length} failed+${(res.failed || []).length} skipped+${(res.skipped || []).length} next=${JSON.stringify(res.next)} ms=${res.ms}`
      )
      ;(res.failed || []).slice(0, 8).forEach((f: Record<string, unknown>) => console.log('  FAIL', f.date, f.kind, f.step || '', String(f.error).slice(0, 140)))
      if (res.fatal) break
      if (!res.next) break
      cursor = res.next
    }
    console.log('TOTALS:', JSON.stringify(totals))
  }
}

main().catch((e) => console.error(e))
