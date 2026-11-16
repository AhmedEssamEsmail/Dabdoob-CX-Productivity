# TRACKER: unify-roster-source
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass.

## Baseline dirty tree (pre-build, do NOT revert)
- M src/app/api/qa/[action]/route.ts, src/app/styles/quality.css,
  src/features/cx-hub/lib/roster.ts, src/features/cx-quality/components/qa-shared.tsx,
  quality-analytics-page.tsx, quality-scores-page.tsx, src/features/cx-quality/lib/analytics.ts,
  src/features/cx-quality/lib/server.ts
- ?? scripts/ops/probe-sync-health.ts, specs/aging-stale-status/, specs/qa-active-toggle/,
  specs/qa-agent-week-grid/, specs/unify-roster-source/,
  tests/platform/dq-hct-active.test.ts, tests/quality/qa-agent-weeks-rowhead.test.tsx,
  tests/quality/qa-agent-weeks.test.ts

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all 4 children done; vitest targeted 35/35; dq_hct gone from src+tests |
| S01-01 | mini/S01 | dev | none | 1/4/130/10 | PASS | verified | results/S01-01.md; tsc 0; sheet-direct +15-key projection verified |
| S01-02 | mini/S01 | dev | S01-01 | 1/3/60/8 | PASS | verified | results/S01-02.md; tsc 0; dq_hct gone from server.ts |
| S01-03 | mini/S01 | dev | S01-01 | 3/4/210/8 | PASS | verified | results/S01-03.md; tsc 0; hct.ts + backfill deleted, engine clean |
| S01-04 | mini/S01 | test-engineer | S01-01, S01-02, S01-03 | 3/7/220/10 | PASS | verified | results/S01-04.md; vitest 35/35 x2; tests/ dq_hct-free |
| S02 | package/- | - | S01 (merge ordering) | n/a | not dispatchable | verified | 3 children done; parity exec + remote apply = merge-gated approvals |
| S02-01 | mini/S02 | supabase-expert | S01-02, S01-03 | 1/2/40/5 | PASS | verified | results/S02-01.md; 20261116171029_drop_dead_v1_tables.sql (9 drops, IF EXISTS, no CASCADE) |
| S02-02 | mini/S02 | data-engineer | S01-01 | 1/3/150/10 | PASS | verified | results/S02-02.md; eslint clean; authored only (exec = approved remote read) |
| S02-03 | mini/S02 | dev | none | 1/2/15/5 | PASS | verified | results/S02-03.md; tsc 0; 9 rows gone, hct/sched_* kept |
| qa1-01 | mini/fix-qa-1 | dev | none | 1/2/1/2 | PASS | verified | results/qa1-01.md; `nul` deleted, git status clean of it |
| qa1-02 | mini/fix-qa-1 | data-engineer | none | 1/3/40/8 | PASS | verified | results/qa1-02.md; raw String(email) key + case-variants diagnostic; tsc/eslint 0 |
| qa1-03 | mini/fix-qa-1 | dev | none | 3/4/15/5 | PASS | verified | results/qa1-03.md; require->import x2 + cjs eslint-disable; eslint 0 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS exit 0 |
| 1 | lint | `npx eslint .` | 5 errors — ALL pre-existing outside change (scripts/ops/probe-aging-stale.ts, probe-sync-health.ts, specs/qa-audit-form-ui/logs/ux-check.cjs); 0 in touched files |
| 1 | unit | `npx vitest run` | 1374/1375; 1 fail = PRE-EXISTING tests/quality/qe-fd-cache.test.ts (repo mock omits `newId`, used by engine-live.ts:321 error path — files untouched by this spec) |
| 1 | e2e | `npx playwright test e2e/page-contract.spec.ts -g people-holidays` | PASS 4/4 (chromium+mobile @375/1024); dev-server `Date.now()` prerender warnings pre-existing |
| 1 | security | `npm run test:security` | PASS 4/4 |
| 2 (fix-qa-1) | typecheck | `npx tsc --noEmit` | PASS exit 0 (results/gates/fix-tsc.log) |
| 2 (fix-qa-1) | lint | `npx eslint .` | PASS 0 errors (was 5); 3 pre-existing warnings unrelated (results/gates/fix-eslint.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 HIGH live parity never run | reports/qa-1.md | (none — user approval) | blocked | needs approved remote read; PM/user runs verify-hct-parity.mts pre-merge |
| qa-2 LOW stray `nul` | reports/qa-1.md | qa1-01 dev | verified | results/qa1-01.md; `nul` deleted |
| qa-3 LOW harness dedupe masks case-variants | reports/qa-1.md | qa1-02 data-engineer | verified | results/qa1-02.md; raw-key dedupe mirrors roster.ts:285 + case-variants diagnostic |
| qa-4 LOW untracked probes = 5 eslint errors | reports/qa-1.md | qa1-03 dev | verified | results/qa1-03.md; `npx eslint .` now 0 errors |

## Blocked / needs user
- qa-1 (HIGH): run `npx tsx --tsconfig scripts/tsconfig.json scripts/ops/verify-hct-parity.mts` pre-merge — requires user-approved remote read; left for PM/user.
- S02-02 script EXECUTION requires user-approved remote read — authoring only; TL/PM runs it pre-merge.
- S02-01 migration remote apply is merge-gated + user approval (auto-apply on merge to main).
