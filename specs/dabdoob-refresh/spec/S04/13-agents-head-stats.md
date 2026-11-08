# S04-13: agents — head + 4-stat row
Kind: mini
ID: S04-13
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=170; minutes=10

## Goal
Top of `agents-page.tsx` matches mock 08: `.page-head` (title Agent
performance + sub + real controls) and `.grid.grid-4` of `.stat` cards —
team KPI score, agents at/above band, below-band, data coverage.

## Files
- Edit: `src/features/cx-people/components/agents-page.tsx` | head + stats region

## Context
- `mockups/pages/08-agents.html:45-64` | head + 4 stats
- `src/features/cx-people/components/agents-page.tsx` | current head + summary aggregates (scorecard data)

## Contract
- Head → `.page-head` pattern; keep the page's real period/workbook
  controls in `.page-actions` (`.topbar-right`-style `small.faint`
  read-time note allowed — mock shows one).
- `.grid.grid-4` `.stat` cards: team KPI score (`.delta` vs prev month if
  fetched), agents at/above 95 (`data-tone="ok"`), below-75 band
  (`data-tone="warn"`), data coverage % — all from the page's real
  aggregates; drop a slot without data.
- `D()` labels; `.cxp`/`aria-busy` root untouched.

## Actions
1. Restructure head to `.page-head` + actions (+ read-time note).
2. Build the `.grid.grid-4` `.stat` row from real aggregates.
3. Remove superseded summary markup.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + 4 `.stat` cards match mock 08 with real numbers.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-14 continues this file (roster table card).
Write results/S04-13.md (<=10 lines); TL alone updates TRACKER.md.
