# TRACKER: headcount-access-split
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree at TL start (2026-11-12): `?? docs/Reference_Code.gs`,
`?? specs/headcount-access-split/` — no other modifications. Scope checks use
assignment-local changes only.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | both children done; migration file local-only (applies on merge) |
| S01-01 | mini/S01 | supabase-expert | none | 1/3/30/5 | PASS | verified | results/S01-01.md; supabase/migrations/20261112142701_headcount_access_split.sql (9 nullable cols; local-only, applies on merge) |
| S01-02 | mini/S01 | data-engineer | none | 1/3/15/5 | PASS | verified | results/S01-02.md; hct.ts +code/gender/contactNumber; tsc clean |
| S02 | package/- | - | S01, S03-01 | n/a | not dispatchable | verified | sync fills cols; admin surface reads/edits them |
| S02-01 | mini/S02 | dev | S01-01, S01-02 | 1/5/70/10 | PASS | verified | results/S02-01.md; roster.ts +17; tsc+eslint clean |
| S02-02 | mini/S02 | dev | S02-01, S03-01 | 1/5/140/10 | PASS | verified | results/S02-02.md; roster.ts admin surface; tsc+eslint clean |
| S03 | package/- | - | - | n/a | not dispatchable | verified | helpers published; all platform tests green |
| S03-01 | mini/S03 | dev | none | 2/6/120/10 | PASS | verified | results/S03-01.md; identity.ts +40/-5, new test 5/5; regression in tests/perf/identity-roster.test.ts:147 FIXED (titleLevel:'manager', 6/6 green) |
| S04 | package/- | - | S03-01 | n/a | not dispatchable | verified | all 4 children done; role=access, position=org/headcount |
| S04-01 | mini/S04 | dev | S03-01 | 2/7/60/10 | PASS | verified | results/S04-01.md; pure.ts+server.ts; tsc+eslint clean |
| S04-02 | mini/S04 | dev | S04-01 | 1/5/30/10 | PASS | verified | results/S04-02.md; server.ts TL/calibration lists; tsc+eslint clean |
| S04-03 | mini/S04 | dev | S03-01 | 3/6/40/10 | PASS | verified | results/S04-03.md; 3 files; tsc+eslint clean |
| S04-04 | mini/S04 | dev | S03-01 | 3/6/35/10 | PASS | verified | results/S04-04.md; jobs/tlqueue/calendar; tsc+eslint clean |
| S05 | package/- | - | S04 | n/a | not dispatchable | verified | criterion #1 end to end (date input -> 'yyyy-MM-dd -> validator) |
| S05-01 | mini/S05 | dev | S04-02 | 3/4/100/10 | PASS | verified | results/S05-01.md; qaCleanInteractionDate_ + offqueue branch + test 5/5 |
| S05-02 | mini/S05 | dev | S05-01 | 2/4/40/10 | PASS | verified | results/S05-02.md; dateOnly prop + wiring; tsc+eslint clean |
| S06 | package/- | - | S02-02 | n/a | not dispatchable | verified | page shows+edits headcount record; picklist title-aware |
| S06-01 | mini/S06 | dev | S02-02 | 1/6/90/10 | PASS | verified | results/S06-01.md; 6 headcount cols + title-aware E filter; tsc+eslint clean |
| S06-02 | mini/S06 | dev | S06-01 | 1/6/130/10 | PASS | verified | results/S06-02.md; Lg editor 6 fields; tsc+eslint clean |
| S07 | package/- | - | S01, S02-01 | n/a | not dispatchable | verified | script dry-run clean; live run = approved operator action |
| S07-01 | mini/S07 | data-engineer | S01-01, S01-02, S02-01 | 1/7/160/10 | PASS | verified | results/S07-01.md; script 167 lines; dry-run exit 0 (51 upserts; position=51, code=46, gender=51, contactNumber=45 non-null); REAL RUN NEEDS_APPROVAL |
| S08 | package/- | - | S02, S04 | n/a | not dispatchable | verified | golden suite pins new semantics |
| S08-01 | mini/S08 | test-engineer | S02-02 | 1/5/130/10 | PASS | verified | results/S08-01.md; golden 18/18 green; port-only strips |
| S08-02 | mini/S08 | test-engineer | S04-02, S04-03, S04-04 | 6/5/120/10 | PASS | verified | results/S08-02.md; 6 golden files +position, pin=2/5; 184 tests green |
| S09 | package/- | - | - | n/a | not dispatchable | verified | RESHARD r1 done: vitest gate green minus 4 baseline fails; e2e-2 FAIL is pre-existing suite instability (see gate log) |
| S09-01 | mini/S09 | test-engineer | none | 5/6/160/10 | PASS | verified | results/S09-01.md; 5 files +25/-23, 17 fails -> 0 (208/208 on leaf scope, twice); no prod edits |
| S10 | package/- | - | - | n/a | not dispatchable | verified | EXTEND E1-E3; both children verified; tsc+eslint+targeted vitest green (tl-3) |
| S10-01 | mini/S10 | dev | none | 1/2/6/5 | PASS | verified | results/S10-01.md; refresh.css dq-holform rule only (+1/-1); col2 minmax(12rem,14rem), col3 capped 20rem, max-inline-size:52rem; golden hub-people-holidays 18/18 |
| S10-02 | mini/S10 | dev | none | 5/8/70/10 | PASS | verified | results/S10-02.md; 5 files +27/-65 (92 vs est 70 — mandated CSS-block deletions, in-contract); Reminders = hand-rolled cx-switch (no ui primitive — spec-directed), reduce-* controls+writers gone, media queries kept; tsc+eslint+hub-admin golden 8/8 |

