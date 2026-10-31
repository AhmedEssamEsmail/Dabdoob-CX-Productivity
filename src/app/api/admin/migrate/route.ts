import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const maxDuration = 300

interface MigrationResult {
  success: boolean
  tables: Record<string, { migrated: number; skipped?: number; errors?: string[] }>
  errors: string[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

const SPREADSHEETS = {
  core: process.env.GOOGLE_SHEET_ID!,
  productivity: '1h77da05ZjlxjGCArlr1tGJv7OEtmemFGde8sBnitc-g',
  quality: '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w',
}

const JSON_COLS = new Set([
  'spans_json', 'case_ids_json', 'channel_mix_json', 'rule_json',
  'confidence_factors_json', 'slots_json', 'sources_json', 'cases_json',
  'touches_json', 'calls_json', 'counts_json', 'report_json', 'flags',
  'answers_json', 'fail_reasons_json',
])

const NUM_COLS = new Set([
  'minutes', 'interval_min', 'flagged_min', 'total_flagged_min',
  'avg_cases_per_flag', 'productivity_pct', 'fcr_pct', 'score', 'score_final',
  'inbound_avail_min', 'inbound_target', 'inbound_achieved', 'inbound_missed',
  'inbound_prod_pct', 'inbound_gap', 'texting_avail_min', 'texting_target',
  'texting_achieved', 'texting_prod_pct', 'texting_gap', 'wa_avail_min',
  'wa_target', 'wa_achieved', 'wa_prod_pct', 'wa_gap', 'overall_prod_pct',
  'total_audits', 'avg_score', 'productive_min_aux',
  'productive_min_resolution', 'idle_min', 'tickets',
])

const INT_COLS = new Set([
  'case_count', 'distinct_cases', 'review_open_ms', 'total_flags',
  'auto_accepted', 'year', 'total_cases', 'resolved_on_first', 'windows',
])

interface TableMapping {
  spreadsheet: keyof typeof SPREADSHEETS
  sheet: string
  table: string
  columns: string[]            // DB columns to write
  sheetToDb?: Record<string, string>  // DB col -> sheet header (when names differ)
  upsertOn?: string            // conflict column for upsert (else plain insert)
  require?: string[]           // DB cols that must be non-null (row skipped if null)
}

const MAPPINGS: TableMapping[] = [
  {
    spreadsheet: 'core', sheet: 'ViewAs', table: 'view_as',
    columns: ['owner_email', 'action', 'target_email', 'app', 'submitted_by', 'submitted_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_intervals', table: 'prod_intervals',
    columns: ['interval_key', 'date', 'agent_email', 'agent_name', 'status', 'source_status',
      'start_at', 'end_at', 'minutes', 'source', 'snapshot_at'],
    upsertOn: 'interval_key',
    require: ['interval_key', 'agent_email'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flags', table: 'prod_flags',
    columns: ['flag_id', 'date', 'agent_email', 'agent_name', 'tl_email', 'raw_status',
      'interval_start', 'interval_end', 'interval_min', 'spans_json', 'flagged_min',
      'case_count', 'distinct_cases', 'case_ids_json', 'channel_mix_json', 'suggested_status',
      'decision', 'validated_status', 'decided_by', 'decided_at', 'reason', 'review_open_ms',
      'due_date', 'created_at', 'rule_json', 'updated_at', 'confidence_score',
      'confidence_level', 'confidence_factors_json'],
    upsertOn: 'flag_id',
    require: ['flag_id'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flag_log', table: 'prod_flag_log',
    columns: ['log_id', 'flag_id', 'action', 'from_status', 'to_status', 'by', 'at', 'reason'],
    upsertOn: 'log_id',
    require: ['log_id'],
  },
  {
    // Sheet headers are camelCase: agentName, inboundAvailMin, overallProdPct, computedAt...
    spreadsheet: 'productivity', sheet: 'prod_daily_layers', table: 'prod_daily_layers',
    columns: ['layer', 'agent_name', 'date', 'email',
      'inbound_avail_min', 'inbound_target', 'inbound_achieved', 'inbound_missed',
      'inbound_prod_pct', 'inbound_gap',
      'texting_avail_min', 'texting_target', 'texting_achieved', 'texting_prod_pct', 'texting_gap',
      'wa_avail_min', 'wa_target', 'wa_achieved', 'wa_prod_pct', 'wa_gap',
      'overall_prod_pct', 'total_audits', 'avg_score',
      'productive_min_aux', 'productive_min_resolution', 'idle_min', 'computed_at'],
    sheetToDb: {
      agent_name: 'agentname', computed_at: 'computedat',
      inbound_avail_min: 'inboundavailmin', inbound_target: 'inboundtarget',
      inbound_achieved: 'inboundachieved', inbound_missed: 'inboundmissed',
      inbound_prod_pct: 'inboundprodpct', inbound_gap: 'inboundgap',
      texting_avail_min: 'textingavailmin', texting_target: 'textingtarget',
      texting_achieved: 'textingachieved', texting_prod_pct: 'textingprodpct',
      texting_gap: 'textinggap',
      wa_avail_min: 'waavailmin', wa_target: 'watarget', wa_achieved: 'waachieved',
      wa_prod_pct: 'waprodpct', wa_gap: 'wagap',
      overall_prod_pct: 'overallprodpct', total_audits: 'totalaudits',
      avg_score: 'avgscore', productive_min_aux: 'productiveminaux',
      productive_min_resolution: 'productiveminresolution', idle_min: 'idlemin',
    },
    require: ['email', 'date'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_window_hist', table: 'prod_window_hist',
    columns: ['date', 'class', 'windows', 'counts_json', 'computed_at'],
    upsertOn: 'date,class',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flag_analytics', table: 'prod_flag_analytics',
    columns: ['date', 'agent_email', 'total_flags', 'auto_accepted', 'total_flagged_min',
      'avg_cases_per_flag', 'most_common_raw_status', 'most_common_suggested_status'],
    upsertOn: 'date,agent_email',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_quarterly_reports', table: 'prod_quarterly_reports',
    columns: ['report_id', 'quarter', 'year', 'start_date', 'end_date', 'report_json', 'created_at'],
    upsertOn: 'report_id',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_days', table: 'prod_tph_days',
    columns: ['date', 'agent_email', 'slots_json', 'sources_json', 'by', 'at'],
    upsertOn: 'date,agent_email',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_tasks', table: 'prod_tph_tasks',
    columns: ['task_id', 'date', 'agent_email', 'channel', 'start', 'end', 'by', 'at', 'removed'],
    upsertOn: 'task_id',
    require: ['task_id'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_cases', table: 'prod_tph_cases',
    columns: ['date', 'source', 'cases_json', 'by', 'at'],
    upsertOn: 'date,source',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_touches', table: 'prod_tph_touches',
    columns: ['date', 'touches_json', 'computed_at'],
    upsertOn: 'date',
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_calls', table: 'prod_tph_calls',
    columns: ['date', 'calls_json', 'computed_at'],
    upsertOn: 'date',
  },
  {
    spreadsheet: 'quality', sheet: 'qa_audits', table: 'qa_audits',
    columns: ['audit_id', 'kind', 'queue_id', 'calibration_id', 'ticket_id', 'agent_email',
      'tl_email', 'auditor_email', 'channel', 'contact_type', 'form_id', 'form_version',
      'answers_json', 'comment', 'score', 'fatal', 'score_final', 'started_at', 'submitted_at',
      'audit_date', 'status', 'ack_due_date', 'acknowledged_at', 'ack_by', 'updated_at',
      'updated_by', 'source', 'source_agent', 'fail_reasons_json', 'audit_type', 'reference',
      'sample_basis', 'interaction_at'],
    upsertOn: 'audit_id',
    require: ['audit_id'],
  },
  {
    spreadsheet: 'quality', sheet: 'qa_queue', table: 'qa_queue',
    columns: ['queue_id', 'queue_date', 'ticket_id', 'agent_email', 'agent_name', 'tl_email',
      'channel', 'contact_type', 'tier', 'auditor_email', 'status', 'started_at', 'audit_id',
      'imported_at', 'log_key', 'interaction_at', 'agent_status', 'passed_to', 'passed_by',
      'passed_at', 'pass_note', 'action_at', 'agent_status_log', 'ticket_status', 'pass_reason',
      'expire_reason', 'source', 'requested_by', 'requested_at', 'request_reason', 'waived_by',
      'waived_at', 'waive_reason', 'audit_type', 'reference'],
    upsertOn: 'queue_id',
    require: ['queue_id'],
  },
  {
    spreadsheet: 'quality', sheet: 'qa_volume', table: 'qa_volume',
    columns: ['date', 'channel', 'contact_type', 'tickets', 'updated_at'],
  },
]

async function checkAdminAuth(request: Request): Promise<boolean> {
  const migrationKey = request.headers.get('x-migration-key')
  const expectedKey = process.env.MIGRATION_SECRET_KEY || 'migration-secret-2024'
  return migrationKey === expectedKey
}

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

async function readSheet(spreadsheetId: string, sheetName: string) {
  const sheets = getSheetsClient()
  const response = await sheets.spreadsheets.values.get({
    spreadsheetId,
    range: `'${sheetName}'!A:ZZ`,
  })
  const rows = response.data.values || []
  if (rows.length < 2) return []

  const headers = (rows[0] as string[]).map(h => String(h).trim().toLowerCase())
  return rows.slice(1).map(row => {
    const obj: Record<string, any> = {}
    headers.forEach((header, i) => {
      const v = row[i]
      obj[header] = v === undefined || v === '' ? null : v
    })
    return obj
  })
}

function mapRow(row: Record<string, any>, mapping: TableMapping): Record<string, any> {
  const out: Record<string, any> = {}
  for (const col of mapping.columns) {
    const sheetHeader = mapping.sheetToDb?.[col] || col
    let v = row[sheetHeader]
    if (v === undefined || v === '') {
      out[col] = col === 'created_at' || col === 'updated_at' || col === 'computed_at'
        ? new Date().toISOString()
        : null
      continue
    }
    if (JSON_COLS.has(col) && typeof v === 'string') {
      try { v = JSON.parse(v) } catch { /* keep string */ }
    } else if (col === 'removed') {
      v = v === 'true' || v === true || v === 'TRUE'
    } else if (NUM_COLS.has(col)) {
      v = parseFloat(v)
      if (Number.isNaN(v)) v = null
    } else if (INT_COLS.has(col)) {
      v = parseInt(v, 10)
      if (Number.isNaN(v)) v = null
    }
    out[col] = v
  }
  return out
}

async function migrateTable(mapping: TableMapping) {
  const errors: string[] = []
  const spreadsheetId = SPREADSHEETS[mapping.spreadsheet]

  let rows: Record<string, any>[]
  try {
    rows = await readSheet(spreadsheetId, mapping.sheet)
  } catch (err) {
    return { migrated: 0, skipped: 0, errors: [`Sheet '${mapping.sheet}' read failed: ${err}`] }
  }
  if (rows.length === 0) {
    return { migrated: 0, skipped: 0, errors: [`Sheet '${mapping.sheet}' not found or empty`] }
  }

  // Map + filter rows missing required fields
  let mapped = rows
    .map(r => mapRow(r, mapping))
    .filter(r => !(mapping.require || []).some(col => r[col] === null || r[col] === undefined))
  const skipped = rows.length - mapped.length

  // Dedupe by upsertOn key (keep last occurrence) — required because
  // ON CONFLICT can't affect the same row twice in one statement
  if (mapping.upsertOn) {
    const keys = mapping.upsertOn.split(',')
    const seen = new Map<string, Record<string, any>>()
    for (const r of mapped) {
      seen.set(keys.map(k => String(r[k])).join('|'), r)
    }
    mapped = Array.from(seen.values())
  } else if (mapping.table === 'view_as') {
    // view_as has a serial PK (no conflict target) — replace contents idempotently
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
    if (error) {
      errors.push(`Rows ${i}-${i + batch.length}: ${error.message}`)
    } else {
      migrated += batch.length
    }
  }

  return { migrated, skipped, errors }
}

export async function POST(request: Request) {
  if (!(await checkAdminAuth(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: MigrationResult = { success: false, tables: {}, errors: [] }
  const body = await request.json().catch(() => ({})) as { tables?: string[] }
  const wanted = body.tables?.length ? new Set(body.tables) : null

  try {
    for (const mapping of MAPPINGS) {
      if (wanted && !wanted.has(mapping.table)) continue
      try {
        const { migrated, skipped, errors } = await migrateTable(mapping)
        result.tables[mapping.table] = {
          migrated,
          skipped: skipped || undefined,
          errors: errors.length ? errors : undefined,
        }
      } catch (error) {
        result.tables[mapping.table] = { migrated: 0, errors: [String(error)] }
        result.errors.push(`${mapping.table}: ${error}`)
      }
    }

    result.success = result.errors.length === 0
    return Response.json(result)
  } catch (error) {
    result.errors.push(`Fatal: ${error}`)
    return Response.json(result, { status: 500 })
  }
}
