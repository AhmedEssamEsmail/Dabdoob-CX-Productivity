-- S03-01: dq_hct — HCT mirror table that readStore('dq_hct') feeds
-- dqRosterFromHct_ from (src/features/cx-hub/lib/roster.ts). Column names must
-- equal the adapter keys verbatim because readStore does select('*'); the four
-- camelCase keys use quoted identifiers so PostgREST returns them as written.
-- UNIQUE(email) makes re-import idempotent; the mapping's `require` filters
-- blank emails, so a plain unique index is safe (see spec S03-01 contract).

CREATE TABLE IF NOT EXISTS dq_hct (
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
  synced_at timestamptz
);

CREATE UNIQUE INDEX IF NOT EXISTS dq_hct_email_key ON dq_hct(email);

-- Access model: SERVICE ROLE ONLY. S08-04 (20261108205852) dropped every
-- app_all policy project-wide once table traffic moved to the service-role
-- server client; the earlier "011 convention" app_all posture is superseded.
-- RLS enabled with NO policies = deny-all for anon/authenticated, matching
-- the post-lockdown precedent (app_cache). Do not add public-role policies.
ALTER TABLE public.dq_hct ENABLE ROW LEVEL SECURITY;
-- Intentionally no policies: deny-by-default for anon/authenticated.
