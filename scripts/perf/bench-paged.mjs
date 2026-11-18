/* Read-only benchmark: sequential vs concurrent PK-ordered paging (repo.ts readAllPaged).
   Usage: node scripts/perf/bench-paged.mjs [table:pk ...]   (needs .env.local) */
import dotenv from 'dotenv'

dotenv.config({ path: '.env.local', quiet: true })
const url = process.env.NEXT_PUBLIC_SUPABASE_URL
const key = process.env.SUPABASE_SERVICE_ROLE_KEY
const H = { apikey: key, Authorization: 'Bearer ' + key }
const PAGE = 1000
const CONCURRENCY = 6

async function page(table, pk, from, count) {
  const r = await fetch(`${url}/rest/v1/${table}?select=*&order=${pk}.asc`, {
    headers: { ...H, Range: `${from}-${from + PAGE - 1}`, 'Range-Unit': 'items', ...(count ? { Prefer: 'count=exact' } : {}) },
  })
  const rows = await r.json()
  const total = Number((r.headers.get('content-range') || '').split('/')[1])
  return { rows, total }
}

async function sequential(table, pk) {
  const out = []
  for (let from = 0; ; from += PAGE) {
    const { rows } = await page(table, pk, from)
    out.push(...rows)
    if (rows.length < PAGE) return out.length
  }
}

async function concurrent(table, pk) {
  const first = await page(table, pk, 0, true)
  let n = first.rows.length
  if (first.rows.length < PAGE) return n
  const starts = []
  for (let f = PAGE; f < first.total; f += PAGE) starts.push(f)
  for (let i = 0; i < starts.length; i += CONCURRENCY) {
    const wave = await Promise.all(starts.slice(i, i + CONCURRENCY).map((f) => page(table, pk, f)))
    wave.forEach((w) => (n += w.rows.length))
  }
  return n
}

const targets = process.argv.slice(2).length ? process.argv.slice(2) : ['qa_audits:audit_id', 'qa_queue:queue_id', 'qa_ctls:ctl_id']
for (const t of targets) {
  const [table, pk] = t.split(':')
  const runs = []
  for (let i = 0; i < 3; i++) {
    let s = performance.now()
    const a = await sequential(table, pk)
    const seq = Math.round(performance.now() - s)
    s = performance.now()
    const b = await concurrent(table, pk)
    runs.push([seq, Math.round(performance.now() - s), a, b])
  }
  const med = (i) => runs.map((r) => r[i]).sort((x, y) => x - y)[1]
  console.log(`${table}: rows=${runs[0][2]}/${runs[0][3]} sequential=${med(0)}ms concurrent=${med(1)}ms`)
}
