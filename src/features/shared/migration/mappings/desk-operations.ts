/**
 * WP-32 — desk + operations migration mappings (Sheets -> Supabase).
 *
 * Entry shape mirrors `src/app/api/admin/migrate/route.ts` exactly (route.ts is
 * owned by the orchestrator — do not edit it here). Same conventions as the
 * sibling migration/mappings/queue-quality.ts + people-core.ts:
 *
 *   1. Union `SPREADSHEETS` into route.ts's `SPREADSHEETS` (`core`/`quality`/
 *      `productivity`/`tickets`/`data_2026` are provided by route.ts or the
 *      siblings — this module only needs `live` added).
 *   2. Spread `MAPPINGS` into route.ts's `MAPPINGS` array. Order matters:
 *      `trackers` before `tracker_fields` before the tracker record backfills
 *      (FK chain) — keep this module's entries in file order on merge.
 *   3. Apply `ROW_TRANSFORMS` (sibling hook: mutate the raw sheet row between
 *      readSheet and mapRow — required here for epoch-ms timestamps, the
 *      tlp_queue_daily `windows` string->int count, JSON cells, and
 *      'TRUE'/'FALSE' -> boolean cells).
 *   4. Union the `SUGGESTED_*_COLS` sets (hardening only — PG casts the clean
 *      numeric strings anyway).
 *   5. `NULL_AS_EMPTY` needs a mapRow-side rule (a row transform CANNOT do it:
 *      mapRow turns '' back into null): for every `text NOT NULL DEFAULT ''`
 *      column listed, emit '' instead of null. Without it the pending
 *      mail_approvals rows (6 empty NOT-NULL text cols, verified) fail the
 *      whole 500-row batch on the not-null constraint.
 *   6. `TRACKER_RECORD_BACKFILLS` — the record tab of every registry tracker
 *      (storage_mode/spreadsheet_id/tab_name/header_row read live from the
 *      Trackers tab 2026-11-06: 5 external built-ins + damaged_items_5917
 *      native in Core). The flat TableMapping shape cannot produce
 *      `values` jsonb, `row_n`, or the positional record_id fallback, so
 *      these are declarative descriptors for a ~40-line runner extension —
 *      semantics on the interface below.
 *   7. WP-F6 (external storage cutover): each backfill descriptor carries
 *      `postBackfill` — the `trackers` update flipping storage_mode->'native'
 *      (D-DATA: migrate then continue in Supabase; fail-closed trackerIoFor_
 *      at trackers.ts:358 can only serve tracker_records for 'native'
 *      trackers — unmigrated externals must stay 'external' and keep
 *      failing closed). Apply it per-tracker once its backfill completes
 *      without error; TRACKER_FLIP_SQL is the equivalent one-shot statement.
 *
 * Evidence (live Sheets probe, SA migration-reader@, 2026-11-06 — every store
 * now shared/readable, including CC2 Live which was still 403 in
 * audits/sheet-access.md):
 *   CC2 Core  `1PdDr3J5JECemwPAcf5sCy8b8ivZ5C6hBxBsso1bZVGs` — tabs: Trackers(6
 *             rows), TrackerFields(66), HeatmapInputs(0), "Tracker Damaged
 *             Items"(1), QaAccessLog, queue_status_submissions, Options, Popups,
 *             MailLog… (NO HeatmapAssumptionSets tab — created lazily by
 *             ensureTable_ on first save; mapping kept, run logs "not found".)
 *   CC2 Live  `1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4` — tabs: tlp_* x8,
 *             mail_* x3, kpi_*, sc_months, agg_*, refresh_log, aging_open_tickets
 *   Trackers registry — 6 rows: 5 built-ins (storage_mode 'external') +
 *             damaged_items_5917 ('native', record tab in CC2 Core).
 *   Verified data quirks: tlp_shifts.shift_start/end are epoch-ms strings;
 *             tlp_queue_daily.windows are range STRINGS ("09:30-17:00") while
 *             the port + DDL store an integer count (tlqueue.ts:234);
 *             mail_sla/Trackers/TrackerFields booleans are 'TRUE'/'FALSE'.
 *
 * Sources (legacy): TLP_HEADERS (Desk_deprecated/TlPerformance.js:17-26),
 *   TLS_HEADERS (Desk_deprecated/TlSnapshots.js:18-25), MD_HEADERS
 *   (Desk_deprecated/MailDesk.js:34-40) -> dqTableDefs_ store 'live' = ss_live_id;
 *   TRACKERS/TRACKER_FIELDS_HEADERS (Operations_deprecated/Trackers.js:28-34),
 *   HM_*_HEADERS (Queue_deprecated/Heatmap.js:23-27) -> dataSpreadsheet_() =
 *   CC2 Core. NOTE: 80-data-migration.md's inventory lists TLP/MD under "CC2
 *   Core" and Heatmap under CC2 Live — both wrong; the code + probe win.
 */

