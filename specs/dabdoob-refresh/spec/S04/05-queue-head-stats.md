# S04-05: queue — head + 5-stat row
Kind: mini
ID: S04-05
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=160; minutes=10

## Goal
Top of `queue-page.tsx` matches mock 04: `.page-head` (title + one-line
sub + real actions) and a `.grid.grid-5` of `.stat` cards (open now, came
in today, 10d+, resolved today, not assigned — from real queue data).

## Files
- Edit: `src/features/cx-queue/components/queue-page.tsx` | head + stats region

## Context
- `mockups/pages/04-queue-health.html:66-81` | head + 5 stats
- `src/features/cx-queue/components/queue-page.tsx` | current head + summary row (dq-head / dq-headline region)
- `src/features/cx-queue/components/shared.tsx:38-46` | shared dq-head helper (reskinned by S02-06 — keep or swap to `.page-head`)

## Contract
- Head keeps the shared dq-head OR becomes `.page-head` — either is fine
  visually post-S02-06; ensure sub is one line + real actions in the aside.
- Stat row: `.grid.grid-5` of `.stat` cards mapping mock slots to real
  metrics: open now (`.stat-d` delta vs last snapshot if fetched), came in
  today, open 10d+ (`data-tone="bad"`, `.delta.up` when rising), resolved
  today (`data-tone="ok"`), not assigned (`data-tone="warn"`).
- Keep `.cxp`/`aria-busy`, `D()`, existing refresh control wiring.

## Actions
1. Confirm/restructure the head (title + one-line sub + actions).
2. Build the 5-slot `.stat` grid from loaded queue aggregates.
3. Remove the superseded summary markup.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + 5 `.stat` cards match mock 04 with real numbers.
- Tone strips + deltas appear where data exists.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-06 continues this file (mixbar + by-queue table).
Write results/S04-05.md (<=10 lines); TL alone updates TRACKER.md.
