# S05-09: checkins + analytics — head/card/empty normalization
Kind: mini
ID: S05-09
Parent: S05
Owner: dev
Depends: S02-04
Criteria: PLAN #5
Skills: none
Budget: files=2; actions=6; changed_lines=200; minutes=10

## Goal
`checkins-page.tsx` and `analytics-page.tsx` take the shared patterns.

## Files
- Edit: `src/features/cx-queue/components/checkins-page.tsx` | head + check-ins sections
- Edit: `src/features/cx-queue/components/analytics-page.tsx` | head + queue-analytics sections

## Context
- `mockups/pages/04-queue-health.html` | head + stat/card/table reference (same feature family)
- `src/features/cx-queue/components/shared.tsx:38-46` | shared dq-head helper both pages use
- `analytics-page.tsx:354-358` | `.dq-headline` number block — may become `.stat`-style

## Contract
- Heads (shared dq-head) one-line; check-in entries framed as `.card`/
  `.worklist`; analytics charts/tables framed as `.card`; the big
  `.dq-headline` number may adopt `.stat` styling (additive class);
  statuses → `.pill`; empty branches → `.empty`; `D()` kept; no logic
  changes; do not edit styles/queue.css or shared.tsx.

## Actions
1. checkins: head + `.card`/`.worklist` framing.
2. checkins: pills + `.empty`.
3. analytics: head + `.card` framing (+ optional `.stat` headline).
4. analytics: pills + `.empty`.
5. `npx eslint` both files.
6. `npx tsc --noEmit` clean.

## Done when
- Both pages match the pattern set; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-09.md (<=10 lines); TL alone updates TRACKER.md.
