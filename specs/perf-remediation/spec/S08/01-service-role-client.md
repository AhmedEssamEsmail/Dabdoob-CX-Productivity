# S08-01: db()/createClient() run on SUPABASE_SERVICE_ROLE_KEY, lazily
Kind: mini
ID: S08-01
Parent: S08
Owner: dev
Depends: S04-01
Criteria: PLAN #8 (server clients use the service role key)
Skills: none
Budget: files=2; actions=4; changed_lines=60; minutes=6

## Goal
`shared/lib/supabase.ts` builds its PostgREST client on
`SUPABASE_SERVICE_ROLE_KEY` via a lazy singleton (fixes the current
module-top-level env client, banned by PLAN conventions), and `repo.ts`'s
`db()` returns it. The anon key leaves this file entirely.

## Files
- Edit: `src/features/shared/lib/supabase.ts` | lines 1-11: lazy `createClient()`/`getDb()` on the service key
- Edit: `src/features/shared/platform/repo.ts` | `db()` (24-26) returns the lazy service client (serial after S04-01)

## Context
- `src/features/shared/lib/supabase.ts:1-11` | current eager anon client + `createClient()`; the `Database` type below line 13 is untouched
- `src/features/shared/platform/repo.ts:19-26` | `import { supabase }` + `db()` — the only consumer of the exported const
- `src/features/shared/lib/auth.ts:50-66` | `getViewAsUser` calls `createClient()` — gains service access automatically (intended)
- PLAN conventions: "Never create env-dependent clients at module top level"; "SUPABASE_SERVICE_ROLE_KEY already exists in env"; service role bypasses RLS (desired — authz lives in code)

## Contract
- `createClient()` keeps its signature, returns a memoized `createSupabaseClient(url, SUPABASE_SERVICE_ROLE_KEY)` built on FIRST call (module-scope `let` singleton — no top-level `createSupabaseClient(...)` evaluation).
- The exported `supabase` const is removed; `repo.ts` `db()` calls `createClient()`. If another file imports `supabase` directly (grep `import.*supabase.*from.*lib/supabase`), switch it to `createClient()` — count it in the file budget only if it's one extra file; more => RESHARD_NEEDED.
- `import 'server-only'` stays. `SUPABASE_ANON_KEY` no longer referenced in this file.
- `createAuthClient` (lib/auth.ts) is NOT touched — it keeps the anon key for cookie-JWT work.
Out of scope: call-site .from() swaps (S08-02/03), migrations.

## Actions
1. supabase.ts: replace eager client + anon key with lazy service-key `createClient()`.
2. Remove the `export const supabase` (or keep a lazy-compatible export ONLY if the grep shows >1 consumer — prefer converting consumers).
3. repo.ts: `db()` returns `createClient()`.
4. Grep-verify no other importer of the removed const; fix per contract.

## Done when
- `SUPABASE_SERVICE_ROLE_KEY` is the only key in supabase.ts; zero top-level client instantiation.
- `db()` returns the service client; `npx tsc --noEmit` clean; `npx vitest run tests/platform` green.

## Verify
- Run: `npx vitest run tests/platform` -> all pass.

## Handoff
`db()`/`createClient()` = service client for S08-02/03 call-site swaps and
S10-02's cache table. Write results/S08-01.md (<=10 lines); TL alone updates TRACKER.md.
