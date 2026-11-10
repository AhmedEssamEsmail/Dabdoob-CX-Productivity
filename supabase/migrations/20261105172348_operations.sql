-- Operations shard: trackers (Operations_deprecated/Trackers.js).
-- Registry tabs "Trackers" / "TrackerFields" -> snake_case tables; native
-- tracker records land in tracker_records (one row per record, values jsonb
-- keyed by field id — the Postgres answer to "one tab per native tracker").
-- External sheet-backed trackers keep their registry rows; their rows are read
-- through the sheets adapter seam (D-GOOGLE) and migrated rows may be backfilled
-- into tracker_records by the shard-80 migration (storage stays 'external').
CREATE TABLE IF NOT EXISTS trackers (
  tracker_id text PRIMARY KEY,
  name text NOT NULL,
  storage_mode text NOT NULL DEFAULT 'external',
  spreadsheet_id text NOT NULL DEFAULT '',
  tab_name text NOT NULL DEFAULT '',
  header_row integer NOT NULL DEFAULT 1,
  access_mode text NOT NULL DEFAULT 'edit',
  form_backed boolean NOT NULL DEFAULT false,
  record_id_header text NOT NULL DEFAULT 'record_id',
  record_id_format text NOT NULL DEFAULT '',
  submitted_by_header text NOT NULL DEFAULT 'submitted_by',
  submitted_at_header text NOT NULL DEFAULT 'submitted_at',
  viewer_roles text NOT NULL DEFAULT 'admin,tl',
  editor_roles text NOT NULL DEFAULT 'admin,tl',
  builder_roles text NOT NULL DEFAULT 'admin',
  owner_email text NOT NULL DEFAULT '',
  archived_at text NOT NULL DEFAULT '',
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  updated_by text,
  updated_at timestamptz
);

-- Field ids repeat across trackers: the key is (tracker_id, field_id).
CREATE TABLE IF NOT EXISTS tracker_fields (
  field_id text NOT NULL,
  tracker_id text NOT NULL REFERENCES trackers(tracker_id) ON DELETE CASCADE,
  position integer NOT NULL DEFAULT 0,
  label text NOT NULL,
  column_header text NOT NULL DEFAULT '',
  type text NOT NULL DEFAULT 'text',
  required boolean NOT NULL DEFAULT false,
  list_key text NOT NULL DEFAULT '',
  parent_field_id text NOT NULL DEFAULT '',
  auto text NOT NULL DEFAULT '',
  active boolean NOT NULL DEFAULT true,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  PRIMARY KEY (tracker_id, field_id)
);
CREATE INDEX IF NOT EXISTS tracker_fields_tracker_idx ON tracker_fields (tracker_id);

-- One row per record of a Supabase-backed (native) tracker. `row_n` preserves
-- sheet row ordering; `values` holds { fieldId: value } exactly as validated.
CREATE TABLE IF NOT EXISTS tracker_records (
  tracker_id text NOT NULL REFERENCES trackers(tracker_id) ON DELETE CASCADE,
  record_id text NOT NULL,
  row_n integer NOT NULL,
  submitted_by text NOT NULL DEFAULT '',
  submitted_at timestamptz,
  values jsonb NOT NULL DEFAULT '{}'::jsonb,
  PRIMARY KEY (tracker_id, record_id)
);
CREATE INDEX IF NOT EXISTS tracker_records_tracker_idx ON tracker_records (tracker_id, row_n);

-- Seed the four built-in trackers + the read-only refund ledger
-- (BUILTIN_TRACKERS verbatim; spreadsheet ids are reference-only).
INSERT INTO trackers (tracker_id, name, storage_mode, spreadsheet_id, tab_name, header_row, access_mode, form_backed,
  record_id_header, record_id_format, submitted_by_header, submitted_at_header, viewer_roles, editor_roles, builder_roles)
VALUES
  ('blocked_customers', 'Blocked customers', 'external', '1KFC6ENFbQWPmRSziH9gLsBQED1hnh_e9ZknsjwruPEA', 'Sheet1', 1, 'edit', false,
    'record_id', '', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('promocodes', 'Promocodes', 'external', '1GsBilEGkmXqBSgmiv4jM5UHWPeW0_DpdmBVA3L1zgTw', 'Form Responses 1', 1, 'edit', true,
    'record_id', '', 'Email Address', 'Timestamp', 'admin,tl,agent', 'admin,tl,agent', 'admin'),
  ('operational_loss', 'Operational loss', 'external', '12jVdX8CziY9sS_AVd1kZJEnRp82I3YFLXSCUuu_e5Uc', 'Sheet1', 1, 'edit', false,
    'Record ID', 'OL{n}', 'submitted_by', 'submitted_at', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('customer_strikes', 'Customer strikes', 'external', '1Odij24BsYeukoqdGXOmqnVq36SL7s-8pFR9Jpz3OMmQ', 'Form Responses 1', 1, 'edit', true,
    'record_id', '', 'Email Address', 'Timestamp', 'admin,tl', 'admin,tl,agent', 'admin'),
  ('refund_ledger', 'Refund calculator backend', 'external', '1ZaJnCVOmZF42KAYpd3YwDrsr1gY7fIEwTxUeAESgGU8', 'Refund Log', 1, 'view_only', false,
    'record_id', '', 'Agent', 'Logged at', 'admin,tl', '', 'admin')
ON CONFLICT (tracker_id) DO NOTHING;
