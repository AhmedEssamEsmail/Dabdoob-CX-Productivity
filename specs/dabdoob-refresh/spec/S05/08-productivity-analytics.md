# S05-08: productivity-analytics — head/card/empty normalization
Kind: mini
ID: S05-08
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=160; minutes=10

## Goal
`productivity-analytics-page.tsx` takes the shared patterns.

## Files
- Edit: `src/features/cx-productivity/components/productivity-analytics-page.tsx` | head + productivity-analytics sections

## Context
- `mockups/pages/09-tph.html` | stats/card reference (same feature family)
- `src/features/cx-productivity/components/productivity-analytics-page.tsx` | current head + chart/table sections
- `.devin/work/shoot-new.mjs:103` | readySel `.cxp, table` — keep `.cxp` + a table

## Contract
- Head one-line; chart/table sections framed as `.card` (+ `.card-head`);
  statuses → `.pill`; empty branches → `.empty`; `D()` kept; no logic
  changes; do not edit styles/productivity.css; keep `.cxp` root class.

## Actions
1. Head + card framing.
2. Pills + `.empty` pass.
3. `npx eslint` the file.
4. `npx tsc --noEmit` clean.
5. Confirm `.cxp` root + a `table` still render (readySel).

## Done when
- Page matches the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-08.md (<=10 lines); TL alone updates TRACKER.md.
