/**
 * WP-31 — people + core table mappings for the Sheets→Supabase migration.
 *
 * Orchestrator merges these entries into `MAPPINGS` in
 * `src/app/api/admin/migrate/route.ts` (sibling WPs edit sibling files; the
 * route is orchestrator-owned). The `TableMapping` interface is redeclared
 * verbatim below except `spreadsheet` is widened to `string`: two stores these
 * tables live in are not keys of route.ts `SPREADSHEETS` yet.
 *
 * ── SPREADSHEETS keys to add on merge ─────────────────────────────────────
 *   live:      '1u_EU-LxMYzDmulIWz1cgseDaOkd8C4wXc17BFXVfNF4'  // CC2 Live       (Config `ss_live_id`)
 *   data_2026: '1BVJFMtQMSF2-zS89A-4oxoSuw0LunqAp_YQVwl0fR-I'  // CC2 Data 2026  (Config `ss_data_2026_id`)
 * Both are currently NOT shared with the migration SA (audits/sheet-access.md
 * rows "CC2 Live" / "CC2 Data 2026" 403) — WP-51 needs the share first.
 * Multi-year stores: `ss_data_{year}_id` — only 2026 exists today; if a later
 * `ss_data_{year}_id` Config key appears, duplicate the `data_2026` entries
 * (sc_daily, sc_behaviour) under a `data_{year}` key.
 *
 * ── Tab → store resolution (verified in legacy source) ────────────────────
 * CC2 Core (`GOOGLE_SHEET_ID` → `SPREADSHEETS.core`): every `ensureTable_`/
 * `dataSpreadsheet_()` tab — all 15 PW_TABLES (Actions.js:30-63), `my_notes`
 * (Notes.js:12 NOTE_COLUMNS), `Options` (Options.js:11), `Popups`
 * (Popups.js:14), `MailLog` (Mailer.js:13), `Health` (Health.js:23),
 * `holidays` (WorkCalendar.js:196), `FollowUpDone`
 * (Command_Center_V2_deprecated/Assistant.js:394).
 * CC2 Live (`dqSheet_` → `ss_live_id`, Stores.js:107,116): `sc_months`,
 * `kpi_behaviour_log`, `kpi_leave_log`, `kpi_ol_cases` (KpiPayout.js:27-31).
 * CC2 Data {year} (`dqSheet_` → `ss_data_{year}_id`, Stores.js:105-106):
 * `sc_daily`, `sc_behaviour` (Scorecard.js:50-52).
 *
 * ── Runner hazards the merge must handle ──────────────────────────────────
 * 1. Empty-cell → null vs NOT NULL DEFAULT '': legacy `appendRows_` writes ''
 *    for unset fields (Repo.js:263) and `readSheet`/`mapRow` turn '' into null.
 *    Most 008 columns are `TEXT NOT NULL DEFAULT ''` (or BOOLEAN/NUMERIC NOT
 *    NULL DEFAULT x) — an explicit NULL insert fails. mapRow needs a way to
 *    emit '' (or the column default) instead of null for these tables; e.g. a
 *    per-mapping flag or a not-null-text column set keyed by table, like the
 *    existing `view_as` special-case. Affected columns are all NOT NULL
 *    DEFAULT columns below — worst offenders: actions.{title,description,
 *    owner_email,assigned_by,source_type,source_id,series_id,topic,status,
 *    outcome_note,closed_by,visibility,track_as_task,carry_count},
 *    one_on_one_logs.{summary,no_action_reason,deleted_by,delete_reason,
 *    delete_cascade_json,kind}, one_on_one_topics.*, meetings.notes/decisions,
 *    sc_daily numeric cols, sc_months.{matrix_rows,agents,skipped_rows,
 *    fcr_rows,fcr_dated,behaviour_found,behaviour_cases}, health.{link,active,
 *    expect_every_min,grace_min}, options.active, popups.*, mail_log text cols,
 *    kpi_ol_cases.cases.
 * 2. Insert-only tables (BIGSERIAL/identity PK, no unique conflict target):
 *    re-running the migration appends duplicates. Run once or clean first —
 *    marked "insert-only" per entry below.
 * 3. Sheet cells holding display dates ("10/5/2026") parse into DATE columns
 *    as MDY; V2-store tabs force '@' text so they carry ISO strings (safe).
 *    Core-tab DATE cols (actions.due_date, action_reviews.*_due_date,
 *    action_planned_milestones.target_date, holidays.date,
 *    people_signals.signal_date) are the ambiguous ones if the sheet shows
 *    locale dates — verify on the WP-35 dry run.
 *
 * Scope notes:
 * - `notes` (WP text) = `my_notes` tab/table; `hard-cases` is an unbuilt
 *   parity placeholder page (00-gap-review.md §1) with no sheet backing —
 *   nothing to map.
 * - Soft-deleted rows migrate (D-DATA = full history): nothing here filters
 *   deleted_at/removed_at rows.
 * - Dropped source columns (no DB column): holidays.{holiday_id, updated_by,
 *   updated_at} — the 002/011 `holidays` DDL has only country/date/name/
 *   deleted_at/submitted_*. Needs a schema decision (add columns or accept
 *   loss); flagged for the report.
 * - `one_on_one_schedule.booked_at` exists in DB (002) but has no sheet
 *   header — left NULL. `options.label` same (default '').
 * - sc_* sheets carry no submitted_* / updated_* headers (dqSheet_ stores
 *   don't stamp) — those DB columns are omitted from `columns` so defaults
 *   apply.
 * - `kpi_behaviour_log`/`kpi_leave_log`/`kpi_ol_cases` also appear in WP-32's
 *   desk scope (gap-review §7 desk row) — dedupe on merge; keep one copy.
 * - `one_on_one_topic_prompts` is sheet-readable via pwRows_ but has no
 *   ensureTable_ writer and is not in WP-31 scope — not mapped here.
 */

