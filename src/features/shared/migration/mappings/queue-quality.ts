/**
 * WP-30 — queue + quality-engine migration mappings (Sheets -> Supabase).
 *
 * Entry shape mirrors `src/app/api/admin/migrate/route.ts` exactly (route.ts is
 * owned by the orchestrator — do not edit it here). To wire this module:
 *
 *   1. Merge `SPREADSHEETS` below into route.ts's `SPREADSHEETS` const
 *      (`core`/`quality` already exist there with the same ids — keep one copy).
 *   2. Spread `MAPPINGS` into route.ts's `MAPPINGS` array. If route.ts keeps
 *      `spreadsheet: keyof typeof SPREADSHEETS`, widen that field (or retype
 *      this interface identically) so the new keys type-check.
 *   3. Optionally apply `ROW_TRANSFORMS` and union the `SUGGESTED_*_COLS` sets —
 *      see the contract note above ROW_TRANSFORMS. Entries are written so they
 *      still run (degraded) without the transforms; the per-table comments mark
 *      where a transform is required for correctness.
 *
 * Source stores (Queue_deprecated/Stores.js DQ_STORES, verified against
 * specs/megaplan/audits/sheet-access.md):
 *   core       -> CC_DATA_SPREADSHEET_ID / GOOGLE_SHEET_ID (CC2 Core).
 *                 Hosts the Repo.js `ensureTable_` tabs: sched_*, aging_flags,
 *                 queue_status_submissions, QaAccessLog.
 *   tickets    -> `ss_tickets_id`  (CC2 Tickets)
 *   live       -> `ss_live_id`     (CC2 Live)
 *   data_2026  -> `ss_data_2026_id`(CC2 Data 2026)
 *                 (All three were unshared in the sheet-access audit; WP-34's
 *                 re-probe reports 22/22 readable — share landed.)
 *                 Multi-year pattern: when `ss_data_{year}_id` config keys are
 *                 added, register `data_{year}` here and clone the three
 *                 data-store mappings (queue_snapshots, agg_inflow_hourly,
 *                 agg_productivity_daily); the `year` column is injected per
 *                 store by ROW_TRANSFORMS via the `data_{year}` key suffix.
 *   quality    -> `ss_quality_id`  (CC2 Quality)  — same id as route.ts.
 *
 * Dedupe/upsert notes: `upsertOn` is set only where a UNIQUE constraint exists
 * in supabase/migrations/00*.sql. Tables rewritten wholesale by the legacy
 * jobs (dqRewrite_) have no natural unique index — they map to plain inserts;
 * a re-run duplicates rows unless the runner truncates first (see DECISIONS).
 */

import 'server-only'
import { createHash } from 'node:crypto'

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex')

/** S09-01: content-hash dedupe keys — 'mig-'+sha1(identity cells joined '|').
 *  Returns the positional fallback when every identity cell is empty. */
const dedupeKey_ = (prefix: string, index: number, cells: unknown[]): string => {
  if (cells.every((v) => String(v ?? '') === '')) return prefix + index
  return prefix + sha1(cells.map((v) => String(v ?? '')).join('|'))
}

export const SPREADSHEETS = {
  core: process.env.GOOGLE_SHEET_ID!,
  tickets: '107vS_XyJRpelFPJOFditebZVca6TzUuYHq9rm0ermuk', // ss_tickets_id — CC2 Tickets
  live: '1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4', // ss_live_id — CC2 Live
  data_2026: '1BVJFMtQMSF2-zS89A-4oxoSuw0LunqAp_YQVwl0fR-I', // ss_data_2026_id — CC2 Data 2026
  quality: '1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w', // ss_quality_id — CC2 Quality
} as const

/** Exact shape of src/app/api/admin/migrate/route.ts TableMapping —
 * `spreadsheet` widened to string: tickets/live/data_2026 are not keys of
 * route.ts's SPREADSHEETS until the merge adds them (same convention as
 * sibling migration/mappings/people-core.ts). */
export interface TableMapping {
  spreadsheet: string
  sheet: string
  table: string
  columns: string[] // DB columns to write
  sheetToDb?: Record<string, string> // DB col -> sheet header (when names differ; headers are lowercased by readSheet)
  upsertOn?: string // conflict column(s) for upsert (else plain insert)
  require?: string[] // DB cols that must be non-null (row skipped if null)
}

