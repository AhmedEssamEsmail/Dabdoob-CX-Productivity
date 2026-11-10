# S10-01: revert refresh_log log_id mint to positional 'mig-'+ctx.index
Kind: mini
ID: S10-01
Parent: S10
Owner: data-engineer
Depends: none
Criteria: PLAN #5; finding data-1 (reports/data-1.md) — HIGH
Skills: none
Budget: files=2; actions=4; changed_lines=60; minutes=8

## Goal
S09-01 changed the refresh_log `log_id` mint to `'mig-'+sha1(event tuple)`, but
the live table holds 8,197 WP-51 rows keyed `'mig-'+ctx.index` and the pending
DDL only adds `UNIQUE(log_id)` — no backfill. A gated re-run would mint sha1
keys matching nothing → ~9,046 duplicate inserts, violating PLAN #5 "0 new
rows". Revert the refresh_log mint to positional: the source sheet is
append-only, so position is stable. sched_plan/qa_access_log keep their sha1
mints (they DO have DDL backfills — S09-02).

## Files
- Edit: `src/features/shared/migration/mappings/queue-quality.ts` | refresh_log transform ~lines 518-528 (and its comment block)
- Edit: `tests/lib/migration-dedupe-key.test.ts` | `describe('refresh_log log_id')` ~lines 63-76

## Context
- `src/features/shared/migration/mappings/queue-quality.ts:45-50,518-528` |
  `dedupeKey_` helper + the sha1 mint to revert (helper stays — sched_plan /
  qa_access_log still use it at ~579/589)
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql:19-31` |
  refresh_log section: `UNIQUE INDEX … (log_id)`, no UPDATE/backfill
- `specs/megaplan/audits/migration-run.md:69` | WP-51 evidence: refresh_log
  8,197 rows inserted with the positional mint

## Contract
- `refresh_log` transform: when log_id unset, `row.log_id = 'mig-' + ctx.index`
  — no hashing, no empty-identity branch (positional always unique per run).
- `dedupeKey_` helper and the sched_plan / qa_access_log sha1 mints are
  UNTOUCHED. No SQL file edits (the pending migration's comment
  "'mig-'+ctx.index" at line 20 becomes correct again).
Out of scope: every other transform/table, validate.ts, engine.ts, migrations.

## Actions
1. queue-quality.ts: revert the refresh_log mint to
   `row.log_id = 'mig-' + ctx.index` inside the existing unset guard.
2. Rewrite the comment block (~518-521): positional key matches the 8,197
   live WP-51 rows; append-only sheet makes position stable; sha1 was reverted
   because the DDL has no refresh_log backfill (finding data-1).
3. tests/lib/migration-dedupe-key.test.ts: refresh_log describe now asserts
   positional keys (`'mig-5'`/'`mig-6`'), not the sha1 vector; keep the other
   describes unchanged.
4. Run the targeted test + typecheck.

## Done when
- `grep -n "dedupeKey_" src/features/shared/migration/mappings/queue-quality.ts`
  shows only sched_plan + qa_access_log call sites (~579/589) and the helper.
- `npx vitest run tests/lib/migration-dedupe-key.test.ts` passes.
- `npx tsc --noEmit` exit=0.

## Verify
- Run: `npx vitest run tests/lib/migration-dedupe-key.test.ts` -> pass
- Run: `npx tsc --noEmit` -> exit=0

## Handoff
None — the gated re-run (NEEDS_APPROVAL) now mints keys that conflict-match
the live rows.
Write results/S10-01.md (<=10 lines); TL alone updates TRACKER.md.
