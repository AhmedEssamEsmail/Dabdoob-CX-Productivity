/**
 * describeDbError — the one place that turns Supabase/PostgREST, Google Sheets
 * and configuration failures into a described error: { code, message, detail,
 * hint } where hint is a concrete next step, never a raw PostgREST string.
 *
 * Routes serialize it through apiError() into the { error, code, detail, hint }
 * envelope (`error` stays a string for fetchJson compatibility). Throwing
 * DescribedError keeps the fields intact through intermediate catch blocks —
 * dqStep_ logs err.message, the route returns the whole shape.
 */

export interface DescribedErr {
  code:
    | 'missing_store'
    | 'missing_source'
    | 'missing_config'
    | 'missing_credentials'
    | 'source_unreachable'
    | 'source_forbidden'
    | 'rate_limited'
    | 'write_conflict'
    | 'internal'
  message: string
  detail?: string
  hint?: string
}

export class DescribedError extends Error {
  code: DescribedErr['code']
  detail?: string
  hint?: string
  constructor(d: DescribedErr) {
    super(d.message)
    this.name = 'DescribedError'
    this.code = d.code
    this.detail = d.detail
    this.hint = d.hint
  }
}

/** What populates each store — the hint a missing-store error carries. */
const STORE_HINTS: Record<string, string> = {
  fd_activities:
    "Run supabase/migrations/004_mirror_tables.sql, then load the Activities sheet mirror: POST /api/admin/mirrors {table:'fd_activities', full:true}.",
  maqsam_calls:
    "Run supabase/migrations/004_mirror_tables.sql, then load the Maqsam Calls mirror: POST /api/admin/mirrors {table:'maqsam_calls', full:true}.",
  freshchat:
    "Run supabase/migrations/004_mirror_tables.sql, then load the Freshchat mirror: POST /api/admin/mirrors {table:'freshchat', full:true}.",
  tickets: 'The ticket store is populated by the queue/Freshdesk sync job (sibling app).',
  agg_queue_now: 'Populated by the queue sync job (sibling Hub app); automatic cases need it live.',
  agg_inflow_hourly: 'Populated by the queue inflow job; it keeps inflow_lookback_days of history.',
  agg_snapshots_today: 'Populated by the queue snapshot job (sibling Hub app).',
  refresh_log: 'Created by migration 003_domain_tables.sql.',
  config: 'Created by migration 001_core_tables.sql.',
  roster: 'Created by migration 001_core_tables.sql.',
}

function storeHint(table: string): string {
  return (
    STORE_HINTS[table] ||
    'Check supabase/migrations/ for the migration that creates it, then check /api/admin/source-health.'
  )
}

function raw(e: unknown): { message: string; code?: string | number; details?: string; hint?: string; status?: number } {
  const o = (e || {}) as { message?: string; code?: string | number; details?: string; hint?: string; status?: number; error?: { message?: string } }
  return {
    message: String(o.message || o.error?.message || e || 'Unknown error'),
    code: o.code,
    details: o.details,
    hint: o.hint,
    status: typeof o.status === 'number' ? o.status : typeof o.code === 'number' ? o.code : undefined,
  }
}

export interface DescribeCtx {
  /** The store/table being read or written when it failed. */
  table?: string
  /** The step/operation being run, e.g. 'touches 2026-10-31'. */
  step?: string
  /** Workbook id + tab for Google Sheets failures. */
  workbook?: string
  tab?: string
  /** Config key a missing/blank setting was read under. */
  configKey?: string
}