export const MAPPINGS: TableMapping[] = [
  // ---------------------------------------------------------------- tickets store (ss_tickets_id)
  {
    // FD_TICKET_HEADERS (QueueCore.js) — ~150k rows, the big store.
    spreadsheet: 'tickets', sheet: 'tickets', table: 'tickets',
    columns: ['ticket_id', 'status', 'group_name', 'responder_id', 'requester_id', 'channel', 'country',
      'contact_type_1', 'created_at', 'updated_at', 'resolved_at', 'closed_at',
      'status_code', 'group_id', 'source', 'contact_type_2', 'contact_type_3', 'priority', 'is_escalated',
      'first_responded_at', 'status_updated_at', 'due_by', 'fr_due_by', 'synced_at'],
    upsertOn: 'ticket_id',
    require: ['ticket_id'],
  },
  {
    // FD_ESC_SEEN_HEADERS (FreshdeskSync.js).
    spreadsheet: 'tickets', sheet: 'esc_seen', table: 'esc_seen',
    columns: ['ticket_id', 'status', 'seen_at', 'source'],
    upsertOn: 'ticket_id',
    require: ['ticket_id'],
  },

  // ---------------------------------------------------------------- live store (ss_live_id)
  {
    // DQ_AGING_HEADERS (Aggregates.js) — dqRewrite_ store: full-snapshot insert,
    // re-run duplicates unless truncated first.
    spreadsheet: 'live', sheet: 'aging_open_tickets', table: 'aging_open_tickets',
    columns: ['ticket_id', 'queue', 'group_name', 'status', 'actionable', 'country', 'channel', 'contact_type_1',
      'created_at', 'age_h', 'band', 'agent_email', 'agent_name', 'tl_email', 'tl_name', 'refreshed_at'],
    upsertOn: 'ticket_id',
    require: ['ticket_id'],
  },
  {
    // DQ_QUEUE_NOW_HEADERS (Aggregates.js) — dqRewrite_ store.
    spreadsheet: 'live', sheet: 'agg_queue_now', table: 'agg_queue_now',
    columns: ['queue', 'kind', 'open', 'actionable', 'unassigned', 'oldest_h',
      'over_top', 'created_today', 'resolved_today', 'as_of', 'source_as_of', 'stale', 'by_status_json', 'bands_json'],
    upsertOn: 'queue,kind',
    require: ['queue'],
  },
  {
    // DQ_INFLOW_HEADERS — UNIQUE(date, channel, country) in 007.
    spreadsheet: 'live', sheet: 'agg_inflow_daily', table: 'agg_inflow_daily',
    columns: ['date', 'channel', 'country', 'inflow', 'updated_at'],
    upsertOn: 'date,channel,country',
    require: ['date'],
  },
  {
    // DQ_INFLOW_ROLLUP_HEADERS — dqRewrite_ store (no UNIQUE in DDL).
    spreadsheet: 'live', sheet: 'agg_inflow_weekly', table: 'agg_inflow_weekly',
    columns: ['period', 'channel', 'country', 'inflow', 'days', 'partial', 'updated_at'],
    upsertOn: 'period,channel,country',
    require: ['period'],
  },
  {
    // DQ_INFLOW_ROLLUP_HEADERS — dqRewrite_ store (no UNIQUE in DDL).
    spreadsheet: 'live', sheet: 'agg_inflow_monthly', table: 'agg_inflow_monthly',
    columns: ['period', 'channel', 'country', 'inflow', 'days', 'partial', 'updated_at'],
    upsertOn: 'period,channel,country',
    require: ['period'],
  },
  {
    // DQ_AGENT_PERF_HEADERS — dqRewrite_ store.
    spreadsheet: 'live', sheet: 'agg_agent_perf', table: 'agg_agent_perf',
    columns: ['email', 'name', 'tl_email', 'tl_name', 'period', 'from_date', 'to_date', 'days', 'overall_pct',
      'inbound_pct', 'texting_pct', 'wa_pct', 'inbound_achieved', 'inbound_missed', 'texting_achieved', 'wa_achieved',
      'productive_min', 'idle_min', 'audits', 'avg_score'],
    upsertOn: 'email,period',
    require: ['email', 'period'],
  },
  {
    // DQ_AGENT_DAILY_HEADERS — dqRewrite_ store.
    spreadsheet: 'live', sheet: 'agg_agent_daily', table: 'agg_agent_daily',
    columns: ['date', 'email', 'overall_pct', 'inbound_achieved', 'texting_achieved', 'wa_achieved'],
    upsertOn: 'date,email',
    require: ['date', 'email'],
  },
  {
    // Same DQ_SNAPSHOT_HEADERS as queue_snapshots, on the non-sharded live store;
    // the DB `year` column lands null here unless ROW_TRANSFORMS injects it.
    spreadsheet: 'live', sheet: 'agg_snapshots_today', table: 'agg_snapshots_today',
    columns: ['snapshot_key', 'slot_date', 'slot', 'captured_at', 'data_as_of', 'late', 'queue',
      'open', 'actionable', 'unassigned', 'oldest_h', 'over_top', 'created_today', 'resolved_today',
      'stale', 'by_status_json', 'bands_json', 'year'],
    upsertOn: 'snapshot_key',
    require: ['snapshot_key', 'queue'],
  },
  {
    // Stores.js: 'refresh_log' -> 'live', headers
    // ['job','started_at','finished_at','rows_in','rows_out','source_cursor','status','error','note'].
    // The live table is a legacy/new superset (004_mirror_tables.sql): `type` mirrors
    // `job` and `log_id` was NOT NULL in the pre-004 schema — ROW_TRANSFORMS fills it.
    spreadsheet: 'live', sheet: 'refresh_log', table: 'refresh_log',
    columns: ['job', 'started_at', 'finished_at', 'rows_in', 'rows_out', 'source_cursor',
      'status', 'error', 'note', 'type', 'log_id'],
    sheetToDb: { type: 'job' },
    upsertOn: 'log_id',
    require: ['job'],
  },

  // ---------------------------------------------------------------- core store (CC_DATA_SPREADSHEET_ID)
  {
    // DQ_SUBMISSIONS_HEADERS (QueueCore.js). Tab 'queue_status_submissions' on
    // dataSpreadsheet_() = CC2 Core (Repo.js ensureTable_) — specs/cx-hub/
    // 80-data-migration.md lists it under CC2 Live; the code wins.
    // 014_migration_hardening.sql adds UNIQUE(submission_id) — upsertOn set so
    // re-runs are idempotent (was plain insert).
    spreadsheet: 'core', sheet: 'queue_status_submissions', table: 'queue_submissions',
    columns: ['submission_id', 'slot_date', 'slot', 'snapshot_key', 'status', 'queues_json',
      'corrections_json', 'correction_reason', 'general_note', 'help_needed', 'help_note',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'submission_id',
    require: ['submission_id'],
  },
  {
    // DQ_FLAGS_HEADERS (QueueCore.js). Tab 'aging_flags' on CC2 Core (absent
    // in the dry-run — lazy ensureTable_; B6 verdict in migration-report.md).
    // 014 adds UNIQUE(flag_id) — upsertOn set for idempotent re-runs.
    spreadsheet: 'core', sheet: 'aging_flags', table: 'dq_aging_flags',
    columns: ['flag_id', 'ticket_id', 'note', 'tl_email', 'resolved_at', 'resolved_by',
      'resolved_note', 'submitted_by', 'submitted_at'],
    upsertOn: 'flag_id',
    require: ['flag_id'],
  },

  // Scheduler tabs (Queue_deprecated/Scheduler.js SCH_TABLES, all on CC2 Core).
  // The sheet schemas predate the 007 DB shape — several need ROW_TRANSFORMS:
  {
    // sheet: key, value, submitted_* -> db: key UNIQUE, value jsonb. Plain
    // strings land as jsonb strings (the port writes String values the same way).
    spreadsheet: 'core', sheet: 'sched_config', table: 'sched_config',
    columns: ['key', 'value'],
    upsertOn: 'key',
    require: ['key'],
  },
  {
    // sheet: email, start_date, end_date, note, submitted_* -> db: tl_email
    // UNIQUE, name, shift, wfh, active, extra_json. TRANSFORM REQUIRED: packs
    // start_date/end_date/note into extra_json and defaults active=true (the
    // port reads dates from extra_json only).
    spreadsheet: 'core', sheet: 'sched_team', table: 'sched_team',
    columns: ['tl_email', 'name', 'active', 'extra_json'],
    sheetToDb: { tl_email: 'email' },
    upsertOn: 'tl_email',
    require: ['tl_email'],
  },
  {
    // sheet: month, tl_email, off_days, note, submitted_* -> db: tl_email, date
    // where date = 'yyyy-MM:d1,d2' (blank month -> ':d1,d2' standing default —
    // the port's schLoadOffDays_ regex). TRANSFORM REQUIRED.
    spreadsheet: 'core', sheet: 'sched_offdays', table: 'sched_offdays',
    columns: ['tl_email', 'date'],
    upsertOn: 'tl_email,date',
    require: ['tl_email', 'date'],
  },
  {
    // sheet: date, tl_email, shift, wfh, reason, submitted_* -> db: tl_email,
    // date, shift, note (note = JSON {reason, wfh} — schNotePack_). TRANSFORM REQUIRED.
    spreadsheet: 'core', sheet: 'sched_overrides', table: 'sched_overrides',
    columns: ['tl_email', 'date', 'shift', 'note'],
    upsertOn: 'tl_email,date',
    require: ['tl_email', 'date'],
  },
  {
    // 1:1 columns. Sheet 'hour' is an integer hour.
    spreadsheet: 'core', sheet: 'sched_hour_overrides', table: 'sched_hour_overrides',
    columns: ['tl_email', 'date', 'hour', 'kind', 'label'],
    upsertOn: 'tl_email,date,hour',
    require: ['tl_email', 'date', 'hour'],
  },
  {
    // sheet -> db renames: tl_email->from_email, with_email->to_email,
    // date_from->date, date_to->their_date, note->decided_note (the sheet's
    // `note` held the DECISION note). TRANSFORM REQUIRED: packs
    // subtype/shift/with_shift/reason/peer_status/peer_at into `note` JSON
    // (schNotePack_) and copies the original note to decided_note.
    spreadsheet: 'core', sheet: 'sched_requests', table: 'sched_requests',
    columns: ['request_id', 'type', 'from_email', 'to_email', 'date', 'their_date',
      'note', 'status', 'decided_by', 'decided_at', 'decided_note',
      'submitted_by', 'submitted_at'],
    sheetToDb: {
      from_email: 'tl_email', to_email: 'with_email',
      date: 'date_from', their_date: 'date_to',
    },
    upsertOn: 'request_id',
    require: ['request_id'],
  },
  {
    // sheet: month,date,tl_email,shift,role,start,end,queue_h,people_h,task_h,
    // tasks -> db: month,tl_email,date,shift,"from","to",wfh,segments_json,
    // variant, submitted_*, imported_by. TRANSFORM: rebuilds segments_json from
    // start + queue_h/people_h/task_h (approximation — DECISION, the sheet never
    // stored true segments; wfh/variant land null). dedupe_key is minted by
    // ROW_TRANSFORMS ('mig-'+sha1(month|tl_email|date|shift|variant)) — S02-03:
    // no natural key holds, so the UNIQUE sits on dedupe_key and re-runs
    // upsert instead of duplicating; S09-01 content-hash kills positional keys.
    spreadsheet: 'core', sheet: 'sched_plan', table: 'sched_plan',
    columns: ['month', 'tl_email', 'date', 'shift', 'from', 'to', 'wfh',
      'segments_json', 'variant', 'submitted_by', 'submitted_at', 'imported_by',
      'dedupe_key'],
    sheetToDb: { from: 'start', to: 'end' },
    upsertOn: 'dedupe_key',
    require: ['tl_email', 'date'],
  },
  {
    // Quality.js QA_ACCESS_LOG_HEADERS — "the Core tab QaAccessLog" (line ~655,
    // ensureTable_ -> dataSpreadsheet_ = CC2 Core, NOT the quality store).
    // Remote table absent (dry-run §3 B3) — created by
    // 014_migration_hardening.sql in this exact shape. All key columns are
    // nullable, so S02-02 put UNIQUE on a minted `dedupe_key` column —
    // ROW_TRANSFORMS fills 'mig-'+sha1(email|action|submitted_by|submitted_at)
    // and upsertOn makes re-runs idempotent.
    spreadsheet: 'core', sheet: 'QaAccessLog', table: 'qa_access_log',
    columns: ['email', 'action', 'submitted_by', 'submitted_at', 'dedupe_key'],
    upsertOn: 'dedupe_key',
  },

  // ---------------------------------------------------------------- data store (ss_data_{year}_id — 2026 only today)
  {
    // DQ_SNAPSHOT_HEADERS + `year` injected by ROW_TRANSFORMS from the
    // data_{year} spreadsheet key (legacy shards the store per year; the DB
    // keeps it as a column). UNIQUE(snapshot_key, queue) in 007.
    spreadsheet: 'data_2026', sheet: 'queue_snapshots', table: 'queue_snapshots',
    columns: ['snapshot_key', 'slot_date', 'slot', 'captured_at', 'data_as_of', 'late', 'queue',
      'open', 'actionable', 'unassigned', 'oldest_h', 'over_top', 'created_today', 'resolved_today',
      'stale', 'by_status_json', 'bands_json', 'year'],
    upsertOn: 'snapshot_key,queue',
    require: ['snapshot_key', 'queue'],
  },
  {
    // DQ_INFLOW_HOURLY_HEADERS + `year` injected (UNIQUE includes year in 007).
    spreadsheet: 'data_2026', sheet: 'agg_inflow_hourly', table: 'agg_inflow_hourly',
    columns: ['date', 'hour', 'channel', 'country', 'inflow', 'year'],
    upsertOn: 'date,hour,channel,country,year',
    require: ['date', 'hour'],
  },
  {
    // PRODUCTIVITY_COMPUTED_HEADERS (ProdCore.js) — camelCase headers like
    // prod_daily_layers. env.ts TABLE_ALIAS routes the legacy
    // 'agg_productivity_daily' store into prod_daily_layers with
    // layer='effective' — ROW_TRANSFORMS injects it. upsertOn is the app's
    // real conflict target: env.ts:349 hard-codes ['date','email','layer']
    // ((date,email) alone is NOT unique — the 'raw' layer shares it;
    // dry-run B8). Needs the 014 unique index on (date,email,layer).
    spreadsheet: 'data_2026', sheet: 'agg_productivity_daily', table: 'prod_daily_layers',
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
    upsertOn: 'date,email,layer',
    require: ['email', 'date'],
  },

  // ---------------------------------------------------------------- quality store (ss_quality_id)
  // qa_audits / qa_queue / qa_volume are already mapped in route.ts — not repeated.
  {
    // QA_HEADERS.qa_forms (Quality.js) — UNIQUE(form_id, version) in 006.
    spreadsheet: 'quality', sheet: 'qa_forms', table: 'qa_forms',
    columns: ['form_id', 'version', 'channel', 'title', 'placeholder', 'active',
      'definition_json', 'created_by', 'created_at'],
    upsertOn: 'form_id,version',
    require: ['form_id'],
  },
  {
    // QA_HEADERS.qa_ctls — UNIQUE(ctl_id) in 006.
    spreadsheet: 'quality', sheet: 'qa_ctls', table: 'qa_ctls',
    columns: ['ctl_id', 'audit_id', 'agent_email', 'tl_email', 'opened_date', 'due_date',
      'status', 'coaching_notes', 'action', 'submitted_at', 'submitted_date', 'sla_met',
      'agent_confirmed_at', 'agent_note', 'reminded_date', 'updated_at', 'updated_by',
      'outcome', 'dispute_id', 'reopened_at', 'reopen_count', 'closed_by', 'shift_tls'],
    upsertOn: 'ctl_id',
    require: ['ctl_id'],
  },
  {
    // QA_HEADERS.qa_disputes — UNIQUE(dispute_id) in 006.
    spreadsheet: 'quality', sheet: 'qa_disputes', table: 'qa_disputes',
    columns: ['dispute_id', 'audit_id', 'agent_email', 'auditor_email', 'tl_email',
      'reason', 'raised_at', 'status', 'decision', 'decision_note', 'old_score',
      'new_score', 'decided_by', 'decided_at', 'audit_month', 'raised_by',
      'raised_date', 'escalated_by', 'escalated_at', 'escalation_note'],
    upsertOn: 'dispute_id',
    require: ['dispute_id'],
  },
  {
    // QA_HEADERS.qa_calibrations — UNIQUE(calibration_id) in 006.
    spreadsheet: 'quality', sheet: 'qa_calibrations', table: 'qa_calibrations',
    columns: ['calibration_id', 'ticket_id', 'channel', 'agent_email', 'form_id',
      'form_version', 'auditor_email', 'tl_email', 'created_by', 'created_at',
      'status', 'auditor_audit_id', 'tl_audit_id', 'alignment_pct', 'month',
      'completed_at'],
    upsertOn: 'calibration_id',
    require: ['calibration_id'],
  },
  {
    // QA_HEADERS.qa_kb_gaps — UNIQUE(gap_id) in 006.
    spreadsheet: 'quality', sheet: 'qa_kb_gaps', table: 'qa_kb_gaps',
    columns: ['gap_id', 'audit_id', 'ticket_id', 'auditor_email', 'topic',
      'description', 'suggestion', 'created_at', 'created_date', 'audit_date',
      'same_day', 'status', 'added_by', 'added_at'],
    upsertOn: 'gap_id',
    require: ['gap_id'],
  },

  // Queue-engine tabs (QaEngine.js QE_*_HEADERS / QE_TABS, all on the quality
  // store). Sheet headers are Title Case with spaces; readSheet lowercases
  // them but keeps the spaces, hence the sheetToDb entries.
  {
    // 'Queue Log' -> qe_queue_log (qeLogField_ column names, UNIQUE(key, queued_date)).
    spreadsheet: 'quality', sheet: 'Queue Log', table: 'qe_queue_log',
    columns: ['key', 'queued_date', 'iso_week', 'slot', 'agent', 'channel',
      'group', 'contact_type', 'tier', 'ticket_id', 'subject',
      'country', 'status', 'last_touch', 'touches', 'state',
      'audited_at', 'audited_by', 'interaction', 'agent_status', 'passed_to',
      'agent_email', 'agent_fd_id', 'action_time', 'agent_status_log', 'pass_reason'],
    sheetToDb: {
      queued_date: 'queued date', iso_week: 'iso week', contact_type: 'contact type',
      ticket_id: 'ticket id', last_touch: 'last touch',
      audited_at: 'audited at', audited_by: 'audited by',
      agent_status: 'agent status', passed_to: 'passed to',
      agent_email: 'agent email', agent_fd_id: 'agent fd id',
      action_time: 'action time', agent_status_log: 'agent status log',
      pass_reason: 'pass reason',
    },
    upsertOn: 'key,queued_date',
    require: ['key', 'queued_date'],
  },
  {
    // 'Candidates' -> qe_candidates (UNIQUE(queued_date, agent)). `candidates`
    // is a text JSON payload — left as the sheet string.
    spreadsheet: 'quality', sheet: 'Candidates', table: 'qe_candidates',
    columns: ['queued_date', 'agent', 'candidates'],
    sheetToDb: { queued_date: 'queued date' },
    upsertOn: 'queued_date,agent',
    require: ['queued_date', 'agent'],
  },
  {
    // 'Build Outcomes' -> qe_outcomes (UNIQUE(queued_date, ran_at)).
    spreadsheet: 'quality', sheet: 'Build Outcomes', table: 'qe_outcomes',
    columns: ['queued_date', 'ran_at', 'mode', 'outcomes'],
    sheetToDb: { queued_date: 'queued date', ran_at: 'ran at' },
    upsertOn: 'queued_date,ran_at',
    require: ['queued_date', 'ran_at'],
  },
  {
    // 'Build Log' -> qe_builds. S02-02 gave it UNIQUE(ran_at) — upsertOn set
    // so re-runs are idempotent (was append-only plain insert).
    spreadsheet: 'quality', sheet: 'Build Log', table: 'qe_builds',
    columns: ['ran_at', 'by', 'mode', 'agents', 'queued', 'pool', 'eligible', 'notes'],
    sheetToDb: { ran_at: 'ran at' },
    upsertOn: 'ran_at',
    require: ['ran_at'],
  },
  {
    // 'Catalogue' -> qe_catalogue (UNIQUE(kind, value)).
    spreadsheet: 'quality', sheet: 'Catalogue', table: 'qe_catalogue',
    columns: ['kind', 'value', 'times_seen', 'last_seen'],
    sheetToDb: { times_seen: 'times seen', last_seen: 'last seen' },
    upsertOn: 'kind,value',
    require: ['kind', 'value'],
  },
  {
    // 'Ticket Detail Cache' -> qe_fd_cache. Remote table absent (dry-run §3
    // B3) — created by 014_migration_hardening.sql in this exact 13-column
    // shape with id PRIMARY KEY, so upsertOn 'id' is safe and re-runs are
    // idempotent.
    spreadsheet: 'quality', sheet: 'Ticket Detail Cache', table: 'qe_fd_cache',
    columns: ['id', 'group_name', 'contact_type_1', 'contact_type_2',
      'contact_type_3', 'subject', 'status', 'country',
      'order_id', 'channel', 'source', 'created_at', 'cached_at'],
    sheetToDb: {
      group_name: 'group name', contact_type_1: 'contact type 1',
      contact_type_2: 'contact type 2', contact_type_3: 'contact type 3',
      order_id: 'order id', created_at: 'created at', cached_at: 'cached at',
    },
    upsertOn: 'id',
    require: ['id'],
  },
]

/**
 * Row transforms — applied to the raw sheet row (lowercased headers, the shape
 * route.ts `readSheet` returns) BEFORE `mapRow`. A transform may write
 * synthetic cells that `columns`/`sheetToDb` then pick up (e.g. `extra_json`,
 * `date`, `note`, `layer`, `year`, `log_id`). Suggested runner hook, inside
 * migrateTable between read and map:
 *
 *   const tf = ROW_TRANSFORMS[mapping.sheet]
 *   if (tf) rows.forEach((r, i) => tf(r, { spreadsheet: mapping.spreadsheet, table: mapping.table, index: i }))
 *
 * Keyed by sheet (tab) name — `agg_productivity_daily` and `prod_daily_layers`
 * map to the same table, so table name alone cannot key them.
 */
export interface TransformCtx {
  spreadsheet: string
  table: string
  index: number
}
export type RowTransform = (row: Record<string, unknown>, ctx: TransformCtx) => void

/** 'data_2026' -> 2026; undefined for non-year stores. */
function yearOfSpreadsheet_(key: string): number | undefined {
  const m = /(?:^|_)(\d{4})$/.exec(key)
  return m ? parseInt(m[1], 10) : undefined
}

function schTruthy_(v: unknown): boolean {
  return v === true || ['true', 'yes', '1'].indexOf(String(v ?? '').trim().toLowerCase()) !== -1
}

export const ROW_TRANSFORMS: Record<string, RowTransform> = {
  // CC2 Data {year} shards: inject the store's year as the `year` column.
  queue_snapshots: (row, ctx) => {
    const y = yearOfSpreadsheet_(ctx.spreadsheet)
    if (y !== undefined && (row.year === undefined || row.year === null || row.year === '')) row.year = y
  },
  agg_inflow_hourly: (row, ctx) => {
    const y = yearOfSpreadsheet_(ctx.spreadsheet)
    if (y !== undefined && (row.year === undefined || row.year === null || row.year === '')) row.year = y
  },
  // env.ts TABLE_ALIAS: the legacy year store lands in prod_daily_layers as layer='effective'.
  agg_productivity_daily: (row) => {
    if (row.layer === undefined || row.layer === null || row.layer === '') row.layer = 'effective'
  },
  // agg_snapshots_today is on the (non-sharded) live store — same helper, so a
  // future year-keyed copy still gets a year; 'live' -> no-op (null year).
  agg_snapshots_today: (row, ctx) => {
    const y = yearOfSpreadsheet_(ctx.spreadsheet)
    if (y !== undefined && (row.year === undefined || row.year === null || row.year === '')) row.year = y
  },
  // Pre-004 refresh_log had log_id/type NOT NULL; the sheet rows carry neither.
  // S10-01: log_id = 'mig-'+ctx.index (positional). The live table holds 8,197
  // WP-51 rows keyed this way and the pending UNIQUE(log_id) DDL has no
  // refresh_log backfill — a sha1 mint would match nothing and duplicate ~9k
  // rows (finding data-1). The source sheet is append-only, so position is
  // stable and needs no empty-identity branch.
  refresh_log: (row, ctx) => {
    if (row.log_id === undefined || row.log_id === null || row.log_id === '')
      row.log_id = 'mig-' + ctx.index
  },
  // sheet email -> tl_email (via sheetToDb); dates pack into extra_json per the port.
  sched_team: (row) => {
    row.extra_json = JSON.stringify({
      start_date: row.start_date || '',
      end_date: row.end_date || '',
      note: row.note || '',
    })
    if (row.active === undefined || row.active === null || row.active === '') row.active = true
  },
  // sheet (month, off_days) -> db date cell 'yyyy-MM:d1,d2' / ':d1,d2'.
  sched_offdays: (row) => {
    const off = String(row.off_days ?? '').trim()
    if (!off) return // per-date rows (yyyy-MM-dd already in `date`) pass through
    const month = String(row.month ?? '').trim().slice(0, 7)
    row.date = /^\d{4}-\d{2}$/.test(month) ? month + ':' + off : ':' + off
  },
  // sheet (wfh, reason) -> db note = schNotePack_({reason, wfh}).
  sched_overrides: (row) => {
    row.note = JSON.stringify({ reason: row.reason || '', wfh: schTruthy_(row.wfh) })
  },
  // sheet `note` holds the DECISION note -> decided_note; requester meta packs into note.
  sched_requests: (row) => {
    row.decided_note = row.note ?? ''
    row.note = JSON.stringify({
      subtype: row.subtype || '',
      shift: row.shift || '',
      with_shift: row.with_shift || '',
      reason: row.reason || '',
      peer_status: row.peer_status || '',
      peer_at: row.peer_at || '',
    })
  },
  // Approximate the ported timeline segments from the budget columns
  // (start hour + queue_h/people_h/task_h, sequential). Enough for
  // tlqShiftsFromTimeline_'s queue windows — flagged in DECISIONS.
  sched_plan: (row, ctx) => {
    const num = (v: unknown) => { const n = Number(v); return isFinite(n) ? n : 0 }
    let h = num(row.start)
    const segs: { kind: string; from: number; to: number }[] = []
    const push = (kind: string, hours: number) => {
      if (hours > 0) { segs.push({ kind, from: h, to: h + hours }); h += hours }
    }
    push('queue', num(row.queue_h))
    push('people', num(row.people_h))
    push('task', num(row.task_h))
    if (segs.length) row.segments_json = JSON.stringify(segs)
    if (row.wfh === undefined || row.wfh === null || row.wfh === '') row.wfh = false
    // S09-01: dedupe_key = 'mig-'+sha1(month|tl_email|date|shift|variant) —
    // MUST match the DDL dedupe group; positional fallback when all empty.
    if (row.dedupe_key === undefined || row.dedupe_key === null || row.dedupe_key === '')
      row.dedupe_key = dedupeKey_('mig-', ctx.index, [
        row.month, row.tl_email, row.date, row.shift, row.variant,
      ])
  },
  // S02-02: all qa_access_log key cols are nullable -> UNIQUE sits on a
  // minted dedupe_key. S09-01: 'mig-'+sha1(email|action|submitted_by|
  // submitted_at) matching the DDL dedupe group; positional fallback when
  // all identity cells are empty.
  QaAccessLog: (row, ctx) => {
    if (row.dedupe_key === undefined || row.dedupe_key === null || row.dedupe_key === '')
      row.dedupe_key = dedupeKey_('mig-', ctx.index, [
        row.email, row.action, row.submitted_by, row.submitted_at,
      ])
  },
}

/**
 * Optional unions for route.ts's parse sets — numeric-string cells cast cleanly
 * without them, so these only harden against dirty cells. NOT added anywhere:
 *   'actionable' — integer in queue_snapshots/agg_queue_now but BOOLEAN in
 *     aging_open_tickets; a global INT/NUM entry would null the booleans.
 *   'from','to'  — numeric here but TEXT in tlp_area_metrics (WP-32's table).
 *   'value'      — sched_config writes plain strings that must stay jsonb
 *     strings (a JSON.parse would turn '9' into a number).
 */
export const SUGGESTED_INT_COLS = [
  'open', 'unassigned', 'over_top', 'created_today', 'resolved_today', 'band',
  'inflow', 'days', 'hour', 'touches', 'agents', 'queued', 'pool', 'eligible',
  'times_seen', 'version', 'reopen_count', 'status_code', 'priority',
  'rows_in', 'rows_out', 'audits', 'variant',
]
export const SUGGESTED_NUM_COLS = [
  'age_h', 'oldest_h', 'overall_pct', 'inbound_pct', 'texting_pct', 'wa_pct',
  'inbound_achieved', 'inbound_missed', 'texting_achieved', 'wa_achieved',
  'productive_min', 'idle_min', 'avg_score', 'old_score', 'new_score',
  'alignment_pct',
]
export const SUGGESTED_JSON_COLS = [
  'queues_json', 'corrections_json', 'by_status_json', 'bands_json',
  'segments_json', 'extra_json', 'definition_json',
]

/**
 * Open items the orchestrator/PM must resolve — also flagged inline above.
 *  - qe_fd_cache: no DB table in any migration (mapped anyway; needs CREATE
 *    TABLE or the entry dropped).
 *  - qa_access_log: absent from migration files though server.ts uses it —
 *    confirm it exists remotely (created out-of-band like qa_flags/qa_daily).
 *  - queue_submissions / dq_aging_flags: no UNIQUE on the natural key
 *    (submission_id / flag_id) — inserts duplicate on re-run unless an index
 *    is added or the runner pre-deletes.
 *  - dqRewrite_ stores (aging_open_tickets, agg_queue_now, agg_inflow_weekly/
 *    monthly, agg_agent_perf, agg_agent_daily, agg_snapshots_today,
 *    sched_plan, qe_builds): full-snapshot inserts — same re-run caveat.
 *  - sched_plan.segments_json is reconstructed, not original data.
 *  - mapRow stamps now() into empty created_at/updated_at/computed_at cells —
 *    inherited route.ts behaviour (notable on tickets.created_at).
 *  - WP-31's ''-vs-null hazard: checked — every ''-default column in scope is
 *    `default ''` WITHOUT NOT NULL (qe_queue_log, qa_*, sched_*), and all NOT
 *    NULL cols are covered by `require`, so null inserts are safe here. The
 *    engine's `|| ''` reads treat null and '' alike.
 */
export const DECISIONS: string[] = [
  'qe_fd_cache / qa_access_log absent remotely (dry-run B3) — 014_migration_hardening.sql creates them in the mapping shapes (qe_fd_cache.id PRIMARY KEY -> upsertOn id; qa_access_log UNIQUE on minted dedupe_key -> upsertOn dedupe_key + ROW_TRANSFORMS)',
  'sched_plan + qa_access_log have no usable natural key (S02-02/S02-03) — UNIQUE on dedupe_key, minted as \'mig-\'+sha1(identity cells) by ROW_TRANSFORMS (S09-01 content hash, positional fallback when all identity cells empty); re-runs upsert idempotently',
  '014 adds UNIQUE(submission_id) on queue_submissions and UNIQUE(flag_id) on dq_aging_flags — upsertOn now set on both mappings; re-runs idempotent',
  'dqRewrite_-style stores insert full snapshots — truncate/pre-delete before a second run',
  'sched_plan.segments_json is reconstructed from queue_h/people_h/task_h budgets, not original segments',
  'aging_flags/queue_status_submissions/sched_* read from CC2 Core (dataSpreadsheet_), not CC2 Live as 80-data-migration.md lists — doc correction needed',
]
