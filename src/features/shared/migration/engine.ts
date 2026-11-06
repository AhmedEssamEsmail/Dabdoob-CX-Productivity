/**
 * Sheets→Supabase migration engine — shared by the admin HTTP route
 * (src/app/api/admin/migrate/route.ts) and the CLI runner (migration/migrate-all.ts).
 *
 * MAPPINGS = the original 16-route entries + the wave-3 module files under
 * ./mappings/ (queue-quality, people-core, desk-operations). Aux exports the
 * siblings produced are merged here: SPREADSHEETS additions, ROW_TRANSFORMS,
 * NULL_AS_EMPTY, SUGGESTED_*_COLS, TRACKER_RECORD_BACKFILLS (+ postBackfill
 * storage_mode flip, WP-F6).
 */
import { google } from 'googleapis'
import type { SupabaseClient } from '@supabase/supabase-js'
import { MAPPINGS as QQ_MAPPINGS, ROW_TRANSFORMS as QQ_TRANSFORMS, SUGGESTED_INT_COLS as QQ_INT, SUGGESTED_NUM_COLS as QQ_NUM, SUGGESTED_JSON_COLS as QQ_JSON, DECISIONS as QQ_DECISIONS } from './mappings/queue-quality'
import { MAPPINGS as PC_MAPPINGS } from './mappings/people-core'
import { MAPPINGS as DO_MAPPINGS, ROW_TRANSFORMS as DO_TRANSFORMS, NULL_AS_EMPTY, SUGGESTED_INT_COLS as DO_INT, SUGGESTED_NUM_COLS as DO_NUM, SUGGESTED_JSON_COLS as DO_JSON, TRACKER_RECORD_BACKFILLS, DECISIONS as DO_DECISIONS } from './mappings/desk-operations'

export interface TableMapping {
  spreadsheet: string
  sheet: string
  table: string
  columns: string[]
  sheetToDb?: Record<string, string>
  upsertOn?: string
  require?: string[]
}

export const SPREADSHEETS: Record<string, string> = {
  core: process.env.GOOGLE_SHEET_ID!,
  productivity: '1h77da05ZjlxjGCArlr1tGJv7OEtmemFGde8sBnitc-g',
  tickets: '107vS_XyJRpelFPJOFditebZVca6TzUuYHq9rm0ermuk', // ss_tickets_id — CC2 Tickets
  live: '1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4', // ss_live_id — CC2 Live
  data_2026: '1BVJFMtQMSF2-zS89A-4oxoSuw0LunqAp_YQVwl0fR-I', // ss_data_2026_id — CC2 Data 2026
  quality: '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w', // ss_quality_id — CC2 Quality
}

