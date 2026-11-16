# TL report 1 — unify-roster-source (BUILD)

## Status: COMPLETE — all 7 mini-leaves done, integration gates run

| Leaf | Owner | Files changed | Evidence |
|---|---|---|---|
| S01-01 | dev | src/features/cx-hub/lib/roster.ts | results/S01-01.md; dqReadHct_ reads Sheet1 via readSheet, 15-key projection, require+last-wins dedupe |
| S01-02 | dev | src/features/cx-quality/lib/server.ts | results/S01-02.md; qaActiveEmails_ via dqReadHct_ + cache qa_hct_active/600s, fail-open null |
| S01-03 | dev | engine.ts; deleted mappings/hct.ts + scripts/ops/backfill-hct-headcount.mts | results/S01-03.md; zero executable dq_hct refs in src//scripts/ |
| S01-04 | test-engineer | tests/golden/hub-fakes.ts, hub-people-holidays.test.ts, tests/perf/qa-pushdown.test.ts | results/S01-04.md; one SHEET1 fixture drives oracle+port; vitest 35/35 x2 |
| S02-01 | supabase-expert | supabase/migrations/20261116171029_drop_dead_v1_tables.sql | 9 DROP TABLE IF EXISTS public.<name>, no CASCADE, exact names |
| S02-02 | data-engineer | scripts/ops/verify-hct-parity.mts (new, 129 lines) | authored + eslint clean; NOT executed (approved remote read) |
| S02-03 | dev | migration/validate.ts | 9 inventory rows removed; hct sheet + sched_* kept |

## Gates (round 1, project root) — logs in results/gates/
- tsc --noEmit: PASS
- eslint: 5 errors ALL pre-existing outside this change (untracked ops probes + spec artifact); 0 in touched files
- vitest run: 1374/1375 — 1 fail PRE-EXISTING: tests/quality/qe-fd-cache.test.ts mocks repo without `newId` (engine-live.ts:321 error path); none of its files touched by any leaf
- playwright page-contract /people-holidays: PASS 4/4 (chromium+mobile @375/1024)
- test:security: PASS 4/4

## Needs user / merge-time approvals
- Run `npx tsx --tsconfig scripts/tsconfig.json scripts/ops/verify-hct-parity.mts` pre-merge (approved remote read) -> PARITY OK completes PLAN #2.
- Migration 20261116171029 auto-applies on merge to main — destructive, user-approved drop list.
- S02-02 worker flagged NEEDS_APPROVAL for remote apply — correctly deferred to merge.

## Notes for PM/reviewers
- Pre-existing vitest failure + eslint errors documented above are baseline noise on the dirty tree, not regressions.
- No shard requested reviewers/devops; none spawned per rules.
- User's pre-existing uncommitted edits (cx-quality components/server.ts, qa specs) were preserved; scope verified via assignment-local greps where raw diffs overlapped.
