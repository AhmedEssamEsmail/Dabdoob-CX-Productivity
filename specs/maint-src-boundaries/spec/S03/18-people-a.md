# S03-18: mark cx-people/lib {actions,agents-page,coaching}
Kind: mini
ID: S03-18
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks actions.ts, agents-page.ts, coaching.ts.

## Files
- Edit: `src/features/cx-people/lib/actions.ts` | first statement
- Edit: `src/features/cx-people/lib/agents-page.ts` | first statement
- Edit: `src/features/cx-people/lib/coaching.ts` | first statement

## Context
- `src/features/cx-people/components/` | components import only `./shared`/`./pw`/shared modules — lib is server-only

## Contract
Insert `import 'server-only'` after any leading doc-comment / `/* eslint-disable */`
header, before other statements.
Out of scope: every other file.

## Actions
1. actions.ts: insert the marker import.
2. agents-page.ts: insert the marker import.
3. coaching.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-18.md (<=10 lines); TL alone updates TRACKER.md.