const JSON_COLS = new Set([
  'spans_json', 'case_ids_json', 'channel_mix_json', 'rule_json',
  'confidence_factors_json', 'slots_json', 'sources_json', 'cases_json',
  'touches_json', 'calls_json', 'counts_json', 'report_json', 'flags',
  'answers_json', 'fail_reasons_json', ...QQ_JSON, ...DO_JSON,
])
const NUM_COLS = new Set([
  'minutes', 'interval_min', 'flagged_min', 'total_flagged_min',
  'avg_cases_per_flag', 'productivity_pct', 'fcr_pct', 'score', 'score_final',
  'inbound_avail_min', 'inbound_target', 'inbound_achieved', 'inbound_missed',
  'inbound_prod_pct', 'inbound_gap', 'texting_avail_min', 'texting_target',
  'texting_achieved', 'texting_prod_pct', 'texting_gap', 'wa_avail_min',
  'wa_target', 'wa_achieved', 'wa_prod_pct', 'wa_gap', 'overall_prod_pct',
  'total_audits', 'avg_score', 'productive_min_aux',
  'productive_min_resolution', 'idle_min', 'tickets', ...QQ_NUM, ...DO_NUM,
])
// Dry-run B4 — DO_NUM lists 'value' globally for tlp_otd.value (the only
// numeric `value`); everywhere else it must stay text: options.value and
// qe_catalogue.value are TEXT NOT NULL ('Egypt'/'Field Change' → NaN → null
// → require-skip killed 26 + 347 rows) and sched_config.value is jsonb
// ('0' must stay the string). Scoped back per-table below.
NUM_COLS.delete('value')
const NUM_COLS_BY_TABLE: Record<string, Set<string>> = {
  tlp_otd: new Set(['value']),
  // audits is NUMERIC on sc_daily (would lose fractions under parseInt) but
  // INTEGER on agg_agent_perf — scoped below.
  sc_daily: new Set(['audits']),
}
const INT_COLS = new Set([
  'case_count', 'distinct_cases', 'review_open_ms', 'total_flags',
  'auto_accepted', 'year', 'total_cases', 'resolved_on_first', 'windows',
  ...QQ_INT, ...DO_INT,
])
INT_COLS.delete('priority') // tickets-only int; action_task_details uses 'P1'/'P2' text
INT_COLS.delete('audits')   // numeric on sc_daily; int only on agg_agent_perf
const INT_COLS_BY_TABLE: Record<string, Set<string>> = {
  tickets: new Set(['priority']),
  agg_agent_perf: new Set(['audits']),
}
type TransformCtx = { spreadsheet: string; table: string; index: number }
const ROW_TRANSFORMS: Record<string, (row: Record<string, unknown>, ctx: TransformCtx) => void> = {
  ...QQ_TRANSFORMS, ...DO_TRANSFORMS,
}
const NULL_AS_EMPTY_MAP: Record<string, Set<string>> = {}
Object.entries(NULL_AS_EMPTY).forEach(([t, cols]) => { NULL_AS_EMPTY_MAP[t] = new Set(cols) })

/** The route's original 16 entries live in route.ts (kept inline there — they
 * predate the module split); everything wave-3 produced is in ./mappings/. */
export const MODULE_MAPPINGS: TableMapping[] = [...QQ_MAPPINGS, ...PC_MAPPINGS, ...DO_MAPPINGS]
export const MAPPING_DECISIONS = [...QQ_DECISIONS, ...DO_DECISIONS]

let sheetsClient: ReturnType<typeof google.sheets> | null = null
function getSheetsClient() {
  if (!sheetsClient) {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })
    sheetsClient = google.sheets({ version: 'v4', auth })
  }
  return sheetsClient
}

