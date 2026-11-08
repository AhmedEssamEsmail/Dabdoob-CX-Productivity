# S04-15: tph — head + warn note + 5-stat row
Kind: mini
ID: S04-15
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=180; minutes=10

## Goal
Top of `tph-grid-page.tsx` matches mock 09: `.page-head` (title "TPH and
caps" + sub + the real day-picker/aside controls), a `.note.warn` banner,
and `.grid.grid-5` `.stat` cards (team TPH, cases coverage, agents on
grid, over-cap, call time).

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | head + note + stats region

## Context
- `mockups/pages/09-tph.html:49-81` | topbar note + head + 5 stats
- `src/features/cx-productivity/components/tph-grid-page.tsx:383` | `Ja` day picker — the real head-aside control
- `src/features/cx-productivity/components/tph-grid-page.tsx` | current summary/banner regions (large file — only this region)

## Contract
- Head → `.page-head` + `.page-sub` + `.page-actions` holding the real
  `Ja` day picker + any refresh control; `.topbar`-style `small.faint`
  build-time note optional (mock shows "Last build …" — render from real
  refresh_log data already on the page).
- `.note.warn.mb-3` banner = the page's real warning state (stale build /
  missing coverage); render only when that condition is true.
- `.grid.grid-5` `.stat` cards mapped to real aggregates: Team TPH excl.
  calls, Cases coverage (on-grid slots), Agents on grid, Over cap
  (`data-tone="warn"`), Call time (estimate note).
- `D()` labels; keep `.cxp`, `.tph-grid` hooks for later leaves.

## Actions
1. Restructure head to `.page-head` + actions (keep `Ja` picker).
2. Render `.note.warn` from the real warning condition.
3. Build the `.grid.grid-5` `.stat` row from real aggregates.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + note + 5 stats match mock 09 with real data.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-16 continues (cap mixbar + attention cards); S04-17 wraps the grid.
Write results/S04-15.md (<=10 lines); TL alone updates TRACKER.md.
