# fix-qa-1: QA round-1 blocking findings (reports/qa-1.md)
Source: `specs/perf-pushdown/reports/qa-1.md` — every row is blocking for this
FIX round. One independent root-cause fix per leaf; all file sets are disjoint
so leaves are parallel-safe. qa-4 (LOW) is scoped as a bounded audit + minimal
parity fix — if the audit finds more unsafe `dir.by` consumers than fit the
Files list, stop and return RESHARD_NEEDED with the list.

## qa1-01: sc_behaviour or-clause keeps `date=''` rows (HIGH parity defect)
Kind: mini
ID: qa1-01
Parent: qa-1
Owner: dev
Depends: none
Criteria: qa-1 finding qa-1 — silent row loss vs legacy whole-table path
Skills: none
Budget: files=2; actions=3; changed_lines=40; minutes=6

### Goal
`scReadRange_('sc_behaviour', ...)` returns rows with `date=''` exactly like the legacy filter; pushed or-predicate matches the `TEXT NOT NULL DEFAULT ''` reality.

### Files
- Edit: `src/features/cx-people/lib/scorecard-server.ts` | `scReadRange_` or-branch (:206-216)
- Edit: `tests/perf/scorecard-range.test.ts` | or() double (:40-52), seed (:98-103), sc_behaviour case (:119-125)

### Context
- `src/features/cx-people/lib/scorecard-server.ts:206-216` | current or-string `date.is.null,and(date.gte.,date.lte.)` drops `date=''` rows
- `src/features/cx-quality/lib/server.ts:2316` | established blank-eq or form: `interaction_at.is.null,interaction_at.eq.` (qa-blank-01 precedent)
- `supabase/migrations/20261105172248_people.sql:323` | `date TEXT NOT NULL DEFAULT ''` — real undated rows are `''`, never NULL
- `tests/perf/scorecard-range.test.ts` | `legacyFilter` parity oracle at :81-86 keeps `d === ''` rows for sc_behaviour

### Contract
or-string becomes `date.is.null,date.eq.,and(date.gte.${from},date.lte.${to})`
(exact PostgREST `eq.` empty-value form from the server.ts:2316 precedent).
Post-read JS guard at :213-216 stays. Replace the impossible `date: null`
sc_behaviour seed row with `date: ''` (and keep/adjust the ops assertion to the
new or-string); the test double's or() must parse the new 3-branch expression
including `date.eq.` matching `r.date === ''`. Out of scope: other tables'
gte/lte branch, `scIo_` in-memory path, any other file.

### Actions
1. Update the or-string in `scReadRange_` per contract.
2. Extend the test double's or() regex/handler for the new expression; change the sc_behaviour undated seed to `date: ''`; update the ops assertion.
3. Run the focused test; assert rows parity vs `legacyFilter` including the `date:''` row.

### Done when
- `npx vitest run tests/perf/scorecard-range.test.ts` green incl. a `date:''` sc_behaviour row returned by `scReadRange_`
- `npx tsc --noEmit` 0 errors

### Verify
- Run: `npx vitest run tests/perf/scorecard-range.test.ts` -> pass

### Handoff
Same `''`-blank pattern as qa-blank-01 now also covers sc_behaviour.
Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-02: re-measure GET /api/prod/analytics after layers-fix-01
Kind: mini
ID: qa1-02
Parent: qa-2
Owner: data-engineer
Depends: none
Criteria: qa-1 finding qa-2 — flagship endpoint's After row is unverifiable (measured pre-fix)
Skills: none
Budget: files=2; actions=4; changed_lines=30; minutes=10

### Goal
`docs/PERF_BASELINE.md` ## After table has a post-layers-fix-01 warm timing for `GET /api/prod/analytics` (or a recorded, evidenced blocker).

### Files
- Edit: `docs/PERF_BASELINE.md` | ## After prod/analytics row (:226) + its delta-verdict line
- Create: `specs/perf-pushdown/logs/after-timings-qa1.log` | raw runs (3x time_total/size_download/http_code + error body on non-200)

### Context
- `specs/perf-pushdown/results/after-timing-01.md` | exact prior method: `npm run build`, `next start -p 3100`, login `POST /api/auth/login` e2e.admin@dabdoob.com cookie jar, curl timing x3, median recorded
- `specs/perf-pushdown/results/layers-fix-01.md` | the fix that landed after that measurement (snake_case aliases; prod-analytics vitest 4/4)
- `docs/PERF_BASELINE.md:226` | stale row `0.674 (**500**)` + verdict referencing `prod_daily_layers.productiveMinResolution` — that error should now be gone

