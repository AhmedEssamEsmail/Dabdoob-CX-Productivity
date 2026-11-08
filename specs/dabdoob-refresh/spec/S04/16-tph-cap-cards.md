# S04-16: tph — "Team % of cap" mixbar card + "Needs attention" card
Kind: mini
ID: S04-16
Parent: S04
Owner: dev
Depends: S04-15
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=200; minutes=10

## Goal
`tph-grid-page.tsx` gains the mock 09 mid-section: `.card` "Team % of cap
— today by hour" with `.mixbar` + legend (actual vs scheduled vs over-cap)
and `.card` "Needs attention" (`.empty` state + `.spark` trend).

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | mid-section between stats and grid

## Context
- `mockups/pages/09-tph.html:84-128` | the two cards
- `src/features/cx-productivity/components/tph-grid-page.tsx` | hourly cap data + attention/over-cap data
- `mockups/assets/mock.css:336-350` | .mixbar/.spark

## Contract
- "Team % of cap — today by hour" `.card`: `.card-head` (title +
  `card-hint` cap explanation), `.card-pad` `.mixbar` hourly segments
  (accent actual / line-2 scheduled-estimate / bad over-cap — real hourly
  data) + `.mixbar-legend` with the three swatches.
- "Needs attention" `.card`: `.card-head` (title + `card-hint` today),
  `.empty` (icon + `.t` + `.s`) when nothing needs attention, else the
  real attention list; `.card-pad` border-top `.spark` hourly trend.
- `D()` strings; real data only.

## Actions
1. Build the cap `.card` with hourly `.mixbar` + legend.
2. Build the attention `.card` (`.empty` default + `.spark` strip).
3. Remove superseded markup for these summaries.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Both cards match mock 09; mixbar legend reads actual/scheduled/over-cap.
- `.empty` renders when nothing needs attention.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-17 wraps the tph-grid table in a card.
Write results/S04-16.md (<=10 lines); TL alone updates TRACKER.md.