export async function readSheet(spreadsheetId: string, sheetName: string) {
  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:ZZ`,
  })
  const rows = response.data.values || []
  if (rows.length < 2) return []
  const headers = (rows[0] as string[]).map((h) => String(h).trim().toLowerCase())
  return rows.slice(1).map((row) => {
    const obj: Record<string, unknown> = {}
    headers.forEach((header, i) => {
      // Verbatim cells, '' included (legacy route behaviour — dry-run B1):
      // nulling '' here would hide empty cells from mapRow's ''-branch, so
      // NULL_AS_EMPTY and the created_at/updated_at/computed_at fallback
      // could only ever fire on absent headers, never empty cells.
      obj[header] = row[i]
    })
    return obj
  })
}

function mapRow(row: Record<string, unknown>, mapping: TableMapping): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const nullAsEmpty = NULL_AS_EMPTY_MAP[mapping.table]
  for (const col of mapping.columns) {
    const sheetHeader = mapping.sheetToDb?.[col] || col
    let v = row[sheetHeader]
    // NULL_AS_EMPTY must precede the timestamp fallback: a NOT-NULL DEFAULT ''
    // col (e.g. mail_log.error) takes '' , never an ISO stamp.
    if (v === undefined || v === '') {
      out[col] = nullAsEmpty?.has(col)
        ? ''
        : col === 'created_at' || col === 'updated_at' || col === 'computed_at'
          ? new Date().toISOString()
          : null
      continue
    }
    if (JSON_COLS.has(col) && typeof v === 'string') {
      try { v = JSON.parse(v) } catch { /* keep string */ }
    } else if (col === 'removed') {
      v = v === 'true' || v === true || v === 'TRUE'
    } else if (NUM_COLS.has(col) || NUM_COLS_BY_TABLE[mapping.table]?.has(col)) {
      v = parseFloat(String(v))
      if (Number.isNaN(v)) v = null
    } else if (INT_COLS.has(col) || INT_COLS_BY_TABLE[mapping.table]?.has(col)) {
      v = parseInt(String(v), 10)
      if (Number.isNaN(v)) v = null
    }
    out[col] = v
  }
  return out
}

export interface TableResult { read?: number; migrated: number; skipped?: number; errors?: string[] }

export async function migrateTable(supabase: SupabaseClient, mapping: TableMapping): Promise<TableResult> {
  const errors: string[] = []
  const spreadsheetId = SPREADSHEETS[mapping.spreadsheet] || mapping.spreadsheet
  let rows: Record<string, unknown>[]
  try {
    rows = await readSheet(spreadsheetId, mapping.sheet)
  } catch (err) {
    return { read: 0, migrated: 0, skipped: 0, errors: [`Sheet '${mapping.sheet}' read failed: ${err}`] }
  }
  if (rows.length === 0) {
    return { read: 0, migrated: 0, skipped: 0, errors: [`Sheet '${mapping.sheet}' not found or empty`] }
  }

  // Dry-run B2 — authored contract (see ROW_TRANSFORMS docblock in the
  // mapping modules): transforms mutate the RAW sheet row BEFORE mapRow and
  // are keyed by mapping.sheet (agg_productivity_daily and prod_daily_layers
  // share a table, so table alone cannot key them). They write synthetic
  // cells mapRow then picks up (date/note-pack/layer/year/log_id/extra_json/
  // segments_json + bool/JSON/epoch-ms normalisation). Table-key fallback
  // keeps any sibling-authored table keys working.
  const tf = ROW_TRANSFORMS[mapping.sheet] || ROW_TRANSFORMS[mapping.table]
  if (tf) rows.forEach((r, i) => tf(r, { spreadsheet: mapping.spreadsheet, table: mapping.table, index: i }))

  let mapped = rows
    .map((r) => mapRow(r, mapping))
    .filter((r) => !(mapping.require || []).some((col) => r[col] === null || r[col] === undefined))
  const skipped = rows.length - mapped.length

  if (mapping.upsertOn) {
    const keys = mapping.upsertOn.split(',')
    const seen = new Map<string, Record<string, unknown>>()
    for (const r of mapped) seen.set(keys.map((k) => String(r[k])).join('|'), r)
    mapped = Array.from(seen.values())
  } else if (mapping.table === 'view_as') {
    await supabase.from('view_as').delete().not('id', 'is', null)
  }

  const batchSize = 500
  let migrated = 0
  for (let i = 0; i < mapped.length; i += batchSize) {
    const batch = mapped.slice(i, i + batchSize)
    const query = mapping.upsertOn
      ? supabase.from(mapping.table).upsert(batch, { onConflict: mapping.upsertOn })
      : supabase.from(mapping.table).insert(batch)
    const { error } = await query
    if (error) errors.push(`Rows ${i}-${i + batch.length}: ${error.message}`)
    else migrated += batch.length
  }
  return { read: rows.length, migrated, skipped, errors }
}

/**
 * Sheet-backed tracker record tabs → tracker_records + storage_mode flip
 * (WP-F6). Mirrors legacy readTrackerData_ (Trackers.js:284-320): headers by
 * normHeader_ text match, row_n from raw position, positional record_id.
 */
export async function backfillTrackerRecords(supabase: SupabaseClient): Promise<Record<string, TableResult>> {
  const out: Record<string, TableResult> = {}
  for (const b of TRACKER_RECORD_BACKFILLS) {
    const key = `tracker:${b.trackerId}`
    try {
      const spreadsheetId = SPREADSHEETS[b.spreadsheet] || b.spreadsheet
      const raw = await (async () => {
        const sheets = getSheetsClient()
        const res = await sheets.spreadsheets.values.get({ spreadsheetId, range: `'${b.sheet}'!A:ZZ` })
        return (res.data.values || []) as unknown[][]
      })()
      if (raw.length <= b.headerRow) { out[key] = { read: 0, migrated: 0, skipped: 0, errors: [`'${b.sheet}' empty`] }; continue }
      const normHeader = (s: unknown) => String(s ?? '').trim().replace(/\s+/g, ' ').toLowerCase()
      const headers = (raw[b.headerRow - 1] || []).map(normHeader)
      const colOf = (name: string) => headers.indexOf(normHeader(name))
      const fieldCols = Object.entries(b.fields).map(([fieldId, header]) => ({ fieldId, idx: colOf(header) }))
      const missing = Object.entries(b.fields).filter((_, i) => fieldCols[i].idx < 0).map(([, h]) => h)
      if (missing.length) {
        out[key] = { read: 0, migrated: 0, skipped: raw.length - b.headerRow, errors: [`missing headers: ${missing.join(', ')}`] }
        continue
      }
      const idIdx = colOf(b.recordIdHeader || 'record_id')
      const byIdx = colOf(b.submittedByHeader || 'submitted_by')
      const atIdx = colOf(b.submittedAtHeader || 'submitted_at')
      const rows = raw.slice(b.headerRow).map((cells, n) => {
        const values: Record<string, unknown> = {}
        fieldCols.forEach(({ fieldId, idx }) => { values[fieldId] = cells[idx] === undefined || cells[idx] === '' ? null : cells[idx] })
        const row_n = b.headerRow + 1 + n
        return {
          tracker_id: b.trackerId,
          record_id: String(cells[idIdx] ?? '') || `row-${row_n}`,
          row_n,
          values,
          // submitted_by is `text NOT NULL DEFAULT ''` — an absent/empty cell
          // must land '', never null (dry-run B1: blocked_customers and
          // operational_loss have no submitter column at all).
          submitted_by: String(cells[byIdx] ?? '').trim().toLowerCase(),
          submitted_at: cells[atIdx] || null,
        }
      })
      // Dedupe on (tracker_id, record_id) — keep last
      const seen = new Map<string, (typeof rows)[0]>()
      rows.forEach((r) => seen.set(r.record_id, r))
      const mapped = Array.from(seen.values())
      let migrated = 0
      const errors: string[] = []
      for (let i = 0; i < mapped.length; i += 500) {
        const batch = mapped.slice(i, i + 500)
        const { error } = await supabase.from('tracker_records').upsert(batch, { onConflict: 'tracker_id,record_id' })
        if (error) errors.push(`Rows ${i}-${i + batch.length}: ${error.message}`)
        else migrated += batch.length
      }
      if (!errors.length && b.postBackfill) {
        const pb = b.postBackfill
        const { error } = await supabase.from(pb.table).update(pb.update).eq('tracker_id', pb.where.tracker_id)
        if (error) errors.push(`storage_mode flip: ${error.message}`)
      }
      out[key] = { read: raw.length - b.headerRow, migrated, skipped: rows.length - mapped.length, errors: errors.length ? errors : undefined }
    } catch (err) {
      out[key] = { migrated: 0, errors: [String(err)] }
    }
  }
  return out
}

export async function migrateAll(supabase: SupabaseClient, mappings: TableMapping[], wanted?: Set<string> | null) {
  const result = { success: false, tables: {} as Record<string, TableResult>, errors: [] as string[] }
  for (const mapping of mappings) {
    if (wanted && !wanted.has(mapping.table) && !wanted.has(`${mapping.spreadsheet}:${mapping.sheet}`)) continue
    try {
      result.tables[mapping.table] = await migrateTable(supabase, mapping)
      ;(result.tables[mapping.table].errors || []).forEach((e) => result.errors.push(`${mapping.table}: ${e}`))
    } catch (error) {
      result.tables[mapping.table] = { migrated: 0, errors: [String(error)] }
      result.errors.push(`${mapping.table}: ${error}`)
    }
  }
  if (!wanted || wanted.has('tracker_records') || [...wanted].some((w) => w.startsWith('tracker:'))) {
    const bf = await backfillTrackerRecords(supabase)
    Object.entries(bf).forEach(([k, r]) => {
      if (wanted && !wanted.has('tracker_records') && !wanted.has(k)) return
      result.tables[k] = r
      ;(r.errors || []).forEach((e) => result.errors.push(`${k}: ${e}`))
    })
  }
  result.success = result.errors.length === 0
  return result
}
