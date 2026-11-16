/**
 * verify-hct-parity.mts — pre-merge baseline for unify-roster-source (S02-02).
 *
 * Proves the new sheet-direct roster source returns the same record stream the
 * live `dq_hct` table still holds pre-merge: Sheet1 is read through
 * dqReadHct_() (src/features/cx-hub/lib/roster.ts — the same readSheet engine
 * /api/admin/migrate uses in prod) and diffed against `dq_hct` via the
 * service-role key. PLAN criterion #2 pairs this with S01-04's golden parity.
 *
 * READ-ONLY on both sides: one Sheets read plus a paginated select('*') on
 * dq_hct. Nothing is written, updated, or auto-fixed — diffs are only reported.
 *
 * Run (remote read — run ONLY with explicit user approval):
 *   npx tsx --tsconfig scripts/tsconfig.json scripts/ops/verify-hct-parity.mts
 * Env: dotenv precedent — .env.pulled first, then .env.production.
 * Exit: 0 + "PARITY OK" when identical; 1 on any diff or read failure.
 */
import dotenv from 'dotenv'
import { createClient } from '@supabase/supabase-js'

dotenv.config({ path: '.env.local' })
dotenv.config({ path: '.env.pulled' })
dotenv.config({ path: '.env.production' })

// The 15 projected keys dqReadHct_ emits == dq_hct's adapter columns verbatim
// (id + synced_at are table-internal and excluded by design).
const DQ_HCT_KEYS = [
  'name', 'email', 'position', 'department', 'section', 'manager',
  'status', 'lwd', 'hiringDate', 'fdId', 'fdName', 'maqsamName',
  'code', 'gender', 'contactNumber',
] as const

const EXAMPLE_CAP = 25
const PAGE = 1000

type Rec = Record<string, unknown>
type Diff = { email: string; field: string; sheet: string; table: string }

/** Keep the 15 projected keys; each value compared as String(v ?? ''). */
function normalize(rec: Rec): Record<string, string> {
  const out: Record<string, string> = {}
  for (const k of DQ_HCT_KEYS) out[k] = String(rec[k] ?? '')
  return out
}

/**
 * Index rows by raw String(email) — mirrors dqReadHct_ last-wins dedupe.
 * Only null/undefined/empty-string emails skip as `blank` (production's
 * null-filter); whitespace/case variants stay distinct raw keys so they
 * surface as only-sheet/only-table diffs instead of being masked.
 */
function indexByEmail(rows: Rec[]) {
  const byEmail = new Map<string, Record<string, string>>()
  let blank = 0
  for (const r of rows) {
    if (r.email == null || r.email === '') {
      blank++
      continue
    }
    byEmail.set(String(r.email), normalize(r))
  }
  return { byEmail, blank }
}

/** Read all of dq_hct in bounded pages (select('*'), no writes). */
async function readTable(sb: ReturnType<typeof createClient>): Promise<Rec[]> {
  const all: Rec[] = []
  for (let off = 0; ; off += PAGE) {
    const { data, error } = await sb
      .from('dq_hct')
      .select('*')
      .range(off, off + PAGE - 1)
    if (error) throw new Error(`dq_hct read failed: ${error.message}`)
    const rows = (data ?? []) as Rec[]
    all.push(...rows)
    if (rows.length < PAGE) return all
  }
}

const clip = (v: string) => (v.length > 40 ? `${v.slice(0, 37)}...` : v)

async function main() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) {
    console.error('NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY missing — check .env.pulled / .env.production.')
    process.exit(1)
  }

  // Lazy import AFTER env load: roster.ts -> platform modules read env at
  // module scope; 'server-only' resolves via the scripts/tsconfig.json stub.
  const { dqReadHct_ } = await import('@/features/cx-hub/lib/roster')
  const sheetRows = await dqReadHct_()
  const tableRows = await readTable(createClient(url, key))

  const sheet = indexByEmail(sheetRows)
  const table = indexByEmail(tableRows)

  // case-variants: raw keys folding to the same trim().toLowerCase() form.
  // Diagnostic only — raw-key indexing already routes variants to
  // only-sheet/only-table, so the existing exit(1) below covers them.
  for (const [side, idx] of [['sheet', sheet], ['table', table]] as const) {
    const folded = new Map<string, Set<string>>()
    for (const raw of idx.byEmail.keys()) {
      const f = raw.trim().toLowerCase()
      const g = folded.get(f) ?? new Set<string>()
      g.add(raw)
      folded.set(f, g)
    }
    const variants = [...folded.values()].filter((g) => g.size > 1)
    console.log(`case-variants: ${side} ${variants.length}`)
    for (const g of variants.slice(0, EXAMPLE_CAP)) {
      console.log(`  case-variants ${side} ${[...g].map((k) => JSON.stringify(k)).join(' ')}`)
    }
  }

  const onlySheet = [...sheet.byEmail.keys()].filter((e) => !table.byEmail.has(e))
  const onlyTable = [...table.byEmail.keys()].filter((e) => !sheet.byEmail.has(e))
  const diffs: Diff[] = []
  let diffCount = 0
  for (const [email, sRec] of sheet.byEmail) {
    const tRec = table.byEmail.get(email)
    if (!tRec) continue
    for (const f of DQ_HCT_KEYS) {
      if (sRec[f] === tRec[f]) continue
      diffCount++
      if (diffs.length < EXAMPLE_CAP) {
        diffs.push({ email, field: f, sheet: sRec[f], table: tRec[f] })
      }
    }
  }

  console.log(`sheet rows: ${sheetRows.length} (indexed ${sheet.byEmail.size}, blank-email skipped ${sheet.blank})`)
  console.log(`table rows: ${tableRows.length} (indexed ${table.byEmail.size}, blank-email skipped ${table.blank})`)
  console.log(`only-in-sheet: ${onlySheet.length} | only-in-table: ${onlyTable.length} | field diffs: ${diffCount}`)
  for (const e of onlySheet.slice(0, EXAMPLE_CAP)) console.log(`  only-sheet  ${e}`)
  for (const e of onlyTable.slice(0, EXAMPLE_CAP)) console.log(`  only-table  ${e}`)
  for (const d of diffs) {
    console.log(`  diff ${d.email} .${d.field}: sheet="${clip(d.sheet)}" table="${clip(d.table)}"`)
  }

  if (onlySheet.length || onlyTable.length || diffCount || sheet.blank || table.blank) {
    process.exit(1)
  }
  console.log('PARITY OK')
  process.exit(0)
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
