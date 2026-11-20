# TRACKER: table-center-align
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`.

Baseline dirty tree (foreign, do not revert): specs/ui-shell-polish/reports/*.png (8),
src/features/cx-hub/components/hub-shared.tsx, overview-page.tsx,
src/features/cx-hub/lib/roster.ts, src/features/cx-quality/lib/engine-live.ts,
tests/platform/dq-hct-snapshot.test.ts; untracked foreign: specs/next-security-upgrade/,
specs/overview-single-refresh/, specs/qa-build-no-touches/, specs/unified-page-format/logs/,
tests/overview-single-refresh.test.ts, tests/quality/qe-performer-resolution.test.ts.
NOTE: overview-page.tsx (S02-02 file) has foreign edits — scope check per-hunk only.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | done | both children done; CSS cascade verified in diff + S03-01 test |
| S01-01 | mini/S01 | dev | none | 1/3/15/6 | PASS | done | results/S01-01.md; diff verified: 2 rules + cx-num-col center |
| S01-02 | mini/S01 | dev | none | 5/6/30/9 | PASS | done | results/S01-02.md; 5 css files, +7/-3, scoped rules verified |
| S02 | package/- | - | - | n/a | not dispatchable | done | all 12 children done; 34 table files audited |
| S02-01 | mini/S02 | dev | none | 3/4/25/8 | PASS | done | results/S02-01.md; tl-performance +6 cx-num; other 2 files clean |
| S02-02 | mini/S02 | dev | none | 4/7/40/9 | PASS | done | results/S02-02.md; audit only, all tagged; foreign diff preserved |
| S02-03 | mini/S02 | dev | none | 3/9/50/10 | PASS | done | results/S02-03.md; +8 cx-num in 2 files; coaching clean |
| S02-04 | mini/S02 | dev | none | 3/7/35/9 | PASS | done | results/S02-04.md; pv-shared +2 cx-num; other 2 files clean |
| S02-05 | mini/S02 | dev | none | 2/7/35/9 | PASS | done | results/S02-05.md; +4 cx-num; tph-hg verified |
| S02-06 | mini/S02 | dev | none | 2/7/30/9 | PASS | done | results/S02-06.md; heatmap +4; scheduler audit-only; scope=col miss reported |
| S02-07 | mini/S02 | dev | none | 4/6/30/8 | PASS | done | results/S02-07.md; aging +1; 2 scope=col misses reported |
| S02-08 | mini/S02 | dev | none | 2/9/50/10 | PASS | done | results/S02-08.md; all 8 tables already tagged, 0 edits; 1 ambiguity reported |
| S02-09 | mini/S02 | dev | none | 1/9/50/10 | PASS | done | results/S02-09.md; +4 cx-num, all <=707; 1 ambiguity reported |
| S02-10 | mini/S02 | dev | S02-09 | 1/9/50/10 | PASS | done | results/S02-10.md; +5 cx-num all >750; file complete |
| S02-11 | mini/S02 | dev | none | 3/8/40/10 | PASS | done | results/S02-11.md; +2 cx-num; qa-cov test 2/2 pass |
| S02-12 | mini/S02 | dev | none | 7/8/50/10 | PASS | done | results/S02-12.md; +4 cx-num in 4 files; 3 clean |
| S03 | package/- | - | - | n/a | not dispatchable | done | S03-01 test green 12/12 |
| S03-01 | mini/S03 | test-engineer | S01-01,S01-02,S02 | 1/4/120/10 | PASS | done | results/S03-01.md; tests/css/table-center-align.test.ts 12/12 |
| qa1-01 | mini/qa-1 | dev | none | 2/3/30/8 | PASS | done | results/qa1-01.md; queue.css:162 tbody :is(th,td) start; test 13/13 |
| qa2-01 | mini/qa-3 | dev | none | 2/3/15/6 | PASS | done | results/qa2-01.md; queue.css:163 thead th padding restored; test 14/14 |
| ux1-01 | mini/ux-1 | dev | none | 2/3/15/6 | PASS | done | results/ux1-01.md; .trk-num in :is() list; test 14/14 |
| ux1-02 | mini/ux-2 | dev | none | 1/2/4/4 | PASS | done | results/ux1-02.md; chip td cx-num at aging:303 |
| ux1-03 | mini/ux-3 | dev | ux1-01 (shared test file) | 2/4/20/7 | PASS | done | results/ux1-03.md; base rule drops text-align, tbody keeps !important |
| S04 | package/- | - | - | n/a | not dispatchable | done | all 4 children done; integration gates green (tsc 0, vitest 20/20, eslint 0) |
| S04-01 | mini/S04 | dev | none | 1/2/5/5 | PASS | done | results/S04-01.md; cx-kit.css:661 td:has(.cx-chip) rule, diff verified |
| S04-02 | mini/S04 | dev | none | 1/2/3/4 | PASS | done | results/S04-02.md; quality.css:84 .cx-select.qa-narrow inline-size:auto |
| S04-03 | mini/S04 | dev | none | 2/3/6/6 | PASS | done | results/S04-03.md; analytics:407 cx-num; scores:376 conditional cx-num |
| S04-04 | mini/S04 | test-engineer | S04-01,S04-02,S04-03 | 1/4/70/9 | PASS | done | results/S04-04.md; +6 tests, vitest 20/20 |
| ux3-01 | mini/ux-3 | dev | none | 9/9/50/9 | PASS | done | results/ux3-01.md; cx-txt rule + 8 tds; vitest 21/21 |
| ux3-02 | mini/ux-3 | dev | ux3-01 (shared test file) | 2/2/15/5 | PASS | done | results/ux3-02.md; qa-whylist li justify-content; vitest 22/22 |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck (integration) | `npx tsc --noEmit` | PASS (empty log results/tsc-checkpoint.log) |
| 1 | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 12/12 (S03-01) |
| 1 | targeted unit | `npx vitest run tests/quality/qa-cov-center.test.tsx` | PASS 2/2 (S02-11) |
| 1 | per-leaf lint | `npx eslint <leaf files>` | PASS 0 errors (all leaves) |
| 2 (fix) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-qa1-tsc.log) |
| 2 (fix) | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 13/13 (qa1-01) |
| 2 (fix) | lint | `npx eslint queue.css table-center-align.test.ts` | PASS 0 errors |
| 3 (fix) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-qa2-tsc.log) |
| 3 (fix) | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 14/14 (qa2-01) |
| 3 (fix) | lint | `npx eslint queue.css table-center-align.test.ts` | PASS 0 errors |
| 4 (fix ux-1) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-ux1-tsc.log) |
| 4 (fix ux-1) | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 14/14 (logs/fix-ux1-vitest.log) |
| 4 (fix ux-1) | lint | `npx eslint aging-page.tsx table-center-align.test.ts` | PASS 0 errors (logs/fix-ux1-eslint.log) |
| 5 (S04 integration) | typecheck | `npx tsc --noEmit` | PASS exit 0 (results/s04-tsc.log) |
| 5 (S04 integration) | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 20/20 (results/s04-vitest.log) |
| 5 (S04 integration) | lint | `npx eslint <S04 touched ts/tsx/test files>` | PASS 0 errors (results/s04-eslint.log) |
| 6 (fix ux-3) | typecheck | `npx tsc --noEmit` | PASS exit 0 (logs/fix-ux3-tsc2.log) |
| 6 (fix ux-3) | targeted unit | `npx vitest run tests/css/table-center-align.test.ts` | PASS 22/22 (logs/fix-ux3-vitest.log) |
| 6 (fix ux-3) | lint | `npx eslint <7 tsx + test file>` | PASS 0 errors (logs/fix-ux3-eslint.log) |
Full gates (eslint ., vitest run, e2e, build) = PM-run.

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 (HIGH): .sch-table tbody row-label th lose start | reports/qa-1.md | qa1-01 (dev) | fixed | results/qa1-01.md; tsc 0, vitest 13/13, eslint 0 |
| qa-2 (LOW): missing scope="col" x3 | reports/qa-1.md, qa-2.md | - | deferred | LOW per FIX policy |
| qa-3 (MED): .sch-table thead th padding regression | reports/qa-2.md | qa2-01 (dev) | fixed | results/qa2-01.md; tsc 0, vitest 14/14, eslint 0 |
| ux-1 (MED): .trk-num cells missed by numeric centering | reports/ux-1.md | ux1-01 (dev) | fixed | results/ux1-01.md; tsc 0, vitest 14/14, eslint 0 |
| ux-2 (MED): aging chip td not centered | reports/ux-1.md | ux1-02 (dev) | fixed | results/ux1-02.md; vitest 14/14, eslint 0 |
| ux-3 (LOW->fix): .sch-sticky header can't center | reports/ux-1.md | ux1-03 (dev) | fixed | results/ux1-03.md; PM intent applied; tbody keeps start |
| ux-4 (LOW): aging colSpan over-count | reports/ux-1.md | - | deferred | LOW per FIX policy |
| ux-5 (LOW): missing scope="col" x3 | reports/ux-1.md | - | deferred | LOW per FIX policy (carried from qa-2) |
| ux-1..3 (MED): chip-rule centers text-primary tds | reports/ux-3.md | ux3-01 (dev) | fixed | results/ux3-01.md; cx-txt on checkins:208, queue:326, audit-queue:417 |
| ux-4 (LOW): 4 flip-flop mixed-variant tds | reports/ux-3.md | ux3-01 (dev) | fixed | cx-txt on people-holidays:453/:468, quality-analytics:991, productivity:169, trackers:722 |
| ux-5 (LOW): .qa-whylist li centering no-op | reports/ux-3.md | ux3-02 (dev) | fixed | results/ux3-02.md; justify-content:center at quality.css:208 |

## Blocked / needs user
- (none)
