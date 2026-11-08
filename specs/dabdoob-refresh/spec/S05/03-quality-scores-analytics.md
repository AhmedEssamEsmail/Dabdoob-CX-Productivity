# S05-03: quality-scores + quality-analytics — head/card/empty normalization
Kind: mini
ID: S05-03
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=200; minutes=10

## Goal
`quality-scores-page.tsx` and `quality-analytics-page.tsx` take the
shared patterns (one-line head, `.card` sections, `.empty`, pills).

## Files
- Edit: `src/features/cx-quality/components/quality-scores-page.tsx` | head + score chart/table sections
- Edit: `src/features/cx-quality/components/quality-analytics-page.tsx` | head + analytics chart/table sections

## Context
- `mockups/pages/08-agents.html` | head + card-framed data surfaces reference
- `src/features/cx-quality/components/quality-scores-page.tsx`, `quality-analytics-page.tsx` | current heads + chart/table sections

## Contract
- Heads one-line; chart/table sections framed as `.card` (+ `.card-head`
  title/hint); statuses → `.pill`/`data-status`; empty branches → `.empty`;
  `D()` kept; no logic changes; do not edit styles/quality.css.

## Actions
1. quality-scores: head + card framing pass.
2. quality-scores: pills + `.empty` pass.
3. quality-analytics: head + card framing pass.
4. quality-analytics: pills + `.empty` pass.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-03.md (<=10 lines); TL alone updates TRACKER.md.
