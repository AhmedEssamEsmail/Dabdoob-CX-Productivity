import { createClient } from '@supabase/supabase-js'
import { google } from 'googleapis'

export const maxDuration = 300 // 5 minutes

interface MigrationResult {
  success: boolean
  tables: Record<string, { migrated: number; errors?: string[] }>
  errors: string[]
}

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

async function checkAdminAuth(request: Request): Promise<boolean> {
  const migrationKey = request.headers.get('x-migration-key')
  const expectedKey = process.env.MIGRATION_SECRET_KEY || 'migration-secret-2024'
  return migrationKey === expectedKey
}

async function getGoogleSheetsData(sheetName: string) {
  try {
    const auth = new google.auth.GoogleAuth({
      credentials: {
        client_email: process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL,
        private_key: process.env.GOOGLE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      },
      scopes: ['https://www.googleapis.com/auth/spreadsheets.readonly'],
    })

    const sheets = google.sheets({ version: 'v4', auth })
    const response = await sheets.spreadsheets.values.get({
      spreadsheetId: process.env.GOOGLE_SHEET_ID,
      range: `${sheetName}!A:ZZ`,
    })

    const rows = response.data.values || []
    if (rows.length === 0) return []

    const headers = rows[0] as string[]
    return rows.slice(1).map(row => {
      const obj: Record<string, any> = {}
      headers.forEach((header, i) => {
        obj[header] = row[i]
      })
      return obj
    })
  } catch (error) {
    console.error(`Error reading sheet ${sheetName}:`, error)
    return []
  }
}

async function migrateConfig(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Config')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Config sheet not found or empty'] }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const { error } = await supabase
        .from('config')
        .upsert({
          key: row.key,
          value: row.value,
          description: row.description || null,
          updated_by: row.updated_by || null,
          updated_at: row.updated_at || new Date().toISOString()
        }, { onConflict: 'key' })

      if (error) {
        errors.push(`Config ${row.key}: ${error.message}`)
      } else {
        migrated++
      }
    } catch (err) {
      errors.push(`Config ${row.key}: ${err}`)
    }
  }

  return { migrated, errors }
}

async function migrateRoster(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Roster')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Roster sheet not found or empty'] }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const { error } = await supabase
        .from('roster')
        .upsert({
          email: row.email,
          name: row.name,
          role: row.role,
          tl_email: row.tl_email || null,
          country: row.country || null,
          active: row.active !== 'false',
          submitted_by: row.submitted_by || null,
          submitted_at: row.submitted_at || new Date().toISOString()
        }, { onConflict: 'email' })

      if (error) {
        errors.push(`Roster ${row.email}: ${error.message}`)
      } else {
        migrated++
      }
    } catch (err) {
      errors.push(`Roster ${row.email}: ${err}`)
    }
  }

  return { migrated, errors }
}

async function migrateProdIntervals(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Prod Intervals')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Prod Intervals sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const intervals = batch.map(row => ({
      interval_key: row.interval_key,
      date: row.date,
      agent_email: row.agent_email,
      agent_name: row.agent_name || null,
      status: row.status,
      source_status: row.source_status || null,
      start_at: row.start_at,
      end_at: row.end_at,
      minutes: parseFloat(row.minutes),
      source: row.source || null,
      snapshot_at: row.snapshot_at,
      created_at: row.created_at || new Date().toISOString()
    }))

    const { error } = await supabase.from('prod_intervals').insert(intervals)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += intervals.length
    }
  }

  return { migrated, errors }
}

