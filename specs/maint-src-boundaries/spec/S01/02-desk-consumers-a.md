# S01-02: repoint cx-desk consumers (kb-tracker, kpi-logs, mail-desk)
Kind: mini
ID: S01-02
Parent: S01
Owner: dev
Depends: S01-01
Criteria: PLAN #1
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
Three cx-desk pages import `fetchJson` from `@/features/shared/lib/fetch-json`
instead of pv-shared. One-line import change per file; nothing else changes.

## Files
- Edit: `src/features/cx-desk/components/kb-tracker-page.tsx` | import line 4
- Edit: `src/features/cx-desk/components/kpi-logs-page.tsx` | import line 4
- Edit: `src/features/cx-desk/components/mail-desk-page.tsx` | import line 4

## Context
- `src/features/cx-desk/components/kb-tracker-page.tsx:4` | `import { fetchJson } from '@/features/cx-productivity/components/pv-shared'`

## Contract
Replace the module specifier with `@/features/shared/lib/fetch-json`. Each file
imports only `fetchJson` from pv-shared today — the whole line is replaced.
Out of scope: pv-shared export removal (S01-05); tl-performance (S01-03).

## Actions
1. kb-tracker-page.tsx: repoint the fetchJson import.
2. kpi-logs-page.tsx: repoint the fetchJson import.
3. mail-desk-page.tsx: repoint the fetchJson import.

## Done when
- No `@/features/cx-productivity/components/pv-shared` specifier remains in the 3 files; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S01-02.md (<=10 lines); TL alone updates TRACKER.md.
