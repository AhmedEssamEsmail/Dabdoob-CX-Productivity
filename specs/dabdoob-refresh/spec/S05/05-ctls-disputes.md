# S05-05: ctls + disputes — head/card/empty normalization
Kind: mini
ID: S05-05
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`ctls-page.tsx` and `disputes-page.tsx` take the shared patterns:
one-line heads, `.card` lists/forms, `.pill` statuses, `.empty` branches.

## Files
- Edit: `src/features/cx-quality/components/ctls-page.tsx` | head + CTL list sections
- Edit: `src/features/cx-quality/components/disputes-page.tsx` | head + dispute list + form sections

## Context
- `mockups/pages/06-audit-desk.html` | list + detail card reference
- the two page files | current heads + CTL/dispute list + form regions

## Contract
- Heads one-line; CTL/dispute rows framed as `.card` lists or `.tbl`;
  statuses → `.pill`/`data-status` (acknowledged/dispute/escalated tones
  already map to status tokens); empty branches → `.empty`; `D()` kept;
  no logic changes; do not edit styles/quality.css.

## Actions
1. ctls: head + card framing.
2. ctls: pills + `.empty`.
3. disputes: head + card framing.
4. disputes: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-05.md (<=10 lines); TL alone updates TRACKER.md.
