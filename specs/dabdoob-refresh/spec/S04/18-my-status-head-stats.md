# S04-18: my-status — head + 4-stat row
Kind: mini
ID: S04-18
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=140; minutes=8

## Goal
Top of `my-status-page.tsx` matches mock 10: `.page-head` (title "My
status" — e2e hook + `.page-sub`) and `.grid.grid-4` `.stat` cards:
productivity raw, after reviews (`ok` + delta), flags waiting (`warn`),
disputes open.

## Files
- Edit: `src/features/cx-productivity/components/my-status-page.tsx` | head + stats region

## Context
- `mockups/pages/10-my-status.html:49-61` | head + 4 stats
- `e2e/my-status.spec.ts:11-17` | hooks: heading "My status", heading "This week", `.cxp[aria-busy]`
- `src/features/cx-productivity/components/my-status-page.tsx` | current head + weekly metrics (`.pv-facts` dl)

## Contract
- Head → `.page-head`: `h1` "My status" (name preserved) + `.page-sub`
  one-liner (week range).
- `.grid.grid-4` `.stat` row from real weekly metrics: productivity raw
  %, after reviews (`data-tone="ok"` + `.delta.up.good` accepted-flags
  delta when present), flags waiting (`data-tone="warn"`), disputes open.
- Keep the existing `h2` "This week" section heading somewhere below
  (e2e hook) — inside the following section is fine.
- `.pv-facts` block may feed the stats; keep it if still rendered, or
  fold its data into stats (its removal is allowed — e2e checks it
  conditionally).

## Actions
1. Restructure head to `.page-head` + `.page-sub`.
2. Build `.grid.grid-4` `.stat` row from real metrics.
3. Keep the "This week" heading in the body.
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Head + 4 stats match mock 10 with real numbers.
- "My status" + "This week" headings still resolve.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-19 finishes the page (flags card + side cards).
Write results/S04-18.md (<=10 lines); TL alone updates TRACKER.md.
