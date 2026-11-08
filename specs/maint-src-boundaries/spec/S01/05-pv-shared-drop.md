# S01-05: pv-shared stops exporting fetchJson
Kind: mini
ID: S01-05
Parent: S01
Owner: dev
Depends: S01-02, S01-03, S01-04
Criteria: PLAN #1
Skills: none
Budget: files=1; actions=1; changed_lines=8; minutes=5

## Goal
Delete the `fetchJson` function (and its `ce` section comment) from pv-shared —
no re-export shim. Every consumer already imports the shared module.

## Files
- Edit: `src/features/cx-productivity/components/pv-shared.tsx` | delete lines 58-65 (`/* --- fetchJson — the ce.google-run seam --- */` block + function)

## Context
- `src/features/cx-productivity/components/pv-shared.tsx:58-65` | exact region to remove

## Contract
Remove the section comment line and the whole function; keep surrounding sections
(CHANNEL_LABELS above, `useSe` below) untouched. No replacement export.
Out of scope: all other pv-shared exports; consumer files.

## Actions
1. Delete lines 58-65 (comment + function) from pv-shared.tsx.

## Done when
- `grep -n "fetchJson" pv-shared.tsx` -> no matches; `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
PLAN #1 end state: pv-shared has no fetchJson; shared module is the only home.
Write results/S01-05.md (<=10 lines); TL alone updates TRACKER.md.
