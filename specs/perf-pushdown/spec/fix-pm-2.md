# fix-pm-2: PM finding — user-approved fix (reports/pm-2.md, 2026-11-11)
Source: `specs/perf-pushdown/reports/pm-2.md`. One user-approved blocking item:
remove the deliberately preserved `eval('from')` ReferenceError in the admin
`full=true` hist path so `/api/prod/analytics` returns 200 with populated
`calibration` instead of 500ing on the first hist row.

## pm2-01: remove preserved eval('from'); hist filtered by weeks[0] lower bound
Kind: mini
ID: pm2-01
Parent: S06
Owner: dev
Depends: none
Criteria: pm-2.md F3 (blocking; user approved fixing, parity waived here)
Skills: none
Budget: files=3; actions=4; changed_lines=60; minutes=8

### Goal
`prodAnalytics_` with `full=true` populates `out.calibration` instead of
throwing the preserved legacy ReferenceError. `eval`/`eval('from')` at
`src/features/cx-productivity/lib/prod/analytics.ts:290-296` is removed; hist
rows are filtered by `inp.weeks[0]` — the resolved lower window bound the
function already uses (rows before it are skipped, matching the legacy guard's
intent; the bound is always present because `weeks` is a required input).

### Files
- Edit: `src/features/cx-productivity/lib/prod/analytics.ts` | the `inp.hist.forEach` guard + its comment (:289-296) only
- Edit: `tests/golden/prod-validation.test.ts` | the `full=true` case (:543-568): port no longer throws; assert populated `calibration` + lower-bound filter
- Edit: `tests/perf/prod-analytics.test.ts` | TABLES `prod_window_hist` gains one in-window hist row so the admin GET exercises the path

### Context
- `src/features/cx-productivity/lib/prod/analytics.ts:284-307` | the `inp.full` block; `inp.weeks` = `[week-21, week-14, week-7, week]`
- `src/features/cx-productivity/lib/prod/engine.ts:745-749` | `from = weeks[0]` — the same lower bound `prodAnalyticsFor_` uses for intervals/flags/layers
- `src/app/api/prod/analytics/route.ts:52-55,71-75` | route already bounds `prod_window_hist` with gte(weeksFrom)/lte(to); the in-function guard is the backstop
- `tests/golden/prod-validation.test.ts:543-568` | asserts BOTH legacy and port throw /from is not defined/ — must flip the port side to the fixed contract; legacy oracle still errs (expected, unchanged)
- `tests/perf/prod-analytics.test.ts:90-132` | TABLES/seed; a hist row with date >= weeks[0] (i.e. >= WEEK-21) survives the new filter

### Contract
Remove `eval`/`eval('from')` entirely. The guard becomes: skip a hist row when
`String(r.date) < inp.weeks[0]`; the `!hist[String(r.class)]` half stays. Rewrite
the `BUG PRESERVED VERBATIM` comment to state the bug is FIXED per user approval
(cite ProdValidation.js:541 history in one line, no "PRESERVED"). Byte-parity
for the rest of the function — only the ReferenceError reproduction goes away.
Out of scope: route.ts, engine.ts, any other test file, any other function.

### Actions
1. In analytics.ts replace the eval guard with `String(r.date) < inp.weeks[0]`, delete `eval`, rewrite the comment (fixed, not preserved).
2. Update golden test :543-568: keep `expect(legacy.err).toMatch(/from is not defined/)`; change port side to expect `ok` with `calibration.idle` populated — use an in-window row (date >= '2026-10-04', e.g. '2026-10-10') plus keep/add a pre-window row ('2026-10-01') that is skipped.
3. In prod-analytics.test.ts add one in-window hist row to `TABLES.prod_window_hist` (date >= WEEK-21) so the admin GET returns populated `calibration`; assert `body.calibration.idle` (or working) non-empty in the first test.
4. `npx tsc --noEmit`; `npx vitest run tests/golden/prod-validation.test.ts tests/perf/prod-analytics.test.ts` — all green; record output in results.

### Done when
- no `eval` remains in analytics.ts; `full=true` produces `calibration` instead of throwing
- both targeted vitest files green; tsc 0 errors
- results file records evidence: a `full=true` GET returns 200 with populated `calibration` (test assertion output)

### Verify
- Run: `npx vitest run tests/golden/prod-validation.test.ts tests/perf/prod-analytics.test.ts` -> all green; `npx tsc --noEmit` -> 0 errors; `grep -n "eval" src/features/cx-productivity/lib/prod/analytics.ts` -> no hits

### Handoff
`/api/prod/analytics` `full=true` (admin) path no longer 500s on hist rows;
PM/perf gate can re-time the endpoint expecting 200 + populated calibration.
Write results/pm2-01.md (<=10 lines); TL alone updates TRACKER.md.
