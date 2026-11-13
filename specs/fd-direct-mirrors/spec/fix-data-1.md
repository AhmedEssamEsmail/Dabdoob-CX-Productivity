# Fix leaves: reports/data-1.md (fd-direct-mirrors)

Findings data-4 and data-5 are LOW -> deferred (not mapped here).
Finding data-1 (BLOCKER) is pure approved ops — run the already-authored
`migration/reset-fd-activities.ts --write` then `migration/run-fd-mirror.ts
--write`; no leaf, tracked under Blocked/needs user. The rebuild MUST run
only after data1-01's floor is deployed, or it re-imports the purged
Jun–Aug rows.

## data1-01: Sep-1 retention floor in the mirror sync
Kind: mini
ID: data1-01
Parent: fix-data-1
Owner: data-engineer
Depends: none
Criteria: reports/data-1.md finding data-2 (HIGH)
Skills: none
Budget: files=2; actions=4; changed_lines=140; minutes=10

### Goal
`syncMirror`/`syncAllMirrors` (and so `run-fd-mirror.ts --write` and the
admin backfill's mirrors step) can never re-import mirror rows with
`ts_ms < 2026-09-01T00:00:00Z` — the D4 purge floor — for all three mirror
tables.

### Files
- Edit: `src/features/shared/jobs/mirrors.ts` | floor const + window-start clamp + consume skip
- Edit: `tests/jobs/mirrors.test.ts` | floor tests only (existing cases unchanged)

### Context
- `src/features/shared/jobs/mirrors.ts:42-46,294-312` | OVERLAP_MS const area; windowed walk `let w = ...` and non-windowed `consume(...)`
- `src/features/shared/jobs/mirrors.ts:272-279` | consume row filter (`ts === null` -> skipped; `ts <= cut`/`ts > untilMs` continue)
- `tests/jobs/mirrors.test.ts:159-216` | existing full-sync test shapes (`h.fdCalls`, `h.apiCalls.maqsam` record fetch bounds)
- `src/features/cx-productivity/jobs/backfill.ts:121-144` | caller passes `monthsBack: monthCount(from,to)+1` — inherits the floor, no edit
- `migration/run-fd-mirror.ts:93-111` | `--write` calls `syncMirror({full:true})` — inherits the floor, no edit

### Contract
- New module const `RETENTION_FLOOR_MS = Date.parse('2026-09-01T00:00:00Z')`
  (comment: D4 purge floor — purged rows must never be re-imported).
- Windowed walk start: `w = Math.max(<existing start expr>, RETENTION_FLOOR_MS)`
  — a full sync whose `months[0]` precedes Sep-2026 starts its first window at
  the floor; incremental `w` below the floor is likewise clamped.
- `consume` skips any row `ts < RETENTION_FLOOR_MS` (count as `skipped`) —
  covers non-windowed specs (freshchat fetch has no window bound) and stray
  sub-floor rows inside a fetched window.
- Watermark behaviour unchanged: `until > maxTs` still advances `maxTs`, so a
  floored full rebuild still walks to `endBound` and persists progress.
Out of scope: `run-fd-mirror.ts`, `backfill.ts`, `freshdesk.ts` (data1-02),
any remote run (`--write` is NEEDS_APPROVAL), per-table floor differences
(one floor for all mirrors), the corrupt `tphClock_` parser (data-5 deferred).

### Actions
1. Add the `RETENTION_FLOOR_MS` const + comment near `OVERLAP_MS`.
2. Clamp the windowed walk start (`let w = ...`) with `Math.max(..., RETENTION_FLOOR_MS)`.
3. Add the `ts < RETENTION_FLOOR_MS` skip in `consume` after the `ts === null` check.
4. Tests: (a) full fd_activities sync with `monthsBack` spanning pre-Sep (e.g.
   `monthsBack: 4`, `now` in Oct) asserts `h.fdCalls[0] === '2026-09-01'` — no
   pre-floor day fetched; (b) maqsam full sync with `monthsBack: 6` asserts
   `h.apiCalls.maqsam[0].sinceMs === RETENTION_FLOOR_MS`; (c) a fetched row
   with `ts < floor` (e.g. an Aug freshchat/maqsam row in `h.apiRows`) is
   skipped, not written.

### Done when
- No fetch window starts before 2026-09-01 on a full sync, for any mirror table.
- A sub-floor row arriving inside a fetched window is skipped, never upserted.
- New floor tests fail on the pre-fix code and pass after; existing mirrors
  tests still green; `npx tsc --noEmit` clean.

### Verify
- Run: `npx vitest run tests/jobs/mirrors.test.ts` -> all green incl. floor tests

### Handoff
After this lands AND deploys, the approved `run-fd-mirror.ts --write` rebuild
(data-1 ops) is safe — it physically cannot re-import the purged Jun–Aug rows.
Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.

## data1-02: Sep-1 floor on the ticket sync fetch cursor + D3 doc fix
Kind: mini
ID: data1-02
Parent: fix-data-1
Owner: data-engineer
Depends: none
Criteria: reports/data-1.md finding data-3 (HIGH)
Skills: none
Budget: files=3; actions=4; changed_lines=90; minutes=10

### Goal
A `v2_fd_inc_cursor`/`v2_fd_full_cursor` reset below the 2026-09-01 purge
floor can never re-fetch (and so re-insert) the ~120,602 purged tickets:
the FD ticket sync clamps its fetch start to `2026-09-01T00:00:00Z`.
PLAN.md D3 is corrected to the Sep-1 reset target.

### Files
- Edit: `src/features/shared/jobs/freshdesk.ts` | floor const + cursor clamp in `fdSyncLoop_`
- Edit: `specs/fd-direct-mirrors/PLAN.md` | D3 decision text only (:56-59)
- Create: `tests/jobs/fd-ticket-floor.test.ts` | unit tests for the clamp helper

### Context
- `src/features/shared/jobs/freshdesk.ts:28-33` | const block (FD_*_PROP keys)
- `src/features/shared/jobs/freshdesk.ts:291-299` | `fdSyncLoop_(cursor, ...)` entry — single clamp point covering both callers
- `src/features/shared/jobs/freshdesk.ts:381` | incremental `since` = cursor − 5 min (a Sep-1 cursor otherwise re-fetches 5 min of purged rows)
- `src/features/shared/jobs/freshdesk.ts:404-405` | full sync falls back to `freshdesk_full_sync_start` = 2026-04-20 — the D3 hazard
- `specs/fd-direct-mirrors/PLAN.md:56-59` | D3 text naming `freshdesk_full_sync_start` as the reset target

### Contract
- New exported pure helper `fdFloorCursor_(cursor: string): string` — returns
  `cursor` when `Date.parse(cursor) >= Date.parse('2026-09-01T00:00:00Z')`,
  else `'2026-09-01T00:00:00Z'` (unparseable/empty -> floor, NOT the
  `'2000-01-01'` fallback: the floor wins).
- `fdSyncLoop_` clamps its incoming `cursor` via `fdFloorCursor_` before the
  first `fdTicketsPage_` call — covers `fdSyncIncremental_` (incl. its −5 min
  overlap dipping under the floor) and `runFreshdeskFullSync`.
- Cursor write-back semantics unchanged (`lastUpdated` still saved forward-only).
- PLAN.md D3 now reads that the repopulation reset target is
  `2026-09-01T00:00:00Z` (still an approved config op at release), enforced in
  code by `fdFloorCursor_`.
Out of scope: row-level `updated_at` filtering inside the batch (the FD
`updated_since` filter is server-side), the actual `v2_fd_inc_cursor` config
write (NEEDS_APPROVAL ops, not this leaf), `mirrors.ts` (data1-01),
`settings.ts` `freshdesk_full_sync_start` default (harmless once floored).

### Actions
1. Add `const FD_TICKETS_FLOOR = '2026-09-01T00:00:00Z'` + `fdFloorCursor_` near the const block (comment: D4 purge floor — re-importing sub-floor tickets undoes the purge).
2. Clamp at `fdSyncLoop_` entry: `cursor = fdFloorCursor_(cursor)`.
3. Update PLAN.md:56-59 D3 text per Contract.
4. Tests for `fdFloorCursor_`: below-floor ISO -> floor; above-floor ISO -> unchanged; `''`/garbage/`'2000-01-01T00:00:00Z'` -> floor; exactly floor -> floor.

### Done when
- Any cursor below 2026-09-01 (incl. `freshdesk_full_sync_start` = 2026-04-20
  and a Sep-1 cursor minus the 5-min overlap) fetches from 2026-09-01.
- `fdFloorCursor_` unit tests fail pre-fix / pass post-fix.
- PLAN.md D3 names `2026-09-01T00:00:00Z`, not `freshdesk_full_sync_start`.
- `npx tsc --noEmit` clean.

### Verify
- Run: `npx vitest run tests/jobs/fd-ticket-floor.test.ts` -> all green

### Handoff
The D3 repopulation op (set `v2_fd_inc_cursor` = `2026-09-01T00:00:00Z` on
prod) stays NEEDS_APPROVAL; once this lands it is safe even if the wrong
value is set. Write results/data1-02.md (<=10 lines); TL alone updates
TRACKER.md.
