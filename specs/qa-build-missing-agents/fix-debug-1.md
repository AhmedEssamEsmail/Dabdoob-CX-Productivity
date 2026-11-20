# fix-debug-1 — qa-build-missing-agents

Fixes for blocking findings in `reports/debug-1.md` (every row blocking).
Root cause: PostgREST `max-rows` (1000) silently truncates single-shot reads;
the legacy "chunked scan" lost its chunking in the port.
Regression test (already exists, do NOT edit):
`tests/quality/qe-touch-scan-cap.test.ts` — failing now (`expected 1000 to be
2500`); must pass after dbg1-01. Its mock honours `.range()` and enforces the
1000-row cap per response.
Legacy-parity repo: keep `qe*` names verbatim; parity, not improvement.
No schema changes, no remote DB writes, no deps, no `.env*`, no package.json.

## dbg1-01: page qeReadTouches_ past the PostgREST max-rows cap
Kind: mini
ID: dbg1-01
Parent: fix-debug-1
Owner: dev
Depends: none
Criteria: PLAN #2, #3 (finding dbg-1)
Skills: none
Budget: files=1; actions=2; changed_lines=40; minutes=8

### Goal
`qeReadTouches_` must accumulate every `fd_activities` row in the read window
instead of silently seeing only the newest max-rows (1000) page, preserving the
existing newest-first `QE_MAX_TOUCH_ROWS` cap semantics.

### Files
- Edit: `src/features/cx-quality/lib/engine-live.ts` | `qeReadTouches_` query only (~:178-185); the row-processing loop below it is untouched

### Context
- `specs/qa-build-missing-agents/reports/debug-1.md` row dbg-1 | exact fix + evidence (capped pair counts match outcomes exactly)
- `src/features/shared/platform/repo.ts:225-267` | `readAllPaged` — same hazard, same range-loop idiom
- `tests/quality/qe-touch-scan-cap.test.ts` | mock contract: `.range(from,to)` is the honest terminal; `.limit()` responses are capped at 1000

### Contract
Replace the single `.limit(QE_MAX_TOUCH_ROWS)` query with a `.range()` paging
loop on the same filtered query: keep
`.select(<same cols>)`, `.gte('ts_ms', since)`, `.lt('ts_ms', until)`,
`.order('ts_ms', { ascending: false })`, and add a deterministic secondary
`.order('id', { ascending: false })` (fd_activities PK, exists per migration
20261101175759) so `ts_ms` ties can't duplicate/skip rows across page
boundaries. Page size 1000; loop until a short page or `QE_MAX_TOUCH_ROWS`
total accumulated (stop mid-window is fine — preserves the newest-first cap).
Throw `described(error, { table: 'fd_activities' })` on any page error.
Downstream code keeps consuming one flat `data` array — shape of the returned
`{ pairs, openers, … }` object unchanged.
Out of scope: `qeReadLog_` (dbg1-02 owns it), the test file, any other read in
the file, ticket-detail/candidates/catalogue reads, outcome reasons.

### Actions
1. Rewrite the `qeReadTouches_` fetch as the range-paging loop above.
2. Run the regression test; confirm it passes.

### Done when
- `qeReadTouches_` reads via `.range()` pages, not a single `.limit()`.
- `npx vitest run tests/quality/qe-touch-scan-cap.test.ts` passes (touchesInWindow = poolSize = 2500).
- `npx tsc --noEmit` clean on the edited file (no new errors).
- No other function in the file changed.

### Verify
- Run: `npx vitest run tests/quality/qe-touch-scan-cap.test.ts` -> 1 passing

### Handoff
None. Write results/dbg1-01.md (<=10 lines); TL alone updates TRACKER.md.

## dbg1-02: uncap qeReadLog_ via the readAllPaged path
Kind: mini
ID: dbg1-02
Parent: fix-debug-1
Owner: dev
Depends: dbg1-01 (same file — serial)
Criteria: PLAN #2 (finding dbg-2)
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=4

### Goal
`qeReadLog_` must read the whole `qe_queue_log` through `readRows`'s
`readAllPaged` path so it can never be silently truncated at max-rows once the
log exceeds 1000 rows (latent today at ~34 rows).

### Files
- Edit: `src/features/cx-quality/lib/engine-live.ts` | `qeReadLog_` body only (~:587)

### Context
- `specs/qa-build-missing-agents/reports/debug-1.md` row dbg-2 | exact fix + evidence
- `src/features/shared/platform/repo.ts:277-294` | `readRows`: no `opts.limit` -> `readAllPaged`; with `limit` -> single capped query

### Contract
Drop the `limit` option from the `readRows(QE_TBL_LOG, …)` call so it takes the
`readAllPaged` path; keep `orderBy: 'id', ascending: true` and the existing
`.catch(() => [])` and `qeRecordToValues_` mapping. Semantics unchanged.
Out of scope: `qeReadTouches_` (dbg1-01), `qePartitionLog_`, any other caller
or file, new tests.

### Actions
1. Remove `{ limit: 200000 }` (and the now-unneeded `as never` if the opts no longer need it — keep whatever the existing type requires) from the `qeReadLog_` `readRows` call.
2. Typecheck the file.

### Done when
- `qeReadLog_` calls `readRows` without a `limit` option.
- `npx tsc --noEmit` clean on the edited file (no new errors).
- `npx vitest run tests/quality/` — no new failures vs baseline.
- No other function in the file changed.

### Verify
- Run: `npx vitest run tests/quality/` -> all pass (or only pre-existing failures unrelated to this leaf)

### Handoff
None. Write results/dbg1-02.md (<=10 lines); TL alone updates TRACKER.md.