### Contract
Measurement only — no app source edits, no remote writes. The stale `.next`
build `XmwNC6nOQaYMaeSTp-xcn` predates layers-fix-01: rebuild first
(`npm run build`), then `next start` on a free port, login, 3 warm runs of
`GET /api/prod/analytics`; record median + http_code + size in the table and
update the verdict line (still-500 -> name the new error verbatim; 200 ->
record size/delta vs before). If a step cannot run in this environment, record
the exact blocker in the log + results instead of fabricating numbers.
Out of scope: other endpoints' rows, PERF_BASELINE sections besides the
prod/analytics row + its verdict line.

### Actions
1. `npm run build` -> exit 0 (log tail into the log file).
2. `next start` + login + 3 timed curls of `GET /api/prod/analytics` into the log file.
3. Update the ## After prod/analytics row + verdict line with measured numbers.
4. Write results/qa1-02.md with the before/after medians + http_code.

### Done when
- ## After prod/analytics row reflects a post-layers-fix-01 measurement (or an explicit recorded blocker)
- raw evidence exists in the log file

### Verify
- Run: `grep -n "prod/analytics" docs/PERF_BASELINE.md` -> row/verdict updated past the stale `0.674 (500)` entry

### Handoff
QA can re-verify C2/C3 budget check for the flagship endpoint.
Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-03: delete leftover artifacts (0-byte `nul`, mangled-path logs)
Kind: mini
ID: qa1-03
Parent: qa-3
Owner: dev
Depends: none
Criteria: qa-1 finding qa-3 — `nul` breaks `git checkout` on Windows if committed
Skills: none
Budget: files=3; actions=2; changed_lines=5; minutes=4

### Goal
Repo root no longer contains the 0-byte `nul` file or the two stray `specsperf-pushdownlogsfakes-01-*.log` files; nothing of theirs is staged.

### Files
- Edit: `nul` | delete this 0-byte file entirely (Windows reserved name)
- Edit: `specsperf-pushdownlogsfakes-01-tsc.log` | delete this stray log file entirely
- Edit: `specsperf-pushdownlogsfakes-01-vitest.log` | delete this stray log file entirely

### Context
- `specs/perf-pushdown/reports/qa-1.md` finding qa-3 | all three verified present at repo root, untracked leftovers of the fakes-01 run

### Contract
Delete exactly those three files — nothing else in the dirty tree (the whole
spec is one uncommitted change set; every other file belongs to the build).
If `git rm`/`del` fails on `nul` under Windows, use `rm -f ./nul` /
`cmd //c "del \\?\%CD%\nul"` style escaping — record what worked.
Out of scope: .gitignore edits, any other file.

### Actions
1. Delete the three named files.
2. `git status --porcelain` -> confirm none of the three names appear; record the tail in results.

### Done when
- the three files are absent from the working tree
- `git status --porcelain | grep -c "nul\|specsperf"` is 0

### Verify
- Run: `ls nul specsperf-pushdownlogsfakes-01-* 2>&1` -> not found for all three

### Handoff
None.
Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-04: `pwDirectory` injected admins must not leak into people enumerations
Kind: mini
ID: qa1-04
Parent: qa-4
Owner: dev
Depends: none
Criteria: qa-1 finding qa-4 — `dir.by` gains config admins absent from roster vs prior raw roster reads
Skills: none
Budget: files=3; actions=5; changed_lines=80; minutes=9

### Goal
`dir.by` enumerations see roster-derived persons only (legacy parity); config admins absent from roster stay reachable via `dir.admins` and lookup methods — no injected `name=email` ghost rows surface in people lists.

### Files
- Edit: `src/features/shared/platform/identity.ts` | `pwDirectory` body (:194-~240): `by` construction + `admins` injection + `person`/`name`/`managerOf` fallbacks
- Edit: `src/features/cx-people/lib/one-on-ones-page.ts` | admin enumeration at :1086 only — switch to `dir.admins`-based list if it needs config admins (record decision)
- Edit: `tests/perf/identity-roster.test.ts` | add case: roster-absent admin reachable via `person`/`admins`/`name` but absent from `Object.keys(dir.by)`

