# S05-14: trackers — head/card/empty normalization
Kind: mini
ID: S05-14
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=160; minutes=10

## Goal
`trackers-page.tsx` takes the shared patterns.

## Files
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | head + tracker tables/forms

## Context
- `src/features/cx-operations/components/trackers-page.tsx:808-811` | `.page-head trk-head` block
- `mockups/pages/04-queue-health.html` | card-framed table reference

## Contract
- Head one-line; tracker tables/forms framed as `.card`; statuses →
  `.pill`/`data-status`; empty branches → `.empty`; `D()` kept; no logic
  changes; do not edit styles/operations.css; keep `.trk-*` classes.

## Actions
1. Head + `.card` framing of tables/forms.
2. Pills + `.empty` pass.
3. `npx eslint` the file.
4. `npx tsc --noEmit` clean.
5. Confirm `.trk-*` hooks intact.

## Done when
- Page matches the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-14.md (<=10 lines); TL alone updates TRACKER.md.