Serial chains (same file): roster.ts S02-01 -> S02-02; pure.ts/server.ts S04-01 -> S04-02 -> S05-01; people-holidays-page.tsx S06-01 -> S06-02.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| (unmapped work) S08 coverage gap | vitest gate: 17 failures in 5 test files not covered by any leaf — tests/golden/desk.test.ts (9), tests/golden/people-jobs.test.ts (4), tests/perf/tph-store.test.ts (1), tests/perf/qa-pushdown.test.ts (2), tests/platform/calendar.test.ts (1). All are intended-semantics drift: fixtures lack `position` (isCxAgent_ now false), select strings/`toEqual` shapes gained position/titleLevel, oracle parity needs the S08-02-style reconciliation. No implementation bug found. | S09-01 (test-engineer; 5 files/6 actions/~160 lines/10 min) | resharded |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| final | typecheck | `npx tsc --noEmit` | PASS (exit 0) — logs/gate-tsc.log |
| final | lint | `npx eslint .` | PASS (0 errors; 2 warnings in unrelated specs/ux-ui-audit-v3 probes) — logs/gate-eslint.log |
| final | unit | `npx vitest run` | FAIL — 21 failed / 1294 passed; 4 are pre-existing baseline failures (tests/perf/audit-queue-memo.test.tsx, verified by stash+rerun); 17 are intended-semantics drift in 5 test files unmapped by the spec — logs/gate-vitest.log |
| final | security | `npm run test:security` | PASS (4/4) — logs/gate-security.log |
| final | e2e | `npm run test:e2e` | running at report time — logs/gate-e2e.log |
| final-r2 | typecheck | `npx tsc --noEmit` | PASS (exit 0) — logs/gate-tsc-2.log |
| final-r2 | lint | `npx eslint .` | PASS (0 errors; same 2 warnings in unrelated specs/ux-ui-audit-v3) — logs/gate-eslint-2.log |
| final-r2 | unit | `npx vitest run` | PASS minus baseline: 4 failed / 1311 passed — only the 4 pre-existing tests/perf/audit-queue-memo.test.tsx baseline fails; the 17 drift fails are gone — logs/gate-vitest-2.log |
| final-r2 | e2e | `npm run test:e2e` | FAIL exit=1: 264 failed / 441 passed / 10 skipped (22.6m, full run). 245/264 in e2e/page-contract.spec.ts ('.page-actions x/y moved' layout-stability on all pages incl. untouched); +19 a11y/toolbar/ui-shell flakes. NOT attributable: S09-01 is test-only; prior run on identical prod code failed worse (611 failed / 104 passed) — logs/gate-e2e-2.log |
| tl-3 | typecheck | `npx tsc --noEmit` | PASS (exit 0) — logs/gate-tsc-3.log |
| tl-3 | lint | `npx eslint <6 edited files>` | PASS exit 0 (0 errors; 1 contract-mandated warning: raw <input> for cx-switch has no ui primitive; 2 file-ignored warnings for .css) — logs/gate-eslint-3.log |
| tl-3 | unit | `npx vitest run tests/golden/hub-people-holidays.test.ts tests/golden/hub-admin.test.ts` | PASS 26/26 (18+8) — logs/gate-vitest-3.log |
| fix-qa-1 | typecheck | `npx tsc --noEmit` | PASS (exit 0) — logs/gate-tsc-4.log |
| fix-qa-1 | lint | `npx eslint <9 touched files>` | PASS (exit 0) — logs/gate-eslint-4.log |
| fix-qa-1 | unit | `npx vitest run tests/golden/{people,queue-tlqueue,people-jobs} tests/platform/{directory-title,calendar} tests/perf/identity-roster` | PASS 108/108 — logs/gate-vitest-4.log |
| fix-data-1 | typecheck | `npx tsc --noEmit` | PASS (no diagnostics; empty log) — logs/gate-tsc-5.log |
| fix-data-1 | lint | `npx eslint <7 touched files>` | PASS (exit 0, no output) — logs/gate-eslint-5.log |
| fix-data-1 | unit | `npx vitest run tests/perf/{tph-write-gate,identity-roster} tests/platform/roster-active tests/golden/{queue-tlqueue,people-jobs,hub-admin,hub-my-day,tph}` | PASS 133/133 (8 files) — logs/gate-vitest-5.log |
| fix-ux-1 | typecheck | `npx tsc --noEmit` | PASS (no diagnostics; empty log) — logs/gate-tsc-6.log |
| fix-ux-1 | lint | `npx eslint src/features/cx-hub/components/people-holidays-page.tsx` | PASS (exit 0, no output) — logs/gate-eslint-6.log |
| fix-ux-1 | unit | `npx vitest run tests/golden/hub-people-holidays.test.ts` | PASS 18/18 — logs/gate-vitest-6.log |