/** Exact shape of src/app/api/admin/migrate/route.ts TableMapping —
 * `spreadsheet` widened to string (sibling convention): 'live' is not a key of
 * route.ts's SPREADSHEETS until the merge adds it. */
export interface TableMapping {
  spreadsheet: string
  sheet: string
  table: string
  columns: string[]                  // DB columns to write
  sheetToDb?: Record<string, string> // DB col -> sheet header (lowercased by readSheet)
  upsertOn?: string                  // conflict column(s) for upsert (else plain insert)
  require?: string[]                 // DB cols that must be non-null (row skipped if null)
}

export const SPREADSHEETS = {
  live: '1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4', // ss_live_id — CC2 Live
} as const

export const MAPPINGS: TableMapping[] = [
  // ------------------------------------------------------------------
  // Operations registry FIRST (tracker_fields/tracker_records FK to it).
  // ------------------------------------------------------------------
  {
    // Trackers tab in CC2 Core — all 6 registry rows incl. native
    // damaged_items_5917. Upsert overlays real values onto the 009 seeds.
    // Keep AHEAD of the record backfills: on re-runs it re-writes
    // storage_mode='external' from the sheet, so the postBackfill flips
    // must re-apply after it (idempotent end state unchanged).
    spreadsheet: 'core', sheet: 'Trackers', table: 'trackers',
    columns: ['tracker_id', 'name', 'storage_mode', 'spreadsheet_id', 'tab_name', 'header_row',
      'access_mode', 'form_backed', 'record_id_header', 'record_id_format', 'submitted_by_header',
      'submitted_at_header', 'viewer_roles', 'editor_roles', 'builder_roles', 'owner_email',
      'archived_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'tracker_id',
    // name + header_row are NOT NULL with no usable '' fallback (009).
    require: ['tracker_id', 'name', 'header_row'],
  },
  {
    // TrackerFields tab in CC2 Core — 66 rows (61 built-in seed fields +
    // 2 later customer_strikes fields + 3 damaged_items_5917 fields).
    // WP-F4: fresh-env seeds ship separately in
    // supabase/migrations/013_tracker_fields_seed.sql; this mapping migrates
    // the REAL tab and overlays it on the seeds (same PK).
    spreadsheet: 'core', sheet: 'TrackerFields', table: 'tracker_fields',
    columns: ['field_id', 'tracker_id', 'position', 'label', 'column_header', 'type', 'required',
      'list_key', 'parent_field_id', 'auto', 'active', 'submitted_by', 'submitted_at'],
    upsertOn: 'tracker_id,field_id',
    // label + position are NOT NULL with no usable '' fallback (009).
    require: ['tracker_id', 'field_id', 'label', 'position'],
  },
  // ------------------------------------------------------------------
  // Heatmap stores (HM_*_HEADERS, Heatmap.js:23-27) — CC2 Core.
  // ------------------------------------------------------------------
  {
    // Empty today (0 rows). If rows appear before WP-51: legacy
    // data_1..data_4 are base64 GZIP chunks; the port stores the whole
    // payload as plain JSON in data_1 (heatmap.ts hmPack_/hmUnpack_).
    // Runner must concat chunks, base64-decode + gunzip, write the JSON
    // string to data_1 and '' to data_2..4 — copying chunks verbatim makes
    // hmUnpack_ throw on read. See DECISIONS.
    spreadsheet: 'core', sheet: 'HeatmapInputs', table: 'heatmap_inputs',
    columns: ['input_id', 'name', 'source', 'interval_minutes', 'cells_count', 'window_json', 'notes',
      'data_1', 'data_2', 'data_3', 'data_4', 'archived_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'input_id',
    require: ['input_id'],
  },
  {
    spreadsheet: 'core', sheet: 'HeatmapAssumptionSets', table: 'heatmap_assumption_sets',
    columns: ['set_id', 'name', 'assumptions_json', 'archived_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'set_id',
    require: ['set_id'],
  },
  // ------------------------------------------------------------------
  // Desk + shared TL snapshots — CC2 Live (dqTableDefs_ store 'live').
  // ------------------------------------------------------------------
  {
    spreadsheet: 'live', sheet: 'tlp_resp_ratings', table: 'tlp_resp_ratings',
    columns: ['rating_id', 'tl_email', 'week', 'area', 'rating', 'note', 'rated_by', 'rated_at'],
    upsertOn: 'rating_id',
    require: ['rating_id', 'tl_email', 'week', 'area'], // tl_email/week/area NOT NULL, no default (010)
  },
  {
    spreadsheet: 'live', sheet: 'tlp_kb', table: 'tlp_kb',
    columns: ['kb_id', 'topic', 'requested_at', 'done_at', 'accurate', 'owner_email', 'note',
      'created_by', 'created_at', 'updated_at'],
    upsertOn: 'kb_id',
    require: ['kb_id', 'topic'], // topic NOT NULL, no default
  },
  {
    spreadsheet: 'live', sheet: 'tlp_otd', table: 'tlp_otd',
    columns: ['key', 'month', 'warehouse', 'value', 'entered_by', 'entered_at'],
    upsertOn: 'key',
    require: ['key', 'warehouse', 'month'], // month + warehouse NOT NULL, no default
  },
  {
    spreadsheet: 'live', sheet: 'tlp_ticket_exclusions', table: 'tlp_ticket_exclusions',
    columns: ['key', 'area', 'ticket_id', 'reason', 'logged_by', 'logged_at', 'removed_by', 'removed_at'],
    upsertOn: 'key',
    require: ['key', 'area', 'ticket_id'], // area/ticket_id NOT NULL, no default
  },
  {
    // shift_start/shift_end arrive as epoch-ms strings ('1790490600000');
    // ROW_TRANSFORMS converts to ISO (cols are timestamptz; the port writes
    // ISO, tlqueue.ts:207). queue_json is parsed to jsonb by the transform.
    spreadsheet: 'live', sheet: 'tlp_shifts', table: 'tlp_shifts',
    columns: ['key', 'date', 'tl_email', 'shift_start', 'shift_end', 'queue_json', 'updated_at'],
    upsertOn: 'key',
    require: ['key'],
  },
  {
    // windows arrives as range STRINGS ("09:30-17:00" / "13:00-15:00, 17:00-22:00")
    // — TlQueue.js:324 wrote s.windows.join(', '); the port writes the integer
    // count (tlqueue.ts:234) and the column is `integer`. ROW_TRANSFORMS counts
    // the comma-separated ranges ('' -> null). Data-fidelity note: the count
    // is preserved; the range text is not representable in an integer column
    // (the desk page renders String(windows) either way).
    // 014_migration_hardening.sql adds UNIQUE(date,tl_email) — upsertOn set so
    // re-runs are idempotent (was plain insert; PRE_RUN_SQL kept below as the
    // standalone equivalent).
    spreadsheet: 'live', sheet: 'tlp_queue_daily', table: 'tlp_queue_daily',
    columns: ['date', 'tl_email', 'windows', 'queue_min', 'calls_in', 'calls_serviced', 'calls_abandoned',
      'calls_other', 'answer_rate', 'text_touches', 'text_tickets', 'resp_count', 'resp_avg_min',
      'resp_missing', 'text_source', 'computed_at'],
    upsertOn: 'date,tl_email',
    require: ['date', 'tl_email'],
  },
  {
    // 014 adds UNIQUE(tl_email,month) — upsertOn set for idempotent re-runs.
    spreadsheet: 'live', sheet: 'tlp_team', table: 'tlp_team',
    columns: ['tl_email', 'month', 'quality', 'fcr', 'productivity', 'agents', 'updated_at',
      'kpi_score', 'kpi_prod', 'kpi_qual', 'kpi_fcr', 'kpi_behavior', 'kpi_agents', 'ol_agents',
      'ineligible_agents', 'red_zone', 'action_plan', 'probation_agents', 'partial_agents'],
    upsertOn: 'tl_email,month',
    require: ['tl_email', 'month'],
  },
  {
    spreadsheet: 'live', sheet: 'tlp_area_metrics', table: 'tlp_area_metrics',
    columns: ['key', 'tl_email', 'area', 'from', 'to', 'pct', 'met', 'total', 'rule', 'updated_at'],
    upsertOn: 'key',
    require: ['key'],
  },
  // ------------------------------------------------------------------
  // Mail desk (MD_HEADERS, MailDesk.js:34-40) — CC2 Live.
  // ------------------------------------------------------------------
  {
    spreadsheet: 'live', sheet: 'mail_sla', table: 'mail_sla',
    columns: ['message_id', 'thread_id', 'kind', 'subject', 'from_email', 'received_at', 'expected_tls',
      'status', 'replied_at', 'replied_by', 'minutes_to_reply', 'breached', 'by_expected',
      'covering_missed', 'snippet', 'updated_at', 'due_at', 'next_shift'],
    upsertOn: 'message_id',
    require: ['message_id', 'thread_id'], // thread_id NOT NULL, no default
  },
  {
    // Pending rows carry '' in 6 `text NOT NULL DEFAULT ''` cols (reply_to,
    // decision_text, decided_by, sent_status, sent_message_id, client_token)
    // — NULL_AS_EMPTY emits '' for them; a null insert fails the batch.
    spreadsheet: 'live', sheet: 'mail_approvals', table: 'mail_approvals',
    columns: ['thread_id', 'message_id', 'rfc_message_id', 'type', 'mobile', 'order_id', 'subject',
      'requester', 'reply_to', 'cc', 'received_at', 'excerpt', 'status', 'decision_text', 'decided_by',
      'decided_at', 'sent_status', 'sent_message_id', 'client_token', 'updated_at'],
    upsertOn: 'thread_id',
    require: ['thread_id'],
  },
  {
    spreadsheet: 'live', sheet: 'mail_approval_log', table: 'mail_approval_log',
    columns: ['log_id', 'thread_id', 'action', 'decision', 'text', 'by', 'at', 'sent_status',
      'to', 'cc', 'error'],
    upsertOn: 'log_id',
    require: ['log_id', 'thread_id'], // thread_id NOT NULL, no default
  },
]

// ---------------------------------------------------------------------------
// ROW_TRANSFORMS — sibling convention (queue-quality.ts): applied to the raw
// sheet row (lowercased headers) BEFORE mapRow. A transform may overwrite the
// cell values `columns` then picks up. Suggested runner hook, inside
// migrateTable between read and map:
//
//   const tf = ROW_TRANSFORMS[mapping.sheet]
//   if (tf) rows.forEach((r, i) => tf(r, { spreadsheet: mapping.spreadsheet, table: mapping.table, index: i }))
// ---------------------------------------------------------------------------

export interface TransformCtx {
  spreadsheet: string
  table: string
  index: number
}
export type RowTransform = (row: Record<string, unknown>, ctx: TransformCtx) => void

/** '1790490600000' epoch-ms string -> ISO; anything else passes through. */
const epochMsToIso_ = (v: unknown): unknown => {
  const s = String(v ?? '').trim()
  return /^\d{13}$/.test(s) ? new Date(Number(s)).toISOString() : v
}

/** 'a-b, c-d' range string -> count of parts ('' stays '': mapRow -> null). */
const csvWindowCount_ = (v: unknown): unknown => {
  const s = String(v ?? '').trim()
  if (!s) return v
  return s.split(',').map((p) => p.trim()).filter(Boolean).length
}

/** Valid JSON string -> parsed value (for jsonb cols); else unchanged. */
const parseJson_ = (v: unknown): unknown => {
  if (typeof v !== 'string') return v
  const s = v.trim()
  if (!s) return v
  try { return JSON.parse(s) } catch { return v }
}

/** ''/missing -> dflt; else isTrue_ semantics ('TRUE'/'true'/true -> true). */
const truthyOr_ = (v: unknown, dflt: boolean): boolean => {
  if (v === undefined || v === null || String(v).trim() === '') return dflt
  return v === true || String(v).trim().toLowerCase() === 'true'
}

export const ROW_TRANSFORMS: Record<string, RowTransform> = {
  // WP-F21 residual — people-core sheet key: attended is BOOLEAN NOT NULL
  // DEFAULT TRUE; '' must land as the default true (truthyOr_ semantics).
  meeting_attendees: (row) => {
    row.attended = truthyOr_(row.attended, true)
  },
  Trackers: (row) => {
    row.form_backed = truthyOr_(row.form_backed, false)
  },
  TrackerFields: (row) => {
    row.required = truthyOr_(row.required, false)
    // '' means ACTIVE in legacy reads (isTrue_ checks 'false', not falsy) —
    // the DB default is true, so an empty cell must land true, not false.
    row.active = truthyOr_(row.active, true)
  },
  HeatmapInputs: (row) => {
    row.window_json = parseJson_(row.window_json)
  },
  HeatmapAssumptionSets: (row) => {
    row.assumptions_json = parseJson_(row.assumptions_json)
  },
  tlp_shifts: (row) => {
    row.shift_start = epochMsToIso_(row.shift_start)
    row.shift_end = epochMsToIso_(row.shift_end)
    row.queue_json = parseJson_(row.queue_json)
  },
  tlp_queue_daily: (row) => {
    row.windows = csvWindowCount_(row.windows)
  },
  mail_sla: (row) => {
    row.breached = truthyOr_(row.breached, false)
    row.by_expected = truthyOr_(row.by_expected, false)
    row.covering_missed = truthyOr_(row.covering_missed, false)
    row.next_shift = truthyOr_(row.next_shift, false)
  },
}

/**
 * Columns declared `text NOT NULL DEFAULT ''`: emit '' for empty/missing
 * cells at mapRow level (a RowTransform cannot — mapRow re-nulls '').
 * Without it, NULL inserts violate the constraint and fail whole batches.
 * Verified offenders: mail_approvals pending rows (6 cols), trackers
 * damaged_items_5917 (spreadsheet_id ''), trackers.owner_email/archived_at.
 */
export const NULL_AS_EMPTY: Record<string, string[]> = {
  trackers: ['spreadsheet_id', 'tab_name', 'access_mode', 'record_id_header', 'record_id_format',
    'submitted_by_header', 'submitted_at_header', 'viewer_roles', 'editor_roles', 'builder_roles',
    'owner_email', 'archived_at', 'submitted_by'],
  tracker_fields: ['column_header', 'type', 'list_key', 'parent_field_id', 'auto', 'submitted_by'],
  tlp_resp_ratings: ['note', 'rated_by'],
  tlp_kb: ['accurate', 'owner_email', 'note', 'created_by'],
  tlp_otd: ['entered_by'],
  tlp_ticket_exclusions: ['reason', 'logged_by', 'removed_by'],
  mail_sla: ['kind', 'subject', 'from_email', 'expected_tls', 'status', 'replied_by', 'snippet'],
  mail_approvals: ['message_id', 'rfc_message_id', 'type', 'mobile', 'order_id', 'subject',
    'requester', 'reply_to', 'cc', 'excerpt', 'status', 'decision_text', 'decided_by',
    'sent_status', 'sent_message_id', 'client_token'],
  mail_approval_log: ['action', 'decision', 'text', 'by', 'sent_status', 'to', 'cc', 'error'],
  // WP-F21 residual — people/core tables whose empty cells must land as ''
  // (all verified TEXT NOT NULL DEFAULT '' in 002/008; meeting_attendees.attended
  // is BOOLEAN NOT NULL DEFAULT TRUE — handled by the transform below instead).
  actions: ['description', 'series_id', 'topic', 'outcome_note', 'closed_by'],
  action_reviews: ['note', 'prev_outcome_note'],
  action_updates: ['rag', 'next_step', 'drive_file_id', 'file_name', 'mime_type', 'planned_milestone_id'],
  action_task_details: ['priority', 'blocked_reason', 'rag_self', 'delivery_ref', 'expectation',
    'outcome_rating', 'outcome_note', 'rated_by'],
  one_on_one_schedule: ['log_id', 'rescheduled_to', 'reason', 'deleted_by', 'delete_reason', 'prev_status'],
  one_on_one_logs: ['schedule_id', 'no_action_reason', 'deleted_by', 'delete_reason', 'delete_cascade_json'],
  one_on_one_topics: ['skipped_reason', 'evidence_json'],
  meetings: ['notes', 'decisions'],
  my_notes: ['tag'],
  mail_log: ['cc', 'error'],
  health: ['last_note', 'last_error'],
  sc_daily: ['name'],
  sc_months: ['error', 'fcr_note', 'behaviour_note'],
  sc_behaviour: ['date'],
}

/**
 * Optional unions for route.ts's parse sets (hardening — clean numeric
 * strings cast anyway). JSON cols are additionally parsed by ROW_TRANSFORMS.
 * Deliberately NOT listed: 'windows' (handled by csvWindowCount_), 'from'/'to'
 * (text in tlp_area_metrics — WP-30 flagged the same collision), 'value'
 * (sched_config must stay a string — sibling note).
 */
export const SUGGESTED_INT_COLS = [
  'warehouse', 'calls_in', 'calls_serviced', 'calls_abandoned', 'calls_other',
  'text_touches', 'text_tickets', 'resp_count', 'resp_missing', 'agents', 'kpi_agents',
  'ol_agents', 'ineligible_agents', 'red_zone', 'action_plan', 'probation_agents',
  'partial_agents', 'met', 'total', 'interval_minutes', 'cells_count', 'header_row', 'position',
]
export const SUGGESTED_NUM_COLS = [
  'rating', 'value', 'pct', 'queue_min', 'answer_rate', 'resp_avg_min', 'minutes_to_reply',
  'quality', 'fcr', 'productivity', 'kpi_score', 'kpi_prod', 'kpi_qual', 'kpi_fcr', 'kpi_behavior',
]
export const SUGGESTED_JSON_COLS = ['queue_json', 'window_json', 'assumptions_json']

/**
 * Standalone equivalent of the two uniques now drafted in
 * supabase/migrations/014_migration_hardening.sql — both upsertOns are
 * already set on the mappings above, so applying 014 (or these two
 * statements) makes re-runs idempotent. Kept for manual/single-run use.
 */
export const PRE_RUN_SQL = [
  'CREATE UNIQUE INDEX IF NOT EXISTS tlp_queue_daily_date_tl_uidx ON tlp_queue_daily (date, tl_email)',
  'CREATE UNIQUE INDEX IF NOT EXISTS tlp_team_tl_month_uidx ON tlp_team (tl_email, month)',
]

// ---------------------------------------------------------------------------
// Tracker record backfills — every sheet-backed record tab (WP-32 scope) +
// WP-F6 storage_mode cutover.
// ---------------------------------------------------------------------------

/**
 * One sheet-backed tracker record tab -> tracker_records rows.
 *
 * The flat TableMapping cannot express this: `values` is a jsonb map
 * {field_id: cell}, `row_n` is the raw sheet row position, and record_id has a
 * positional fallback. Runner-extension semantics — mirror legacy
 * readTrackerData_ (Trackers.js:284-320) exactly:
 *
 *   - Resolve `spreadsheet`: a SPREADSHEETS key when it matches one
 *     ('core' for damaged_items_5917), else a literal spreadsheet id.
 *   - Read `'<sheet>'!A:ZZ`; headers come from row `headerRow` and are matched
 *     by normHeader_ (trim, collapse whitespace, lowercase — TEXT, not
 *     position). 'record_id'/'submitted_by'/'submitted_at' system headers are
 *     resolved the same way from recordIdHeader/submittedByHeader/
 *     submittedAtHeader.
 *   - If any field's column_header is missing -> FAIL CLOSED for that tracker
 *     (skip it, log the missing headers — the page's headerProblems pause).
 *   - For each non-blank data row (raw range index n, blank rows still
 *     consume a position):
 *       row_n        = headerRow + 1 + n
 *       record_id    = cell[recordIdHeader] || 'row-' + row_n
 *       submitted_by = normEmail(cell[submittedByHeader] || '')
 *       submitted_at = cell[submittedAtHeader] || null   (raw text; PG parses
 *                      '8/18/2026 15:40:21' and '2026-09-12 10:59' alike)
 *       values       = { field_id: cell } for every entry in `fields`
 *   - Upsert on (tracker_id, record_id); THEN apply `postBackfill` — the
 *     WP-F6 storage_mode flip. Apply only when the tracker's backfill step
 *     completed without error (0 data rows is still a complete migration).
 */
export interface TrackerRecordBackfill {
  trackerId: string
  /** SPREADSHEETS key ('core') or literal spreadsheet id from the registry row. */
  spreadsheet: string
  sheet: string
  headerRow: number
  recordIdHeader: string
  submittedByHeader: string
  submittedAtHeader: string
  /** field_id -> column_header for every ACTIVE field (from TrackerFields). */
  fields: Record<string, string>
  targetTable: 'tracker_records'
  upsertOn: 'tracker_id,record_id'
  /** WP-F6: after rows land, emit this trackers update — flips storage off the
   *  fail-closed external seam so trackerIoFor_ serves tracker_records. */
  postBackfill: { table: 'trackers'; update: { storage_mode: 'native' }; where: { tracker_id: string } }
}

export const TRACKER_RECORD_BACKFILLS: TrackerRecordBackfill[] = [
  {
    // No record_id/submitted_by/submitted_at columns in the sheet (V2 sys
    // cols were never appended) -> every row: record_id 'row-N',
    // submitted_by '', submitted_at null (the legacy "outside" rows).
    trackerId: 'blocked_customers',
    spreadsheet: '1KFC6ENFbQWPmRSziH9gLsBQED1hnh_e9ZknsjwruPEA',
    sheet: 'Sheet1', headerRow: 1,
    recordIdHeader: 'record_id', submittedByHeader: 'submitted_by', submittedAtHeader: 'submitted_at',
    fields: {
      customer_id: 'Customer ID', name: 'Name', mail: 'Mail', phone: 'Phone',
      reason: 'Reason', block_date: 'Block Date', profile_link: 'Profile Link',
      blocked_by: 'Blocked by',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'blocked_customers' } },
  },
  {
    // Google Form tab: Timestamp + Email Address are the submitter columns.
    trackerId: 'promocodes',
    spreadsheet: '1GsBilEGkmXqBSgmiv4jM5UHWPeW0_DpdmBVA3L1zgTw',
    sheet: 'Form Responses 1', headerRow: 1,
    recordIdHeader: 'record_id', submittedByHeader: 'Email Address', submittedAtHeader: 'Timestamp',
    fields: {
      promo_code: 'Promo Code', percentage_or_fixed: 'Percentage or Fixed Value?',
      value_fixed_or_perce: 'Value (Fixed or Percentage)', cap: 'Cap',
      select_countries_all: 'Select Countries Allowed to Use the Code',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'promocodes' } },
  },
  {
    // 2000 rows; 'Record ID' is the registry record_id_header ('OL1'…).
    // loss_in_kd is a 'computed' field — legacy reads the stored cell, so its
    // values migrate too; 'Column 1' is an unmapped junk column — ignored.
    trackerId: 'operational_loss',
    spreadsheet: '12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc',
    sheet: 'Sheet1', headerRow: 1,
    recordIdHeader: 'Record ID', submittedByHeader: 'submitted_by', submittedAtHeader: 'submitted_at',
    fields: {
      date_of_loss: 'Date of Loss', reported_date: 'Reported Date', team_liability: 'Team Liability',
      liability_reason: 'Liability Reason', loss_description: 'Loss Description', root_cause: 'Root Cause',
      country: 'Country', order_id: 'Order ID', item_id: 'Item ID',
      ticket_id_if_applica: 'Ticket ID (If Applicable)', loss_amount: 'Loss Amount',
      currancy: 'Currancy', actions_taken: 'Actions Taken', responsible_person: 'Responsible Person',
      status: 'Status', approval_date: 'Approval Date', approver: 'Approver',
      loss_trigger_type: 'Loss Trigger Type', detected_by: 'Detected By',
      loss_in_kd: 'Loss In KD', final_liability: 'Final Liability',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'operational_loss' } },
  },
  {
    // Form tab; the appended 'record_id' column exists but cells are empty
    // -> 'row-N' fallback. order_id/order_amount are the later builder-added
    // fields (headers exist in the tab).
    trackerId: 'customer_strikes',
    spreadsheet: '1Odij24BsYeukoqdGXOmqnVq36SL7s-8pFR9Jpz3OMmQ',
    sheet: 'Form Responses 1', headerRow: 1,
    recordIdHeader: 'record_id', submittedByHeader: 'Email Address', submittedAtHeader: 'Timestamp',
    fields: {
      customer_profile: 'Customer Profile', strike_reason: 'Strike Reason',
      reference_ticket: 'Reference Ticket', order_id: 'Order ID', order_amount: 'Order amount',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'customer_strikes' } },
  },
  {
    // View-only ledger: 'Agent'/'Logged at' are the submitter columns.
    // Flipping storage_mode->'native' only switches the READ path —
    // access_mode 'view_only' + REFUND_LEDGER_SPREADSHEET_ID keep every write
    // refused (trackerIsReadOnly_), so the flip is safe. The
    // 'Refund Log (pre-*)' archive tabs are not referenced by the registry
    // (tab_name) -> out of scope, logged by the validator.
    trackerId: 'refund_ledger',
    spreadsheet: '1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8',
    sheet: 'Refund Log', headerRow: 1,
    recordIdHeader: 'record_id', submittedByHeader: 'Agent', submittedAtHeader: 'Logged at',
    fields: {
      status: 'Status', order_number: 'Order number', reference_number: 'Reference number',
      confirmed_at: 'Confirmed at', reason: 'Reason', shipping_policy: 'Shipping policy',
      policy_overridden: 'Policy overridden', market: 'Market', currency: 'Currency',
      items_subtotal: 'Items subtotal', shipping_net: 'Shipping net', vat_on_shipping: 'VAT on shipping',
      shipping_vat: 'Shipping VAT', shipping_charged: 'Shipping charged', discount: 'Discount',
      discount_total: 'Discount total', order_total_computed: 'Order total (computed)',
      order_total_on_recor: 'Order total (on record)', refund_type: 'Refund type',
      items_refunded: 'Items refunded', shipping_refunded: 'Shipping refunded',
      adjustment: 'Adjustment', refund_total: 'REFUND TOTAL', breakdown: 'Breakdown',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'refund_ledger' } },
  },
  {
    // Native tracker (registry storage_mode='native', spreadsheet_id '') —
    // its sheet lives in the trackers spreadsheet = CC_DATA_SPREADSHEET_ID =
    // 'core'. postBackfill is a documented no-op (already native), kept for
    // uniformity so every backfill carries the flip mechanically.
    trackerId: 'damaged_items_5917',
    spreadsheet: 'core',
    sheet: 'Tracker Damaged Items', headerRow: 1,
    recordIdHeader: 'record_id', submittedByHeader: 'submitted_by', submittedAtHeader: 'submitted_at',
    fields: {
      order_id: 'Order ID', refund_amount: 'Refund Amount', case_description: 'Case Description',
    },
    targetTable: 'tracker_records', upsertOn: 'tracker_id,record_id',
    postBackfill: { table: 'trackers', update: { storage_mode: 'native' }, where: { tracker_id: 'damaged_items_5917' } },
  },
]

