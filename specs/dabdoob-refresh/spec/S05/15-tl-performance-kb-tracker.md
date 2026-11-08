# S05-15: tl-performance + kb-tracker — head/card/empty normalization
Kind: mini
ID: S05-15
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`tl-performance-page.tsx` and `kb-tracker-page.tsx` take the shared
patterns.

## Files
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | head + tl-performance sections
- Edit: `src/features/cx-desk/components/kb-tracker-page.tsx` | head + kb-tracker sections

## Context
- `tl-performance-page.tsx:190-194`, `kb-tracker-page.tsx:143-147` | `.page-head`/`route.purpose` subs
- `mockups/pages/08-agents.html` | card-framed table reference

## Contract
- Heads one-line (purpose text trimmed to one line if it wraps); tables/
  lists framed as `.card`; statuses → `.pill`; empty branches → `.empty`;
  `D()` kept; no logic changes; do not edit styles/desk.css.

## Actions
1. tl-performance: head + card framing.
2. tl-performance: pills + `.empty`.
3. kb-tracker: head + card framing.
4. kb-tracker: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-15.md (<=10 lines); TL alone updates TRACKER.md.
