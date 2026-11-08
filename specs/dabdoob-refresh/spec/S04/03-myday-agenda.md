# S04-03: my-day — head + Today/Week seg + agenda timeline card
Kind: mini
ID: S04-03
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=200; minutes=10

## Goal
Top of `my-day-page.tsx` matches mock 03: `.page-head` (+`.page-sub`),
the Today/Week `.seg` control, and a "Timeline" `.card` whose rows are
`.agenda > .ag-row > .ag-t + .ag-item`.

## Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | head + timeline region

## Context
- `mockups/pages/03-my-day.html:54-75` | seg + agenda timeline
- `src/features/cx-hub/components/my-day-page.tsx:664` | current `.page-head md-head` block
- `src/features/cx-hub/components/my-day-page.tsx` | existing day-parts data (check-ins, meetings, deadlines)

## Contract
- Keep `md-head`/existing head element but align it to `.page-head`
  semantics (title + one-line `.page-sub`); keep the page's real period
  control — restyle it as `.seg` (Today/Week or the real range options,
  `D()` labels).
- "Timeline" `.card`: `.card-head` (`card-title` `D('Timeline')` +
  `card-hint` with Kuwait-time note), `.card-pad.agenda` containing
  `.ag-row` per scheduled item: `.ag-t` time + `.ag-item` `.t`/`.s`; the
  in-progress/current slot gets `.ag-item.now`.
- Items come from real my-day parts only (check-ins, meetings, deadlines,
  focus blocks); no fabricated rows.

## Actions
1. Align head to `.page-head` pattern + `.seg` period control.
2. Build the Timeline `.card` + `.agenda` rows from real schedule data.
3. Remove the old markup this replaces (folds/lists superseded by the card).
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + seg + agenda timeline match mock 03 with real items.
- `.ag-item.now` marks the current slot when one exists.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-04 continues the page's right column.
Write results/S04-03.md (<=10 lines); TL alone updates TRACKER.md.
