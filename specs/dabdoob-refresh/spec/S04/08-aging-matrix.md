# S04-08: aging — queue×age matrix table card + source footnote
Kind: mini
ID: S04-08
Parent: S04
Owner: dev
Depends: S04-07
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=200; minutes=10

## Goal
Bottom of `aging-page.tsx` matches mock 05: `.card` "By queue × age" —
`.tbl` matrix whose cells are count chips by age band (click = list the
band's tickets), plus the `.card-pad.small.faint` source footnote.

## Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | matrix + footnote region

## Context
- `mockups/pages/05-aging-cases.html:83-104` | matrix card + footnote
- `src/features/cx-queue/components/aging-page.tsx` | existing matrix data + ticket-list drill
- `mockups/assets/mock.css:306-314,355-356` | .agechip tones + .heat cell reference

## Contract
- `.card` with `.card-head`: `.card-title` `By queue × age` + `card-hint`
  (select a cell to list tickets) + `.pill.bad` showing the real >10d
  count when > 0.
- `.tbl` (may need `min-width` for many columns, mock uses 64rem): rows =
  queues (`.lead` name), cells = per-age counts rendered as age-colored
  chips/cells (`--cx-age-*` bg + `--cx-age-ink-*` text — reuse `.agechip`
  classes from refresh.css or existing `.cx-agechip`), zero cells dim.
- Cell click keeps the EXISTING drill behavior (lists that band's
  tickets) — visual reskin only.
- Footnote `.card-pad.small.faint`: real source list from the page's data.

## Actions
1. Wrap matrix in `.card` + `.card-head` w/ `.pill.bad` count.
2. Restyle matrix cells to age chips (`.agechip`/`.cx-agechip` tones).
3. Add the `.small.faint` source footnote.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Matrix card matches mock 05; cell drill still works.
- `.pill.bad` shows the real >10d count (or absent when 0).
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — aging done.
Write results/S04-08.md (<=10 lines); TL alone updates TRACKER.md.