### Context
- `src/features/shared/platform/identity.ts:194-240` | `by` built from roster rows then `admins.forEach` injects `{name: a, role:'admin', ...}` for absent admins (:215-218)
- Enumerating consumers (people lists): `kpilogs.ts:80`, `tlperformance.ts:621`, `coaching.ts:32`, `meetings.ts:119`, `one-on-ones-page.ts:109`, `scorecard-server.ts:256`, `tph/touches/route.ts:36`, prod-analytics `dirBy` (:39-47)
- `src/features/cx-people/lib/one-on-ones-page.ts:1086` | legitimately wants admins — uses `dir.by` filter on `role==='admin'`; `dir.admins` is the authoritative config list
- `specs/perf-pushdown/results/S07-01.md` | caveat origin; `tests/perf/identity-roster.test.ts:71` | existing ilike/`_` case to extend near

### Contract
`by` contains ONLY roster-derived persons (so every `Object.keys/values(dir.by)`
enumeration regains raw-roster parity). Config admins absent from roster:
`admins` array unchanged (full config list); `person(e)`, `name(e)`,
`managerOf(e)` keep working for them via a synthesized on-lookup fallback
identical to the current injected shape (`name=email`, `role='admin'`,
`tlEmail=null`, `active=true`, `position=''`) WITHOUT mutating `by`. At
one-on-ones-page.ts:1086 only: if the admin picker must include config admins
absent from roster, source it from `dir.admins` (+ `by`/person lookups for
name/active); if rostered-admins-only matches intent, leave it and record why.
If auditing shows ANOTHER enumerated people list where roster-parity is wrong
in a way this change doesn't already fix, stop -> RESHARD_NEEDED with the
consumer list. Out of scope: `roleForEmail` (:98-107), `dir.admins` content,
any other consumer edit beyond :1086.

### Actions
1. Restructure `pwDirectory` per contract (roster-only `by` + lookup fallbacks for absent admins).
2. Decide + (only if needed) fix the :1086 admin enumeration; record the decision.
3. Spot-check the listed enumerating consumers compile unchanged (they read `dir.by` — no signature change allowed).
4. Add the roster-absent-admin test case.
5. Run focused tests + tsc.

### Done when
- `Object.keys(dir.by)` == roster emails only; `person`/`name`/`managerOf` still resolve a roster-absent admin (test proves both)
- `npx vitest run tests/perf/identity-roster.test.ts` green; `npx tsc --noEmit` 0 errors

### Verify
- Run: `npx vitest run tests/perf/identity-roster.test.ts` -> pass

### Handoff
`dir.by` is roster-parity again; `dir.admins` is the way to enumerate config admins.
Write results/qa1-04.md (<=10 lines); TL alone updates TRACKER.md.

## qa1-05: clear the 2 new eslint warnings (`_table` unused)
Kind: mini
ID: qa1-05
Parent: qa-5
Owner: test-engineer
Depends: none
Criteria: qa-1 finding qa-5 — the only warning delta vs the 439 pre-existing
Skills: none
Budget: files=2; actions=2; changed_lines=10; minutes=4

### Goal
`tests/perf/stores-filter.test.ts` and `tests/perf/tph-store.test.ts` produce zero eslint warnings; fakes still behave identically.

### Files
- Edit: `tests/perf/stores-filter.test.ts` | `from: (_table: string)` at :13
- Edit: `tests/perf/tph-store.test.ts` | `from: (_table: string)` at :11

### Context
- Both are fake-builder signatures where the param is unused; prefix-underscore is the repo convention but eslint still flags them here — either drop the param (callers in-file only) or reference it.

### Contract
Test-only change; the fakes' external behaviour (ops recorded, filters applied)
must be identical — these files feed other suites' assertions. Prefer the
smallest diff that silences the warning (remove the param if `from`'s signature
is local to the fake; if the fake must satisfy a `from(table)` call shape, keep
the param but make it used, e.g. record or assert it). Out of scope: any source
file, any other test file.

### Actions
1. Fix both `_table` warnings per contract.
2. `npx eslint tests/perf/stores-filter.test.ts tests/perf/tph-store.test.ts` -> 0 warnings; `npx vitest run tests/perf/stores-filter.test.ts tests/perf/tph-store.test.ts` -> green.

### Done when
- eslint on both files: 0 errors, 0 warnings
- both test files still green

### Verify
- Run: `npx eslint tests/perf/stores-filter.test.ts tests/perf/tph-store.test.ts` -> clean

### Handoff
Lint delta vs pre-existing baseline is 0.
Write results/qa1-05.md (<=10 lines); TL alone updates TRACKER.md.