import 'server-only'

interface TableMapping {
  spreadsheet: string                // keyof typeof SPREADSHEETS in route.ts (after merge adds 'live' + 'data_2026')
  sheet: string
  table: string
  columns: string[]                  // DB columns to write
  sheetToDb?: Record<string, string> // DB col -> sheet header (when names differ)
  upsertOn?: string                  // conflict column(s) for upsert (else plain insert)
  require?: string[]                 // DB cols that must be non-null (row skipped if null)
}

export const MAPPINGS: TableMapping[] = [
  // ── Shared actions engine (Actions.js PW_TABLES; Tasks.js milestones) ────
  {
    spreadsheet: 'core', sheet: 'actions', table: 'actions',
    columns: ['action_id', 'title', 'description', 'owner_email', 'assigned_by', 'due_date',
      'source_type', 'source_id', 'series_id', 'topic', 'status', 'outcome_note', 'closed_at',
      'closed_by', 'visibility', 'track_as_task', 'carry_count', 'source_deleted_at',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'action_id',
    require: ['action_id'],
  },
  {
    spreadsheet: 'core', sheet: 'action_reviews', table: 'action_reviews',
    columns: ['review_id', 'action_id', 'reviewed_in_type', 'reviewed_in_id', 'outcome', 'note',
      'new_due_date', 'prev_status', 'prev_due_date', 'prev_outcome_note', 'reverted_at',
      'submitted_by', 'submitted_at'],
    upsertOn: 'review_id',
    require: ['review_id'],
  },
  {
    spreadsheet: 'core', sheet: 'action_updates', table: 'action_updates',
    columns: ['update_id', 'action_id', 'kind', 'note', 'percent_complete', 'rag', 'next_step',
      'drive_file_id', 'file_name', 'mime_type', 'planned_milestone_id',
      'submitted_by', 'submitted_at'],
    upsertOn: 'update_id',
    require: ['update_id'],
  },
  {
    spreadsheet: 'core', sheet: 'action_task_details', table: 'action_task_details',
    columns: ['action_id', 'priority', 'start_at', 'deadline_at', 'est_hours', 'available_hours',
      'fit_status', 'progress_state', 'blocked_reason', 'rag_self', 'delivered_at', 'delivery_ref',
      'actual_hours', 'source_label', 'assigned_anyway', 'submitted_by', 'submitted_at',
      'updated_by', 'updated_at', 'expectation', 'outcome_rating', 'outcome_note',
      'rated_by', 'rated_at'],
    upsertOn: 'action_id',
    require: ['action_id'],
  },
  {
    spreadsheet: 'core', sheet: 'action_planned_milestones', table: 'action_planned_milestones',
    columns: ['milestone_id', 'action_id', 'label', 'target_date', 'done_by_update_id',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'milestone_id',
    require: ['milestone_id'],
  },

  // ── 1:1s (Actions.js PW_TABLES + OneOnOnes.js/OneOnOneDelete.js) ─────────
  {
    spreadsheet: 'core', sheet: 'one_on_one_schedule', table: 'one_on_one_schedule',
    columns: ['schedule_id', 'kind', 'manager_email', 'report_email', 'scheduled_at',
      'duration_min', 'status', 'log_id', 'rescheduled_to', 'reason', 'missed_at',
      'deleted_at', 'deleted_by', 'delete_reason', 'prev_status',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'schedule_id',
    require: ['schedule_id', 'scheduled_at'], // scheduled_at is NOT NULL in DDL (002)
  },
  {
    spreadsheet: 'core', sheet: 'one_on_one_logs', table: 'one_on_one_logs',
    columns: ['log_id', 'schedule_id', 'kind', 'manager_email', 'report_email', 'held_at',
      'summary', 'no_action_reason', 'on_time', 'deleted_at', 'deleted_by', 'delete_reason',
      'delete_cascade_json', 'submitted_by', 'submitted_at'],
    upsertOn: 'log_id',
    require: ['log_id'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates
    spreadsheet: 'core', sheet: 'one_on_one_topics', table: 'one_on_one_topics',
    columns: ['log_id', 'topic', 'position', 'raised_by', 'suggested', 'skipped_reason',
      'outcome', 'confidential', 'answers_json', 'fields_json', 'evidence_json',
      'submitted_by', 'submitted_at'],
    upsertOn: 'log_id,position',
    require: ['log_id'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates
    spreadsheet: 'core', sheet: 'one_on_one_private_notes', table: 'one_on_one_private_notes',
    columns: ['log_id', 'kind', 'author_email', 'note', 'submitted_by', 'submitted_at'],
    upsertOn: 'log_id,author_email,kind',
    require: ['log_id'],
  },

  // ── Meetings (Meetings.js; PW_TABLES meeting_*) ──────────────────────────
  {
    spreadsheet: 'core', sheet: 'meeting_series', table: 'meeting_series',
    columns: ['series_id', 'meeting_type', 'title', 'chair_email', 'cadence', 'active',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'series_id',
    require: ['series_id'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates
    spreadsheet: 'core', sheet: 'meeting_series_members', table: 'meeting_series_members',
    columns: ['series_id', 'email', 'role', 'submitted_by', 'submitted_at'],
    upsertOn: 'series_id,email',
    require: ['series_id'],
  },
  {
    spreadsheet: 'core', sheet: 'meetings', table: 'meetings',
    columns: ['meeting_id', 'series_id', 'held_at', 'next_meeting_at', 'notes', 'decisions',
      'status', 'closed_at', 'summary_sent_at',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'meeting_id',
    require: ['meeting_id'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates
    spreadsheet: 'core', sheet: 'meeting_attendees', table: 'meeting_attendees',
    columns: ['meeting_id', 'email', 'role', 'attended',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'meeting_id,email',
    require: ['meeting_id'],
  },

  // ── Reminder dedupe + coaching signals + owner notes ─────────────────────
  {
    spreadsheet: 'core', sheet: 'pw_reminder_log', table: 'pw_reminder_log',
    columns: ['dedupe_key', 'kind', 'recipient', 'ref', 'status', 'submitted_by', 'submitted_at'],
    upsertOn: 'dedupe_key',
    require: ['dedupe_key'],
  },
  {
    spreadsheet: 'core', sheet: 'people_signals', table: 'people_signals',
    columns: ['signal_id', 'email', 'topic', 'reason', 'signal_date', 'source',
      'submitted_by', 'submitted_at'],
    upsertOn: 'signal_id',
    require: ['signal_id'],
  },
  {
    // Notes.js NOTE_COLUMNS — the owner's private scratchpad; deleted_at rows included.
    spreadsheet: 'core', sheet: 'my_notes', table: 'my_notes',
    columns: ['note_id', 'text', 'tag', 'status', 'deleted_at',
      'submitted_by', 'submitted_at', 'updated_by', 'updated_at'],
    upsertOn: 'note_id',
    require: ['note_id'],
  },

  // ── Core platform tabs (Options.js / Popups.js / Mailer.js / Health.js) ──
  {
    // insert-only: unique index is (list_key, lower(value)) — an expression, not
    // a usable ON CONFLICT target — re-run duplicates
    spreadsheet: 'core', sheet: 'Options', table: 'options',
    columns: ['list_key', 'value', 'sort', 'active', 'submitted_by', 'submitted_at'],
    upsertOn: 'list_key,value',
    require: ['list_key', 'value'],
  },
  {
    spreadsheet: 'core', sheet: 'Popups', table: 'popups',
    columns: ['popup_id', 'recipient', 'kind', 'title', 'body', 'link', 'ref', 'created_at',
      'resolved_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'popup_id',
    require: ['popup_id'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates
    spreadsheet: 'core', sheet: 'MailLog', table: 'mail_log',
    columns: ['sent_at', 'to', 'cc', 'subject', 'kind', 'ref', 'status', 'error',
      'quota_left', 'submitted_by', 'submitted_at'],
    upsertOn: 'sent_at,to,subject',
    require: ['sent_at'],
  },
  {
    spreadsheet: 'core', sheet: 'Health', table: 'health',
    columns: ['job', 'system', 'link', 'label', 'expect_every_min', 'grace_min', 'active',
      'last_run_at', 'last_status', 'last_note', 'last_ok_at', 'last_error_at', 'last_error',
      'seeded_at'],
    upsertOn: 'job',
    require: ['job'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates.
    // Sheet (WorkCalendar.js DQ_HOLIDAYS_HEADERS) also has holiday_id/updated_by/
    // updated_at — no DB columns for them; see header note.
    // DECISION (dry-run B9, WP-F22): map-what-fits — the tab is header-only
    // (0 rows), so the three sheet-only cols are dropped rather than adding
    // schema. If rows appear and the owner wants holiday_id preserved, add
    // columns first, then extend this list.
    spreadsheet: 'core', sheet: 'holidays', table: 'holidays',
    columns: ['country', 'date', 'name', 'deleted_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'country,date,name',
    require: ['country', 'date'],
  },
  {
    // insert-only: BIGSERIAL id, no unique conflict target — re-run duplicates.
    // Assistant.js AS_FOLLOWUP_TABLE 'FollowUpDone' (hub app, CC2 Core).
    spreadsheet: 'core', sheet: 'FollowUpDone', table: 'follow_up_done',
    columns: ['thread_id', 'last_at_ms', 'done_at', 'submitted_by', 'submitted_at'],
    upsertOn: 'thread_id,done_at',
    require: ['thread_id'],
  },

  // ── Scorecard stores (Scorecard.js SC_*_HEADERS; V2 dqSheet_ stores) ─────
  {
    // CC2 Data {year} — duplicate per `ss_data_{year}_id` key if more years appear.
    spreadsheet: 'data_2026', sheet: 'sc_daily', table: 'sc_daily',
    columns: ['month', 'date', 'email', 'name', 'matrix_day', 'inb_target', 'inb_achieved',
      'txt_target', 'txt_achieved', 'wa_target', 'wa_achieved', 'audits', 'score_x_audits',
      'fcr_passed', 'fcr_failed', 'fcr_excluded', 'computed_at'],
    upsertOn: 'month,date,email', // UNIQUE (month, date, email) in 008
    require: ['month', 'date', 'email'],
  },
  {
    // insert-only: identity PK, no unique conflict target — re-run duplicates.
    // `date` is legitimately empty on undated behaviour cases (Scorecard.js:256+).
    spreadsheet: 'data_2026', sheet: 'sc_behaviour', table: 'sc_behaviour',
    columns: ['month', 'date', 'email', 'note'],
    upsertOn: 'month,date,email,note',
    require: ['month', 'email'],
  },
  {
    spreadsheet: 'live', sheet: 'sc_months', table: 'sc_months',
    columns: ['month', 'workbook_id', 'title', 'refreshed_at', 'refreshed_by', 'status',
      'error', 'matrix_rows', 'agents', 'first_date', 'last_date', 'skipped_rows',
      'fcr_rows', 'fcr_dated', 'fcr_note', 'behaviour_found', 'behaviour_cases',
      'behaviour_note'],
    upsertOn: 'month',
    require: ['month'],
  },

  // ── KPI manual logs + OL snapshot (KpiPayout.js KPI_LOG_HEADERS; CC2 Live)─
  {
    // insert-only: identity PK, no unique conflict target — re-run duplicates.
    // removed_* rows migrate (full history). Also claimed by WP-32 — dedupe on merge.
    spreadsheet: 'live', sheet: 'kpi_behaviour_log', table: 'kpi_behaviour_log',
    columns: ['log_id', 'email', 'date', 'note', 'logged_by', 'logged_at',
      'removed_by', 'removed_at'],
    upsertOn: 'log_id',
    require: ['log_id'],
  },
  {
    // insert-only: identity PK, no unique conflict target — re-run duplicates.
    // Also claimed by WP-32 — dedupe on merge.
    spreadsheet: 'live', sheet: 'kpi_leave_log', table: 'kpi_leave_log',
    columns: ['log_id', 'email', 'from_date', 'to_date', 'type', 'note', 'logged_by',
      'logged_at', 'removed_by', 'removed_at'],
    upsertOn: 'log_id',
    require: ['log_id'],
  },
  {
    // `key` is UNIQUE in 003. Also claimed by WP-32 — dedupe on merge.
    spreadsheet: 'live', sheet: 'kpi_ol_cases', table: 'kpi_ol_cases',
    columns: ['key', 'month', 'email', 'cases', 'updated_at'],
    upsertOn: 'key',
    require: ['key'],
  },
]
