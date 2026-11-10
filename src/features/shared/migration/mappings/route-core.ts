/** The pre-wave-3 route mappings (prod/quality/view_as) — moved out of
 * route.ts so the migration engine + CLI share one source of truth. */
import 'server-only'
import type { TableMapping } from '../engine'

export const MAPPINGS: TableMapping[] = [
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
    // Sheet carries a real `layer` column (578 'effective' + 578 'raw' rows —
    // dry-run §2). upsertOn is the app's true conflict target
    // (shared/jobs/env.ts:349 hard-codes ['date','email','layer'] for this
    // table): (date,email) alone is NOT unique — two layers share it
    // (dry-run B8). Needs the 014 unique index; see that file.
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
    upsertOn: 'date,email,layer',
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
    // Tab absent in CC2 Prod (dry-run B6 — owner decision pending; see
    // migration-report.md). Columns follow the shape the ported job actually
    // appends (jobs/quarterly.ts:61-71 = 003 DDL = remote V1 shape) so a
    // created tab with app headers would migrate correctly. NB `quarter` is
    // INTEGER in DDL — a real tab must carry quarter numbers, or the engine's
    // INT set needs 'quarter'.
    spreadsheet: 'productivity', sheet: 'prod_quarterly_reports', table: 'prod_quarterly_reports',
    columns: ['report_id', 'quarter', 'year', 'start_date', 'end_date',
      'report_json', 'created_at'],
    upsertOn: 'report_id',
    require: ['report_id'],
  },
  {
    // Sheet cols `date,agent_email,slots_json,sources_json,by,at` — match
    // remote exactly (dry-run B5). upsertOn 'date,agent_email' is the app's
    // real conflict target (tph/write.ts:108); plain 'date' collapsed 27
    // agent rows to 3 in the dry-run.
    spreadsheet: 'productivity', sheet: 'prod_tph_days', table: 'prod_tph_days',
    columns: ['date', 'agent_email', 'slots_json', 'sources_json', 'by', 'at'],
    upsertOn: 'date,agent_email',
    require: ['date', 'agent_email'],
  },
  {
    // Sheet cols `task_id,date,agent_email,channel,start,end,by,at,removed`
    // (dry-run B5). App upserts on task_id (tph/write.ts:171,198). Remote
    // lacks `removed` — 014 adds it (the app writes the column anyway).
    spreadsheet: 'productivity', sheet: 'prod_tph_tasks', table: 'prod_tph_tasks',
    columns: ['task_id', 'date', 'agent_email', 'channel', 'start', 'end',
      'by', 'at', 'removed'],
    upsertOn: 'task_id',
    require: ['task_id'],
  },
  {
    // Sheet cols `date,source,cases_json,by,at` (dry-run B5). App upserts on
    // (date,source) — 'tl'/'auto'/'rebuilt' source rows coexist per date
    // (tph/write.ts:227).
    spreadsheet: 'productivity', sheet: 'prod_tph_cases', table: 'prod_tph_cases',
    columns: ['date', 'source', 'cases_json', 'by', 'at'],
    upsertOn: 'date,source',
    require: ['date'],
  },
  {
    // Sheet cols `date,touches_json,computed_at` (dry-run B5). App upserts on
    // date (tph/index.ts:1517).
    spreadsheet: 'productivity', sheet: 'prod_tph_touches', table: 'prod_tph_touches',
    columns: ['date', 'touches_json', 'computed_at'],
    upsertOn: 'date',
    require: ['date'],
  },
  {
    // Already correct in the dry-run (the only well-shaped tph mapping):
    // sheet `date,calls_json,computed_at`; app upserts on date
    // (tph/index.ts:1579).
    spreadsheet: 'productivity', sheet: 'prod_tph_calls', table: 'prod_tph_calls',
    columns: ['date', 'calls_json', 'computed_at'],
    upsertOn: 'date',
    require: ['date'],
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
    upsertOn: 'date,channel,contact_type',
  },
]
