# FIX-10: prod_daily_layers dedupe keeps stale row (wrong survivor)
Kind: mini
ID: FIX-10
Parent: -
Owner: supabase-expert
Depends: none
Criteria: data report data-2 (MED, blocking per task) — dedupe keeps LOWEST id
while memoUpsert/upsert semantics make the LATEST write authoritative
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase-postgres-best-practices\SKILL.md
Budget: files=1; actions=2; changed_lines=15; minutes=4

## Goal
In migration `20261108204952_..._dedupe_uniques_prod_daily_layers_queue_submissions.sql`,
the prod_daily_layers dedupe deletes the row the app would keep. Upsert
semantics (memoUpsert last-write-wins; delete+insert fallback) make the
LATEST write authoritative — a recomputed layer row has the higher id, so the
current `a.id > b.id` deletes the freshest row. Flip the survivor rule to
keep-latest, matching the queue_submissions block in the same file.

## Files
- Edit: `supabase/migrations/20261108204952_dedupe_uniques_prod_daily_layers_queue_submissions.sql` | section 1 DELETE (lines ~7-18)

## Context
- `reports/data-1.md` finding data-2 | exact fix: `a.id < b.id`
- Same file lines 25-30 | queue_submissions already keeps latest — copy that intent
- Migration is UNAPPLIED remotely (TRACKER NEEDS_APPROVAL) — edit in place, no new file

## Contract
- Only the prod_daily_layers DELETE (section 1) and its header comment change:
  delete `a` where `a.id < b.id` (the higher id / freshest row survives).
- queue_submissions DELETE, both CREATE UNIQUE INDEX statements, the
  IS NOT DISTINCT FROM null-collapse logic: untouched.
Out of scope: any other migration, any TS file, remote apply (NEEDS_APPROVAL stays).

## Actions
1. Flip `a.id > b.id` to `a.id < b.id` in the section-1 DELETE.
2. Update the comment "Survivor rule: keep the LOWEST id per key group
   (earliest-written row wins)" to describe keep-latest (freshest/highest id).

## Done when
- Section-1 DELETE keeps the highest-id (latest) row per (date,email,layer) group.
- Comment matches the new rule; file still applies cleanly (syntax check).

## Verify
- Run: `grep -n "a.id < b.id" supabase/migrations/20261108204952_*.sql` -> 1 hit.

## Handoff
none. Write results/FIX-10.md (<=10 lines); TL alone updates TRACKER.md.
