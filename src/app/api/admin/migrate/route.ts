import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const maxDuration = 300

interface MigrationResult {
  success: boolean
  tables: Record<string, { migrated: number; errors?: string[] }>
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

// JSON columns that need JSON.parse
const JSON_COLS = new Set([
  'spans_json', 'case_ids_json', 'channel_mix_json', 'rule_json',
  'confidence_factors_json', 'slots_json', 'sources_json', 'cases_json',
  'touches_json', 'calls_json', 'counts_json', 'report_json', 'flags',
])

// Columns that are DB-generated (never insert)
const SKIP_COLS = new Set(['id', 'created_at', 'updated_at'])

// Column renames: sheet header -> db column
const RENAMES: Record<string, string> = {
  agent_email: 'agent_email', // default identity
}

interface TableMapping {
  spreadsheet: keyof typeof SPREADSHEETS
  sheet: string
  table: string
  // allowlist of DB columns (from information_schema)
  columns: string[]
  // optional per-row column rename: dbCol -> sheetHeader
  rename?: Record<string, string>
}

const MAPPINGS: TableMapping[] = [
  // === CC2 Core ===
  {
    spreadsheet: 'core', sheet: 'ViewAs', table: 'view_as',
    columns: ['owner_email', 'action', 'target_email', 'app', 'submitted_by', 'submitted_at'],
  },
  // === CC2 Productivity ===
  {
    spreadsheet: 'productivity', sheet: 'prod_intervals', table: 'prod_intervals',
    columns: ['interval_key', 'date', 'agent_email', 'agent_name', 'status', 'source_status',
      'start_at', 'end_at', 'minutes', 'source', 'snapshot_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flags', table: 'prod_flags',
    columns: ['flag_id', 'date', 'agent_email', 'agent_name', 'tl_email', 'raw_status',
      'interval_start', 'interval_end', 'interval_min', 'spans_json', 'flagged_min',
      'case_count', 'distinct_cases', 'case_ids_json', 'channel_mix_json', 'suggested_status',
      'decision', 'validated_status', 'decided_by', 'decided_at', 'reason', 'review_open_ms',
      'due_date', 'created_at', 'rule_json', 'updated_at', 'confidence_score',
      'confidence_level', 'confidence_factors_json'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flag_log', table: 'prod_flag_log',
    columns: ['log_id', 'flag_id', 'action', 'from_status', 'to_status', 'by', 'at', 'reason', 'created_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_daily_layers', table: 'prod_daily_layers',
    columns: ['layer', 'email', 'date', 'available_min', 'idle_min', 'inbound_calls_min',
      'chats_min', 'waiting_address_min', 'offline_min', 'flagged_min',
      'effective_idle_min', 'productivity_pct', 'computed_at'],
    rename: { email: 'agent_email' },
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_window_hist', table: 'prod_window_hist',
    columns: ['date', 'class', 'windows', 'counts_json', 'computed_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_flag_analytics', table: 'prod_flag_analytics',
    columns: ['date', 'agent_email', 'total_flags', 'auto_accepted', 'total_flagged_min',
      'avg_cases_per_flag', 'most_common_raw_status', 'most_common_suggested_status'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_quarterly_reports', table: 'prod_quarterly_reports',
    columns: ['report_id', 'quarter', 'year', 'start_date', 'end_date', 'report_json', 'created_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_days', table: 'prod_tph_days',
    columns: ['date', 'agent_email', 'slots_json', 'sources_json', 'by', 'at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_tasks', table: 'prod_tph_tasks',
    columns: ['task_id', 'date', 'agent_email', 'channel', 'start', 'end', 'by', 'at', 'removed'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_cases', table: 'prod_tph_cases',
    columns: ['date', 'source', 'cases_json', 'by', 'at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_touches', table: 'prod_tph_touches',
    columns: ['date', 'touches_json', 'computed_at'],
  },
  {
    spreadsheet: 'productivity', sheet: 'prod_tph_calls', table: 'prod_tph_calls',
    columns: ['date', 'calls_json', 'computed_at'],
  },
  // === CC2 Quality ===
  {
    spreadsheet: 'quality', sheet: 'qa_audits', table: 'qa_audits',
    columns: ['audit_id', 'date', 'agent_email', 'agent_name', 'score', 'flags', 'comments', 'by', 'at'],
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
    if (SKIP_COLS.has(col)) continue
    const sheetHeader = mapping.rename?.[col] || col
    let v = row[sheetHeader]
    if (v === undefined || v === '') {
      out[col] = null
      continue
    }
    if (JSON_COLS.has(col) && typeof v === 'string') {
      try { v = JSON.parse(v) } catch { /* keep as string */ }
    } else if (col === 'removed') {
      v = v === 'true' || v === true || v === 'TRUE'
    } else if (['minutes', 'interval_min', 'flagged_min', 'total_flagged_min',
      'avg_cases_per_flag', 'productivity_pct', 'available_min', 'idle_min',
      'inbound_calls_min', 'chats_min', 'waiting_address_min', 'offline_min',
      'effective_idle_min', 'fcr_pct', 'score', 'qa_pct', 'qa_score',
      'qa_max_score', 'fcr_rate'].includes(col)) {
      v = v === null ? null : parseFloat(v)
      if (Number.isNaN(v)) v = null
    } else if (['case_count', 'distinct_cases', 'review_open_ms', 'total_flags',
      'auto_accepted', 'year', 'total_cases', 'resolved_on_first', 'fcr_count',
      'windows'].includes(col)) {
      v = v === null ? null : parseInt(v, 10)
      if (Number.isNaN(v)) v = null
    }
    out[col] = v
  }
  return out
}

async function migrateTable(mapping: TableMapping): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const spreadsheetId = SPREADSHEETS[mapping.spreadsheet]

  let rows: Record<string, any>[]
  try {
    rows = await readSheet(spreadsheetId, mapping.sheet)
  } catch (err) {
    return { migrated: 0, errors: [`Sheet '${mapping.sheet}' read failed: ${err}`] }
  }
  if (rows.length === 0) {
    return { migrated: 0, errors: [`Sheet '${mapping.sheet}' not found or empty`] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize).map(r => mapRow(r, mapping))
    const { error } = await supabase.from(mapping.table).insert(batch)
    if (error) {
      errors.push(`Rows ${i}-${i + batch.length}: ${error.message}`)
    } else {
      migrated += batch.length
    }
  }

  return { migrated, errors }
}

export async function POST(request: Request) {
  if (!(await checkAdminAuth(request))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const result: MigrationResult = { success: false, tables: {}, errors: [] }

  // Optional: only migrate specific tables via {"tables": ["prod_intervals", ...]}
  const body = await request.json().catch(() => ({})) as { tables?: string[] }
  const wanted = body.tables?.length ? new Set(body.tables) : null

  try {
    for (const mapping of MAPPINGS) {
      if (wanted && !wanted.has(mapping.table)) continue
      console.log(`Migrating ${mapping.table} from ${mapping.spreadsheet}/${mapping.sheet}...`)
      try {
        const { migrated, errors } = await migrateTable(mapping)
        result.tables[mapping.table] = { migrated, errors: errors.length ? errors : undefined }
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
