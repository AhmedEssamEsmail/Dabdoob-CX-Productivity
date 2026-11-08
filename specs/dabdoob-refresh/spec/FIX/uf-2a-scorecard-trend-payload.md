# FUX-11: scorecard page payload — per-agent 8-bucket trend + prior-period team score
Kind: mini
ID: FUX-11
Parent: FIX-UF
Owner: dev
Depends: none
Criteria: reports/user-fix-round.md UF-2 (HIGH) — TREND-8W + Team-KPI delta, real data only
Skills: none
Budget: files=3; actions=4; changed_lines=140; minutes=9

## Goal
The agents page needs the mockup's "Trend · 8w" spark column and a delta chip
on "Team KPI score", built ONLY from data already loaded. `scIo_` already
prefetches every `sc_daily` / `sc_behaviour` row, so per-agent day rows and a
prior-window aggregate cost ZERO new queries/endpoints. Expose
`agents[i].trend: (number|null)[]` (8 equal-width time buckets over
[from,to], each = mean of that agent's per-day `overall` KPI score) and
top-level `prevTeam: number|null` (mean `overall` of scored agents over the
immediately preceding window of equal length) from `getScorecardPage`.

## Files
- Edit: `src/features/cx-people/lib/scorecard/index.ts` | add exported pure `scTrend_` helper next to `scDayRows_` (~L364-395)
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | `getScorecardPage` only (~L302-318): attach `trend` to each visible row, add `prevTeam` to the response
- Edit: `tests/golden/scorecard.test.ts` | add a focused `scTrend_` describe block (same fixture style as the existing `scDayRows_`/`scAggregate_` tests)

## Context
- `src/features/cx-people/lib/scorecard/index.ts:364-395` | `scDayRows_(daily, cases, bhvFound, email, kctx)` returns per-agent day rows `{ date, overall, … }` newest-first — reuse it for the series
- `src/features/cx-people/lib/scorecard-server.ts:302-318` | `getScorecardPage`: `io`, `d` (scLoad_ result: `d.daily`, `d.cases`, `d.bhvFound`, `d.views`), `kctx`, `rows` (post `scVisible_`) all already in scope
- `src/features/cx-people/lib/scorecard-server.ts:221-243` | `scIo_` `readRange(name, from, to)` filters the PREFETCHED tables — calling it for the prior window is in-memory, not a query
- `src/features/cx-people/lib/scorecard/index.ts:401-429` | `scAggregate_(daily, cases, bhvFound, who, kctx)` -> rows with `.overall`
- `mockups/pages/08-agents.html:78` | column contract "Trend · 8w" (8 bars)

## Contract
- `scTrend_(daily, cases, bhvFound, email, kctx, from, to)` ->
  `(number|null)[8]`, oldest->newest. Bucket index =
  `min(7, floor((date - from) / spanDays * 8))` where
  `spanDays = (to - from)/864e5 + 1`; bucket value = mean of the bucket's
  non-null per-day `overall` (from `scDayRows_`), rounded to 0.1; `null`
  when the bucket has no scored days. Pure function, no IO.
- In `getScorecardPage`: after `rows` is built, set
  `r.trend = scTrend_(d.daily, d.cases, d.bhvFound, r.email, kctx, range.from, range.to)`
  for each row (visible agents only).
- `prevTeam`: prior window `pt = addDays(from, -1)`, `pf = addDays(from, -spanDays)`,
  then `scAggregate_(io.readRange('sc_daily', pf, pt), scCasesInRange_(io.readRange('sc_behaviour', pf, pt), pf, pt), d.bhvFound, scWho_(dir), kctx)`;
  `prevTeam` = mean `overall` over scored (typeof number) rows rounded 0.1,
  `null` when none. Reuse `dqAddDays_`/date helpers already imported in the
  server file (check its imports; `addDays`-equivalent exists for the cron
  code — use what the file already has, add no new util).
- Response shape additions only: `agents[i].trend`, `prevTeam`. NO changes to
  `scIo_`, endpoints, queries, caches or other views (detail/admin).
- Out of scope: agents-page.tsx rendering (FUX-12), behaviour/scoring logic,
  `scLoad_` internals.

## Actions
1. Implement `scTrend_` in scorecard/index.ts per the contract (reuse
   `scDayRows_`; sort/bucket oldest->newest).
2. In `getScorecardPage` attach `trend` per visible row and compute
   `prevTeam` per the contract.
3. Add `scTrend_` tests in tests/golden/scorecard.test.ts: fabricated
   `sc_daily` rows for one email spanning a range -> assert 8-length output,
   per-bucket means, `null` for empty buckets, oldest->newest order.
4. `npx vitest run tests/golden/scorecard.test.ts` + `npx tsc --noEmit` clean.

## Done when
- `scTrend_` exported and returns `(number|null)[8]` per the bucketing rule.
- `getScorecardPage` response includes `trend` on each `agents[]` row and a
  top-level `prevTeam` (number|null); no other view's shape changes.
- New test block passes; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/golden/scorecard.test.ts` -> all pass incl. new `scTrend_` cases
- Run: `npx tsc --noEmit` -> clean

## Handoff
`data.agents[i].trend` (8 buckets, may contain nulls) and `data.prevTeam`
(number|null) are available for FUX-12's spark column and delta chip.
Write results/FUX-11.md (<=10 lines); TL alone updates TRACKER.md.
