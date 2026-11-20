# TRACKER: home-quality-cards
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (2026-11-20, NOT ours — qa-audit-footer-compact in flight):
M src/app/styles/quality.css; M src/features/cx-quality/components/{audit-queue-detail,
audit-queue-page,qa-shared,quality-analytics-page}.tsx; M src/features/cx-queue/lib/jobs.ts;
M tests/golden/hub-fakes.ts; ?? results-ac01-*.log, tl-tsc-check.log,
tests/golden/queue-checkin-auto.test.ts, tests/quality/qa-audit-footer-compact.test.tsx

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | all children verified; integration gates logged |
| S01-01 | mini/S01 | dev | none | 1/6/150/10 | PASS | verified | results/S01-01.md; aggregates.ts +66/-1; tsc 0 |
| S01-02 | mini/S01 | test-engineer | S01-01 | 2/5/260/10 | PASS | verified | results/S01-02.md; golden strip D-QUALITY; new test 15/15 pass x2 |
| S01-03 | mini/S01 | dev | S01-01 | 2/5/110/10 | PASS | verified | results/S01-03.md; overview-page +47-16, hub.css +1; eslint+tsc 0 |
| qa1-01 | mini/S01 | dev | none | 1/2/15/5 | PASS | verified | results/qa1-01.md; settings parse moved inside quality catch; targeted vitest 5/5, scoped eslint 0, tsc 0 |
| ux1-01 | mini/S01 | dev | none | 1/3/10/5 | PASS | verified | results/ux1-01.md; 3 .stat-v spans get %/pts units; tsc 0, eslint 0, vitest 5/5 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | npx tsc --noEmit | PASS (exit 0) |
| 1 | lint (scoped) | npx eslint <our 4 files> | PASS (exit 0) |
| 1 | lint (repo) | npx eslint . | FAIL — 1 pre-existing error in committed tests/golden/queue-aggregates.test.ts:123 (not ours, file clean in git) + 6 warnings in unrelated files |
| 1 | unit | npx vitest run | FAIL 2/1536 — both pre-existing/foreign: sheets-freeze-scan (committed scripts/ops/qa-*.ts readers) & table-center-align .qa-whylist (quality.css dirty = qa-audit-footer-compact agent). Our tests 15/15 pass. |
| 2 | typecheck | npx tsc --noEmit | PASS (exit 0) |
| 2 | lint (scoped) | npx eslint src/features/cx-hub/lib/aggregates.ts | PASS (exit 0) |
| 2 | lint (repo) | npx eslint . | FAIL — same 1 pre-existing error in committed tests/golden/queue-aggregates.test.ts:123 + 6 warnings |
| 2 | unit | npx vitest run | FAIL 2/1538 — same foreign failures: sheets-freeze-scan and table-center-align .qa-whylist; targeted quality test 5/5 PASS |
| 3 | typecheck | npx tsc --noEmit | PASS (exit 0) |
| 3 | lint (scoped) | npx eslint src/features/cx-hub/components/overview-page.tsx | PASS (exit 0) |
| 3 | unit (targeted) | npx vitest run tests/hub-home-quality.test.ts | PASS 5/5 |

Round 3 log: logs/gates-ux1.log

Round 1 log: results/integration-gates.log
Round 2 evidence: reports/tl-2.md (gate exits and failure list; scratch logs removed)

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 (MED): `qeSettingsFrom_` can throw before the quality `try/catch` | reports/qa-1.md | qa1-01 / dev | verified | results/qa1-01.md; parse now inside catch; targeted vitest 5/5 |
| qa-2 (LOW): missing throw-path and `weekStartsOn=1` coverage | reports/qa-1.md | - | deferred | LOW deferred per FIX policy |
| ux-1 (MED): quality `.stat-v` scores lack a unit | reports/ux-1.md | ux1-01 / dev | verified | results/ux1-01.md; logs/gates-ux1.log |
| ux-2 (LOW): Open CTLs shows `0` when quality is null | reports/ux-1.md | - | deferred | LOW deferred per FIX policy |
| ux-3 (LOW): `.stat-d` jargon copy | reports/ux-1.md | - | deferred | LOW deferred per FIX policy |

## Blocked / needs user
- (none)
