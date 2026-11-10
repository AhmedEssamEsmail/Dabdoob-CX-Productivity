# S02: dedupe + unique-key hardening of the 23 insert-only tables
Kind: package
ID: S02
Dispatch: NEVER

## Goal and contract
PLAN #5: every previously insert-only mapped table gets a chosen dedupe key,
existing duplicates removed, a UNIQUE index, and its mapping flipped to
`upsertOn` — so no re-run can ever append duplicates. Three `supabase-expert`
leaves generate one migration file each (dedupe DELETEs + UNIQUE indexes);
four `dev` leaves flip `upsertOn` in the mapping modules, serial per file.
Key rule: prefer a natural unique from the sheet's row identity; only when no
such key exists use a generated `dedupe_key TEXT` column backfilled as
`'mig-' || (row_number() over (order by id) - 1)` (matches the positional
`'mig-'+ctx.index` transform — same mechanism refresh_log already uses).
Each DB leaf records chosen keys (+ any needed transform) in `results/<id>.md`;
flip leaves read them. Non-goal: applying migrations remotely (approval gate).

## Children
Index: `S02/00-index.md`
- PLAN #5 agg/queue snapshots -> S02-01, flips -> S02-04/05
- PLAN #5 logs/ops append-only -> S02-02, flips -> S02-05/07
- PLAN #5 people/sched -> S02-03, flips -> S02-05/06/07
- route-core qa_volume -> S02-08

## Completion
All 23 tables have unique indexes drafted + upsertOn flipped; keys recorded in
results files; `npx tsc --noEmit` clean. Live dedupe/apply is approval-gated.
This file is context for planners only, not a developer assignment.
