# S05-12: meetings + my-actions — head/card/empty normalization
Kind: mini
ID: S05-12
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=200; minutes=10

## Goal
`meetings-page.tsx` and `my-actions-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-people/components/meetings-page.tsx` | head + meetings sections
- Edit: `src/features/cx-people/components/my-actions-page.tsx` | head + my-actions sections

## Context
- `src/features/cx-people/components/pw.tsx:131-149` | shared `.pw-page` head shell
- `mockups/pages/03-my-day.html:80-105` | worklist/pill reference
- the two page files | current list/form regions

## Contract
- Heads one-line; meetings/actions framed as `.card`/`.workitem` lists;
  statuses → `.pill`/`data-status`; empty branches → `.empty`; `D()`
  kept; no logic changes; do not edit styles/people.css or pw.tsx.

## Actions
1. meetings: head + card framing.
2. meetings: pills + `.empty`.
3. my-actions: head + card framing.
4. my-actions: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-12.md (<=10 lines); TL alone updates TRACKER.md.