export function describeDbError(e: unknown, ctx: DescribeCtx = {}): DescribedErr {
  if (e instanceof DescribedError) return { code: e.code, message: e.message, detail: e.detail, hint: e.hint }
  const r = raw(e)
  const msg = r.message
  const at = ctx.step ? ctx.step + ' — ' : ''

  // Missing store: PostgREST schema-cache miss or PG 42P01.
  const tblMatch = /Could not find the table 'public\.([a-zA-Z0-9_]+)'/.exec(msg) || /relation "?(?:public\.)?([a-zA-Z0-9_]+)"? does not exist/.exec(msg)
  const missing = tblMatch ? tblMatch[1] : /PGRST205|42P01/.test(String(r.code)) || /PGRST205|42P01/.test(msg) ? ctx.table : undefined
  if (missing || (ctx.table && /schema cache|does not exist/i.test(msg))) {
    const t = missing || ctx.table!
    return {
      code: 'missing_store',
      message: `${at}Store '${t}' is not set up (missing table).`,
      detail: msg,
      hint: storeHint(t),
    }
  }

  // Google credentials.
  if (/GOOGLE_SERVICE_ACCOUNT|credentials are not configured|no key file|invalid_grant|invalid_client/i.test(msg)) {
    return {
      code: 'missing_credentials',
      message: `${at}Google Sheets credentials are missing or invalid.`,
      detail: msg,
      hint: 'Set GOOGLE_SERVICE_ACCOUNT_EMAIL and GOOGLE_PRIVATE_KEY in the environment.',
    }
  }

  // Google Sheets failures (Gaxios carries status/code).
  const book = ctx.workbook ? `workbook ${ctx.workbook}${ctx.tab ? ` tab '${ctx.tab}'` : ''}` : ctx.tab ? `tab '${ctx.tab}'` : 'the workbook'
  if (r.status === 403 || /The caller does not have permission|insufficient.*permission/i.test(msg)) {
    return {
      code: 'source_forbidden',
      message: `${at}The service account cannot read ${book} (403).`,
      detail: msg,
      hint: 'Share the spreadsheet with the GOOGLE_SERVICE_ACCOUNT_EMAIL address.',
    }
  }
  if (r.status === 404 || /Requested entity was not found|File not found/i.test(msg)) {
    return {
      code: 'source_unreachable',
      message: `${at}Spreadsheet not found: ${book}.`,
      detail: msg,
      hint: 'Check the workbook id in config (see /api/admin/source-health).',
    }
  }
  if (r.status === 429 || /quota|rate ?limit|too many requests/i.test(msg)) {
    return {
      code: 'rate_limited',
      message: `${at}Google Sheets API rate limit or quota hit reading ${book}.`,
      detail: msg,
      hint: 'Wait a minute and retry; a backfill retries automatically on the next run.',
    }
  }
  if (r.status === 400 && /Unable to parse range|was not found/i.test(msg) && ctx.tab) {
    return {
      code: 'missing_source',
      message: `${at}${book} does not exist on the source sheet.`,
      detail: msg,
      hint: 'Check the tab name and the configured spreadsheet id.',
    }
  }

  // Missing/blank config.
  if (ctx.configKey || /config key|is not configured|not set up/i.test(msg)) {
    const k = ctx.configKey || ''
    return {
      code: 'missing_config',
      message: `${at}Config ${k ? `'${k}' ` : ''}is missing or blank.`,
      detail: msg,
      hint: 'Set it under Admin > Config (or see /api/admin/source-health for the full checklist).',
    }
  }

  // A workbook the run did not prefetch.
  if (/was not prefetched/i.test(msg)) {
    return {
      code: 'missing_source',
      message: `${at}${msg}`,
      detail: msg,
      hint: 'The job must prefetchWorkbook() this id before the step opens it.',
    }
  }

  // Write conflicts.
  if (/duplicate key|unique constraint|23505|conflict/i.test(msg) && !/ON CONFLICT/i.test(msg)) {
    return {
      code: 'write_conflict',
      message: `${at}Write to ${ctx.table || 'the store'} hit a constraint: ${msg}`,
      detail: r.details || msg,
      hint: 'Check for duplicate keys or a schema change; upsert keys are listed in jobs/env.ts.',
    }
  }

  return {
    code: 'internal',
    message: at + msg,
    detail: r.details || undefined,
    hint: undefined,
  }
}

/** describeDbError as a throwable. `ctx` is the step/table/source context. */
export function described(e: unknown, ctx?: DescribeCtx): DescribedError {
  return new DescribedError(describeDbError(e, ctx))
}
