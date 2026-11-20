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
| low1-01 | mini/S01 | dev | none | 1/1/5/5 | PASS | verified | results/low1-01.md; diff scoped to 1 expr; eslint 0 |
| low1-02 | mini/S01 | dev | low1-01 | 1/2/4/5 | PASS | verified | results/low1-02.md; 2 strings only; eslint 0 |
| low1-03 | mini/S01 | test-engineer | none | 1/3/80/10 | PASS | verified | results/low1-03.md; 2 new tests, 7/7 pass, week=50 discriminates |
| chg1-01 | mini/S01 | dev | none | 1/2/5/5 | PASS | done | results/chg1-01.md; aggregates.ts +1 line; tsc 0 |
| chg1-02 | mini/S01 | dev | chg1-01 | 1/3/15/5 | PASS | verified | results/chg1-02.md; overview-page +9/-3; tsc 0, eslint 0 |
| chg1-03 | mini/S01 | test-engineer | chg1-01 | 1/2/10/5 | PASS | verified | results/chg1-03.md; prevMonth asserts admin 60 / tl 70; vitest 7/7 |

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
| 4 | unit (targeted) | npx vitest run tests/hub-home-quality.test.ts | PASS 7/7 |
| 4 | typecheck | npx tsc --noEmit | PASS (exit 0) |
| 4 | lint (scoped) | npx eslint overview-page.tsx tests/hub-home-quality.test.ts | PASS (exit 0) |

| 5 | unit (targeted) | npx vitest run tests/hub-home-quality.test.ts | PASS 7/7 |
| 5 | typecheck | npx tsc --noEmit | PASS (exit 0) |
| 5 | lint (scoped) | npx eslint overview-page.tsx aggregates.ts hub-home-quality.test.ts | PASS (exit 0) |

Round 5 log: logs/gates-chg1.log

Round 4 log: logs/gates-low1.log

Round 3 log: logs/gates-ux1.log

Round 1 log: results/integration-gates.log
Round 2 evidence: reports/tl-2.md (gate exits and failure list; scratch logs removed)

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 (MED): `qeSettingsFrom_` can throw before the quality `try/catch` | reports/qa-1.md | qa1-01 / dev | verified | results/qa1-01.md; parse now inside catch; targeted vitest 5/5 |
| qa-2 (LOW): missing throw-path and `weekStartsOn=1` coverage | reports/qa-1.md; reports/low-findings.md low-3 | low1-03 / test-engineer | verified | results/low1-03.md; 7/7 pass |
| ux-1 (MED): quality `.stat-v` scores lack a unit | reports/ux-1.md | ux1-01 / dev | verified | results/ux1-01.md; logs/gates-ux1.log |
| ux-2 (LOW): Open CTLs shows `0` when quality is null | reports/ux-1.md; reports/low-findings.md low-1 | low1-01 / dev | verified | results/low1-01.md; expr now `== null ? '–'` |
| ux-3 (LOW): `.stat-d` jargon copy | reports/ux-1.md; reports/low-findings.md low-2 | low1-02 / dev | verified | results/low1-02.md; plain copy landed |
| chg-1 (REQ): `prev` computed but not exposed on `out.quality` | reports/change-delta-card.md | chg1-01 / dev | done | results/chg1-01.md; +1 line, tsc 0 |
| chg-2 (REQ): delta card must show last month's score + `.delta` pill | reports/change-delta-card.md | chg1-02 / dev | verified | results/chg1-02.md; logs/gates-chg1.log |
| chg-3 (REQ): `prevMonth` untested | reports/change-delta-card.md | chg1-03 / test-engineer | verified | results/chg1-03.md; vitest 7/7 |

## Blocked / needs user
- (none)
