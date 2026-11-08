# S01-04: repoint the three app-page consumers
Kind: mini
ID: S01-04
Parent: S01
Owner: dev
Depends: S01-01
Criteria: PLAN #1
Skills: none
Budget: files=3; actions=3; changed_lines=9; minutes=8

## Goal
`fetchJson` in the three thick productivity pages resolves from
`@/features/shared/lib/fetch-json`. Each has a grouped pv-shared import —
remove `fetchJson` from the braces, add a separate fetch-json import.

## Files
- Edit: `src/app/status-validation/page.tsx` | grouped import lines 14-25 (fetchJson at :19)
- Edit: `src/app/my-status/page.tsx` | grouped import lines 13-25 (fetchJson at :17)
- Edit: `src/app/productivity-analytics/page.tsx` | grouped import lines 13-22 (fetchJson at :16)

## Context
- `src/app/status-validation/page.tsx:14-25` | `import { CasesLine, …, fetchJson, … } from '…/pv-shared'` — remove only `fetchJson`

## Contract
Add `import { fetchJson } from '@/features/shared/lib/fetch-json'` (its own
statement, keep alphabetical/grouped style of the file); delete `fetchJson,`
from the pv-shared braces. All other named imports stay on pv-shared.
Out of scope: pv-shared export removal (S01-05); page moves (S05-02..04).

## Actions
1. status-validation/page.tsx: split fetchJson onto the shared import.
2. my-status/page.tsx: split fetchJson onto the shared import.
3. productivity-analytics/page.tsx: split fetchJson onto the shared import.

## Done when
- pv-shared import braces no longer contain fetchJson in the 3 files; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
The three page files are repointed — S05-02..04 may move them after this leaf.
Write results/S01-04.md (<=10 lines); TL alone updates TRACKER.md.