| qa1-01 | mini/fix-qa-1 | dev | none | 4/5/60/10 | PASS | verified | results/qa1-01.md; new lib/title-level.ts + identity re-export + adapters title-keyed; tlqueue+people-jobs 64/64 |
| qa1-02 | mini/fix-qa-1 | dev | none | 2/3/15/5 | PASS | verified | results/qa1-02.md; pwPair_ level gate + kind; people.test 24/24, no fixture change |
| qa1-03 | mini/fix-qa-1 | dev | none | 1/2/5/5 | PASS | verified | results/qa1-03.md; asTlFollowUps_ predicate -> dqTitleLevel_; tsc+eslint clean |
| qa1-04 | mini/fix-qa-1 | dev | none | 1/2/5/5 | PASS | verified | results/qa1-04.md; viewAsAuditors = qaAuditors_ predicate; tsc+eslint clean |
| qa1-05 | mini/fix-qa-1 | dev | none | 1/2/4/5 | PASS | verified | results/qa1-05.md; coachingPage filter -> titleLevel!=='manager'; tsc+eslint clean |
| qa1-06 | mini/fix-qa-1 | dev | none | 2/4/15/8 | PASS | verified | results/qa1-06.md; payload +titleLevel; chair/owner/task-check title-keyed; tsc+eslint clean |
| data1-01 | mini/fix-data-1 | dev | none | 2/3/80/8 | PASS | verified | results/data1-01.md; write.ts gate -> isCxAgent_; new tests/perf/tph-write-gate.test.ts 5/5 |
| data1-02 | mini/fix-data-1 | dev | none | 5/6/80/10 | PASS | verified | results/data1-02.md; 5 sites !== 'false' (adapters/jobs/roster×3/myday); new tests/platform/roster-active.test.ts 3/3; 105 tests green |
| data1-03 | mini/fix-data-1 | supabase-expert | none | 1/3/10/5 | PASS | verified | results/data1-03.md; supabase/migrations/20261112165047_roster_active_not_null.sql (NULL->TRUE backfill + NOT NULL; local-only, applies on merge) |

