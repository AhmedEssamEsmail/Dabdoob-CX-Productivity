import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'
import { qaRollupAudits_, qaPeriodOf_, qaWhen_ } from '@/features/cx-quality/lib/core'
import { qaColumnTrend_, qaScoreDate_, qaScoreKnown_ } from '@/features/cx-quality/lib/analytics'
import { normEmail_ } from '@/features/shared/lib/adapters'

const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)

async function allRows(table: string, cols: string): Promise<Record<string, unknown>[]> {
  const out: Record<string, unknown>[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb.from(table).select(cols).range(from, from + 999)
    if (error) throw new Error(table + ': ' + error.message)
    out.push(...(data as unknown as Record<string, unknown>[]))
    if (!data || data.length < 1000) return out
  }
}

/** Sunday-start week key (Sun–Sat), matching startsOn=0. */
function weekOf(dateKey: string): string {
  return qaPeriodOf_(dateKey, 'week', 0)
}

/** Date a Sheets pivot would bucket on: parse interaction_at like Sheets does. */
function sheetDate(v: unknown): string {
  const s = String(v === undefined || v === null ? '' : v).replace(/^'/, '')
  const n = qaWhen_(s)
  const m = /^(\d{4}-\d{2}-\d{2})/.exec(n)
  if (m) return m[1]
  const iso = /^(\d{4}-\d{2}-\d{2})/.exec(s)
  if (iso) return iso[1]
  return ''
}

const WEEKS = [] as string[]
for (let i = 0; i < 12; i++) {
  const d = new Date(Date.UTC(2026, 7, 30) + i * 7 * 864e5)
  WEEKS.push(d.toISOString().slice(0, 10))
}

async function main() {
  const audits = [] as Record<string, unknown>[]
  for (let from = 0; ; from += 1000) {
    const { data, error } = await sb
      .from('qa_audits')
      .select('audit_id,kind,queue_id,agent_email,interaction_at,audit_date,status,score,score_final,source,sample_basis,audit_type')
      .gte('audit_date', '2026-06-01')
      .range(from, from + 999)
    if (error) throw new Error('qa_audits: ' + error.message)
    audits.push(...(data as Record<string, unknown>[]))
    if (!data || data.length < 1000) break
  }
  const queue = await allRows('qa_queue', 'queue_id,agent_email,interaction_at,source,status')
  console.log('qa_audits rows:', audits.length, '| qa_queue rows:', queue.length)

  // --- App semantics (post-fix): exactly what AgentWeeks renders ---
  const rolled = qaRollupAudits_(audits)
  const known = rolled.filter(qaScoreKnown_)
  const anchor = '2026-11-16'
  const cols = qaColumnTrend_(known, anchor, 0, (e: string) => e, (a) => qaScoreDate_(a, 'interaction')) as {
    agentWeeks: { periods: string[]; agents: { key: string; cells: { audits: number; avg: number | null }[] }[] }
  }
  const appCell: Record<string, Record<string, number>> = {}
  cols.agentWeeks.agents.forEach((g) => {
    appCell[g.key] = {}
    cols.agentWeeks.periods.forEach((p, i) => {
      appCell[g.key][p] = g.cells[i].audits
    })
  })

  // --- Pivot semantics: raw COUNTA(agent_email) by interaction date ---
  const rawCell: Record<string, Record<string, number>> = {}
  const rawNoDate: Record<string, number> = {}
  audits.forEach((a) => {
    const e = String(a.agent_email || '').trim()
    if (!e) return
    const d = sheetDate(a.interaction_at)
    if (!d) {
      rawNoDate[e] = (rawNoDate[e] || 0) + 1
      return
    }
    const w = weekOf(d)
    ;(rawCell[e] = rawCell[e] || {})[w] = ((rawCell[e] || {})[w] || 0) + 1
  })

  // --- Queue-draw hypothesis: count qa_queue rows by interaction date ---
  const qCell: Record<string, Record<string, number>> = {}
  queue.forEach((q) => {
    const e = String(q.agent_email || '').trim()
    if (!e) return
    const d = sheetDate(q.interaction_at)
    if (!d) return
    const w = weekOf(d)
    ;(qCell[e] = qCell[e] || {})[w] = ((qCell[e] || {})[w] || 0) + 1
  })

  const emails = Array.from(new Set([...Object.keys(rawCell), ...Object.keys(appCell), ...Object.keys(qCell)])).sort()
  const hdr = 'WEEK       ' + WEEKS.map((w) => w.slice(5)).join('  ')
  console.log('\n=== app (qaColumnTrend_ post-fix, random|historical+known) ===')
  console.log(hdr)
  emails.forEach((e) => {
    if (!appCell[e]) return
    console.log(e.padEnd(38), WEEKS.map((w) => String(appCell[e][w] || 0).padStart(8)).join(''))
  })
  console.log('\n=== raw qa_audits COUNTA by interaction date (pivot-on-audits) ===')
  console.log(hdr)
  emails.forEach((e) => {
    console.log(e.padEnd(38), WEEKS.map((w) => String((rawCell[e] || {})[w] || 0).padStart(8)).join(''), '  nodate:' + (rawNoDate[e] || 0))
  })
  console.log('\n=== qa_queue COUNTA by interaction date (draw hypothesis) ===')
  console.log(hdr)
  emails.forEach((e) => {
    if (!qCell[e]) return
    console.log(e.padEnd(38), WEEKS.map((w) => String((qCell[e] || {})[w] || 0).padStart(8)).join(''))
  })

  // --- per-cell diff: app vs raw ---
  console.log('\n=== cells where app != raw-pivot (overlapping weeks) ===')
  emails.forEach((e) => {
    const diffs: string[] = []
    WEEKS.forEach((w) => {
      const a = (appCell[e] || {})[w] || 0
      const r = (rawCell[e] || {})[w] || 0
      if (a !== r) diffs.push(`${w.slice(5)}: app=${a} raw=${r}`)
    })
    if (diffs.length) console.log(e, '->', diffs.join(' | '))
  })
}
main().catch((e) => console.error(e))
