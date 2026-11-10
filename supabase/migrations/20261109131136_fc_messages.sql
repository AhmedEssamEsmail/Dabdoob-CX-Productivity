-- S04-01: public.fc_messages — raw-mirror sink for the 'Freshchat Detailed
-- Msgs' sheet (1ZxDxS…). No ported import reads it yet; it is the Postgres
-- sink the 012_pg_cron_schedule.sql:237 note asks for
-- ("fc_messages — NOT ported (B3 creds + WP-53/WP-F16)").
-- Backfilled by S04-07 as {dedupe_key, ts_ms, cols, synced_at}; ts_ms stays
-- NULL on rows whose timestamp column can't be parsed.
--
-- Column/index shape is verbatim the 004 mirror shape (fd_activities,
-- maqsam_calls, freshchat): id identity PK, dedupe_key UNIQUE, ts_ms,
-- cols jsonb, synced_at, ts index.
--
-- Access model: SERVICE ROLE ONLY. 004 granted an `app_all` permissive
-- policy, but S08-04 (20261108205852) dropped every app_all policy
-- project-wide once table traffic moved to the service-role server client.
-- RLS enabled with NO policies = deny-all for anon/authenticated, matching
-- the post-lockdown precedent (app_cache). Do not add public-role policies.

CREATE TABLE IF NOT EXISTS public.fc_messages (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  dedupe_key text UNIQUE,
  ts_ms bigint,
  cols jsonb,
  synced_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_fc_messages_ts ON public.fc_messages(ts_ms);

ALTER TABLE public.fc_messages ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default for anon/authenticated.
