# S05: `before_user_created` auth hook — reject non-@dabdoob.com signups
Kind: mini
ID: S05
Parent: google-signin
Owner: supabase-expert
Depends: none
Criteria: PLAN #3 defense-in-depth (optional identity-layer gate; app-side S03 remains primary)
Skills: none
Budget: files=1; actions=2; changed_lines=60; minutes=8

## Goal
Ship ONE generated migration defining the Postgres function a Supabase
`before_user_created` auth hook can point at, rejecting signups whose email is
outside the dabdoob.com Workspace domain. Defense-in-depth only — the app-side
callback gate (S03) is the primary enforcement.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new before_user_created_domain_gate`

## Context
- `supabase/migrations/` | existing numbered + timestamped migration conventions; never invent the generated filename — record it after `migration new`
- `src/features/shared/platform/identity.ts:77-111` | app-side rules this mirrors at the coarsest level (domain only; roster check stays app-side)
- PLAN "Manual prerequisites" | hook enablement in the dashboard is a runbook step (S07), NOT part of this migration

## Contract
Intent only — `supabase-expert` writes the SQL:
- A Postgres function (e.g. `public.reject_non_workspace_user()`) conforming to the `before_user_created` hook signature: `jsonb` event in, `jsonb` out; returns the event unchanged when `event->'user'->>'email'` ends with `@dabdoob.com` (case-insensitive), otherwise returns the hook `error` object so the identity is never created.
- `security definer`, locked-down `search_path`; `revoke` from `public`/`anon`/`authenticated`, `grant execute` to `supabase_auth_admin` only (standard hook hardening).
- No tables, policies, seeds or config changes; no edits to any existing file.
Out of scope: enabling the hook (dashboard, manual), roster checks, SMTP/links.

## Actions
1. `supabase migration new before_user_created_domain_gate`; write the function + grants inside the generated file only.
2. Record the generated filename in results/S05.md; lint the file.

## Done when
- One new migration exists containing function + grants; no other files touched.
- Migration SQL lints/parses clean.

## Verify
- Run: `supabase migration list` -> new timestamped file listed.
- Run: `supabase db lint` (or `supabase migration up --dry-run` where local stack exists) -> no errors on the new migration.

## Handoff
S07 documents enabling the hook against the function name chosen here — record
it in results/S05.md. Write results/S05.md (<=10 lines); TL alone updates TRACKER.md.
