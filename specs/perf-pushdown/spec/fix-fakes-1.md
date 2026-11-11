# fix-fakes-1: shared golden fake missing paged-read query ops
Source: TL golden-suite run `specs/perf-pushdown/logs/golden-check.log` —
15 files / 246 tests failing on `query.order(...).range is not a function`
(S02-01's `readAllPaged` path) + missing `gte`/`lte`/`lt` on filtered reads
(S10-01/S10-02). One shared fake file is the single root cause.

## fakes-01: hub-fakes mkQuery gains range + comparison ops
Kind: mini
ID: fakes-01
Parent: S02
Owner: test-engineer
Depends: none
Criteria: regression — golden suite green again after S02-01/S10-01 paging pushdown
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=7

### Goal
`tests/golden/hub-fakes.ts`'s `mkQuery` builder supports `.range`, `.gte`, `.gt`, `.lte`, `.lt` so the golden suite passes again.

### Files
- Edit: `tests/golden/hub-fakes.ts` | `mkQuery` builder (:96-175 region) + its chained-clone type (`Q` iface ~:280)

### Context
- `tests/golden/hub-fakes.ts:96-175` | filters array + `order` + materialization — add ops here
- `src/features/shared/platform/repo.ts` | `readAllPaged` call shape: `.select(cols).order(pk).range(from, to)` and `build` callbacks using `gte/lte/lt`
- `specs/perf-pushdown/logs/golden-check.log` | the 246-failure baseline to clear

### Contract
`.range(from, to)` = inclusive PostgREST slice applied AFTER `filters` + `order`
(same semantics as Supabase). `.gte/.gt/.lte/.lt(col, v)` push comparison
predicates onto `filters` consistent with the existing `eq`/`is` handling
(string-safe comparisons as the fake already does — record if any type coercion
needed). All methods return the chainable clone like existing ops. No test-body
edits; no app-source edits. Out of scope: other fake files (desk-fakes.ts,
ops-fakes.ts, queue-oracle.ts) — if any still fail after this fix, enumerate
files + error lines in results instead of editing them.

### Actions
1. Add `range(from, to)` to the builder + `Q` interface (slice the ordered/filtered rows).
2. Add `gte`, `gt`, `lte`, `lt` comparison ops onto `filters`.
3. Re-run `npx vitest run tests/golden/` -> expect 0 range/order TypeErrors; record remaining failures by file (should be none).
4. Record any residual non-fake failures (real regressions) in results — do not fix them.

### Done when
- `npx vitest run tests/golden/` exits 0, or residual failures are enumerated by file with first error line
- `npx tsc --noEmit` clean on the edited file

### Verify
- Run: `npx vitest run tests/golden/` -> all pass (or enumerated leftovers)

### Handoff
Golden suite trustworthy again for downstream leaf verifies (S08-*, S10-02 re-verify, S11-*).
Write results/fakes-01.md (<=10 lines); TL alone updates TRACKER.md.

## fakes-02: triage the 6 golden residuals (ordering parity)
Kind: mini
ID: fakes-02
Parent: S02
Owner: dev
Depends: fakes-01
Criteria: regression — 6 remaining golden failures after fakes-01
Skills: none
Budget: files=1; actions=4; changed_lines=80; minutes=8

### Goal
Each of the 6 residual golden failures is either fixed in the fake (if fake semantics differ from real PostgREST) or root-caused to an app call site and recorded with the order the old path produced.

### Files
- Edit: `tests/golden/hub-fakes.ts` | comparison/order semantics only — if a failure is fake-side (e.g. NULL/tie ordering, numeric-string compare). App-side root causes go into results/fakes-02.md — record only, no app edits.

### Context
- `specs/perf-pushdown/results/fakes-01.md` | the 6 residuals: desk.test.ts:716/723 + :1823/1834 (approvals[1] order), operations.test.ts:1085 (view-as write pick), people-jobs.test.ts:549 (digest line[0])
- `tests/golden/hub-fakes.ts` | `cmpVals`, `.order()` append-keys, `.range` just added
- `src/features/shared/platform/repo.ts` | `readAllPaged` pk-asc ordering + `orderBy`+pk tiebreak

### Contract
Decide per failure: (a) fake semantics differ from real Supabase (e.g. tie-break
order, NULL placement, string vs numeric compare) -> fix inside hub-fakes only;
(b) the app genuinely returns a different row order now (old path relied on
insertion/unordered reads) -> record exact call site + the order the old code
produced; do NOT edit app source. If all 6 are app-side, the leaf still ends with
a written root-cause list — no app edits. Out of scope: any `src/` edit, new
tests.

### Actions
1. Re-run the 4 failing test names only; capture expected-vs-actual ordering per failure.
2. For each: trace whether the old read path had an explicit order or relied on table order; compare against real PostgREST semantics for tie-breaks.
3. Fake-side diffs -> patch `hub-fakes.ts` minimally; re-run until those pass.
4. Record remaining app-side root causes (file:line, old order, new order) in results.

### Done when
- the 6 residuals are all green OR each has a recorded app-side root cause
- `npx vitest run tests/golden/` shows <= the recorded app-side failures; `npx tsc --noEmit` clean

### Verify
- Run: `npx vitest run tests/golden/` -> pass count documented in results

### Handoff
Any recorded app-side root cause becomes a fix leaf restoring the old row order (explicit secondary sort).
Write results/fakes-02.md (<=10 lines); TL alone updates TRACKER.md.

<!-- Ordering-parity fix leaves from fakes-02 root causes. PLAN requires
byte-equivalent responses: the old un-ordered read returned Postgres physical
(insertion) order; readAllPaged now returns pk-asc. For text-PK tables these
differ. Each leaf makes the affected output deterministic AND matching the old
order (or records why the new order is kept + oracle updated). -->

## ord-01: maildesk approvals deterministic tiebreak
Kind: mini
ID: ord-01
Parent: S02
Owner: dev
Depends: fakes-02
Criteria: regression — desk.test.ts:716/723 + :1823/1834 (approvals[1] order)
Skills: none
Budget: files=1; actions=3; changed_lines=30; minutes=5

### Goal
The approvals sort at `maildesk.ts` produces the same order the legacy sheet-order input produced — deterministic, not an unstable-sort artifact.

### Files
- Edit: `src/features/cx-desk/lib/maildesk.ts` | the approvals comparator (:595-615 region — verify exact lines; root cause at :601-604)

### Context
- `specs/perf-pushdown/results/fakes-02.md` | root cause 1: comparator `Number(pending diff) || (receivedAt compare)` never returns 0; all fixture rows share received_at -> output follows input order, which changed sheet->pk
- `tests/golden/desk.test.ts:700-730,1810-1840` | the two failing expectations (approvals[1] must be 't6')

### Contract
Make the comparator total: after the existing pending-diff and receivedAt
comparison, add a deterministic final tiebreak that reproduces the legacy result
(`t6` before `t-stuck`/`t-fresh-send` — derive WHICH stable key does that, e.g.
insertion index captured before sort, or a business key like created/updated).
If no cheap key reproduces it, choose a documented sensible order and update the
golden expectations in the SAME file's test — record the choice. No other code
changes. Out of scope: other maildesk functions, the read path itself.

### Actions
1. Reproduce the failure locally (run the two test names); inspect the comparator + row shape for a legacy-order-preserving key.
2. Apply the minimal comparator fix (or document the accepted new order + update the golden assertions).
3. `npx tsc --noEmit` clean; the 4 desk assertions green.

### Done when
- `tests/golden/desk.test.ts` green (all previously failing cases)
- order is total/deterministic (no input-order dependence)

### Verify
- Run: `npx vitest run tests/golden/desk.test.ts` -> all pass

### Handoff
none
Write results/ord-01.md (<=10 lines); TL alone updates TRACKER.md.

## ord-02: trackerRegistry_ canonical order for setupTrackers
Kind: mini
ID: ord-02
Parent: S02
Owner: dev
Depends: fakes-02
Criteria: regression — operations.test.ts:1085 (view-as refusal picks wrong tracker write)
Skills: none
Budget: files=1; actions=3; changed_lines=40; minutes=6

### Goal
`setupTrackers` emits tracker writes in the same order the legacy readStore row order produced (Promocodes first per the golden expectation).

### Files
- Edit: `src/features/cx-operations/lib/trackers.ts` | `trackerRegistry_` order source (:184-191) + `setupTrackers` emission (:1011 region)

### Context
- `specs/perf-pushdown/results/fakes-02.md` | root cause 2: registry order followed readStore row order; now tracker_id asc
- `tests/golden/operations.test.ts:1075-1095` | the failing expectation
- `supabase/migrations/` | tracker's PK / any seq column that encoded the old order

### Contract
Give the registry read an explicit order matching the legacy physical order (if
a monotonic column exists — e.g. `id`, `created_at` — `.order()` on it), or sort
the emitted lines by the fixed business order the golden test expects (record
the chosen key). Result output identical to pre-pushdown. Out of scope: other
tracker functions, the fake.

### Actions
1. Inspect `trackerRegistry_` rows: find the column whose order matches legacy insertion order (or the fixed list the test expects).
2. Apply `.order()`/explicit sort so `setupTrackers` emits that order deterministically.
3. `npx tsc --noEmit` clean; operations.test.ts:1085 green.

### Done when
- `tests/golden/operations.test.ts` green
- emitted tracker order deterministic + matching legacy

### Verify
- Run: `npx vitest run tests/golden/operations.test.ts` -> all pass

### Handoff
none
Write results/ord-02.md (<=10 lines); TL alone updates TRACKER.md.

## ord-03: digest line ordering (pwTasksOut_ actions)
Kind: mini
ID: ord-03
Parent: S02
Owner: dev
Depends: fakes-02
Criteria: regression — people-jobs.test.ts:549 (digest line[0] T-OD not T-HALF)
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

### Goal
Digest lines are emitted in the order the legacy sheet-order actions read produced (T-OD first).

### Files
- Edit: `src/features/cx-people/lib/work-core.ts` | `pwTasksOut_` actions read order (:88 region)
- Edit: `src/features/cx-people/lib/reminders.ts` | digest line emission (:193-199) — only if the fix belongs there (choose ONE site; record)

### Context
- `specs/perf-pushdown/results/fakes-02.md` | root cause 3: `pwTasksOut_` order = actions read order; now action_id asc
- `tests/golden/people-jobs.test.ts:540-560` | the failing expectation (line[0] = T-OD)

### Contract
Preserve legacy emission order at ONE site: either order the actions read by the
column reproducing sheet order (if one exists), or sort digest lines by the
business order the test expects (record the key). Output identical to
pre-pushdown. Out of scope: other people-lib functions.

### Actions
1. Identify the ordering column / business key reproducing the legacy order.
2. Apply the minimal explicit ordering at the chosen site.
3. `npx tsc --noEmit` clean; people-jobs.test.ts:549 green.

### Done when
- `tests/golden/people-jobs.test.ts` green
- digest order deterministic + matching legacy

### Verify
- Run: `npx vitest run tests/golden/people-jobs.test.ts` -> all pass

### Handoff
Golden suite fully green after ord-01..03.
Write results/ord-03.md (<=10 lines); TL alone updates TRACKER.md.

## qa-blank-01: backfill bound must cover interaction_at = ''
Kind: mini
ID: qa-blank-01
Parent: S08
Owner: dev
Depends: S08-09
Criteria: regression — S08-09 pushed `is:{interaction_at:null}` but `''` rows exist and the JS blank guard fills them (not a strict superset)
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=5

### Goal
`backfillQaInteractionDates` reads NULL **and** empty-string `interaction_at` rows — a true superset of the JS `blank` check.

### Files
- Edit: `src/features/cx-quality/lib/server.ts` | the `blank` read at ~:2309 (post-S08-09)
- Edit: `tests/perf/qa-pushdown.test.ts` | add `interaction_at=''` parity case

### Context
- `src/features/cx-quality/lib/server.ts:2309` | current `qaRowsWhere_('qa_audits', { is: { interaction_at: null } })`
- `src/features/cx-quality/lib/core.ts:676-680` | `qaWhen_('')` -> `''` (falsy) — JS treats `''` as blank
- `specs/perf-pushdown/results/S08-01.md` | evidence `interaction_at` stores `'yyyy-MM-dd HH:mm`, `'yyyy-MM-dd`, `''`

### Contract
Pushed predicate must accept `interaction_at IS NULL OR interaction_at = ''`.
Apply `.or('interaction_at.is.null,interaction_at.eq.')` inside `readAllPaged`'s
`build` callback (direct `readAllPaged` call is fine; extending `qaRowsWhere_`
with an `or` option also acceptable — keep the helper's existing signature
compatible). The JS `blank` filter stays verbatim. Strict superset required:
NULL + `''` covers every row `!qaWhen_` accepts that a text bound could reach.
Out of scope: other call sites, the queue read, the upsert (S09).

### Actions
1. Change the :2309 read to the or-bound per contract (implementation route of the two options; record which).
2. Parity test: fixture with `interaction_at` = NULL, `''`, `'2026-11-01`, `'2026-11-01 10:00` rows -> same `written`/`missing` + upserted rows as the whole-table path.
3. `npx tsc --noEmit` clean.

### Done when
- test green incl. the `''` case; tsc clean
- pushed predicate accepts NULL and `''` (asserted via mocked db() args)

### Verify
- Run: `npx vitest run tests/perf/qa-pushdown.test.ts` -> pass

### Handoff
Chain resumes at S08-10.
Write results/qa-blank-01.md (<=10 lines); TL alone updates TRACKER.md.

## pk-drift-01: PK_OVERRIDES for drift tables lacking `id`
Kind: mini
ID: pk-drift-01
Parent: S02
Owner: dev
Depends: fakes-02
Criteria: regression — readAllPaged `.order('id')` 500s on pre-existing tables that never got the migration's `id` column (qa_queue 500 seen live; prod/analytics 500 likely same)
Skills: none
Budget: files=2; actions=4; changed_lines=90; minutes=8

### Goal
Every app-read table that lacks an `id` column resolves a working ordering key via `PK_OVERRIDES`/`opts.pk` — no `.order('id')` error can reach production.

### Files
- Edit: `src/features/shared/platform/repo.ts` | `PK_OVERRIDES` (:130-158) + optionally an escape for truly keyless tables (see contract)
- Edit: `tests/perf/read-all-paged.test.ts` | drift-table case (PK_OVERRIDES hit) + keyless-escape case if implemented

### Context
- `specs/perf-pushdown/results/p19-04.md` | evidence: remote qa_queue/qa_audits lack `id`; real keys `queue_id`/`audit_id`; baseline prod/analytics + getQaScoresPage 500s
- `supabase/migrations/20261106151132_remote_reconcile.sql:203-213` | the pre-existing (drift) table list
- `src/features/shared/platform/repo.ts:130-190` | PK_OVERRIDES + readAllPaged pk resolution
- `docs/PERF_BASELINE.md` | pg_indexes rows for the 7 measured tables

### Contract
1. Discover which tables app code can hit unbounded AND that lack `id`:
   grep `readStore(`/`readRows(`/`qaRows_(`/`qaRowsWhere_(`/`readAllPaged(` call
   sites for table names; cross-check the drift list; query the LOCAL linked DB
   (`npx supabase db query` on the local/linked instance, or psql — NO remote
   writes; remote reads only if already-approved SELECT-only form) for
   `information_schema.columns`/`pg_index` PK evidence.
2. Add `PK_OVERRIDES` entries for every such table using the business key the app
   already filters on (qa_queue->queue_id, qa_audits->audit_id confirmed; record
   each chosen key + evidence line in results).
3. Tables with NO plausible single-column key: either add a documented composite
   fallback (`.order(c1).order(c2)` tiebreak supported by the builder — verify
   PostgREST accepts multi-order) or a `PK_NONE` sentinel that pages unordered
   only when the table fits one page — pick ONE approach, record decision.
   Behaviour for id-keyed tables unchanged.
Out of scope: remote ALTER/DDL (needs separate approval — escalate via results
if a table truly has no usable key), call-site edits, hub-fakes.

### Actions
1. Enumerate at-risk tables (grep + schema check); list them in results.
2. Add the PK_OVERRIDES entries / keyless handling per contract.
3. Test: a drift-table fixture pages correctly on its business key; id tables unchanged.
4. `npx tsc --noEmit` clean; `npx vitest run tests/perf/read-all-paged.test.ts` green.

### Done when
- every enumerated at-risk table has a recorded resolution (override, sentinel, or escalation)
- test green; tsc clean

### Verify
- Run: `npx vitest run tests/perf/read-all-paged.test.ts` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
If any table needed remote ALTER instead, escalate via results (NEEDS_APPROVAL for remote DDL). Quality/prod endpoints should stop 500ing — spot-check `getQaScoresPage`/`getQaQueuePage` after.
Write results/pk-drift-01.md (<=10 lines); TL alone updates TRACKER.md.

## pk-scan-01: remote PK evidence for escalated drift tables (SELECT-only)
Kind: mini
ID: pk-scan-01
Parent: S02
Owner: supabase-expert
Depends: pk-drift-01
Criteria: regression — pk-drift-01 could not verify ~10 drift tables (remote schema read 403'd for dev)
Skills: none
Budget: files=1; actions=3; changed_lines=60; minutes=7

### Goal
`docs/perf/pk-drift-evidence.md` records, per escalated table, its real PK/unique columns (or "no usable key") from SELECT-only remote introspection.

### Files
- Create: `docs/perf/pk-drift-evidence.md` | table -> PK/unique-index columns -> verdict (override candidate / needs-ALTER)

### Context
- `specs/perf-pushdown/results/pk-drift-01.md` | the escalated list: prod_intervals, prod_flag_log, prod_flag_analytics, fcr_daily/weekly/monthly, qa_forms, freshchat, fd_activities, maqsam_calls, queue_status_submissions + `dqReadTail` flag
- `specs/perf-pushdown/PLAN.md:73-77` | remote conventions (`--remote` + `env -u SUPABASE_ACCESS_TOKEN`, verify Target)

### Contract
SELECT-only remote reads (approved class — same as S01-01): run
`information_schema.columns` / `pg_index`+`pg_class` queries for the escalated
tables to identify PK columns, UNIQUE indexes, and whether `id` exists. NO DDL,
no DML, no remote writes. Where NO unique column exists record "needs-ALTER" —
that is a NEEDS_APPROVAL handoff, do not attempt it. Record which app reads hit
each table if obvious from results/pk-drift-01.md.
Out of scope: repo.ts/stores.ts edits (pk-apply-01), any non-listed table.

### Actions
1. Run the remote SELECT-only introspection for each escalated table (`--remote`, token unset, Target verified).
2. Write the evidence doc: per table — columns, PK/unique-index names+columns, verdict.
3. List tables that still 500 under readAllPaged despite any override (none should, but record).

### Done when
- every escalated table has a verdict: `pk=<col(s)>` or `needs-ALTER`
- doc written; no DDL/DML executed

### Verify
- Run: `type docs\perf\pk-drift-evidence.md` -> one row per escalated table with verdict

### Handoff
pk-apply-01 consumes the verdicts (PK_OVERRIDES entries + `dqReadTail` fix). needs-ALTER tables escalate to PM/user.
Write results/pk-scan-01.md (<=10 lines); TL alone updates TRACKER.md.

## pk-apply-01: apply PK evidence + dqReadTail pk-aware order
Kind: mini
ID: pk-apply-01
Parent: S02
Owner: dev
Depends: pk-scan-01
Criteria: regression — remaining drift tables still 500 on .order('id')
Skills: none
Budget: files=3; actions=4; changed_lines=70; minutes=7

### Goal
`PK_OVERRIDES` covers every table with a pk-scan verdict; `dqReadTail` resolves the same key instead of hardcoding `.order('id')`.

### Files
- Edit: `src/features/shared/platform/repo.ts` | `PK_OVERRIDES` additions per evidence doc
- Edit: `src/features/shared/platform/stores.ts` | `dqReadTail` order resolution (pk-aware desc order via PK_OVERRIDES, same tail semantics)
- Edit: `tests/perf/read-all-paged.test.ts` | case per added table (group ok) + dqReadTail order test

### Context
- `docs/perf/pk-drift-evidence.md` | per-table verdicts (from pk-scan-01)
- `src/features/shared/platform/stores.ts` | `dqReadTail` hardcoded `.order('id')` (flagged by pk-drift-01)
- `src/features/shared/platform/repo.ts:130-190` | PK_OVERRIDES (string|string[] post pk-drift-01) + readAllPaged

### Contract
For each `pk=` verdict add the PK_OVERRIDES entry (single or composite per the
string[] support landed in pk-drift-01). For `needs-ALTER` tables add NO entry
and record them in results for PM escalation. `dqReadTail(name, ...)`: resolve
pk via the same `PK_OVERRIDES[name] ?? 'id'` path; on composite pk order by its
first column desc (record the choice) — tail semantics = latest rows by the
resolved key, matching what `.order('id', desc)` produced where id existed.
Out of scope: remote DDL (escalated), other stores.ts functions.

### Actions
1. Apply PK_OVERRIDES entries per verdict doc.
2. Make `dqReadTail` pk-aware per contract; keep its return shape.
3. Tests: override resolution for added tables; dqReadTail orders by resolved key desc on a drift fixture.
4. `npx tsc --noEmit` clean; vitest green.

### Done when
- all `pk=` verdicts have entries; needs-ALTER list recorded
- test green; tsc clean

### Verify
- Run: `npx vitest run tests/perf/read-all-paged.test.ts tests/perf/dq-live-cache.test.ts` -> pass

### Handoff
Drift coverage complete except escalated needs-ALTER tables (TL -> PM). Re-run p19-04's profile for /audit-queue measurement.
Write results/pk-apply-01.md (<=10 lines); TL alone updates TRACKER.md.

## upsert-fake-01: add `.upsert` to perf-test fake builders
Kind: mini
ID: upsert-fake-01
Parent: S02
Owner: test-engineer
Depends: none
Criteria: regression — S09-01 switched `qaUpsertIn_` to `.upsert()`; fake builders without it throw `upsert is not a function` (5 vitest failures)
Skills: none
Budget: files=3; actions=3; changed_lines=60; minutes=6

### Goal
Every fake PostgREST builder used by failing perf tests implements `.upsert(rows, {onConflict})` with dedupe-on-conflict-keys semantics identical to `tests/golden/hub-fakes.ts:254-268`.

### Files
- Edit: `tests/perf/qa-pushdown.test.ts` | `mk` builder (:49-99) — add `upsert` next to `insert`/`update`
- Edit: `tests/perf/qe-lookups.test.ts` | its fake builder — same addition
- Edit: `tests/golden/hub-fakes.ts` | `upsert` (:254-268) — reference only, no change needed; use as the semantics template

### Context
- `tests/golden/hub-fakes.ts:254-268` | reference `upsert`: match on `onConflict` keys (default `id`), `Object.assign` on hit else push; returns builder
- `src/features/cx-quality/lib/server.ts:133-145` | `qaUpsertIn_` calls `.upsert(clean, {onConflict})`, falls back to per-row loop only on 42P10-class `error`
- `specs/perf-pushdown/logs/vitest-full.log` | the 5 `upsert is not a function` failures

### Contract
Test-only. The fake must RESOLVE `{data,error:null}` (not throw) so the bulk path is exercised; on-conflict dedupe must match hub-fakes semantics. Do NOT change app source. Do NOT add error-injection — qa-upsert.test.ts already covers the fallback.

### Actions
1. Add `upsert` to the qa-pushdown `mk` builder mirroring hub-fakes (records an op, dedupes by onConflict keys, mutates `tables[table]`).
2. Same for qe-lookups' builder; grep other `tests/perf/*.test.ts` fakes for missing `upsert` and add only where a test actually hits `qaUpsertIn_`.
3. `npx vitest run tests/perf/qa-pushdown.test.ts tests/perf/qe-lookups.test.ts tests/golden/hub-people-holidays.test.ts` -> green except any pre-existing holiday oracle failure (tracked by holiday-eq-01).

### Done when
- no `upsert is not a function` failures remain in the run
- previously-passing tests in those files still pass

### Verify
- Run: `npx vitest run tests/perf/qa-pushdown.test.ts tests/perf/qe-lookups.test.ts` -> all pass

### Handoff
Write results/upsert-fake-01.md (<=10 lines); TL alone updates TRACKER.md.

## holiday-eq-01: dqIsHoliday_ case-sensitive eq breaks duplicate guard
Kind: mini
ID: holiday-eq-01
Parent: S10
Owner: dev
Depends: none
Criteria: regression — pushed `eq:{country}` is case-sensitive; legacy duplicate check is case-insensitive -> {ok} where legacy threw (hub-people-holidays oracle mismatch)
Skills: none
Budget: files=2; actions=2; changed_lines=30; minutes=5

### Goal
`addHoliday` duplicate detection matches legacy exactly: a stored holiday whose country differs only by case still blocks the insert, while the read stays bounded.

### Files
- Edit: `src/features/cx-hub/lib/roster.ts` | `dqIsHoliday_` (:560-571)
- Edit: `tests/golden/hub-people-holidays.test.ts` | only if an existing test must reflect the pushed op list

### Context
- `src/features/cx-hub/lib/roster.ts:560-571` | `dqIsHoliday_` pushes `eq:{date,country}` then JS-compares country case-insensitively — the pushed country eq is NOT a superset (SQL eq is case-sensitive)
- `tests/golden/hub-people-holidays.test.ts:257` | oracle failure: `Duplicate case-insensitive` expected err, got ok
- S10-03 | introduced the filtered lookups

### Contract
Keep the `date` eq pushdown (date format is normalized `^\d{4}-\d{2}-\d{2}$` — safe). REMOVE `country` from the pushed `eq` (keep `is deleted_at null`); the existing JS guard already does the case-insensitive country compare. Do NOT use `ilike` (wildcard injection) and do NOT change the guard semantics or the thrown messages.

### Actions
1. Drop `country` from the `eq` map in `dqIsHoliday_`; leave date eq + deleted_at is + JS guard.
2. Run the golden file; confirm the oracle mismatch is gone and no new failures.

### Done when
- `npx vitest run tests/golden/hub-people-holidays.test.ts` -> all pass
- `npx tsc --noEmit` clean

### Verify
- Run: `npx vitest run tests/golden/hub-people-holidays.test.ts` -> all pass

### Handoff
Write results/holiday-eq-01.md (<=10 lines); TL alone updates TRACKER.md.

## lint-test-01: fix 3 eslint errors in plan-added test files
Kind: mini
ID: lint-test-01
Parent: S02
Owner: test-engineer
Depends: upsert-fake-01
Criteria: regression — `npx eslint .` gate: 3 errors in test files added by plan leaves
Skills: none
Budget: files=2; actions=3; changed_lines=15; minutes=4

### Goal
`tests/perf/lookups.test.ts` and `tests/perf/queue-pages.test.ts` have zero eslint errors (warnings untouched).

### Files
- Edit: `tests/perf/lookups.test.ts` | :11 and :15 — two `no-explicit-any`
- Edit: `tests/perf/queue-pages.test.ts` | :19 — `prefer-const` (`let p` -> `const p` if never reassigned)

### Context
- `specs/perf-pushdown/logs/eslint-full.log` | the 3 errors (439 warnings elsewhere are pre-existing/tolerated — do not touch)

### Contract
Test-only, minimal diffs. For the `any`s: replace with the narrowest correct type (the fixture row/param shape — infer from usage; `unknown` + narrow, or a small local interface). Do NOT silence with eslint-disable comments. Do NOT change assertions or behaviour.

### Actions
1. Fix the two `any` annotations in lookups.test.ts with precise types.
2. Fix `let p` in queue-pages.test.ts (`const` if never reassigned; else destructure/rename).
3. `npx eslint tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` -> 0 errors; run both test files green.

### Done when
- `npx eslint tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` reports 0 errors
- `npx vitest run tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` passes

### Verify
- Run: `npx eslint tests/perf/lookups.test.ts tests/perf/queue-pages.test.ts` -> 0 errors

### Handoff
Write results/lint-test-01.md (<=10 lines); TL alone updates TRACKER.md.

## after-timing-01: post-change endpoint medians vs T0 baseline
Kind: mini
ID: after-timing-01
Parent: S01
Owner: data-engineer
Depends: none
Criteria: PLAN perf gate — PERF_BASELINE `## After` table is an empty skeleton awaiting measured post-change medians
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=9

### Goal
The `## After` table in `docs/PERF_BASELINE.md` is filled with post-change medians measured the SAME way as T0 (3 runs x 7 endpoints vs `next start -p 3100` prod build, e2e admin session).

### Files
- Edit: `docs/PERF_BASELINE.md` | `## After` section (:214+) — fill medians + sizes + delta verdicts
- Create: `specs/perf-pushdown/logs/after-timings.log` | raw timing output

### Context
- `docs/PERF_BASELINE.md` | T0 medians table (:122) + `## After` skeleton (:214+); method: `next start -p 3100`, session via `/api/auth/login` (e2e admin), 3 runs per endpoint
- `results/S01-02.md` | the exact endpoints: prod/analytics, tph/page, tph/slots(POST{}), hub/home, queue/aging, queue/analytics, qa/getQaScoresPage
- T0 known 500s: prod/analytics 500, qa/getQaScoresPage 500 (`qa_audits.id` missing — pk overrides landed since)

### Contract
Measurement only — no app source edits, no remote writes. Requires
`npm run build` then `next start -p 3100` (build is already green; reuse if a
current build exists). Same endpoints, same session method, same run count.
Record status codes too — the T0 500s becoming 200 is evidence, not noise.
If the prod server cannot start/login, record the blocker verbatim in the
doc and results instead of guessing.

### Actions
1. Build (or reuse `.next`) + `next start -p 3100`; login via `/api/auth/login` e2e admin.
2. 3 timed runs per endpoint; compute medians + status + size; write raw output to logs/after-timings.log.
3. Fill `## After` table (after median/size columns) + one-line delta verdict per endpoint.

### Done when
- `## After` table has measured values for all 7 endpoints or a recorded blocker
- status codes recorded (esp. the two T0 500s)

### Verify
- Run: `grep -c "|" docs/PERF_BASELINE.md` After rows all filled

### Handoff
Perf-gate evidence complete; PM reviews deltas.
Write results/after-timing-01.md (<=10 lines); TL alone updates TRACKER.md.

## layers-scan-01: remote column evidence for prod analytics projections (SELECT-only)
Kind: mini
ID: layers-scan-01
Parent: S06
Owner: supabase-expert
Depends: none
Criteria: regression — after-timing-01: `/api/prod/analytics` 500 `column prod_daily_layers.productiveMinResolution does not exist`; projection likely used camelCase where remote has snake_case
Skills: none
Budget: files=1; actions=3; changed_lines=60; minutes=7

### Goal
Evidence doc lists the ACTUAL remote columns of `prod_intervals`, `prod_flags`, `prod_daily_layers`, `prod_window_hist` so route.ts projections can be corrected exactly once.

### Files
- Create: `docs/perf/prod-analytics-cols.md` | per-table column lists + the projection at route.ts:58-74 vs actual + alias suggestion per mismatch

### Context
- `src/app/api/prod/analytics/route.ts:56-75` | the four `readAllPaged` projections to verify
- `src/features/shared/jobs/env.ts:88-95` | write-path mappings `productiveMinAux->productive_min_aux`, `productiveMinResolution->productive_min_resolution` (strong hint remote is snake_case)
- `docs/perf/pk-drift-evidence.md` | precedent read-only method (direct-pg pooler, `BEGIN READ ONLY`)
- Approved remote method: read-only SELECT/information_schema only — NO DDL/DML

### Contract
SELECT-only remote read (information_schema.columns or equivalent). No
code edits, no writes, no guesses — every verdict cites the actual remote
column list. If remote read fails, record the error verbatim and stop.

### Actions
1. Query remote `information_schema.columns` (or `\d`) for the four tables.
2. For each projected column in route.ts:58-74, mark exists/missing; for missing, name the actual column that holds the value (e.g. `productive_min_resolution`).
3. Write docs/perf/prod-analytics-cols.md with the table + recommended PostgREST alias form (`"productiveMinResolution":productive_min_resolution`).

### Done when
- all four tables have actual remote column lists recorded
- every mismatch has a concrete alias/fix recommendation

### Verify
- Run: `grep -c "prod_" docs/perf/prod-analytics-cols.md` -> >=4 tables with column lists

### Handoff
layers-fix-01 consumes the verdicts.
Write results/layers-scan-01.md (<=10 lines); TL alone updates TRACKER.md.

## layers-fix-01: fix prod analytics projections to remote-verified columns
Kind: mini
ID: layers-fix-01
Parent: S06
Owner: dev
Depends: layers-scan-01
Criteria: regression — `/api/prod/analytics` 500 on missing column (after-timing-01)
Skills: none
Budget: files=2; actions=2; changed_lines=30; minutes=5

### Goal
`/api/prod/analytics` returns 200 with the same JSON shape — projected columns use remote-verified names with PostgREST aliases where the code expects camelCase keys.

### Files
- Edit: `src/app/api/prod/analytics/route.ts` | the four `columns:` strings (:58-74)
- Edit: `tests/perf/prod-analytics.test.ts` | only if the fake validates column strings that must now include aliases

### Context
- `docs/perf/prod-analytics-cols.md` | remote column verdicts + alias recommendations (from layers-scan-01)
- `src/features/cx-productivity/lib/prod/analytics.ts:149-150` | reads `r.productiveMinResolution`/`r.productiveMinAux` — row keys must stay camelCase
- PostgREST alias syntax: `"alias":column` inside select string

### Contract
Use ONLY columns verified present remotely in docs/perf/prod-analytics-cols.md.
Where remote is snake_case but the engine reads camelCase, project
`"camelKey":snake_col` so returned row keys are unchanged. Response JSON
byte-shape identical. No other file/route changes; bounds/builders unchanged.

### Actions
1. Rewrite the four `columns:` strings per the evidence doc (aliases where needed).
2. `npx vitest run tests/perf/prod-analytics.test.ts` green; `npx tsc --noEmit` clean.

### Done when
- projections contain only remote-verified columns (aliases allowed)
- tests + tsc clean

### Verify
- Run: `npx vitest run tests/perf/prod-analytics.test.ts` -> pass; `npx tsc --noEmit` -> 0 errors

### Handoff
/api/prod/analytics 500 fixed; re-time in a later checkpoint if PM wants.
Write results/layers-fix-01.md (<=10 lines); TL alone updates TRACKER.md.
