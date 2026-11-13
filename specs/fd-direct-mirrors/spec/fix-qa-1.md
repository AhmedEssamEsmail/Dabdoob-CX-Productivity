# fix-qa-1: qa-1 report blocking findings (fd-direct-mirrors)

Kind: index
Size gate: PASS

Routes findings from `reports/qa-1.md`. LOW findings qa-4 (drop-cols merge
ordering) and qa-5 (results files at repo root) are deferred per workflow.
qa-3's fix (qa1-03) is a FOREIGN-file minimal in-place repair — the file is
in the TRACKER baseline, touched by commits 752bd5c/593fb30, not this task.

| ID | Kind | Owner | Depends | Finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|
| qa1-01 | mini | data-engineer | none | qa-1 dedupe_key re-key gap | 1/4/120/10 |
| qa1-02 | mini | dev | none | qa-2 roster error swallowed | 2/3/60/10 |
| qa1-03 | mini | dev | none | qa-3 foreign test mock repair | 1/1/2/5 |

## qa1-01: reset-fd-activities CLI — wipe rows + watermark for API re-key
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: data-engineer
Depends: none
Criteria: qa-1 finding — sheet-era dedupe keys vs API ISO-cell keys -> dup rows
Skills: none
Budget: files=1; actions=4; changed_lines=120; minutes=10

### Goal
`migration/reset-fd-activities.ts` (scratch CLI, `--dry` default, `--write`
gated) wipes the rebuildable `fd_activities` mirror and deletes the
`config` key `mirror_state_fd_activities`, so the next `syncMirror` run
rebuilds the whole table with consistent API-era (ISO cell0) dedupe keys.
This is the qa-1 "wipe fd_activities" option: 404,915 remote rows carry
sheet-era keys (cell0 = DD/MM/YYYY display) that the API writer's ISO
cell0 can never collide with — wiping is ordering-robust and avoids
canonical re-keying of live rows.

### Files
- Create: `migration/reset-fd-activities.ts` | whole file

### Context
- Pattern: `migration/purge-mirrors-pre-sep.ts:1-40` — dotenv bootstrap,
  `createClient` from NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY,
  `--write = includes('--write') && !includes('--dry')`, paged DELETE,
  refresh_log row, one parseable summary line.
- `src/features/shared/jobs/mirrors.ts:206-208,238-241` — dedupe_key =
  sha1(table|JSON cells); `full` triggers when `mirror_state_<table>`
  config row is absent (watermark delete -> automatic full rebuild).
- `migration/run-fd-mirror.ts` — existing `--write` runner for the
  `syncMirror(cfg,'fd_activities',{full:true})` rebuild that follows.

### Contract
- `--dry` (default): prints exact `fd_activities` row count and whether
  `config.key='mirror_state_fd_activities'` exists; exits 0, no writes.
- `--write`: paged `DELETE` of ALL `fd_activities` rows (batched, e.g. by
  `ts_ms`/`id` ranges like the purge), then `DELETE` the config watermark
  key if present; prints before/deleted/remaining + appends one
  `refresh_log` row (`job='fd_activities_reset'`) with the totals.
- Idempotent: re-run on an empty table reports 0 and exits 0.
- Remote `--write` is NEEDS_APPROVAL — worker runs `--dry` only.
Out of scope: canonical re-key of existing rows, changes to mirrors.ts or
dedupeKey(), other mirror tables, running the rebuild itself.

### Actions
1. Write the CLI: env bootstrap + flag parsing + `--dry` count/watermark
   probe (copy purge-mirrors-pre-sep.ts structure).
2. Add the paged `--write` delete-all + watermark config delete +
   refresh_log row.
3. Run `npx tsx migration/reset-fd-activities.ts --dry` locally; capture
   the summary line into the results file.
4. Run `npx tsc --noEmit` (scoped check passes clean).

### Done when
- `--dry` exits 0 and prints fd_activities count + watermark presence.
- `--write` deletes all fd_activities rows + `mirror_state_fd_activities`,
  writes refresh_log, prints before/deleted/remaining.
- `npx tsc --noEmit` exit 0.
- Re-run safety: second `--write` on empty table exits 0.

### Verify
- Run: `npx tsx migration/reset-fd-activities.ts --dry && npx tsc --noEmit` -> exit 0

