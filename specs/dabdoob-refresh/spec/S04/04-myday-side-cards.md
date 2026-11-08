# S04-04: my-day — "Waiting on you" worklist + "Focus blocks" cards
Kind: mini
ID: S04-04
Parent: S04
Owner: dev
Depends: S04-03
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=180; minutes=10

## Goal
The my-day side column matches mock 03: `.card` "Waiting on you" as a
`.worklist`, and `.card` "Focus blocks" with pill-marked blocks.

## Files
- Edit: `src/features/cx-hub/components/my-day-page.tsx` | side-column region

## Context
- `mockups/pages/03-my-day.html:80-105` | the two cards
- `src/features/cx-hub/components/my-day-page.tsx` | existing waiting/followups + focus-block data

## Contract
- Arrange main column (timeline from S04-03) + this side column in a
  two-col layout like the mock (`1.7fr 1fr`-ish; reuse `.md` or a grid
  wrapper consistent with S04-02's choice).
- "Waiting on you" `.card`: `.card-head` (title + `card-hint`
  `D('From other people')`) + `.worklist` of real pending items (mail
  waiting, followups) — `.workitem` with `.wi-ico`, `.wi-t`, `.wi-s`,
  `.wi-side`.
- "Focus blocks" `.card`: `.card-head` (title + `card-hint` count), rows
  = `.flex`/`between` time-range text + `.pill` (`acc` when current,
  neutral otherwise); booking control stays a `.btn`.
- `D()` all labels; `.empty` inside cards when a list is empty.

## Actions
1. Wrap the two-column layout around timeline + side cards.
2. Restyle waiting-on-you items as `.workitem` rows.
3. Restyle focus blocks with `.pill` markers.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Side column matches mock 03 (two cards, worklist + pills).
- Real data only; `.empty` where lists are empty.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — my-day done.
Write results/S04-04.md (<=10 lines); TL alone updates TRACKER.md.
