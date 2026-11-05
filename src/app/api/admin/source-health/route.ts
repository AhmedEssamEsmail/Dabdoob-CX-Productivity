import { NextResponse } from 'next/server'
import { createAuthClient } from '@/features/shared/lib/auth'
import { requireAdminCaller } from '@/features/shared/lib/admin-auth'
import { apiError } from '@/features/shared/lib/api-error'
import { describeDbError } from '@/features/shared/lib/errors'
import { configAll } from '@/features/shared/platform/settings'
import { dqSetting_, prodFileFor_ } from '@/features/shared/lib/adapters'
import { prodToday_ } from '@/features/cx-productivity/lib/prod/engine'
import { fetchWorkbookTabs, sheetCreds } from '@/features/shared/jobs/sheets'
import { hbRowState } from '@/features/shared/platform/health'

export const maxDuration = 120

/**
 * GET /api/admin/source-health — the definitive "why is everything zero" answer.
 * Probes every store the compute paths read, every config key they need, the
 * env vars, the source spreadsheets and the cron heartbeat. Each check is
 * { name, ok, detail, hint? }; ok=false overall when any required check fails.
 */

interface Check {
  name: string
  kind: 'table' | 'config' | 'env' | 'sheet' | 'cron' | 'external' | 'legacy'
  ok: boolean
  detail: string
  hint?: string
}

/* Tables this app's migrations create (001-004). */
const APP_TABLES: { table: string; migration: string }[] = [
  { table: 'config', migration: '001' }, { table: 'roster', migration: '001' }, { table: 'view_as', migration: '001' },
  { table: 'options', migration: '002' }, { table: 'popups', migration: '002' }, { table: 'mail_log', migration: '002' },
  { table: 'health', migration: '002' }, { table: 'holidays', migration: '002' }, { table: 'one_on_one_schedule', migration: '002' },
  { table: 'prod_intervals', migration: '003' }, { table: 'prod_flags', migration: '003' },
  { table: 'prod_flag_log', migration: '003' }, { table: 'prod_daily_layers', migration: '003' },
  { table: 'prod_window_hist', migration: '003' }, { table: 'prod_flag_analytics', migration: '003' },
  { table: 'prod_quarterly_reports', migration: '003' }, { table: 'prod_tph_days', migration: '003' },
  { table: 'prod_tph_tasks', migration: '003' }, { table: 'prod_tph_cases', migration: '003' },
  { table: 'prod_tph_touches', migration: '003' }, { table: 'prod_tph_calls', migration: '003' },
  { table: 'kpi_behaviour_log', migration: '003' }, { table: 'kpi_leave_log', migration: '003' },
  { table: 'kpi_ol_cases', migration: '003' }, { table: 'tlp_shifts', migration: '003' },
  { table: 'tlp_queue_daily', migration: '003' }, { table: 'tlp_team', migration: '003' },
  { table: 'tlp_area_metrics', migration: '003' }, { table: 'tickets', migration: '003' },
  { table: 'dq_aging_flags', migration: '003' }, { table: 'queue_submissions', migration: '003' },
  { table: 'refresh_log', migration: '003' },
  { table: 'fd_activities', migration: '004' }, { table: 'maqsam_calls', migration: '004' },
  { table: 'freshchat', migration: '004' },
]

/* Tables populated by sibling apps — reported, never required to exist here. */
const EXTERNAL_TABLES: { table: string; usedBy: string }[] = [
  { table: 'agg_queue_now', usedBy: 'TPH auto cases (hourly snapshot)' },
  { table: 'agg_inflow_hourly', usedBy: 'TPH rebuilt call cases' },
  { table: 'agg_snapshots_today', usedBy: 'TPH auto cases' },
  { table: 'queue_snapshots', usedBy: 'queue/check-in features' },
  { table: 'sc_daily', usedBy: 'scorecard' },
  { table: 'fcr_daily', usedBy: 'scorecard FCR' },
  { table: 'qa_audits', usedBy: 'quality audits' },
]

const REQUIRED_CONFIG = [
  'business_tz', 'data_tz', 'fd_activity_ss_id', 'daily_report_ss_id',
  'productivity_files', 'productivity_fallback_id', 'activity_local_tz',
  'prod_activity_tz', 'prod_flag_statuses', 'prod_working_statuses', 'prod_offline_statuses',
  'prod_chat_groups', 'prod_wa_groups',
  'tph_channels', 'tph_day_hours', 'tph_minutes_per_case', 'tph_cap_window_min',
  'tph_calls_minute_factor', 'tph_ticket_statuses', 'tph_call_states',
  'tph_tl_edit_days', 'tph_eligible_days', 'admin_emails', 'roster_hct_ss_id',
]