### Handoff
`--write` + the subsequent `run-fd-mirror.ts --write` rebuild are
NEEDS_APPROVAL remote writes, sequenced by the PM at API-sync cutover
(wipe must precede or coincide with the first API-era sync).
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: fdActivityRosterNames_ must not swallow select errors
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: qa-2 finding — roster select error -> 'User <id>' names in cells+dedupe_key
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=10

### Goal
`fdActivityRosterNames_` (`src/features/shared/jobs/mirrors.ts:76-86`)
reads `data` without checking `error`: a transient roster failure silently
produces `User <id>` performer fallback names baked into cells AND
dedupe_key -> mislabeled persisted rows + dupes when the roster recovers.
Fail the window like a day-export failure instead.

### Files
- Edit: `src/features/shared/jobs/mirrors.ts` | fdActivityRosterNames_ only (lines ~76-86)
- Edit: `tests/jobs/mirrors.test.ts` | one new test for the roster-error path

### Context
- `src/features/shared/jobs/mirrors.ts:36,103-107` — `described` import and
  the established `throw described(e, {step: ...})` pattern for export failures.
- `src/features/shared/jobs/mirrors.ts:93-94` — call site; `fdGroups_` is
  `.catch`-guarded by design, roster intentionally is not.
- `tests/jobs/mirrors.test.ts:60-70,145,248-259` — `h.roster` seam, the
  `from().select()` mock returning `{data, error:null}`, and the existing
  'fd export failure -> per-table error' test to mirror.

### Contract
- On a non-null select `error`, `fdActivityRosterNames_` throws
  `described(error, {step: 'roster directory'})` (or equivalent described
  step) — the fd_activities window/sync fails with a per-table error,
  never writes rows with unresolved `User <id>` fallback names.
- Successful select behaviour unchanged; `fdGroups_` catch-guard untouched.
Out of scope: retry/backoff logic, partial-roster handling, other specs,
dedupe_key changes (qa1-01 owns the re-key gap).

### Actions
1. Destructure `{ data, error }` in `fdActivityRosterNames_`; throw
   `described(error, ...)` when `error` is non-null (before reading data).
2. Add a mirrors.test.ts case: roster select returns an error ->
   fd_activities sync surfaces a per-table error and upserts nothing.
3. Run the targeted vitest + tsc.

### Done when
- Roster select error -> thrown described error / per-table sync error.
- New test fails on the old (error-swallowing) code, passes on the fix.
- Existing mirrors tests stay green; tsc clean.

### Verify
- Run: `npx vitest run tests/jobs/mirrors.test.ts && npx tsc --noEmit` -> exit 0

### Handoff
None — self-contained defect fix.
Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-03: FOREIGN repair — TableScroll missing from ui mock
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: qa-3 finding — vitest RED, 4 failures in audit-queue-memo.test.tsx
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
FOREIGN in-flight file (TRACKER baseline; commits 752bd5c/593fb30 — not
this task's code). MINIMAL in-place repair only, never revert: the
`@/features/shared/components/ui` mock lacks `TableScroll`, which
`audit-queue-page.tsx:436` renders -> 4 test failures ("No TableScroll
export on @/features/shared/components/ui mock").

### Files
- Edit: `tests/perf/audit-queue-memo.test.tsx` | the ui mock object only (lines ~135-141)

### Context
- `tests/perf/audit-queue-memo.test.tsx:135-141` — mock map of string stubs
  (`Button: 'button'`, `Empty: 'empty'`, `PageShell: 'page-shell'`,
  `Seg: 'seg'`, `Select: 'select'`).
- `src/features/cx-quality/components/audit-queue-page.tsx:20,436,592` —
  imports and renders `<TableScroll>` twice.

### Contract
- Add exactly `TableScroll: 'table-scroll'` to that mock object — same
  string-stub convention as siblings. NOTHING else in the file changes.
Out of scope: refactoring the test, touching any other mock, source files.

### Actions
1. Add the `TableScroll` entry to the ui mock; run the file's suite.

### Done when
- `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> all tests pass.
- Diff = exactly the added mock line.

### Verify
- Run: `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> exit 0

### Handoff
Repair attributed as foreign in tl report; file remains in baseline.
Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.
