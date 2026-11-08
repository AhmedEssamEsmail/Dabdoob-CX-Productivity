# S04-07: aging — head + scope seg + wait-time mixbar card
Kind: mini
ID: S04-07
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=160; minutes=10

## Goal
Top of `aging-page.tsx` matches mock 05: `.page-head`, the scope `.seg`
(All / Ours / Unassigned — the page's real filter), and `.card`
"Wait-time distribution" with `.mixbar` + legend that filters the matrix.

## Files
- Edit: `src/features/cx-queue/components/aging-page.tsx` | head + distribution region

## Context
- `mockups/pages/05-aging-cases.html:49-71` | head + seg + mixbar card
- `src/features/cx-queue/components/aging-page.tsx` | current head, scope control, band data
- `mockups/assets/mock.css:336-341` | .mixbar + legend

## Contract
- Head: `.page-head` (or shared dq-head post-reskin) — title + one-line
  sub; the page's scope filter becomes/renders as `.seg` with `D()` labels
  (All/Ours/Unassigned per real options).
- `.card.mb-3` "Wait-time distribution": `.card-head` (title + `card-hint`
  = select-a-band instruction), `.card-pad` `.mixbar` segments = real age
  bands (`--cx-age-*`), `.mixbar-legend` below; selecting a band drives
  the EXISTING matrix filter (visual re-skin of current behavior).

## Actions
1. Align head + restyle scope control to `.seg`.
2. Wrap distribution in `.card` + `.card-head`/`card-hint`.
3. Render `.mixbar` + legend from real band counts; keep band-select wiring.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head/seg/mixbar match mock 05 with real bands.
- Band selection still filters the matrix.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-08 finishes the page (matrix + footnote).
Write results/S04-07.md (<=10 lines); TL alone updates TRACKER.md.
