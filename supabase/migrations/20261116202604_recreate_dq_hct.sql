-- S07-01 (qa-live-sheets-freeze): recreate public.dq_hct, restoring the table
-- dropped by 20261116171029_drop_dead_v1_tables.sql.
-- Shape = the full 15-column DQ_HCT adapter shape (roster.ts DQ_HCT_COLUMNS,
-- verbatim + case-sensitive: original 12 cols from 20261109131140 plus
-- code/gender/"contactNumber" from 20261112142701) + synced_at stamped by
-- dqSyncRoster_. Column names must equal the adapter keys because the sync
-- upserts keyed records; camelCase keys keep quoted identifiers.
-- UNIQUE(email) gives the batched upsert its onConflict:'email' target
-- (last-wins per email). IF NOT EXISTS everywhere for idempotent local re-run.

CREATE TABLE IF NOT EXISTS public.dq_hct (
  id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  name text,
  email text,
  position text,
  department text,
  section text,
  manager text,
  status text,
  lwd text,
  "hiringDate" text,
  "fdId" text,
  "fdName" text,
  "maqsamName" text,
  code text,
  gender text,
  "contactNumber" text,
  synced_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS dq_hct_email_key ON public.dq_hct(email);

-- Access model: SERVICE ROLE ONLY. RLS enabled with NO policies = deny-all for
-- anon/authenticated (post-lockdown app_cache precedent; see 20261109131140).
-- The service-role server client bypasses RLS for the manual roster sync.
-- Do not add public-role policies.
ALTER TABLE public.dq_hct ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default for anon/authenticated.
