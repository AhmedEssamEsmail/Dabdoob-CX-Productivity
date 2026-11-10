-- S06-04: DDL for the decision docs' NEW tables (3 total — under the
-- combined cap of 5 across decisions-v1-ops.md + decisions-ops-tabs.md).
-- Idempotent: CREATE ... IF NOT EXISTS throughout; re-apply is a no-op.
--
-- aux_spans + call_transcripts use the 004_mirror_tables.sql shape verbatim
-- (id identity PK, dedupe_key UNIQUE, ts_ms, cols jsonb, synced_at); both docs
-- name dedupe_key as the upsert key.
-- v1_task_occurrences follows its doc's verbatim column list; occurrence_id is
-- the declared PRIMARY KEY (qe_fd_cache precedent: natural key as PK = the
-- upsertOn target).
--
-- RLS posture copied from the newest-table convention (20261109131140
-- dq_hct_table.sql / S03-01): service-role-only. S08-04 (20261108205852)
-- dropped every app_all policy project-wide, so RLS enabled with NO policies
-- = deny-all for anon/authenticated. Do not add public-role policies.

-- ---------- aux_spans (decisions-ops-tabs.md: FD_AUX tab) ----------
-- cols = verbatim A..G [Agent name, Status name, Start time, End time, Email,
-- Minutes, Date]; dedupe_key = sha1 of verbatim row cells (fd_activities
-- precedent). Natural key (Email, Start time, Status name) is informational.
CREATE TABLE IF NOT EXISTS public.aux_spans (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_aux_spans_ts ON public.aux_spans(ts_ms);

-- ---------- call_transcripts (decisions-ops-tabs.md: Transcript tab) ----------
-- cols = verbatim A..H [Incoming Instance, Call ID, IVR inputs, Caller,
-- Start time, Call Transcription, Helper, Correct Date Time];
-- dedupe_key = sha1(Call ID + Start time) — Call ID alone can repeat.
CREATE TABLE IF NOT EXISTS public.call_transcripts (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);
CREATE INDEX IF NOT EXISTS idx_call_transcripts_ts ON public.call_transcripts(ts_ms);

-- ---------- v1_task_occurrences (decisions-v1-ops.md: TaskOccurrences tab) ----------
-- Occurrence-grain recurring-task rows; task_id joins actions.source_id of the
-- S04-02 Tasks->actions rows. upsertOn occurrence_id (= the PK). Columns are
-- the doc's verbatim list plus submitted_* housekeeping and synced_at.
CREATE TABLE IF NOT EXISTS public.v1_task_occurrences (
  occurrence_id text PRIMARY KEY,
  task_id text,
  due_date text,
  status text,
  done_at text,
  note text,
  updated_by text,
  updated_at timestamptz,
  submitted_by text,
  submitted_at timestamptz,
  synced_at timestamptz
);
-- Documented join column (-> actions.source_id).
CREATE INDEX IF NOT EXISTS idx_v1_task_occurrences_task
  ON public.v1_task_occurrences(task_id);

-- ---------- RLS: service-role-only posture (dq_hct / S08-04 convention) ----------
ALTER TABLE public.aux_spans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.call_transcripts ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.v1_task_occurrences ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default for anon/authenticated;
-- the service-role server client bypasses RLS for sync writes.

-- ---------- S08-02: seed tracker registry rows (finding qa-2) ----------
-- tracker_records.tracker_id FKs trackers(tracker_id) (009_operations.sql:54).
-- ops-tabs.ts transforms write tracker_id 'aux_exceptions' (oct_workbook
-- "AUXes Exceptions") and 'wa_parcels' (daily_report "WA"); without these rows
-- the live upsert fails 23503. storage_mode 'external' per 009 convention for
-- sheet-backed trackers; ON CONFLICT guards keep the block re-runnable.
INSERT INTO trackers (tracker_id, name, storage_mode, spreadsheet_id, tab_name, header_row, access_mode, form_backed,
  record_id_header, record_id_format, submitted_by_header, submitted_at_header, viewer_roles, editor_roles, builder_roles)
VALUES
  ('aux_exceptions', 'AUXes Exceptions', 'external', '1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI', 'AUXes Exceptions', 1, 'edit', false,
    'record_id', '', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('wa_parcels', 'WA parcels', 'external', '1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4', 'WA', 1, 'edit', false,
    'record_id', '', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin')
ON CONFLICT (tracker_id) DO NOTHING;

-- field_id = the jsonb keys written by the transforms; position = values order;
-- label/column_header = the sheet header text (probe-ops-tabs.log).
INSERT INTO tracker_fields (tracker_id, field_id, position, label, column_header)
VALUES
  ('aux_exceptions', 'agent_mail', 1, 'Agent Mail', 'Agent Mail'),
  ('aux_exceptions', 'date', 2, 'Date', 'Date'),
  ('aux_exceptions', 'aux', 3, 'AUX', 'AUX'),
  ('aux_exceptions', 'duration', 4, 'Duration', 'Duration'),
  ('wa_parcels', 'country', 1, 'Country', 'Country'),
  ('wa_parcels', 'creation_date', 2, 'Creation Date', 'Creation Date'),
  ('wa_parcels', 'warehouse', 3, 'Warehouse', 'Warehouse'),
  ('wa_parcels', 'order_id', 4, 'Order ID', 'Order ID'),
  ('wa_parcels', 'status_3pl', 5, '3PL_status', '3PL_status'),
  ('wa_parcels', 'whatsapp_status', 6, 'whatsapp_status', 'whatsapp_status'),
  ('wa_parcels', 'invoice_id', 7, 'Invoice_Id', 'Invoice_Id'),
  ('wa_parcels', 'link', 8, 'Link', 'Link'),
  ('wa_parcels', 'code', 9, 'Code', 'Code'),
  ('wa_parcels', 'trailed', 10, 'Trailed?', 'Trailed?'),
  ('wa_parcels', 'confirmed', 11, 'Confirmed?', 'Confirmed?'),
  ('wa_parcels', 'date_only', 12, 'Date_Only', 'Date_Only')
ON CONFLICT DO NOTHING;