async function migrateProdFlags(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Prod Flags')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Prod Flags sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const flags = batch.map(row => ({
      flag_id: row.flag_id,
      date: row.date,
      agent_email: row.agent_email,
      agent_name: row.agent_name || null,
      tl_email: row.tl_email || null,
      raw_status: row.raw_status,
      interval_start: row.interval_start,
      interval_end: row.interval_end,
      interval_min: parseFloat(row.interval_min),
      spans_json: row.spans_json ? JSON.parse(row.spans_json) : null,
      flagged_min: parseFloat(row.flagged_min),
      case_count: row.case_count ? parseInt(row.case_count) : null,
      distinct_cases: row.distinct_cases ? parseInt(row.distinct_cases) : null,
      case_ids_json: row.case_ids_json ? JSON.parse(row.case_ids_json) : null,
      channel_mix_json: row.channel_mix_json ? JSON.parse(row.channel_mix_json) : null,
      suggested_status: row.suggested_status,
      decision: row.decision,
      validated_status: row.validated_status || null,
      decided_by: row.decided_by || null,
      decided_at: row.decided_at || null,
      reason: row.reason || null,
      review_open_ms: row.review_open_ms ? parseInt(row.review_open_ms) : null,
      due_date: row.due_date || null,
      created_at: row.created_at,
      rule_json: row.rule_json ? JSON.parse(row.rule_json) : null,
      updated_at: row.updated_at || new Date().toISOString(),
      confidence_score: row.confidence_score ? parseInt(row.confidence_score) : null,
      confidence_level: row.confidence_level || null,
      confidence_factors_json: row.confidence_factors_json ? JSON.parse(row.confidence_factors_json) : null
    }))

    const { error } = await supabase.from('prod_flags').insert(flags)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += flags.length
    }
  }

  return { migrated, errors }
}

async function migrateProdFlagLog(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Prod Flag Log')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Prod Flag Log sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const logs = batch.map(row => ({
      log_id: row.log_id,
      flag_id: row.flag_id,
      action: row.action,
      from_status: row.from_status || null,
      to_status: row.to_status || null,
      by: row.by,
      at: row.at,
      reason: row.reason || null,
      created_at: row.created_at || new Date().toISOString()
    }))

    const { error } = await supabase.from('prod_flag_log').insert(logs)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += logs.length
    }
  }

  return { migrated, errors }
}

async function migrateProdDailyLayers(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Prod Daily Layers')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Prod Daily Layers sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const layers = batch.map(row => ({
      layer: row.layer,
      date: row.date,
      agent_email: row.agent_email,
      productivity_pct: row.productivity_pct ? parseFloat(row.productivity_pct) : null,
      logged_minutes: row.logged_minutes ? parseFloat(row.logged_minutes) : null,
      available_minutes: row.available_minutes ? parseFloat(row.available_minutes) : null,
      chats_minutes: row.chats_minutes ? parseFloat(row.chats_minutes) : null,
      inbound_calls_minutes: row.inbound_calls_minutes ? parseFloat(row.inbound_calls_minutes) : null,
      waiting_address_minutes: row.waiting_address_minutes ? parseFloat(row.waiting_address_minutes) : null,
      idle_minutes: row.idle_minutes ? parseFloat(row.idle_minutes) : null,
      offline_minutes: row.offline_minutes ? parseFloat(row.offline_minutes) : null,
      busy_minutes: row.busy_minutes ? parseFloat(row.busy_minutes) : null,
      other_minutes: row.other_minutes ? parseFloat(row.other_minutes) : null,
      computed_at: row.computed_at || new Date().toISOString(),
      created_at: row.created_at || new Date().toISOString()
    }))

    const { error } = await supabase.from('prod_daily_layers').insert(layers)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += layers.length
    }
  }

  return { migrated, errors }
}

async function migrateTphDays(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('TPH Days')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['TPH Days sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const days = batch.map(row => ({
      date: row.date,
      agent_email: row.agent_email,
      slots_json: row.slots_json ? JSON.parse(row.slots_json) : null,
      sources_json: row.sources_json ? JSON.parse(row.sources_json) : null,
      by: row.by || null,
      at: row.at || new Date().toISOString()
    }))

    const { error } = await supabase.from('prod_tph_days').insert(days)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += days.length
    }
  }

  return { migrated, errors }
}

async function migrateTphTasks(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('TPH Tasks')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['TPH Tasks sheet not found or empty'] }
  }

  const batchSize = 500
  let migrated = 0

  for (let i = 0; i < rows.length; i += batchSize) {
    const batch = rows.slice(i, i + batchSize)
    const tasks = batch.map(row => ({
      task_id: row.task_id,
      date: row.date,
      agent_email: row.agent_email,
      channel: row.channel,
      start: row.start,
      end: row.end,
      by: row.by || null,
      at: row.at || new Date().toISOString(),
      removed: row.removed === 'true'
    }))

    const { error } = await supabase.from('prod_tph_tasks').insert(tasks)
    if (error) {
      errors.push(`Batch ${i}-${i + batchSize}: ${error.message}`)
    } else {
      migrated += tasks.length
    }
  }

  return { migrated, errors }
}

