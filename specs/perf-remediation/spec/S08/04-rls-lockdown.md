# S08-04: Drop app_all policies — RLS-enabled tables deny anon/auth access
Kind: mini
ID: S08-04
Parent: S08
Owner: supabase-expert
Depends: S08-02, S08-03, S03-01, S10-01
Criteria: PLAN #8 (deny public/anon/authenticated on every public app table)
Skills: none
Budget: files=1; actions=2; changed_lines=80; minutes=6

## Goal
One migration file that drops the permissive `app_all` policies
(`USING (true) WITH CHECK (true) FOR roles={public}`) from every public
app table, leaving RLS enabled with NO policies — deny-all for anon and
authenticated roles while the service-role server client bypasses RLS.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`; record the actual filename in results

## Context
- PLAN research: "RLS enabled on all tables but every policy app_all = using(true)/with_check(true) for roles={public} — anon key has full table access"; "service_role key bypasses RLS entirely; deny-all policies then only affect anon/authenticated clients (browser has none for tables)"
- `supabase/migrations/014_migration_hardening.sql:207-222` | the loop convention that CREATED app_all on the recreated tables — the inverse pattern to write (DO $$ over pg_policies)
- `supabase/migrations/004_mirror_tables.sql:61-62` | example original app_all definitions

## Contract
- For EVERY table in `public` having a policy named `app_all` (or any policy granting ALL to public/anon/authenticated — enumerate via pg_policies, do not hard-code the table list): `DROP POLICY IF EXISTS app_all ON public.<t>`.
- `ALTER TABLE ... ENABLE ROW LEVEL SECURITY` stays as-is (re-affirm with a no-op enable is acceptable); create NO replacement policies — absence of policies on an RLS table = deny.
- Intent comment at top: browser anon key is Auth-only; all table traffic is service-role (post-S08 deploy ordering is a PM concern — file content stands alone).
- Idempotent re-apply; remote apply requires user approval, NOT this leaf.
Out of scope: new per-user policies (PLAN non-goal), grants/roles changes, storage policies (unless found holding app_all — include them if the enum finds any).

## Actions
1. DO $$ loop dropping `app_all` (and any discovered `*_all`-style permissive policy) on all public tables — enumerate from pg_policies/policy catalog, no hard-coded list.
2. Header comment block: intent, ordering note (apply after service-role deploy), verification query.

## Done when
- Migration exists, drops app_all project-wide idempotently, creates no new policies.
- `supabase migration lint` (or skill-equivalent check) passes.

## Verify
- Run: `supabase migration list` -> the new file is registered.

## Handoff
This is the last migration in the chain; `npm run test:security` post-deploy
is the PM gate. Write results/S08-04.md (<=10 lines) with the filename;
TL alone updates TRACKER.md.
