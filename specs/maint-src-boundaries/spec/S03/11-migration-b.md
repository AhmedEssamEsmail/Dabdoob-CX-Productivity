# S03-11: mark remaining migration mappings + shared/lib/admin-auth
Kind: mini
ID: S03-11
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=6; minutes=5

## Goal
`import 'server-only'` marks the last two mapping tables and admin-auth.ts.

## Files
- Edit: `src/features/shared/migration/mappings/queue-quality.ts` | first statement
- Edit: `src/features/shared/migration/mappings/route-core.ts` | first statement
- Edit: `src/features/shared/lib/admin-auth.ts` | first statement

## Context
- `src/features/shared/migration/mappings/queue-quality.ts` | its cx-quality mention is a comment, not an import (PLAN #23) — marker is safe
- `src/app/api/admin/mirrors/route.ts:2` | admin-auth consumer (server route)

## Contract
Insert `import 'server-only'` after the leading doc-comment, before other imports.
Out of scope: every other file.

## Actions
1. queue-quality.ts: insert the marker import.
2. route-core.ts: insert the marker import.
3. admin-auth.ts: insert the marker import.

## Done when
- All 3 files start with the marker; tsc clean.

## Verify
- Run: `npx tsc --noEmit` -> clean

## Handoff
none. Write results/S03-11.md (<=10 lines); TL alone updates TRACKER.md.
