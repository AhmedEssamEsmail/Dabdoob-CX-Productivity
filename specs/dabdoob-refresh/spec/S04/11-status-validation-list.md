# S04-11: status-validation — head + flags master card (.md left)
Kind: mini
ID: S04-11
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=4; changed_lines=160; minutes=10

## Goal
Top/left of `status-validation-page.tsx` matches mock 07: `.page-head`
(title + sub) and `.md` left `.card` "Flags" with the agent filter input
+ `.worklist` flag rows — while every `.pv-*` e2e hook survives.

## Files
- Edit: `src/features/cx-productivity/components/status-validation-page.tsx` | head + flag-list region

## Context
- `mockups/pages/07-status-validation.html:48-82` | head + master card (filter input + workitems)
- `e2e/status-validation.spec.ts:23-36` | hooks that MUST survive: `.pv-item`, `.pv-item__who`, `.pv-item__what`, `.cx-chip`, `.cxp[aria-busy]`
- `src/features/cx-productivity/components/status-validation-page.tsx` | current list markup

## Contract
- Head: title `Status validation` (heading name is an e2e hook) +
  `.page-sub` one-liner.
- `.md` wrapper; left `.card` `.card-head`: `.card-title` `Flags` + the
  agent filter `.input` (keep existing filter state).
- Flag rows become `.workitem`-styled rows BUT keep classes `.pv-item`,
  `.pv-item__who`, `.pv-item__what` and the `.cx-chip` inside (additive
  classes — e.g. `className="workitem pv-item"`); selected flag keeps the
  accent-soft highlight.
- Keep click-to-open + `aria` state wiring.

## Actions
1. Restructure head to `.page-head`/`.page-sub`.
2. Open `.md`; wrap flag list in `.card` + `.card-head` (title + filter input).
3. Restyle `.pv-item` rows to the `.workitem` layout (wi-side pill = the
   `.cx-chip`, kept).
4. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- List matches mock 07; `.pv-item`/`.pv-item__*`/`.cx-chip` classes intact.
- Filter input still filters; clicking a flag opens detail.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-12 builds the `.md` right detail card.
Write results/S04-11.md (<=10 lines); TL alone updates TRACKER.md.
