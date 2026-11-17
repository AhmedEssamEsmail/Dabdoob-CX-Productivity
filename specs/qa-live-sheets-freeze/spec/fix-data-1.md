# fix-data-1 — FIX leaves for reports/data-1.md (qa-live-sheets-freeze)

Source report: `specs/qa-live-sheets-freeze/reports/data-1.md`. Dispatched:
data-1 (HIGH), data-2 (MED), data-3 (LOW — same root cause as sec-5,
PM-routed despite LOW). data-4 (LOW stale mirrors docstring) is NOT routed
by the PM -> deferred. PM routes all three to `dev` (overrides report's
data-engineer owner column).

## data1-01: 'Maqsam Calls' L emits decimal minutes (handling is fractional days); 'H:MM:SS' duration fallback un-deaded
Kind: mini
ID: data1-01
Parent: fix-data-1
Owner: dev
Depends: none
Criteria: reports/data-1.md finding data-1 (HIGH); PLAN #1
Skills: none
Budget: files=3; actions=4; changed_lines=60; minutes=8

### Goal
Column L of the synthetic 'Maqsam Calls' grid carries handling time in
DECIMAL MINUTES, as the prod engine contract requires. `maqsam_calls.handling`
stores fractional days, so L = `handling * 1440`; when handling is absent the
fallback parses the 'H:MM:SS' `duration` text (today's `(Number(duration))/60`
is dead code — `Number('0:02:00')` is NaN -> always 0).

### Files
- Edit: `src/features/shared/jobs/dbbook.ts` | `maqsamTab_` L derivation (:117-123) + one private `hmsToSec_` helper
- Edit: `tests/jobs/dbbook.test.ts` | `MAQSAM_ROW` fixture (:44-53) + the two L assertions (:108-128)
- Edit: `tests/jobs/env-dbbook.test.ts` | `MAQSAM_ROW` fixture (:71-80) + L assert (:114-116)

### Context
- `src/features/shared/jobs/dbbook.ts:104-125` | current `L = Number.isFinite(handling) ? handling : (Number(r.duration) || 0) / 60` — emits fractional days as if minutes (understated ~x1440); fallback dead on 'H:MM:SS' text. Local `tphHourMs_` twin (:66-69) is the pattern for a private helper
- `src/features/shared/jobs/vendor-apis.ts:26,41-53` | mirror write path: `hms()` renders `duration` as 'H:MM:SS'; `handling` = `handlingSec / 86400` (fractional days) — confirmed by tests/jobs/mirrors.test.ts:204 ('0.0013888889')
- `src/features/cx-productivity/lib/prod/engine.ts:305-312` | consumer: "L=Handling time (decimal min)", `handlingMin: Number(r[5]) || 0`
- `tests/jobs/dbbook.test.ts:44-53,123-128` | fixture `handling:'1.5'` bakes the wrong unit; fallback case `duration:'120'` relies on the dead `Number()/60` path
- `tests/jobs/env-dbbook.test.ts:71-80,114-116` | same fixture + `toBe(1.5)` L assertion on the env path

### Contract
Add private `hmsToSec_(v: unknown): number` in dbbook.ts (strict 'H:MM:SS' ->
seconds; anything else -> 0). Then
`const L = Number.isFinite(handling) ? handling * 1440 : hmsToSec_(r.duration) / 60`.
Update the :104 doc comment if it names units. Fixtures: `handling` becomes a
fractional-days string of 90 seconds (`String(90 / 86400)`) so L === 1.5 and
the existing `toBe(1.5)` assertions remain correct; the fallback test row uses
`duration:'0:02:00'` (still expects L === 2). `maqsamCells_`, other tabs, the
mirror write path and env.ts are untouched.
Out of scope: env.ts (data1-02), roster.ts (data1-03), vendor-apis/mirrors,
engine.ts, any other grid column.

### Actions
1. Add `hmsToSec_` next to `tphHourMs_` in dbbook.ts; change the L line and doc comment.
2. In tests/jobs/dbbook.test.ts set `MAQSAM_ROW.handling` to `String(90 / 86400)` and the fallback-case `duration` to `'0:02:00'`.
3. In tests/jobs/env-dbbook.test.ts set `MAQSAM_ROW.handling` to `String(90 / 86400)`.
4. Run the targeted vitest files; confirm green.