async function migrateTphCases(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('TPH Cases')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['TPH Cases sheet not found or empty'] }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const { error } = await supabase.from('prod_tph_cases').insert({
        date: row.date,
        source: row.source,
        cases_json: row.cases_json ? JSON.parse(row.cases_json) : null,
        by: row.by || null,
        at: row.at || new Date().toISOString()
      })

      if (error) {
        errors.push(`TPH cases ${row.date}: ${error.message}`)
      } else {
        migrated++
      }
    } catch (err) {
      errors.push(`TPH cases ${row.date}: ${err}`)
    }
  }

  return { migrated, errors }
}

async function migrateQualityAudits(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('Quality Audits')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['Quality Audits sheet not found or empty'] }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const { error } = await supabase.from('quality_audits').insert({
        audit_id: row.audit_id,
        date: row.date,
        agent_email: row.agent_email,
        ticket_id: row.ticket_id || null,
        qa_score: row.qa_score ? parseFloat(row.qa_score) : null,
        qa_max_score: row.qa_max_score ? parseFloat(row.qa_max_score) : null,
        qa_pct: row.qa_pct ? parseFloat(row.qa_pct) : null,
        evaluator_email: row.evaluator_email || null,
        comments: row.comments || null,
        created_at: row.created_at || new Date().toISOString()
      })

      if (error) {
        errors.push(`Quality audit ${row.audit_id}: ${error.message}`)
      } else {
        migrated++
      }
    } catch (err) {
      errors.push(`Quality audit ${row.audit_id}: ${err}`)
    }
  }

  return { migrated, errors }
}

async function migrateFcrDaily(): Promise<{ migrated: number; errors: string[] }> {
  const errors: string[] = []
  const rows = await getGoogleSheetsData('FCR Daily')
  if (rows.length === 0) {
    return { migrated: 0, errors: ['FCR Daily sheet not found or empty'] }
  }

  let migrated = 0
  for (const row of rows) {
    try {
      const { error } = await supabase.from('fcr_daily').insert({
        date: row.date,
        agent_email: row.agent_email,
        fcr_count: row.fcr_count ? parseInt(row.fcr_count) : null,
        total_cases: row.total_cases ? parseInt(row.total_cases) : null,
        fcr_rate: row.fcr_rate ? parseFloat(row.fcr_rate) : null,
        computed_at: row.computed_at || new Date().toISOString()
      })

      if (error) {
        errors.push(`FCR ${row.date}: ${error.message}`)
      } else {
        migrated++
      }
    } catch (err) {
      errors.push(`FCR ${row.date}: ${err}`)
    }
  }

  return { migrated, errors }
}

export async function POST(request: Request) {
  const isAdmin = await checkAdminAuth(request)
  if (!isAdmin) {
    return Response.json(
      { error: 'Unauthorized - Admin access required' },
      { status: 401 }
    )
  }

  const result: MigrationResult = {
    success: false,
    tables: {},
    errors: [],
  }

  try {
    console.log('Starting migration...')

    const migrations = [
      { name: 'config', fn: migrateConfig },
      { name: 'roster', fn: migrateRoster },
      { name: 'prod_intervals', fn: migrateProdIntervals },
      { name: 'prod_flags', fn: migrateProdFlags },
      { name: 'prod_flag_log', fn: migrateProdFlagLog },
      { name: 'prod_daily_layers', fn: migrateProdDailyLayers },
      { name: 'prod_tph_days', fn: migrateTphDays },
      { name: 'prod_tph_tasks', fn: migrateTphTasks },
      { name: 'prod_tph_cases', fn: migrateTphCases },
      { name: 'quality_audits', fn: migrateQualityAudits },
      { name: 'fcr_daily', fn: migrateFcrDaily },
    ]

    for (const { name, fn } of migrations) {
      console.log(`Migrating ${name}...`)
      try {
        const { migrated, errors } = await fn()
        result.tables[name] = { migrated, errors: errors.length > 0 ? errors : undefined }
        console.log(`${name}: ${migrated} rows migrated`)
      } catch (error) {
        result.tables[name] = { migrated: 0, errors: [String(error)] }
        result.errors.push(`${name}: ${error}`)
      }
    }

    result.success = result.errors.length === 0
    console.log('Migration complete!')

    return Response.json(result)
  } catch (error) {
    result.errors.push(`Fatal error: ${error}`)
    return Response.json(result, { status: 500 })
  }
}
