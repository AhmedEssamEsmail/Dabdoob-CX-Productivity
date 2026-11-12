# TL report 2 — headcount-access-split (BUILD)

## Outcome
RESHARD r1 leaf **S09-01 done**: test-engineer reconciled the 5 drifted test
files from reports/tl-1.md. 17 failures -> 0 (`npx vitest run` on the 5 files:
208/208 pass, run twice). Fixtures gained role-consistent verbatim `position`
titles per the S08-02 convention; `toEqual`/select assertions pin the new
emitted shape exactly — no assertion weakened, zero production-code edits.
S09 package: all children done.

## Changed files (this round; all leaf-scoped)
- tests/golden/desk.test.ts (+9/-9 fixture positions)
- tests/golden/people-jobs.test.ts (shorthand positions -> verbatim titles)
- tests/perf/tph-store.test.ts (fixture positions; `dir.by` toEqual +position)
- tests/perf/qa-pushdown.test.ts (seed() roster positions)
- tests/platform/calendar.test.ts (stub position; select string pinned)
- Scope check: `git diff --stat` on the 5 files = +25/-23 (budget 160). No
  other files touched by this assignment; results/S09-01.md.

## Gates (final-r2; logs under specs/headcount-access-split/logs/)
- `npx tsc --noEmit` — PASS (exit 0) — gate-tsc-2.log
- `npx eslint .` — PASS (0 errors; same 2 warnings in unrelated
  specs/ux-ui-audit-v3 probe files) — gate-eslint-2.log
- `npx vitest run` — PASS minus baseline: 4 failed / 1311 passed. The only
  failures are the 4 PRE-EXISTING baseline fails in
  tests/perf/audit-queue-memo.test.tsx (TableScroll mock; verified failing on
  baseline in r1). All 17 drift fails reconciled — gate-vitest-2.log
- `npm run test:e2e` — **FAIL exit=1**: 264 failed / 441 passed / 10 skipped
  (22.6m, full run to completion). Breakdown: 245/264 in
  e2e/page-contract.spec.ts ('.page-actions x/y moved' layout-stability on
  every page incl. routes untouched by this spec); +19 scattered a11y /
  toolbar-stability / ui-shell-polish / auth / my-status fails. NOT
  attributable to S09-01 (test-only diff, +25/-23) — the prior run on the
  SAME production code failed worse: 611 failed / 104 passed (gate-e2e.log).
  Verdict: pre-existing e2e suite instability (dev-mode render jitter +
  ERR_STREAM_DESTROYED webserver noise), outside this spec's scope — flag to
  PM for a separate investigation; no leaf change can fix it — gate-e2e-2.log

## Blocked / needs user (unchanged from tl-1)
- **NEEDS_APPROVAL**: real (non-dry-run) run of
  scripts/ops/backfill-hct-headcount.mts writes remote dq_hct + roster.
  Migration applies to remote on merge to main.
