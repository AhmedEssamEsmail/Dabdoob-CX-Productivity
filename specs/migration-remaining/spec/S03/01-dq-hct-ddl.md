# S03-01: dq_hct table DDL
Kind: mini
ID: S03-01
Parent: S03
Owner: supabase-expert
Depends: none
Criteria: PLAN #2 (dq_hct exists + populated)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=4; changed_lines=90; minutes=8

## Goal
One generated migration creating `public.dq_hct` — the HCT mirror
`readStore('dq_hct')` feeds `dqRosterFromHct_` from — plus RLS/app_all per the
011 convention and a UNIQUE on `email` for idempotent re-import.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `src/features/cx-hub/lib/roster.ts:46-48,148-156,170-181,196-218` | exact
  record keys `dqRosterFromHct_` reads off each row
- `src/features/shared/platform/stores.ts:27-35` | `readStore` = `select('*')`
  → column names must equal the adapter keys verbatim (case-sensitive)
- `supabase/migrations/005_hub.sql:13-14` | dq_hct deliberately deferred note
- `supabase/migrations/004_mirror_tables.sql:56-62` | RLS app_all convention

## Contract
Columns (TEXT unless noted): name, email, position, department, section,
manager, status, lwd, "hiringDate", "fdId", "fdName", "maqsamName" — the
camelCase four need quoted identifiers so PostgREST returns them as written.
Plus: identity `id` PK, `UNIQUE (email)`, `synced_at timestamptz`, RLS enabled
+ `app_all` policy. `email` may hold '' in source rows — the mapping's
`require` filters blanks, so a plain unique index is safe; if the run hits a
'' collision the fix is a partial unique `WHERE email <> ''` — prefer the
plain index, switch only if evidence demands it (record choice in results).
Out of scope: any other table; applying remotely; backfill (mapping+run are
separate leaves/gates).

## Actions
1. `supabase migration new <name>`; record the filename in results.
2. CREATE TABLE dq_hct with the exact 12 data columns + id + synced_at.
3. UNIQUE index on email; RLS enable + app_all policy.
4. Write `results/S03-01.md` (<=10 lines): filename + column list + key choice.

## Done when
- Migration creates dq_hct whose columns match the adapter keys verbatim.
- UNIQUE(email) + RLS app_all present; SQL idempotent.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s03-01-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
S03-02 writes the mapping against these exact column names; roster.ts then
reads them unmodified. Write `results/S03-01.md`; TL updates TRACKER.md.
