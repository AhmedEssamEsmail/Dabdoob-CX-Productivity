# S04-17: tph — the tph-grid table inside a card
Kind: mini
ID: S04-17
Parent: S04
Owner: dev
Depends: S04-16
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=3; changed_lines=120; minutes=8

## Goal
The big `.tph-grid` table in `tph-grid-page.tsx` sits inside a `.card`
with a `.card-head` (title + hint) matching mock 09's framed-table
presentation — grid internals untouched.

## Files
- Edit: `src/features/cx-productivity/components/tph-grid-page.tsx` | grid wrapper only

## Context
- `mockups/pages/09-tph.html:129-160` | framed table region
- `src/features/cx-productivity/components/tph-grid-page.tsx` | the `.tph-grid` render (keep class + internals)
- `.devin/work/shoot-new.mjs:104-105` | readySel uses `.tph-grid` — must stay

## Contract
- Wrap the existing `.tph-grid` element in `<section className="card">`
  with `.card-head`: `.card-title` (grid caption, `D()`) + `.card-hint`
  (slot/channel summary from real data).
- Grid body keeps `overflow-x` scroll (wrap in `.card` without extra
  padding or with `.card-pad` 0 — grid edge-to-edge like mock).
- `.tph-grid` class + all cell markup/handlers unchanged.

## Actions
1. Wrap `.tph-grid` in `.card` + `.card-head` (title + hint).
2. Ensure horizontal scroll still works inside the card.
3. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Grid renders inside a framed `.card`; `.tph-grid` selector still resolves.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none — tph done.
Write results/S04-17.md (<=10 lines); TL alone updates TRACKER.md.
