# S05-07: qa-forms — head/card/empty normalization
Kind: mini
ID: S05-07
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=160; minutes=10

## Goal
`qa-forms-page.tsx` takes the shared patterns.

## Files
- Edit: `src/features/cx-quality/components/qa-forms-page.tsx` | head + qa-forms sections

## Context
- `mockups/pages/06-audit-desk.html` | card/framed reference
- `src/features/cx-quality/components/qa-forms-page.tsx` | current head + form/version sections

## Contract
- Head one-line; form/version lists framed as `.card`; statuses →
  `.pill`; empty branches → `.empty`; `D()` kept; no logic changes; do
  not edit styles/quality.css.

## Actions
1. Head + card framing.
2. Pills + `.empty` pass.
3. `npx eslint` the file.
4. `npx tsc --noEmit` clean.
5. Confirm no bare status text or prose-wall head remains.

## Done when
- Page matches the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-07.md (<=10 lines); TL alone updates TRACKER.md.
