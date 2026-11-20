/**
 * qa-audits-sync.ts — push NEW rows from the CC2 Quality sheet's `qa_audits`
 * tab into the qa_audits table. Diff-scoped on audit_id (never overwrites
 * rows the app has already mutated). Uses the same readSheet + mapRow +
 * route-core mapping as the admin migrate route, so coercion is identical.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/ops/qa-audits-sync.ts
 * Add `--all` to skip the diff and upsert every sheet row (full sync).
 */
import dotenv from 'dotenv'
dotenv.config({ path: '.env.local' })
import { createClient } from '@supabase/supabase-js'

const SS_QUALITY = '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w'

async function main() {
  const { readSheet, mapRow, conflictTarget } = await import('@/features/shared/migration/engine')
  const { MAPPINGS } = await import('@/features/shared/migration/mappings/route-core')
  const mapping = MAPPINGS.find((m) => m.spreadsheet === 'quality' && m.sheet === 'qa_audits')
  if (!mapping) throw new Error('quality/qa_audits mapping not found in route-core')

  const sb = createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, process.env.SUPABASE_SERVICE_ROLE_KEY!)
  const rows = await readSheet(SS_QUALITY, 'qa_audits')
  console.log('sheet data rows:', rows.length)

  let wanted = rows
  if (!process.argv.includes('--all')) {
    const dbIds = new Set<string>()
    for (let from = 0; ; from += 1000) {
      const { data, error } = await sb.from('qa_audits').select('audit_id').range(from, from + 999)
      if (error) throw error
      ;(data || []).forEach((r) => dbIds.add(String(r.audit_id)))
      if (!data || data.length < 1000) break
    }
    wanted = rows.filter((r) => r.audit_id && !dbIds.has(String(r.audit_id)))
    console.log('already in db:', dbIds.size, '| new to sync:', wanted.length)
  }

  const mapped = wanted
    .map((r) => mapRow(r, mapping))
    .filter((r) => (mapping.require || []).every((c) => r[c] !== null && r[c] !== undefined))

  const seen = new Map<string, Record<string, unknown>>()
  for (const r of mapped) seen.set(String(r.audit_id), r)
  const batch = [...seen.values()]

  let migrated = 0
  const errors: string[] = []
  for (let i = 0; i < batch.length; i += 500) {
    const { error } = await sb
      .from('qa_audits')
      .upsert(batch.slice(i, i + 500), { onConflict: conflictTarget('audit_id') })
    if (error) errors.push(`rows ${i}-${i + 500}: ${error.message}`)
    else migrated += Math.min(500, batch.length - i)
  }
  console.log(JSON.stringify({ read: rows.length, attempted: batch.length, migrated, skipped: wanted.length - mapped.length, errors }))
}
main().catch((e) => console.error(e))