const REQUIRED_ENV = [
  'NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_ANON_KEY', 'SUPABASE_SERVICE_ROLE_KEY',
  'GOOGLE_SERVICE_ACCOUNT_EMAIL', 'GOOGLE_PRIVATE_KEY', 'CRON_SECRET',
]

const CRON_JOBS = ['mirror_sync', 'prod_flags', 'productivity', 'prod_tph_touches', 'prod_tph_calls', 'prod_tph_cases_rebuilt', 'prod_tph_auto', 'prod_snapshot']

/** The legacy productivity workbook the migrate route reads (shard 04 audit). */
const LEGACY_PRODUCTIVITY_SS = '1h77da05ZjlxjGCArlr1tGJv7OEtmemFGde8sBnitc-g'
const LEGACY_TABS = ['prod_tph_days', 'prod_tph_cases', 'prod_tph_touches', 'prod_tph_calls', 'prod_intervals', 'prod_flags', 'prod_daily_layers']

export async function GET(req: Request) {
  try {
    await requireAdminCaller(req)
  } catch (e) {
    return apiError(e)
  }

  const checks: Check[] = []
  const supabase = await createAuthClient()

  /* ---- tables ---------------------------------------------------------
   * head:true count reads return {error:null, count:null} on a MISSING table —
   * a silent false-ok. Always verify with a real select when count is null. */
  const probeTable = async (table: string): Promise<{ missing: string | null; count: number | null }> => {
    const { count, error } = await supabase.from(table).select('*', { count: 'exact', head: true })
    if (error) return { missing: error.message, count: null }
    if (count !== null) return { missing: null, count }
    const { error: e2 } = await supabase.from(table).select('*').limit(1)
    return e2 ? { missing: e2.message, count: null } : { missing: null, count: null }
  }
  await Promise.all(
    APP_TABLES.map(async ({ table, migration }) => {
      const p = await probeTable(table)
      if (p.missing) {
        const d = describeDbError(p.missing, { table })
        checks.push({
          name: `table ${table}`, kind: 'table', ok: false,
          detail: d.message,
          hint: `Created by migration ${migration}_*.sql — run it, then re-check. ${d.hint || ''}`.trim(),
        })
      } else {
        checks.push({ name: `table ${table}`, kind: 'table', ok: true, detail: p.count === null ? 'exists' : `${p.count} rows` })
      }
    })
  )
  await Promise.all(
    EXTERNAL_TABLES.map(async ({ table, usedBy }) => {
      const p = await probeTable(table)
      checks.push({
        name: `external ${table}`, kind: 'external', ok: !p.missing,
        detail: p.missing ? describeDbError(p.missing, { table }).message : p.count === null ? 'exists' : `${p.count} rows`,
        hint: p.missing ? `Populated by a sibling app; needed for ${usedBy}.` : undefined,
      })
    })
  )

  /* ---- config ---------------------------------------------------------- */
  const cfg = await configAll()
  for (const key of REQUIRED_CONFIG) {
    const v = cfg[key]
    const blank = v === undefined || v === '' || (Array.isArray(v) && !v.length) || (typeof v === 'object' && v !== null && !Array.isArray(v) && !Object.keys(v).length)
    checks.push({
      name: `config ${key}`, kind: 'config', ok: !blank,
      detail: blank ? 'missing or blank — falls back to the code default' : `set (${JSON.stringify(v).slice(0, 120)})`,
      hint: blank ? 'Set it under Admin > Config, or run the settings seed.' : undefined,
    })
  }

  /* ---- env -------------------------------------------------------------- */
  for (const key of REQUIRED_ENV) {
    const v = process.env[key]
    checks.push({
      name: `env ${key}`, kind: 'env', ok: !!v,
      detail: v ? 'set' : 'not set',
      hint: v ? undefined : `Set ${key} in the deployment environment and redeploy.`,
    })
  }

  /* ---- source sheets ------------------------------------------------------ */
  if (!sheetCreds()) {
    checks.push({
      name: 'sheet credentials', kind: 'sheet', ok: false,
      detail: 'GOOGLE_SERVICE_ACCOUNT_EMAIL / GOOGLE_PRIVATE_KEY are not set',
      hint: 'Set both env vars; the service account must have read access to the source spreadsheets.',
    })
  } else {
    const sheetProbes: { name: string; id: string; tab: string; required: boolean }[] = [
      { name: 'FD Activities workbook', id: String(dqSetting_(cfg, 'fd_activity_ss_id') || ''), tab: 'Activities', required: true },
      { name: 'Daily report workbook', id: String(dqSetting_(cfg, 'daily_report_ss_id') || ''), tab: 'Freshchat', required: true },
      { name: 'Current month productivity workbook', id: prodFileFor_(prodToday_(cfg).slice(0, 7), cfg), tab: 'Assumptions', required: true },
    ]
    await Promise.all(
      sheetProbes.map(async (p) => {
        if (!p.id) {
          checks.push({ name: `sheet ${p.name}`, kind: 'sheet', ok: false, detail: 'no spreadsheet id configured', hint: 'Set the *_ss_id / productivity_files config key.' })
          return
        }
        try {
          const tabs = await fetchWorkbookTabs(p.id, [p.tab])
          const rows = (tabs[p.tab] || []).length
          checks.push({
            name: `sheet ${p.name}`, kind: 'sheet', ok: requiredOk(p.required, rows),
            detail: rows ? `'${p.tab}' reachable, ${Math.max(0, rows - 1)} data rows` : `'${p.tab}' reachable but empty`,
          })
        } catch (e) {
          const d = describeDbError(e, { workbook: p.id, tab: p.tab })
          checks.push({ name: `sheet ${p.name}`, kind: 'sheet', ok: false, detail: d.message, hint: d.hint })
        }
      })
    )
  }

  /* ---- legacy store audit (shard 04 input) --------------------------------- */
  if (sheetCreds()) {
    try {
      const tabs = await fetchWorkbookTabs(LEGACY_PRODUCTIVITY_SS, LEGACY_TABS)
      const counts = LEGACY_TABS.map((t) => `${t}: ${Math.max(0, (tabs[t] || []).length - 1)}`).join(', ')
      const hasData = LEGACY_TABS.some((t) => (tabs[t] || []).length > 1)
      checks.push({
        name: 'legacy prod_* workbook', kind: 'legacy', ok: true,
        detail: hasData ? `reachable — ${counts}` : `reachable but no legacy rows (${counts})`,
        hint: hasData ? 'Run POST /api/admin/migrate to import rows a recompute cannot rebuild (grid slots, tl/auto cases, intervals).' : 'No legacy rows: only source-backed recomputation is possible.',
      })
    } catch (e) {
      const d = describeDbError(e, { workbook: LEGACY_PRODUCTIVITY_SS })
      checks.push({ name: 'legacy prod_* workbook', kind: 'legacy', ok: false, detail: d.message, hint: d.hint })
    }
  }

  /* ---- cron health ----------------------------------------------------------- */
  const { data: logRows } = await supabase
    .from('refresh_log')
    .select('job, status, started_at, finished_at, error')
    .order('started_at', { ascending: false })
    .limit(200)
  const latest: Record<string, { status: string; at: string; error: string }> = {}
  ;(logRows || []).forEach((r) => {
    const j = String(r.job || '')
    if (j && !latest[j]) latest[j] = { status: String(r.status || ''), at: String(r.finished_at || r.started_at || ''), error: String(r.error || '') }
  })
  for (const job of CRON_JOBS) {
    const r = latest[job]
    checks.push({
      name: `cron ${job}`, kind: 'cron', ok: !!r,
      detail: r ? `last ${r.status} at ${r.at}${r.error ? ` — ${r.error}` : ''}` : 'never ran (no refresh_log row)',
      hint: r ? undefined : 'Check CRON_SECRET, the Vercel cron deployment and vercel.json schedules. Hobby plans run daily crons only — intra-day cadence is folded into per-hour daily entries.',
    })
  }

  /* ---- health rows (per-job heartbeat staleness) --------------------------- */
  const { data: healthRows, error: healthErr } = await supabase
    .from('health')
    .select('job, label, expect_every_min, grace_min, active, last_run_at, last_status, last_note, seeded_at')
  if (healthErr) {
    const d = describeDbError(healthErr, { table: 'health' })
    checks.push({ name: 'health table', kind: 'cron', ok: false, detail: d.message, hint: d.hint })
  } else {
    const now = Date.now()
    const watched = (healthRows || []).filter((r) => r.active !== false)
    const down: string[] = []
    const late: string[] = []
    watched.forEach((r) => {
      const s = hbRowState(r as never, now)
      if (s.state === 'down') down.push(s.note)
      else if (s.state === 'warn') late.push(s.note)
    })
    checks.push({
      name: 'health heartbeats', kind: 'cron', ok: down.length === 0,
      detail: watched.length
        ? down.length
          ? down.join(' | ')
          : late.length
            ? `all running; late: ${late.join(' | ')}`
            : `${watched.length} jobs healthy`
        : 'no health rows — heartbeats never wrote',
      hint: !watched.length || down.length ? 'Heartbeats are written by hbBeat inside the job env — an empty/stale table means the cron chain never ran.' : undefined,
    })
  }

  const failed = checks.filter((c) => !c.ok)
  return NextResponse.json({
    ok: failed.length === 0,
    generatedAt: new Date().toISOString(),
    failed: failed.length,
    checks,
  })
}

function requiredOk(required: boolean, rows: number): boolean {
  return required ? rows > 1 : true
}
