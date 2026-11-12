# TL report 1 — headcount-access-split (BUILD)

## Outcome
All 15 mapped leaves completed and verified; every package S01–S08 done.
**RESHARD_NEEDED**: the `npx vitest run` gate exposed 17 failures in 5 test files
the spec did not map to any leaf (details below). Not an implementation bug —
the failures are intended-semantics drift (fixtures without `position`, select
strings/`toEqual` that gained `position`/`titleLevel`, oracle parity needing the
S08-02-style reconciliation).

## Changed files (all leaf-scoped)
- New: `supabase/migrations/20261112142701_headcount_access_split.sql`,
  `scripts/ops/backfill-hct-headcount.mts`, `tests/platform/directory-title.test.ts`,
  `tests/quality/qa-interaction-date.test.ts`
- src: `identity.ts`, `mappings/hct.ts`, `roster.ts`, `pure.ts`,
  `cx-quality/lib/server.ts`, `one-on-ones-page.ts`, `tph/page.ts`, `kpilogs.ts`,
  `jobs.ts`, `tlqueue.ts`, `calendar.ts`, `people-holidays-page.tsx`,
  `qa-shared.tsx`, `audit-queue-coverage.tsx`
- tests: `hub-people-holidays.test.ts` + 6 golden files (S08-02),
  `tests/perf/identity-roster.test.ts` (one-line fix)
- Leaf results: `specs/headcount-access-split/results/*.md`; tracker: `TRACKER.md`

## Gates (run at final integration; logs under specs/headcount-access-split/logs/)
- `npx tsc --noEmit` — PASS
- `npx eslint .` — PASS (0 errors; 2 warnings in unrelated specs/ux-ui-audit-v3)
- `npm run test:security` — PASS (4/4)
- `npx vitest run` — **FAIL**: 21 failed / 1294 passed. 4 are PRE-EXISTING
  (tests/perf/audit-queue-memo.test.tsx fails identically on baseline — verified
  via stash + rerun). The other 17 are the unmapped test-file drift below.
- `npm run test:e2e` — still running at report time (715 tests, page-contract);
  full output in logs/gate-e2e.log.

## RESHARD_NEEDED — unmapped test reconciliation (~150 lines est.)
| File | Fails | Cause |
|---|---|---|
| tests/golden/desk.test.ts | 9 | kpiLogSave/kpiLogsPage fixtures lack `position` → `isCxAgent_` false → 'Choose the agent.' / empty agent list (intended #6) |
| tests/golden/people-jobs.test.ts | 4 | calendar `isTl`/`wcState` title-driven shifts vs oracle (intended #5) |
| tests/perf/tph-store.test.ts | 1 | `dir.by` person `toEqual` gained `position`/`titleLevel` |
| tests/perf/qa-pushdown.test.ts | 2 | people map/read shapes gained `position` |
| tests/platform/calendar.test.ts | 1 | roster select string now includes `position` |

Suggested leaf: test-engineer, same pattern as S08-02 (fixtures get
role-consistent `position`; assertions updated; no expectation weakening).
Baseline-passing files that S08-02 already swept stay untouched.

## Blocked / needs user
- **NEEDS_APPROVAL**: real (non-dry-run) run of
  `scripts/ops/backfill-hct-headcount.mts` writes remote `dq_hct` + `roster`
  (dry-run verified: 51 upserts; position=51, code=46, gender=51,
  contactNumber=45 non-null). Migration applies to remote on merge to main.
- Noted: `specs/fd-direct-mirrors/` (untracked) appeared during the build — not
  from this orchestration; left untouched. Stray `nul` redirect artifact removed.
