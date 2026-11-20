# TRACKER: ui-label-size-sweep
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (foreign, do not revert): quality.css,
audit-queue-detail.tsx, audit-queue-page.tsx, qa-shared.tsx,
quality-analytics-page.tsx, jobs.ts, hub-fakes.ts,
tests/quality/qa-audit-footer-compact.test.tsx (untracked, prior spec),
plus logs/other spec dirs. Leaves self-check `git diff HEAD` for foreign
hunks -> `deferred-foreign`.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | all children done; integration below | |
| S01-01 | mini/S01 | dev | none | 1/2/1/4 | PASS | verified | results/S01-01.md; eslint+tsc clean |
| S01-02 | mini/S01 | dev | none | 1/2/1/4 | PASS | verified | results/S01-02.md; eslint+tsc clean |
| S01-03 | mini/S01 | dev | none | 1/5/4/6 | PASS | verified | results/S01-03.md; eslint+tsc clean |
| S01-04 | mini/S01 | dev | none | 2/6/45/10 | PASS | verified | results/S01-04.md; vitest 7/7, tsc clean |
| S01-05 | mini/S01 | dev | none | 1/3/2/4 | PASS | verified | results/S01-05.md; eslint+tsc clean |
| S01-06 | mini/S01 | dev | none | 1/2/4/5 | PASS | verified | results/S01-06.md; append-only diff clean |
| S02 | package/- | - | - | n/a | not dispatchable | done | all children done; integration below | |
| S02-01 | mini/S02 | dev | none | 1/2/1/4 | PASS | verified | results/S02-01.md; eslint+tsc clean |
| S02-02 | mini/S02 | dev | none | 1/2/1/4 | PASS | verified | results/S02-02.md; eslint+tsc clean |
| S02-03 | mini/S02 | dev | none | 1/3/2/5 | PASS | verified | results/S02-03.md; eslint+tsc clean |
| S02-04 | mini/S02 | dev | none | 1/4/3/6 | PASS | verified | results/S02-04.md; eslint+tsc clean |
| S02-05 | mini/S02 | dev | none | 1/3/2/5 | PASS | verified | results/S02-05.md; eslint+tsc clean |
| S02-06 | mini/S02 | dev | none | 1/3/2/5 | PASS | verified | results/S02-06.md; eslint+tsc clean |
| S02-07 | mini/S02 | dev | none | 1/2/1/4 | PASS | verified | results/S02-07.md; eslint+tsc clean |
| S03 | package/- | - | - | n/a | not dispatchable | done | all children done; integration below | |
| S03-01 | mini/S03 | dev | none | 1/2/2/4 | PASS | verified | results/S03-01.md; append-only diff clean |
| S03-02 | mini/S03 | dev | none | 1/3/3/5 | PASS | verified | results/S03-02.md; append-only diff clean |
| S03-03 | mini/S03 | dev | none | 1/2/2/4 | PASS | verified | results/S03-03.md; append-only diff clean |
| S04 | package/- | - | - | n/a | not dispatchable | done | all 5 children done; integration round 2 below |
| S04-01 | mini/S04 | dev | none | 1/2/3/4 | PASS | done | results/S04-01.md; 3 strings changed, eslint+tsc clean (attempt2; attempt1 false-positive defer) |
| S04-02 | mini/S04 | dev | none | 1/2/1/4 | PASS | done | results/S04-02.md; 1 line changed, eslint+tsc clean (attempt2; attempt1 false-positive defer) |
| S04-03 | mini/S04 | dev | none | 1/2/2/4 | PASS | done | results/S04-03.md; diff=2 lines, eslint+tsc clean |
| S04-04 | mini/S04 | dev | none | 1/2/1/4 | PASS | done | results/S04-04.md; 1 line changed, eslint+tsc clean |
| S04-05 | mini/S04 | dev | none | 1/2/1/4 | PASS | done | results/S04-05.md; aria-label added, eslint+tsc clean |
| S05 | package/- | - | - | n/a | not dispatchable | done | all 12 children done; integration round 2 below |
| S05-01 | mini/S05 | dev | none | 1/3/2/4 | PASS | done | results/S05-01.md; 2 props added, eslint+tsc clean (attempt2; attempt1 false-positive defer — :485 `Pass`->`Skip` hunk is sibling spec qa-audit-footer-compact, kept intact) |
| S05-02 | mini/S05 | dev | none | 1/9/8/10 | PASS | done | results/S05-02.md; 8 buttons size="sm", eslint+tsc clean |
| S05-03 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-03.md; 1 prop, eslint+tsc clean |
| S05-04 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-04.md; 1 prop, eslint+tsc clean |
| S05-05 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-05.md; 1 prop, eslint+tsc clean |
| S05-06 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-06.md; 1 prop, eslint+tsc clean |
| S05-07 | mini/S05 | dev | none | 1/3/2/4 | PASS | done | results/S05-07.md; 2 props, eslint+tsc clean |
| S05-08 | mini/S05 | dev | none | 1/5/4/6 | PASS | done | results/S05-08.md; 4 props, eslint+tsc clean |
| S05-09 | mini/S05 | dev | none | 1/5/4/6 | PASS | done | results/S05-09.md; 4 props, eslint+tsc clean |
| S05-10 | mini/S05 | dev | none | 1/4/3/5 | PASS | done | results/S05-10.md; 4 props, eslint+tsc clean |
| S05-11 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-11.md; 1 prop, eslint+tsc clean |
| S05-12 | mini/S05 | dev | none | 1/2/1/4 | PASS | done | results/S05-12.md; 1 prop, eslint+tsc clean |
| S06 | package/- | - | - | n/a | not dispatchable | done | all 7 children done; integration round 2 below |
| S06-01 | mini/S06 | dev | none | 1/3/2/5 | PASS | done | results/S06-01.md; 2 rows={2}, eslint+tsc clean |
| S06-02 | mini/S06 | dev | none | 1/2/1/4 | PASS | done | results/S06-02.md; 1 prop, eslint+tsc clean |
| S06-03 | mini/S06 | dev | none | 1/2/4/5 | PASS | done | results/S06-03.md; EOF append 3 rules, append-only |
| S06-04 | mini/S06 | dev | none | 1/2/3/5 | PASS | done | results/S06-04.md; EOF append 2 rules, add-only |
| S06-05 | mini/S06 | dev | none | 1/2/2/4 | PASS | done | results/S06-05.md; 2 lines after .other-row, add-only |
| S06-06 | mini/S06 | dev | none | 1/2/2/4 | PASS | done | results/S06-06.md; EOF append, add-only |
| S06-07 | mini/S06 | dev | none | 2/4/3/6 | PASS | done | results/S06-07.md; 3 classNames, eslint+tsc clean |
| qa2-01 | mini/fix-qa-2 | test-engineer | none | 1/5/450/10 | PASS | verified | results/qa2-01.md; 389 lines, vitest 6/6, eslint+tsc clean |
| qa2-02 | mini/fix-qa-2 | test-engineer | none | 1/3/300/10 | PASS | verified | results/qa2-02.md; 342 lines, vitest 2/2, eslint+tsc clean |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | npx tsc --noEmit | PASS exit 0 (log tl-tsc.log) |
| 1 | lint | npx eslint . | 1 error + 6 warnings, all pre-existing foreign (queue-aggregates.test.ts any, unused-var warnings); no leaf file flagged |
| 1 | unit | npx vitest run | 123/125 files pass; 2 pre-existing foreign fails: table-center-align (.qa-whylist foreign hunk), sheets-freeze-scan (scripts/ops allowlist, untouched) |
| 2 | typecheck | npx tsc --noEmit | PASS exit 0 (log tl2-tsc.log) |
| 2 | lint | npx eslint . | same as round 1: 1 error + 6 warnings, all pre-existing foreign; no leaf file flagged (log tl2-eslint.log) |
| 2 | unit | npx vitest run | 123/125 pass; same 2 pre-existing foreign fails (table-center-align, sheets-freeze-scan); no new failures (log tl2-vitest.log) |
| 3 | typecheck | npx tsc --noEmit | PASS exit 0 (log tl3-tsc.log) |
| 3 | lint (leaf file) | npx eslint audit-queue-page.tsx | PASS exit 0 (log tl3-eslint.log) |
| 4 (fix-qa-2) | typecheck | npx tsc --noEmit | PASS exit 0 (log tl4-tsc.log) |
| 4 (fix-qa-2) | unit (new specs) | npx vitest run tests/quality/ui-label-sweep*.test.tsx | PASS 8/8 (log tl4-vitest.log) |
| 4 (fix-qa-2) | lint (new files) | npx eslint tests/quality/ui-label-sweep*.test.tsx | PASS exit 0 (log tl4-eslint.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-2-1 (MED): no regression assertions for S04-S06 pinned fixes | reports/qa-2.md | test-engineer (qa2-01, qa2-02) | done | results/qa2-01.md, results/qa2-02.md; tl4 gates pass |

## Blocked / needs user
- (none)
