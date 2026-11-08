# S05-13: notes + coaching — head/card/empty normalization
Kind: mini
ID: S05-13
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`notes-page.tsx` and `coaching-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-people/components/notes-page.tsx` | head + notes sections
- Edit: `src/features/cx-people/components/coaching-page.tsx` | head + coaching sections

## Context
- `src/features/cx-people/components/pw.tsx:131-149` | shared `.pw-page` head shell
- the two page files | current list/form regions

## Contract
- Heads one-line; notes/coaching entries framed as `.card`/`.workitem`;
  statuses → `.pill`/`data-status`; empty branches → `.empty`; `D()`
  kept; no logic changes; do not edit styles/people.css or pw.tsx.

## Actions
1. notes: head + card framing.
2. notes: pills + `.empty`.
3. coaching: head + card framing.
4. coaching: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-13.md (<=10 lines); TL alone updates TRACKER.md.
