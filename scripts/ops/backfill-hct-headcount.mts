/**
 * backfill-hct-headcount.mts — S07-01: re-read HCT `Sheet1` with the service
 * account, upsert the mapped columns into `dq_hct` (fills code / gender /
 * contactNumber / position — NULL on the 51 pre-split rows), then run
 * dqSyncRoster_() so `roster` rows pick up position / gender / mobile /
 * hr_id / employment_status. Same code path as the "Sync roster from HCT
 * now" button — no new sync semantics.
 *
 * Run:  npx tsx --tsconfig scripts/tsconfig.json scripts/ops/backfill-hct-headcount.mts [--dry-run]
 *
 * --dry-run reads Sheet1 and prints per-column non-null counts, then exits
 * before any Supabase client is created (Sheets is read-only).
 * The real run UPSERTS dq_hct and syncs `roster` on the REMOTE database —
 * run it only with explicit user approval.
 */
import { google } from 'googleapis'
import dotenv from 'dotenv'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { createClient } from '@supabase/supabase-js'
import { headerKeys, conflictTarget, SPREADSHEETS } from '@/features/shared/migration/engine'
import { MAPPINGS } from '@/features/shared/migration/mappings/hct'

// Repo root ("cx-kpis-*.json next to package.json"): scripts/ops -> ../.. —
// check-sheet-access's '..' only reaches scripts/ and misses the keyfile.
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..')

dotenv.config({ path: '.env.pulled' })
dotenv.config({ path: '.env.production' })

// --- auth: verbatim check-sheet-access.mts (keyFile glob -> env-var fallback) ---
const keyFile =
  process.env.GOOGLE_APPLICATION_CREDENTIALS ||
  fs.readdirSync(ROOT)
    .filter((f) => /\.iam\.gserviceaccount\.com\.json$|^cx-kpis-.*\.json$|^service-account.*\.json$/.test(f))
    .map((f) => path.join(ROOT, f))[0]

const auth = keyFile
  ? new google.auth.GoogleAuth({
      keyFile,
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
  : new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
const sheets = google.sheets({ version: 'v4', auth })

const MAP = MAPPINGS[0] // hct Sheet1 -> dq_hct (mappings/hct.ts)
const HCT_ID = SPREADSHEETS.hct
const UPSERT_ON = MAP.upsertOn || 'email'
const COUNT_COLS = ['name', 'email', 'position', 'code', 'gender', 'contactNumber', 'status']

/** readTab from check-sheet-access.mts — A:S only, the U..W side-table is ignored. */
async function readTab(ssId: string, tab: string): Promise<unknown[][]> {
  const res = await sheets.spreadsheets.values.get({
    spreadsheetId: ssId,
    range: `'${tab.replace(/'/g, "\\'")}'!A:S`,
  })
  return (res.data.values || []) as unknown[][]
}

/** engine.ts readSheet (168-188) verbatim — widest-row keys + headerKeys. */
function rowsToObjects(raw: unknown[][]): Record<string, unknown>[] {
  let width = raw[0]?.length ?? 0
  for (const r of raw) if (r.length > width) width = r.length
  const keys = headerKeys(Array.from({ length: width }, (_, i) => raw[0]?.[i]))
  return raw.slice(1).map((row) => {
    const obj: Record<string, unknown> = {}
    keys.forEach((key, i) => {
      obj[key] = row[i]
    })
    return obj
  })
}

/** mapRow's null handling only (engine.ts:193-205): '' / undefined -> null.
 * Deliberately no JSON/INT/NUM coercion — `position` sits in the engine's
 * global SUGGESTED_INT_COLS and parseInt would null every job title. */
function mapRow(row: Record<string, unknown>): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  for (const col of MAP.columns) {
    const v = row[MAP.sheetToDb?.[col] || col]
    out[col] = v === undefined || v === '' ? null : v
  }
  return out
}

async function main() {
  const dryRun = process.argv.includes('--dry-run')
  const raw = await readTab(HCT_ID, MAP.sheet)
  if (raw.length < 2) {
    console.error(`Sheet '${MAP.sheet}' of ${HCT_ID} is empty or unreadable.`)
    process.exit(1)
  }

  const objects = rowsToObjects(raw)
  let mapped = objects
    .map(mapRow)
    .filter((r) => !(MAP.require || []).some((c) => r[c] === null || r[c] === undefined))
  const requireDropped = objects.length - mapped.length

  // upsertOn dedupe, last wins (engine.ts:264-269) — a duplicated conflict
  // key inside one batch makes Postgres reject the whole upsert.
  const seen = new Map<string, Record<string, unknown>>()
  for (const r of mapped) seen.set(String(r[UPSERT_ON]), r)
  const dupSkipped = mapped.length - seen.size
  mapped = Array.from(seen.values())

  console.log(
    `hct ${MAP.sheet}: ${objects.length} data rows; ${requireDropped} dropped by require ${JSON.stringify(MAP.require)}; ` +
      `${dupSkipped} duplicate ${UPSERT_ON} keys (last wins); ${mapped.length} rows to upsert`
  )
  const counts: Record<string, number> = {}
  for (const c of COUNT_COLS) counts[c] = mapped.filter((r) => r[c] !== null && r[c] !== undefined).length
  console.log('non-null counts:', JSON.stringify(counts))

  if (dryRun) {
    console.log('--dry-run: no DB client created, nothing written.')
    process.exit(0)
  }

  // Service-role client (route.ts:8-11 precedent) — created only past the
  // dry-run exit; Sheets above stays on the read-only scope.
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const batchSize = 500
  let migrated = 0
  const errors: string[] = []
  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize)
    const { error } = await supabase
      .from(MAP.table)
      .upsert(batch, { onConflict: conflictTarget(UPSERT_ON) })
    if (error) errors.push(`Rows ${i}-${i + batch.length}: ${error.message}`)
    else migrated += batch.length
  }
  console.log(
    `dq_hct upsert: read=${objects.length} migrated=${migrated} skipped=${requireDropped + dupSkipped} errors=${errors.length}`
  )
  errors.forEach((e) => console.error('  ' + e))
  if (errors.length) process.exit(1)

  // Lazy import: --dry-run never touches the DB client, and module-level env
  // reads in the app graph see the dotenv-loaded variables above.
  const { dqSyncRoster_ } = await import('@/features/cx-hub/lib/roster')
  const res = (await dqSyncRoster_()) as Record<string, unknown>
  const unresolved = (res.unresolved as unknown[]) || []
  console.log(
    'dqSyncRoster_:',
    JSON.stringify({ synced: res.synced, added: res.added, changed: res.changed, unresolved: unresolved.length })
  )
  if (unresolved.length) console.log('  unresolved:', JSON.stringify(unresolved).slice(0, 800))
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
