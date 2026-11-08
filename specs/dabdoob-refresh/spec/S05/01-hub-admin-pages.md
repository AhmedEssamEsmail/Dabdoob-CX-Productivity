# S05-01: hub admin pages — head/card/empty normalization (admin, config, roster)
Kind: mini
ID: S05-01
Parent: S05
Owner: dev
Depends: S01-02, S02-04
Criteria: PLAN #5
Skills: none
Budget: files=3; actions=8; changed_lines=200; minutes=10

## Goal
The three admin pages take the shared head + card + empty patterns:
one-line subs, `.card`-framed content, `.empty` for empty branches.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | head + section framing
- Edit: `src/features/cx-hub/components/admin-config-page.tsx` | head + framing
- Edit: `src/features/cx-hub/components/admin-roster-page.tsx` | head + framing

## Context
- `mockups/pages/08-agents.html:45-64,73-140` | head + card-framed table reference
- `src/features/cx-hub/components/admin-page.tsx:263-267` | existing `.page-head`/`.page-purpose`
- `src/features/cx-hub/components/admin-config-page.tsx:68-72`, `admin-roster-page.tsx:103-107` | same pattern

## Contract
- Heads already use `.page-head` — ensure `.page-purpose` is ONE line
  (trim if longer), actions live in the head aside.
- Wrap bare tables/forms/lists in `.card` (+ `.card-head` title/hint
  where a section label exists); statuses become `.pill`/`data-status`
  chips.
- Any plain-text empty branch becomes `.empty` (icon + `.t` + `.s`).
- `D()` kept; no data/logic changes; styles from refresh/kit classes +
  minimal inline style only — do NOT edit styles/hub.css.

## Actions
1. admin-page.tsx: head trim + `.card` framing + `.empty` for empty nav/section branches.
2. admin-page.tsx: pill-ify any bare status text.
3. admin-config-page.tsx: head trim + `.card` framing.
4. admin-config-page.tsx: pills + `.empty` pass.
5. admin-roster-page.tsx: head trim + `.card` framing.
6. admin-roster-page.tsx: pills + `.empty` pass.
7. `npx eslint` all three files; re-grep each for remaining bare empty markup.
8. `npx tsc --noEmit` clean.

## Done when
- All three heads are one-line; content sits in cards; empties use `.empty`.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none
Write results/S05-01.md (<=10 lines); TL alone updates TRACKER.md.
