# S01-03: repoint tl-performance, trackers, tph-grid consumers
Kind: mini
ID: S01-03
Parent: S01
Owner: dev
Depends: S01-01
Criteria: PLAN #1
Skills: none
Budget: files=3; actions=3; changed_lines=8; minutes=5

## Goal
Three more consumers import `fetchJson` from `@/features/shared/lib/fetch-json`.
tph-grid shares a grouped import with `useSe` — split it, keep `useSe` on pv-shared.

## Files
- Edit: `src/features/cx-desk/components/tl-performance-page.tsx` | import line 4
- Edit: `src/features/cx-operations/components/trackers-page.tsx` | import line 21
- Edit: `src/app/tph-grid/page.tsx` | import line 24

## Context
- `src/app/tph-grid/page.tsx:24` | `import { fetchJson, useSe } from '@/features/cx-productivity/components/pv-shared'` — split into two imports

## Contract
```
import { fetchJson } from '@/features/shared/lib/fetch-json'
import { useSe } from '@/features/cx-productivity/components/pv-shared'
```
(tph-grid). The other two files: repoint the whole single-specifier line.
Out of scope: pv-shared export removal; the page move (S05-01) — do NOT move code.

## Actions
1. tl-performance-page.tsx: repoint the fetchJson import.
2. trackers-page.tsx: repoint the fetchJson import.
3. tph-grid/page.tsx: split the grouped import; fetchJson comes from fetch-json.

## Done when
- All 3 files resolve fetchJson from fetch-json; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
`tph-grid/page.tsx` is repointed — S05-01 may move it after this leaf.
Write results/S01-03.md (<=10 lines); TL alone updates TRACKER.md.
