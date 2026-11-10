# S06-04: DDL for decision docs' NEW tables (bounded, may be no-op)
Kind: mini
ID: S06-04
Parent: S06
Owner: supabase-expert
Depends: S06-01, S06-02
Criteria: PLAN #1 (mirror/staging tables where no ported target exists —
PLAN Scope permits these)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=5; changed_lines=400; minutes=10

## Goal
One generated migration creating exactly the tables listed under `NEW:` in
`specs/migration-remaining/decisions-v1-ops.md` +
`decisions-ops-tabs.md` — nothing more. If the docs list zero `NEW:` tables,
this leaf is a recorded no-op.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `specs/migration-remaining/decisions-v1-ops.md` | `NEW:` list (max 3) —
  required, do not guess columns
- `specs/migration-remaining/decisions-ops-tabs.md` | `NEW:` list —
  combined total across both docs <=5 tables
- `supabase/migrations/20261109131140_dq_hct_table.sql` | newest-table
  convention (id PK, synced_at, UNIQUE natural key, RLS posture)
- `supabase/migrations/014_migration_hardening.sql:60-70` | dedupe_key
  convention for append-only data

## Contract
For each `NEW:` entry create the named table with exactly the columns the
decision doc lists (TEXT unless the doc marks int/num/ts), plus identity
`id` PK, `synced_at timestamptz`, and a UNIQUE index on the decision doc's
natural key (or a `dedupe_key` col + UNIQUE where the doc names one). RLS:
match the S03-01/S04-01 posture the docs' target domain uses (app_all only
if that is the current convention — copy, don't invent). Bounds: if the docs
list >5 NEW tables or the DDL would exceed ~400 handwritten lines, STOP —
record RESHARD_NEEDED instead of a mega-migration. If zero `NEW:` entries,
write `results/S06-04.md` = `no-op: no NEW tables` and do not create a file.
Out of scope: any table not in the docs; applying remotely (PM gate);
backfills/mappings.

## Actions
1. Read both decision docs; collect `NEW:` entries; enforce the bounds.
2. `supabase migration new <name>`; record the filename in results.
3. Write CREATE TABLE + UNIQUE per entry, idempotent (IF NOT EXISTS).
4. RLS/policy per the copied convention.
5. `npx tsc --noEmit` sanity; write `results/S06-04.md` (<=10 lines:
   filename + tables + key choices, or the no-op line).

## Done when
- Migration covers exactly the `NEW:` list (or results = no-op).
- Every new table has the doc's natural key UNIQUE + synced_at; SQL idempotent.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s06-04-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
PM gate applies the file; S06-05..08 mappings may name these tables. Write
`results/S06-04.md`; TL updates TRACKER.md.