/**
 * WP-F6 consolidated statement — equivalent of applying every `postBackfill`
 * above. For manual runs, or if the runner implements the flip as one step
 * after ALL backfills (per-descriptor flips are preferred: a tracker whose
 * sheet failed to read stays external and is logged, not silently flipped).
 */
export const TRACKER_FLIP_SQL =
  "UPDATE trackers SET storage_mode = 'native', updated_at = now() " +
  "WHERE tracker_id IN ('blocked_customers','promocodes','operational_loss','customer_strikes','refund_ledger') " +
  "AND storage_mode <> 'native'"

/**
 * Open items the orchestrator / WP-51 operator must resolve — also flagged
 * inline above.
 */
export const DECISIONS: string[] = [
  'storage_mode flip (WP-F6): DECIDED — per-descriptor postBackfill flips storage_mode->native after a successful backfill (D-DATA "migrate then continue"; audit §5#3 recommendation). A tracker whose read fails is NOT flipped. TRACKER_FLIP_SQL is the consolidated fallback.',
  'WP-F4 field seed: DECIDED via SQL — supabase/migrations/013_tracker_fields_seed.sql ships the 61 built-in field rows (verbatim seedTrackerRegistry_ output, verified against the live TrackerFields tab). The TrackerFields->tracker_fields mapping then overlays the real tab (66 rows) on top.',
  'tlp_queue_daily/tlp_team uniques landed in 014_migration_hardening.sql — upsertOn now set on both mappings; re-runs idempotent. PRE_RUN_SQL kept as the standalone equivalent.',
  'tlp_queue_daily.windows: legacy stored range STRINGS; the column is integer and the port writes a count — transform counts ranges; the original range text is unrepresentable (flagged for the report).',
  'HeatmapInputs rows, if any appear before WP-51, hold base64-gzip chunks in data_1..4 — runner must gunzip into a plain-JSON data_1 (port hmUnpack_ JSON.parses data_1). Tab is empty today; mapping + note in place.',
  'HeatmapAssumptionSets tab does not exist yet in CC2 Core — expected "not found or empty" log, not an error.',
  '80-data-migration.md inventory corrections: TLP_HEADERS/MD_HEADERS tabs live in CC2 Live (not Core); HeatmapInputs lives in CC2 Core (not Live); queue_status_submissions lives in Core (WP-30 agrees).',
  'Tracker record tabs NOT in the registry (skipped): refund_ledger "Refund Log (pre-*)" archive tabs + "Sheet1"/"Shipping Fees", operational_loss "Pivot Table 2|Dashboard|Sheet5|Curencies" — D-DATA scope is the configured tab_name only; validator should log them as intentionally skipped.',
  'damaged_items_5917 already native — its postBackfill is a no-op kept for uniformity.',
]
