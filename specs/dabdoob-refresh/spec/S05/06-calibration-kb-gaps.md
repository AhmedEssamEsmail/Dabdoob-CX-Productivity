# S05-06: calibration + kb-gaps — head/card/empty normalization
Kind: mini
ID: S05-06
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=180; minutes=10

## Goal
`calibration-page.tsx` and `kb-gaps-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-quality/components/calibration-page.tsx` | head + calibration sections
- Edit: `src/features/cx-quality/components/kb-gaps-page.tsx` | head + kb-gaps list sections

## Context
- `mockups/pages/06-audit-desk.html` | card/framed list reference
- the two page files | current heads + sections

## Contract
- Heads one-line; content framed as `.card`/`.tbl`; statuses →
  `.pill`/`data-status`; empty branches → `.empty`; `D()` kept; no logic
  changes; do not edit styles/quality.css.

## Actions
1. calibration: head + card framing.
2. calibration: pills + `.empty`.
3. kb-gaps: head + card framing.
4. kb-gaps: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-06.md (<=10 lines); TL alone updates TRACKER.md.
