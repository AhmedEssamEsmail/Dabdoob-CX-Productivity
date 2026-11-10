# S02-02: dedupe + UNIQUE — logs & ops append-only tables
Kind: mini
ID: S02-02
Parent: S02
Owner: supabase-expert
Depends: none
Criteria: PLAN #5 (insert-only hardening, logs/ops family)
Skills: none (supabase-expert reads its own DB skills)
Budget: files=1; actions=10; changed_lines=380; minutes=10

## Goal
One generated migration removing existing duplicates and adding UNIQUE
indexes on the 8 log/ops insert-only tables, so their `upsertOn` flips have a
real conflict target.

## Files
- Generated: `supabase/migrations/` | one output of `supabase migration new <name>`

## Context
- `supabase/migrations/20261108204952_*.sql` | dedupe pattern to copy
- `supabase/migrations/002_platform.sql:5-16,36-50,72-80` | options/mail_log/holidays DDL
- `supabase/migrations/005_hub.sql:16-24`, `006_quality.sql:261-271`,
  `014_migration_hardening.sql:202-205` | follow_up_done / qe_builds / qa_access_log
- `src/features/shared/migration/mappings/queue-quality.ts:494-496` | refresh_log
  transform already mints `log_id='mig-'+index` — upsertOn 'log_id' is natural
- `specs/megaplan/audits/migration-run.md:160-162` | hazard list

## Contract
Tables and candidate keys (verify each before indexing):
refresh_log→log_id (already populated by the transform) ·
qe_builds→ran_at · options→(list_key,value) — note the existing
`idx_options_list_value` is an expression index and cannot be a conflict
target, so a plain (list_key,value) unique is needed ·
holidays→(country,date,name) · mail_log→(sent_at,"to",subject) ·
qa_access_log→(email,action,submitted_at) ·
follow_up_done→(thread_id,done_at) · sc_behaviour→(month,date,email,note).
Fallback rule (same as S02-01): NULL-key rows or no clean composite →
`dedupe_key TEXT` column, backfill `'mig-' || (row_number() OVER (ORDER BY id)-1)`,
UNIQUE, and record `transform:dedupe_key` in results so S02-05 adds the
matching `'mig-'+ctx.index` transform. Keep-highest-id survivor rule.
Out of scope: applying remotely; other tables; RLS/policy changes.

## Actions
1. `supabase migration new <name>`; record the filename in results.
2. refresh_log: NULL-key probe comment + guarded dedupe DELETE on log_id +
   `CREATE UNIQUE INDEX IF NOT EXISTS refresh_log_log_id_uidx`.
3. qe_builds: same on ran_at (or dedupe_key column + backfill where no
   natural key holds).
4. options: check case-variant dupes first (the existing index is on
   lower(value)), then dedupe + plain (list_key,value) unique index.
5. holidays: probe + dedupe + `CREATE UNIQUE INDEX IF NOT EXISTS` on
   (country,date,name).
6. mail_log: same on (sent_at,"to",subject).
7. qa_access_log: same on (email,action,submitted_at).
8. follow_up_done: same on (thread_id,done_at).
9. sc_behaviour: same on (month,date,email,note).
10. Write `results/S02-02.md` (<=10 lines): table→final key + transform
    flags.

## Done when
- One migration file covers all 8 tables.
- `results/S02-02.md` names each table's authoritative upsertOn key.
- SQL is idempotent.

## Verify
- Run: `npx tsc --noEmit > specs/migration-remaining/logs/s02-02-tsc.log 2>&1; echo "exit=$?"` -> exit=0.

## Handoff
`results/S02-02.md` feeds S02-05 (queue-quality flips incl. any dedupe_key
transforms for refresh_log/qa_access_log/qe_builds) and S02-07 (options,
mail_log, holidays, follow_up_done, sc_behaviour flips). TL updates TRACKER.md.