### Done when
- `handling` fractional days multiply by 1440 into L; missing handling falls back to parsed 'H:MM:SS' minutes (0 for non-conforming text).
- Both test fixtures store fractional days; `toBe(1.5)` (90s) and `toBe(2)` (0:02:00) assertions pass.
- `npx vitest run tests/jobs/dbbook.test.ts tests/jobs/env-dbbook.test.ts` -> all pass.

### Verify
- Run: `npx vitest run tests/jobs/dbbook.test.ts tests/jobs/env-dbbook.test.ts` -> all pass

### Handoff
L is now minutes end-to-end; `hmsToSec_` is private to dbbook.
Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.

## data1-02: prefetchWorkbook fails the whole book on ANY real tab error (missing-store stays header-only)
Kind: mini
ID: data1-02
Parent: fix-data-1
Owner: dev
Depends: data1-01 (shares tests/jobs/env-dbbook.test.ts — serial)
Criteria: reports/data-1.md finding data-2 (MED); PLAN #1
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=8

### Goal
Restore sheet-era fail-the-book semantics: if ANY requested tab synthesis
throws a real error, `books[key]` stores that Error so `openSpreadsheet`
throws — no partial book, no pocketed `tabErrors` map (write-only today;
engines silently computed on absent tabs). `missing_store` still yields the
header-only empty grid via `missingOk_` and never reaches the catch.

### Files
- Edit: `src/features/shared/jobs/env.ts` | `prefetchWorkbook` tabErrors/merge/store logic (:450-486)
- Edit: `tests/jobs/env-dbbook.test.ts` | repo mock gains an `errors` map + one partial-failure regression case

### Context
- `src/features/shared/jobs/env.ts:444-486` | today: per-tab catch pockets errors into `tabErrors` (0 readers — grep); whole-book Error only when EVERY requested tab fails (:481-484); merge branch merges `hold.tabErrors` (:472-477)
- `src/features/shared/jobs/dbbook.ts:95-102` | `missingOk_`: `missing_store` -> [] (header-only grid, never throws); all other errors throw `described()` — so the tabErrors catch only ever holds REAL errors
- `tests/jobs/dbbook.test.ts:8-30` | repo-mock `errors` map pattern (`h.errors[table]` -> throw after recording the call) to copy into env-dbbook.test.ts's mock (:10-36)
- `tests/jobs/env-dbbook.test.ts:119-123` | existing whole-book-fail test ('Nope' unknown tab -> openSpreadsheet throws /unknown tab/) must still pass
- `tests/jobs/env-dbbook.test.ts:90-117` | happy-path book tests must still pass (no errors map set -> unchanged behaviour)

### Contract
After the `Promise.all`, if `Object.keys(tabErrors).length > 0` then
`books[key] = tabErrors[<first errored tab in `missing` order>]` and return —
in BOTH fresh and merge paths (a partial existing book is replaced by the
Error: whole-book parity with the old sheet fetch). Delete the now-dead
`tabErrors` property on stored book objects and the `hold.tabErrors` merge
lines; the catch inside `missing.map` may still collect into a local
`tabErrors` map used only for this check. The merge branch keeps merging
`cells` only when zero tabs errored.
Test: extend the hoisted mock with `errors: Record<string, Error>`; new case —
`prefetchWorkbook('x-book', ['Maqsam Calls', 'Freshchat'])` with
`h.errors.maqsam_calls = new Error('boom')` -> `openSpreadsheet('x-book')`
throws /boom/ even though Freshchat synthesized fine. Reset `h.errors` in
beforeEach.
Out of scope: dbbook.ts internals, other env methods, missingOk_/describeDbError,
openSpreadsheet signature, sheetBook().

### Actions
1. In env.ts prefetchWorkbook: after Promise.all, store `books[key] = <first tab error>` and return when any tab errored; remove `tabErrors` from stored books and the `hold.tabErrors` merge.
2. In tests/jobs/env-dbbook.test.ts add `errors` to the hoisted mock (throw after `h.calls.push`), reset in beforeEach, and add the partial-failure regression case.
3. Run the targeted vitest file; confirm green.

