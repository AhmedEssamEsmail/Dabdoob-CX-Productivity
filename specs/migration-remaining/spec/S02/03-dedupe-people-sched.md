# S02-03: dedupe + UNIQUE — people & scheduler tables
Kind: mini
ID: S02-03
Parent: S02
Owner: supabase-expert
Depends: none
Criteria: PLAN #5 (insert-only hardening, people/sched family)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=8; changed_lines=300; minutes=10

## Goal
One generated migration removing existing duplicates and adding UNIQUE
indexes on the 7 people/scheduler insert-only tables.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `supabase/migrations/20261108204952_*.sql` | dedupe pattern to copy
- `supabase/migrations/008_people.sql:156-185,199-207,227-238,320-330` |
  one_on_one_topics / private_notes / meeting_series_members / attendees DDL
- `supabase/migrations/003_domain_tables.sql:90-99` | kpi_*_log DDL (log_id col)
- `supabase/migrations/007_queue.sql:135-141` | sched_plan DDL
- `specs/megaplan/audits/migration-run.md:160-162` | hazard list

## Contract
Tables and candidate keys:
one_on_one_topics→(log_id,position) ·
one_on_one_private_notes→(log_id,author_email,kind) ·
meeting_series_members→(series_id,email) ·
meeting_attendees→(meeting_id,email) ·
kpi_behaviour_log→log_id · kpi_leave_log→log_id ·
sched_plan→(month,tl_email,date,shift,variant).
Same rules as S02-01: NULL-key probe per column, guarded dedupe DELETE keeping
highest id, `dedupe_key` fallback ('mig-'+row_number-1) with
`transform:dedupe_key` recorded when no natural key holds. kpi_*_log migrated
0 rows — indexes still created (empty tables are free).
Out of scope: applying remotely; other tables; RLS.

## Actions
1. `supabase migration new <name>`; record the filename in results.
2. one_on_one_topics: NULL-key probe comment + guarded dedupe DELETE on
   (log_id,position) + `CREATE UNIQUE INDEX IF NOT EXISTS`.
3. one_on_one_private_notes: same on (log_id,author_email,kind).
4. meeting_series_members: same on (series_id,email).
5. meeting_attendees: same on (meeting_id,email).
6. kpi_behaviour_log: same on log_id (table empty — index still created).
7. kpi_leave_log: same on log_id (table empty — index still created).
8. sched_plan: same on (month,tl_email,date,shift,variant) or dedupe_key
   fallback; then write `results/S02-03.md` (<=10 lines): table→final key +
   transform flags.

## Done when
- One migration file covers all 7 tables.
- `results/S02-03.md` names each table's authoritative upsertOn key.
- SQL is idempotent.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-03-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
`results/S02-03.md` feeds S02-05 (sched_plan flip), S02-06 (1o1/meeting/kpi
flips). TL updates TRACKER.md.
