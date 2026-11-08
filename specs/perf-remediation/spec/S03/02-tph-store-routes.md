# S03-02: Remaining tph routes pass their date param to tphLoadStore_
Kind: mini
ID: S03-02
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3 (old-date views keep working through the bounded store window)
Skills: none
Budget: files=6; actions=6; changed_lines=20; minutes=5

## Goal
The six other `tphLoadStore_()` callers pass their date-ish request param so
views/edits on dates older than the default window still load their day
(one-line call-site change per route).

## Files
- Edit: `src/app/api/tph/cases/route.ts` | `tphLoadStore_()` call (~:41)
- Edit: `src/app/api/tph/tasks/route.ts` | `tphLoadStore_()` call (~:41)
- Edit: `src/app/api/tph/touches/route.ts` | `tphLoadStore_()` call (~:21)
- Edit: `src/app/api/tph/run-day/route.ts` | `tphLoadStore_()` call (~:16)
- Edit: `src/app/api/tph/slots/route.ts` | `tphLoadStore_()` call (~:13)
- Edit: `src/app/api/tph/run-step/route.ts` | `tphLoadStore_()` call (~:15)

## Context
- `src/features/cx-productivity/lib/tph/page.ts:129` | post-S03-01 signature `tphLoadStore_(dateParam?: string | null)`
- Each route reads its own search param name — check the file (`?date=`, `?d=`, body `date`, or none). Where the route parses a date param, pass it; where it takes no date param, leave `tphLoadStore_()` unchanged and note it in results.

## Contract
- Only the call expression changes: `tphLoadStore_()` -> `tphLoadStore_(<parsed date param or null>)` where the route reads one.
- No handler logic, auth, or response changes. Routes without a date param are untouched.
Out of scope: page.ts itself, page/trend routes (S03-01), any non-tph route.

## Actions
1. cases route: pass its date param (or record "no date param" in results).
2. tasks route: same.
3. touches route: same.
4. run-day route: same.
5. slots route: same.
6. run-step route: same.

## Done when
- Every route that accepts a date-looking param forwards it; the rest are listed as untouched with reason.
- `npx tsc --noEmit` clean.

## Verify
- Run: `npx tsc --noEmit` -> no errors.

## Handoff
None. Write results/S03-02.md (<=10 lines) listing which routes forward a
param and which don't; TL alone updates TRACKER.md.
