# S01-02: Hub component brand titles -> "Dabdoob CX"
Kind: mini
ID: S01-02
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1
Skills: none
Budget: files=2; actions=2; changed_lines=12; minutes=5

## Goal
The two remaining `src/` brand strings that are not templates or chrome:
the admin page's own `APPS`-style title map and the ecosystem page's
`document.title`.

## Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | title map (L203-210)
- Edit: `src/features/cx-hub/components/ecosystem-page.tsx` | `document.title` (L2659)

## Context
- `src/features/cx-hub/components/admin-page.tsx:203-210` | eight `CX Helm*` titles shown in the admin UI

## Contract
`CX Helm` -> `Dabdoob CX` and `CX Helm <X>` -> `Dabdoob CX <X>` in display
strings only; ecosystem title becomes `Ecosystem, Dabdoob CX`.
Out of scope: everything else in both files (S05-01 restyles admin heads later).

## Actions
1. admin-page.tsx: retitle the eight map values in place.
2. ecosystem-page.tsx: retitle the `document.title` string.

## Done when
- `grep -n "CX Helm\|CX Productivity"` on both files returns 0 hits.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
admin-page.tsx is next touched by S05-01 (head/empty normalization) — serial.
Write results/S01-02.md (<=10 lines); TL alone updates TRACKER.md.
