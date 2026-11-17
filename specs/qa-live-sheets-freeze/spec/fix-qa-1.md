# fix-qa-1 — FIX leaves for reports/qa-1.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/qa-1.md`. One leaf per
finding; LOW findings routed per owner per PM instruction (not deferred).

## qa1-01: dbbook missingOk — rethrow non-missing read errors
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: qa-1 report finding qa-1 (MED)
Skills: none
Budget: files=2; actions=4; changed_lines=160; minutes=10

### Goal
`dbbook.ts` keeps missing-table tolerance (header-only grid) but stops
swallowing every other read error (timeout, 5xx, permission) into silent
empty grids — engines must fail, not compute on wrong data.

### Files
- Edit: `src/features/shared/jobs/dbbook.ts` | add `missingOk_` helper; replace all 7 `.catch(() => [] as Row[])` call sites (lines ~98,117,127,147,156,200,213)
- Edit: `tests/jobs/dbbook.test.ts` | extend hoisted repo mock so a table can throw; add cases for both branches

### Context
- `src/features/shared/jobs/dbbook.ts:91-218` | the 7 blanket-catch sites
- `src/features/shared/lib/errors.ts:88-105,192-194` | `describeDbError` maps PostgREST schema-cache miss / `relation ... does not exist` / PGRST205 / 42P01 -> code `missing_store`; `described()` is the throwable twin
- `src/features/shared/platform/repo.ts:199-217` | `readAllPaged` throws plain `Error(error.message)` — match via `describeDbError` on the message, not `.code`
- `src/features/shared/jobs/sheets.ts:111-121` | the `missing_source` seam pattern to mirror (`missing_store` is the DB equivalent)
- `tests/jobs/dbbook.test.ts:8-28` | hoisted `h.tables`/`h.calls` mock of `readAllPaged` to extend (e.g. `h.errors`)

### Contract
New module-private `missingOk_(table, promise)` (name flexible): returns `[]`
ONLY when `describeDbError(e, { table }).code === 'missing_store'`; otherwise
`throw described(e, { table })`. All 7 tab readers route their `readAllPaged`
through it. No behaviour change for present tables or genuinely missing ones.
Out of scope: repo.ts error shape, other callers, engine files, cx-quality.

### Actions
1. Add the `missingOk_` helper + `describeDbError`/`described` import in dbbook.ts.
2. Replace each of the 7 `.catch(() => [] as Row[])` with the helper.
3. Extend the test mock with a per-table throw hook.
4. Add tests: missing-relation message -> header-only grid; generic error -> rejects (not `[]`).

### Done when
- No `.catch(() => []` remains in dbbook.ts.
- Missing-table message (e.g. `Could not find the table 'public.x' in the schema cache`) still yields header-only grid.
- A non-missing error (e.g. `timeout`) propagates out of `dbBookTabCells_`.
- `npx vitest run tests/jobs/dbbook.test.ts` passes.

### Verify
- Run: `npx vitest run tests/jobs/dbbook.test.ts` -> all pass, including new throw/tolerance cases

### Handoff
None. Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: delete stray artifacts (nul, probe-sync-health.ts)
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: qa-1 report findings qa-2 + qa-3 (LOW; same outcome: clean tree of stray artifacts)
Skills: none
Budget: files=2; actions=2; changed_lines=120; minutes=3

### Goal
Remove the two stray untracked artifacts QA flagged so they cannot ride the
commit: repo-root `nul` (0-byte bad redirect) and
`scripts/ops/probe-sync-health.ts` (untracked scratch recon script outside
every leaf's Files list).

### Files
- Edit: `nul` | delete the 0-byte stray at repo root
- Edit: `scripts/ops/probe-sync-health.ts` | delete the scratch recon script

### Context
- `specs/qa-live-sheets-freeze/reports/qa-1.md` rows qa-2/qa-3 | both say delete; qa-3 alternative "adopt in a leaf" rejected — recon is done (results/S09-01-remote-cron.md)
- `tests/freeze/sheets-freeze-scan.test.ts` EXPECTED | does NOT list probe-sync-health.ts; scan unaffected by the delete

### Contract
Delete both files; no other changes. They are untracked (no git history to
preserve). Out of scope: anything else under scripts/ops, tracked files, `nul`-like
artifacts elsewhere.

### Actions
1. Delete `nul` (Git Bash: `rm -f ./nul` or `git clean -f nul` — file is untracked).
2. Delete `scripts/ops/probe-sync-health.ts`.

### Done when
- Both paths no longer exist (`ls nul` and `ls scripts/ops/probe-sync-health.ts` fail).
- `git status --porcelain` no longer lists `?? nul` or `?? scripts/ops/probe-sync-health.ts`.

### Verify
- Run: `git status --porcelain | findstr /C:"nul" /C:"probe-sync"` -> no output

### Handoff
None. Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-03: drop stale env.ts entry from freeze-scan EXPECTED
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: test-engineer
Depends: none
Criteria: qa-1 report finding qa-4 (LOW)
Skills: none
Budget: files=1; actions=2; changed_lines=10; minutes=3

### Goal
`sheets-freeze-scan.test.ts` EXPECTED no longer carries the stale
`src/features/shared/jobs/env.ts` entry + "S03 deletes this call" comment —
env.ts is already sheet-clean, so the snapshot must reflect the current tree.

### Files
- Edit: `tests/freeze/sheets-freeze-scan.test.ts` | EXPECTED map, line ~40

### Context
- `tests/freeze/sheets-freeze-scan.test.ts:39-40` | the DEFERRED block + the env.ts line to drop
- `specs/qa-live-sheets-freeze/reports/qa-1.md` row qa-4 | env.ts already clean; subset assert merely tolerated the stale entry

### Contract
Remove the `'src/features/shared/jobs/env.ts': ['fetchWorkbookTabs'], ...`
entry (and its now-empty `--- DEFERRED wave-1 ... ---` comment stays only if
other DEFERRED entries remain — tlqueue/heatmap/scorecard-server/source-health/
mirrors stay). Do not touch patterns, walk logic, or other entries.
Out of scope: env.ts itself, any other EXPECTED row.

### Actions
1. Delete the env.ts EXPECTED line.
2. Re-run the scan test to confirm green.

### Done when
- EXPECTED contains no `env.ts` key.
- `npx vitest run tests/freeze/sheets-freeze-scan.test.ts` passes.

### Verify
- Run: `npx vitest run tests/freeze/sheets-freeze-scan.test.ts` -> pass

### Handoff
None. Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.
