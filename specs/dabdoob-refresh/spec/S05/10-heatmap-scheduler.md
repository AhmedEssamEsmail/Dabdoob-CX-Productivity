# S05-10: heatmap + scheduler — head/card/empty normalization
Kind: mini
ID: S05-10
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`heatmap-page.tsx` and `scheduler-page.tsx` take the shared patterns —
heads + framed content only; the heat grid and calendar internals stay.

## Files
- Edit: `src/features/cx-queue/components/heatmap-page.tsx` | head + heatmap grid framing
- Edit: `src/features/cx-queue/components/scheduler-page.tsx` | head + scheduler calendar framing

## Context
- `src/features/cx-queue/components/heatmap-page.tsx:1020-1023` | `.page-head hm-head` block
- `src/features/cx-queue/components/scheduler-page.tsx:1020-1025` | `.page-head sch-head` block
- `mockups/pages/09-tph.html` | framed dense-grid reference

## Contract
- Heads one-line; wrap the heat grid / calendar in `.card` (+ `.card-head`
  title/hint); statuses → `.pill`; empty branches → `.empty`; `D()` kept;
  no logic changes; do not edit styles/queue.css; keep `.hm-*`/`.sch-*`
  classes (internal grid markup unchanged — wrap, don't rebuild).

## Actions
1. heatmap: head + `.card` wrap of the grid.
2. heatmap: `.empty` branches.
3. scheduler: head + `.card` wrap of the calendar.
4. scheduler: `.empty` branches.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; grids intact; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-10.md (<=10 lines); TL alone updates TRACKER.md.
