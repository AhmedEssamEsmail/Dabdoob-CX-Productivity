# S04-09: audit-queue — head + status seg + "Today's queue" worklist (.md left)
Kind: mini
ID: S04-09
Parent: S04
Owner: dev
Depends: S02-04, S02-06
Criteria: PLAN #5
Skills: none
Budget: files=1; actions=5; changed_lines=220; minutes=10

## Goal
Top/left of `audit-queue-page.tsx` matches mock 06: `.page-head`, the
status `.seg` (To do / In progress / Done — the page's real tab states),
and `.md` left column `.card` "Today's queue" as `.worklist` items with
`.pill` status.

## Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | head + queue-list region

## Context
- `mockups/pages/06-audit-desk.html:55-96` | seg + md left worklist
- `src/features/cx-quality/components/audit-queue-page.tsx` | current list markup + tab state (large file — only this region)
- `mockups/assets/mock.css:455-456` | `.md` split contract
- `e2e/*.spec.ts` does not cover this page — still keep `.qa-*` page classes

## Contract
- Head → `.page-head` pattern (title + one-line `.page-sub` + real
  actions); the status filter becomes `.seg` with counts (`D()`).
- `.md` wrapper starts here: left `.card` = "Today's queue"
  (`.card-head` title + `card-hint` "Requested first"), `.worklist` rows:
  `.wi-ico` (agent avatar-ish or icon), `.wi-main .wi-t` (ticket + agent)
  `.wi-s` (form/duration), `.wi-side` `.pill` (`.warn` requested /
  neutral queued / `.ok` done) — from real queue data; selected item gets
  the accent-soft highlight (mock inline style -> use a `.is-sel`-style
  approach consistent with existing selected-state class if present).
- Keep the item click/open behavior + ids the detail pane relies on.

## Actions
1. Restructure head + status filter to `.seg`.
2. Open `.md` wrapper; build left `.card` + `.card-head`.
3. Convert queue rows to `.workitem` markup with `.pill` statuses.
4. Keep selection + open-audit wiring intact.
5. `npx eslint` + `npx tsc --noEmit` clean.

## Done when
- Left column matches mock 06 (worklist + pills + seg).
- Selecting an item still opens the audit detail.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
S04-10 builds the `.md` right column (detail card).
Write results/S04-09.md (<=10 lines); TL alone updates TRACKER.md.