### Done when
- Any real tab error -> `books[key]` is an Error -> `openSpreadsheet` throws it; no `tabErrors` property remains on stored books.
- All-succeed and missing-store (header-only) paths unchanged; unknown-tab test still passes.
- `npx vitest run tests/jobs/env-dbbook.test.ts tests/jobs/dbbook.test.ts` -> all pass.

### Verify
- Run: `npx vitest run tests/jobs/env-dbbook.test.ts tests/jobs/dbbook.test.ts` -> all pass

### Handoff
Partial tab failure can no longer produce a silent-empty grid for engines;
`books` values are `{cells, book}` or `Error` only.
Write results/data1-02.md (<=10 lines); TL alone updates TRACKER.md.

## data1-03: dq_hct snapshot dedupes on the CLEANED email before upsert (data-3 == sec-5)
Kind: mini
ID: data1-03
Parent: fix-data-1
Owner: dev
Depends: none
Criteria: reports/data-1.md finding data-3 (LOW, PM-routed); reports/sec-2.md finding sec-5; PLAN #1
Skills: none
Budget: files=2; actions=3; changed_lines=50; minutes=8

### Goal
The dq_hct snapshot dedupes last-wins on `dqCleanEmail_(rec.email)` before the
500-slice upsert, so two raw-distinct emails that clean equal (e.g.
`'A@x.com '` vs `'a@x.com'`) cannot collide inside one batch — PG "ON
CONFLICT cannot affect row a second time" can no longer abort the sync.

### Files
- Edit: `src/features/cx-hub/lib/roster.ts` | `snap` construction in `dqSyncRoster_` (:320-329)
- Edit: `tests/platform/dq-hct-snapshot.test.ts` | one same-batch clean-collision case

### Context
- `src/features/cx-hub/lib/roster.ts:295-297` | `dqReadHct_` already dedupes on RAW `String(rec.email)` — raw-distinct pairs survive into `hct`
- `src/features/cx-hub/lib/roster.ts:321-329` | `snap` cleans email at :322 then upserts 500-batches `{onConflict:'email'}` — a clean-equal pair in one slice throws
- `src/features/cx-hub/lib/roster.ts:82` | `dqCleanEmail_`: lowercase + zero-width/space/BOM strip
- `tests/platform/dq-hct-snapshot.test.ts:40-70` | `install()`/`sheetRows()` fixtures; `hubDb.inserted` logs every upsert payload
- `tests/golden/hub-fakes.ts:263-276` | upsert fake records `{table, rows}` per call into `hubDb.inserted` — assert on that payload (the fake does NOT simulate the PG conflict error itself)

### Contract
Build the snapshot through a `Map` keyed on the already-cleaned `rec.email`
(last wins — same last-wins order the raw Map dedupe uses today), then
`.filter((rec) => rec.email)` and the 500-slice upsert loop stay unchanged.
`hct` itself is NOT deduped further (it still feeds `dqRosterFromHct_` with
the raw dedupe's rows). Test: inject two sheet rows `'DUP@dabdoob.com '` and
`'dup@dabdoob.com'` (distinct names so both survive the `name` gate), run
`dqSyncRoster_`, assert every inserted dq_hct batch has unique `email` values
and exactly one `'dup@dabdoob.com'` row total (the LAST sheet row wins).
Out of scope: `dqReadHct_` raw dedupe, `dqRosterFromHct_`, remote dq_hct
cleanup of pre-existing dup rows (PM handoff), hub-fakes.

### Actions
1. In roster.ts, route the mapped/filtered snapshot rows through a `Map` keyed on cleaned email before slicing (last wins).
2. In tests/platform/dq-hct-snapshot.test.ts add the clean-collision case per Contract.
3. Run the targeted vitest file; confirm green.

### Done when
- No 500-slice upsert payload can contain two rows with the same cleaned email; last wins.
- Existing snapshot tests (523 upserted, batched, stamped, fail-closed) still pass.
- `npx vitest run tests/platform/dq-hct-snapshot.test.ts` -> all pass.

### Verify
- Run: `npx vitest run tests/platform/dq-hct-snapshot.test.ts` -> all pass

### Handoff
Closes data-3 and sec-5 with one fix. Remote cleanup of pre-existing
NULL-email dup rows remains a PM/deploy handoff (db push still pending).
Write results/data1-03.md (<=10 lines); TL alone updates TRACKER.md.
