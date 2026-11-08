# S04-02: overview — "Needs you" worklist + queues/team-pulse side cards
Kind: mini
ID: S04-02
Parent: S04
Owner: dev
Depends: S04-01
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=260; minutes=10

## Goal
The main body of `overview-page.tsx` matches mock 02: a 1.7fr/1fr grid —
left `.card` "Needs you today" `.worklist`, right column "Queues right
now" `.bar` rows and "Team pulse" `.hbar-row` card.

## Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | body grid below the stat row

## Context
- `mockups/pages/02-home.html:114-183` | worklist card + two right-column cards
- `mockups/assets/mock.css:358-382,336-356` | .workitem/.wi-*/.bar/.hbar-row anatomy
- `src/features/cx-hub/components/overview-page.tsx:53-176` | existing `Sg`, `_u` (row lists), `bg` (cards) helpers to restyle
- `src/features/cx-queue/components/shared.tsx` | queue-format helpers if reused

## Contract
- Outer two-col grid (mock `1.7fr 1fr`; use inline style or `.grid` +
  style, collapse ≤900px — add a `.ov-main` rule only if strictly needed,
  else reuse `.md`-style split already in refresh.css).
- Left `.card`: `.card-head` (`card-title` `D('Needs you today')` +
  `card-hint`) + `.worklist` of `.workitem` rows — `.wi-ico` tone variant,
  `.wi-main .wi-t/.wi-s`, `.wi-side .t/.s`; rows link to their real pages
  (existing `_u` links/hrefs).
- Right column `.grid`: `.card` "Queues right now" — `.between.small`
  queue name + `num` summary + `.bar` (+`.warn/.bad` tone) per queue from
  real snapshot data; `.card` "Team pulse" — `.hbar-row` rows (label,
  `.bar` + tone, `b.num.small`).
- Keep `D()`, real data only, drop empty sections to `.empty` inside the
  card where mock shows none.

## Actions
1. Wrap the two-col body grid.
2. Needs-you `.card` + `.worklist` rows from existing list data.
3. Queues-right-now `.card` with `.bar` rows.
4. Team-pulse `.card` with `.hbar-row` rows.
5. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Body matches mock 02 layout (worklist + 2 side cards) with real data.
- Empty states use `.empty`, no bare text blocks.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — overview page done.
Write results/S04-02.md (<=10 lines); TL alone updates TRACKER.md.
