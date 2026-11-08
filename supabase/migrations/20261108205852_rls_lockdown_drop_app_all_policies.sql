-- S08-04: RLS lockdown — drop every permissive `app_all` policy project-wide.
--
-- Intent: the browser anon key is Auth-only. After the app moves all table
-- traffic to the service-role server client (which bypasses RLS), RLS-enabled
-- tables must hold NO policies for public/anon/authenticated: absence of
-- policies on an RLS table = deny-all for those roles.
--
-- Ordering: apply only AFTER the service-role deploy is live (S08 deploy
-- ordering is the PM's gate; this file stands alone). Idempotent: re-running
-- finds nothing and drops nothing.
--
-- Verify after apply:
--   SELECT count(*) FROM pg_policies WHERE schemaname IN ('public','storage');
--     -- expect 0 rows for public app tables
--   SELECT relname FROM pg_class c JOIN pg_namespace n ON n.oid = c.relnamespace
--   WHERE n.nspname = 'public' AND c.relkind = 'r' AND NOT c.relrowsecurity;
--     -- expect 0 rows (RLS still enabled everywhere)

-- (1) Drop `app_all` and any other grant-ALL-to-public-style permissive
--     policy on public tables (plus storage if any app_all exists there).
--     Enumerated from pg_policies — no hard-coded table list.
DO $$
DECLARE
  pol record;
BEGIN
  FOR pol IN
    SELECT schemaname, tablename, policyname
    FROM pg_policies
    WHERE policyname = 'app_all'
       OR (schemaname = 'public'
           AND cmd = 'ALL'
           AND qual = 'true'
           AND (with_check IS NULL OR with_check = 'true')
           AND roles::text[] && '{public,anon,authenticated}'::text[])
    ORDER BY schemaname, tablename
  LOOP
    EXECUTE format('DROP POLICY IF EXISTS %I ON %I.%I',
                   pol.policyname, pol.schemaname, pol.tablename);
    RAISE NOTICE 'dropped policy % on %.%',
      pol.policyname, pol.schemaname, pol.tablename;
  END LOOP;
END $$;

-- (2) Re-affirm RLS enabled on every public base table (no-op where already
--     enabled). No replacement policies are created — deny-all stands.
DO $$
DECLARE
  t text;
BEGIN
  FOR t IN
    SELECT c.relname
    FROM pg_class c
    JOIN pg_namespace n ON n.oid = c.relnamespace
    WHERE n.nspname = 'public' AND c.relkind = 'r'
  LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
  END LOOP;
END $$;