Serial chains (fix wave): none — all six files-sets disjoint; ran 4+2 parallel.
Serial chains (fix-data-1 wave): none — write.ts+new test / adapters+jobs+roster+myday+new test / migrations dir all disjoint; 3 parallel.

| ux1-01 | mini/fix-ux-1 | dev | none | 1/2/3/5 | PASS | verified | results/ux1-01.md; people-holidays-page.tsx:126 `emp \|\| undefined` (+1/-1); golden 18/18, tsc+eslint clean |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-1 HIGH pwDirectory_ role-keyed | reports/qa-1.md | qa1-01 -> dev | verified | results/qa1-01.md |
| qa-2 HIGH pwPair_ role-keyed | reports/qa-1.md | qa1-02 -> dev | verified | results/qa1-02.md |
| qa-3 MED asTlFollowUps_ role-keyed | reports/qa-1.md | qa1-03 -> dev | verified | results/qa1-03.md |
| qa-4 MED viewAsAuditors diverges | reports/qa-1.md | qa1-04 -> dev | verified | results/qa1-04.md |
| qa-5 MED coaching list access-keyed | reports/qa-1.md | qa1-05 -> dev | verified | results/qa1-05.md |
| qa-6 MED chair/owner access-keyed | reports/qa-1.md | qa1-06 -> dev | verified | results/qa1-06.md |
| qa-7 LOW stray root log file | reports/qa-1.md | dev | deferred | LOW per FIX routing |
| data-1 MED tphCheckAgent_ write gate role-keyed | reports/data-1.md | data1-01 -> dev | verified | results/data1-01.md |
| data-2 MED roster.active NULL predicate diverges | reports/data-1.md | data1-02 -> dev + data1-03 -> supabase-expert | verified | results/data1-02.md; results/data1-03.md |
| data-3 LOW adapters `by` holds synthetic admins | reports/data-1.md | dev | deferred | LOW per FIX routing |
| data-4 LOW legacy tph copies role-keyed | reports/data-1.md | dev | deferred | LOW per FIX routing |
| data-5 LOW dqHctActive_ LWD guard undocumented | reports/data-1.md | data-engineer | deferred | LOW per FIX routing; verify LWD state at approved backfill run |
| ux-1 MED 'Leave unchanged' clears stored status | reports/ux-1.md | ux1-01 -> dev | verified | results/ux1-01.md |
| ux-2 LOW cx-hint auto-places beside Status field | reports/ux-1.md | dev | deferred | LOW per FIX routing |
| ux-3 LOW Mobile input lacks type/inputMode | reports/ux-1.md | dev | deferred | LOW per FIX routing |
| ux-4 LOW cx-switch label cursor on disabled | reports/ux-1.md | dev | deferred | LOW per FIX routing; pre-existing shared quirk |

## Blocked / needs user
- S07-01: script's real (non-dry-run) run writes to the remote DB — worker must build + dry-run only; executing the real backfill needs explicit user approval (00-index note, PLAN conventions). At that run, also confirm none of the 16 Current CX Agents carries an LWD (deferred data-5).
- data1-03 FYI: `20261112165047_roster_active_not_null.sql` is local-only and auto-applies on merge to main (same as S01-01); no remote command was run — merge approval covers it.
