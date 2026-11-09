# FIX-18: Bound prod_flags admin decided-history read (perf-4)
Kind: mini
ID: FIX-18
Parent: -
Owner: dev
Depends: none
Criteria: perf-1 finding perf-4 (LOW, blocking per PM): admin branch `prod_flags.neq('decision','void')` unbounded — whole flag history per load
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=5

## Goal
The flags GET keeps every pending flag (any age) but stops fetching decided
history older than the already-computed `decidedFrom` window — one bounded
query, identical `pending`/`decided` views for both admin and TL branches.

## Files
- Edit: `src/app/api/prod/flags/route.ts` | the `flagsQuery` composition (~line 74-83) only

## Context
- `src/app/api/prod/flags/route.ts:56-99` | `decidedFrom = addDays(today, -30)` already computed at :57; decided view filters `f.date >= decidedFrom` in memory (~:99); TL branch adds `.or(scope)` at ~78-80
- `specs/perf-remediation/reports/perf-1.md` (finding perf-4) | reviewer fix: `.gte('date', decidedFrom)` for decided rows or `.limit(N)`; pending-only stays unfiltered-in-time

## Contract
- Append `.or('decision.eq.pending,date.gte.' + decidedFrom)` to `flagsQuery` so Postgres returns pending rows of any age OR any row dated within the decided window. Compose it with the existing `.neq('decision','void')` and the TL `.or(scope)` so semantics = AND(neq void, tl-scope-when-tl, or(pending|recent)) — verify PostgREST and/or precedence: `.or()` calls AND together, so the TL scope `.or` must still apply; if combining two `.or`s does not AND them, split into two queries (pending all-time; decided `gte decidedFrom`) instead — pick whichever preserves exact current output.
- The in-memory pending/decided filters stay (identical results guaranteed).
Out of scope: roster/config reads, TL scoping logic, other routes, the 150-cap.

## Actions
1. Add the pending-or-recent bound to `flagsQuery` (or the two-query equivalent) preserving exact output.
2. Typecheck + lint the file.

## Done when
- Admin branch no longer fetches all-time decided rows; pending rows of any age still arrive.
- TL scope and both views produce identical results to today.
- `npx tsc --noEmit` clean; eslint on the file reports 0 new issues.

## Verify
- Run: `npx tsc --noEmit` -> 0 errors; `npx eslint src/app/api/prod/flags/route.ts` -> 0 errors.

## Handoff
None.
Write results/FIX-18.md (<=10 lines); TL alone updates TRACKER.md.
