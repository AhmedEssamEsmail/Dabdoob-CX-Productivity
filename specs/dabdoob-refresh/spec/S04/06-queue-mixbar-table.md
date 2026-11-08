# S04-06: queue — age mixbar card + by-queue table card
Kind: mini
ID: S04-06
Parent: S04
Owner: dev
Depends: S04-05
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=220; minutes=10

## Goal
Body of `queue-page.tsx` matches mock 04: `.card` "Open tickets by age"
with `.mixbar` + legend (click a band to filter), then `.card` "By queue"
with a `.tbl` of per-queue rows + `.pill` status.

## Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | body below the stat row

## Context
- `mockups/pages/04-queue-health.html:82-150` | mixbar card + by-queue table card
- `src/features/cx-queue/components/queue-page.tsx` | existing age-band + per-queue data and any band filtering
- `mockups/assets/mock.css:317-341` | .tbl/.mixbar anatomy

## Contract
- "Open tickets by age" `.card`: `.card-head` (title + `card-hint` count +
  filter affordance), `.card-pad` `.mixbar` whose segments are the real
  age bands (`--cx-age-*` colors, clickable -> selects the band exactly as
  the existing filter does) + `.mixbar-legend`.
- "By queue" `.card`: `.card-head` (title + `card-hint` + `.pill.warn`
  when a queue breaches threshold), `.tbl` rows: queue name (`.lead`),
  counts `.num`, oldest-age cell, `.pill` status (`ok` clear / `warn` /
  `bad` per the page's real thresholds).
- Keep existing row actions (open ticket links) — `.rowlink`.
- `D()` strings; band-filter state unchanged (visual only).

## Actions
1. Wrap age distribution in the mixbar `.card` (segments + legend, band click = existing filter).
2. Wrap per-queue rows in the `.tbl` `.card` with `.num`/`.pill` cells.
3. Wire the `.pill.warn` head badge to the real "needs help" condition.
4. Remove superseded markup.
5. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Both cards match mock 04; band click still filters.
- `.tbl` uses `.num`/`.pill`/`lead`/`rowlink` cells.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — queue done.
Write results/S04-06.md (<=10 lines); TL alone updates TRACKER.md.
