# fix-data-1: data-analyst findings (reports/data-1.md, 2026-11-12)
Source: `specs/perf-pushdown/reports/data-1.md`. Every row is blocking.
data-1 (HIGH) splits into two leaves: the Xa `missingItems` dep and the
AuditQueuePage sort-apply dep are independent root causes in disjoint files.
data-5 (LOW in report) is blocking per PM instruction.

## data1-01: Xa missingItems — narrow memo deps to the fields We() consumes
Kind: mini
ID: data1-01
Parent: data-1
Owner: dev
Depends: none
Criteria: data-1.md data-1 (tph-grid-views.tsx:211)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=4

### Goal
`tests/perf/tph-grid-memo.test.tsx` "Xa memo deps" goes green: `missingItems`
recomputes only when a field `We(d,…)` actually reads changes — not on every
new `d` identity.

### Files
- Edit: `src/features/cx-productivity/components/tph-grid-views.tsx` | the `missingItems` useMemo deps only (:205-212)

### Context
- `src/features/cx-productivity/components/tph-grid-views.tsx:201-235` | sibling memos already use field-level deps (`d.dayTotals`, `d.channels`, `d.rebuiltReasons`)
- `src/features/cx-productivity/components/tph-grid-shared.ts:108-109` | `We(d, key)` reads ONLY `d.off`, `d.channels`, `d.activities`
- `tests/perf/tph-grid-memo.test.tsx:443-475` | the 3 asserting cases: unchanged dep fields → no We calls; `d.channels` change → We recompute while `Ua` stays cached; `d.table` change → recompute via `missingMap`

### Contract
Deps become `[missingMap, d.off, d.channels, d.activities]` — exactly the
fields `We` reads plus `missingMap`. Do NOT change the memo body, `missingMap`,
or any other memo/component. Reproduced failure (TL): `We` called 2x when only
`d.date` changed.
Out of scope: audit-queue-page.tsx, any other component or test file.

### Actions
1. Change the `missingItems` dep array `[d, missingMap]` -> `[missingMap, d.off, d.channels, d.activities]` (keep `d.off` first-class — `We` compares `key === d.off`).
2. `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> 7/7 green; record output in results.

### Done when
- `tests/perf/tph-grid-memo.test.tsx` all green (Xa block: no recompute on `date` change; recompute on `channels`; recompute on `table`)
- no other diff in the file than the dep array

### Verify
- Run: `npx vitest run tests/perf/tph-grid-memo.test.tsx` -> all pass

### Handoff
P-19 memoization claim re-verifiable on this component; data1-02 covers the
audit-queue half of data-1.
Write results/data1-01.md (<=10 lines); TL alone updates TRACKER.md.

## data1-02: AuditQueuePage — sort memos depend on apply fn, not the sort object
Kind: mini
ID: data1-02
Parent: data-1
Owner: dev
Depends: none
Criteria: data-1.md data-1 (audit-queue-page.tsx:225-226)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=4

### Goal
`tests/perf/audit-queue-memo.test.tsx` "AuditQueuePage memo deps" goes green:
`sortedQueue`/`sortedPassed` recompute only when their row inputs or the
`apply` function change — not on every re-render (`f`/`g` get a fresh object
identity per render).

### Files
- Edit: `src/features/cx-quality/components/audit-queue-page.tsx` | the two `useMemo` lines :225-226 (plus a destructure line if used)

### Context
- `src/features/cx-quality/components/audit-queue-page.tsx:149-150` | `f`/`g` are `useQaSort` return objects — new wrapper identity per render; only `.apply` is meaningful to the memos
- `src/features/cx-quality/components/qa-shared.tsx:575-593` | real `useQaSort` useCallback-memoizes `apply` on `[n, t]` — `.apply` is the stable member in production AND in the test mock (per-colset spy)
- `tests/perf/audit-queue-memo.test.tsx:157-162,272-317` | mock returns a fresh `{s,toggle,apply}` per call; tests assert apply-call counts 1/2 across renders

### Contract
`sortedQueue = useMemo(() => f.apply(C), [C, f.apply])` and
`sortedPassed = useMemo(() => g.apply(sPassed ?? []), [sPassed, g.apply])` —
e.g. destructure `const { apply: applyQueue } = f` before the memos if eslint
prefers. Do NOT touch useQaSort, other memos, or JSX.
Out of scope: tph-grid-views.tsx, qa-shared.tsx, test files.

### Actions
1. Restabilize the two dep arrays to depend on `f.apply`/`g.apply` (destructure to locals first).
2. `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> all green; record output in results.

### Done when
- `tests/perf/audit-queue-memo.test.tsx` all green (re-render: no re-apply; `s.rows` change re-sorts queue only; `s.passed` change re-sorts passed only)
- no other diff in the file

### Verify
- Run: `npx vitest run tests/perf/audit-queue-memo.test.tsx` -> all pass

### Handoff
With data1-01 green, the data-1 HIGH is closed; TL re-runs `npx vitest run`
expecting 1292/1292.
Write results/data1-02.md (<=10 lines); TL alone updates TRACKER.md.

## data2-01: queue_submissions slot_date reads — prefix-superset bound
Kind: mini
ID: data2-01
Parent: data-2
Owner: supabase-expert
Depends: none
Criteria: data-1.md data-2 (blocking)
Skills: C:\Users\AHMED\AppData\Roaming\devin\skills\supabase\SKILL.md (if present; else none)
Budget: files=5; actions=4; changed_lines=140; minutes=10

### Goal
Every `queue_submissions` read that feeds `dqSubmissionsFor_` returns a strict
superset of today's rows: a stored `slot_date` whose first 10 chars equal a
requested ISO date (e.g. `'2026-05-06T08:00'`, `'2026-05-06 08:00'`) must come
back from Postgres instead of being silently dropped by `eq`/`in`. Snapshot
tables are NOT touched (their consumers compare raw `===`, same as legacy — no
parity break).

### Files
- Edit: `src/features/shared/platform/stores.ts` | `StoreFilter` + `readStoreFiltered` build fn (:36-75) — only if the `or` passthrough form is chosen
- Edit: `src/features/cx-hub/lib/aggregates.ts` | the `in: { slot_date: [pulseTo] }` read (:169)
- Edit: `src/features/cx-queue/lib/server.ts` | the `eq: { slot_date: today }` read (:79)
- Edit: `src/features/cx-queue/lib/pages.ts` | the two `in: { slot_date: [today, yesterday] }` reads (:135, :236)
- Edit: `tests/perf/hub-aggregates.test.ts` | bound-call assertions (:334-347) + one `'…T…'`-suffixed fixture row proving the widened read flows through `dqSubmissionsFor_`

### Context
- `src/features/shared/lib/queue-core.ts:94-108` | `dqSubmissionsFor_` normalizes `dqKeyPart_('slot_date', v).slice(0,10)` then matches ISO dateKeys — THIS is the consumer contract SQL must be a superset of
- `src/features/cx-queue/lib/pages.ts:232` + `src/features/cx-queue/lib/server.ts:264-270` | app writes ISO `dqDateKey_` / validates `DATE_KEY_RE`; only migrated rows can be non-ISO
- `src/features/shared/platform/stores.ts:36-75` | `StoreFilter` supports eq/in/is/gte/lte — a contiguous-date `gte`/`lte` range (e.g. `gte min`, `lte max+'\ufffd'`) already expresses the prefix bound with NO shared-infra change; adding an optional `or?: string` passthrough (`q.or(or)` after the existing filters) is the alternative
- `tests/perf/hub-aggregates.test.ts:253-347` | fake store records chained calls; `:345` asserts the current `in` call — update to the new bound shape; `narrow()` (:310) keeps raw `=== '2026-05-06'` parity semantics
- `specs/perf-pushdown/reports/data-1.md` data-2 row | remote count `select count(*) from queue_submissions where slot_date !~ '^\d{4}-\d{2}-\d{2}$'` — NEEDS_APPROVAL per PLAN, not required for the fix (superset is safe either way); record in results if MCP/remote is unavailable

### Contract
The new bound MUST return every stored `slot_date` whose `slice(0,10)` is one
of the requested dates, AND only dates within the requested contiguous set
(extra-prefix rows are fine — `dqSubmissionsFor_` re-filters in memory).
Strict superset of current results; zero change for clean ISO data. Keep the
in-memory `dqSubmissionsFor_` filter — per PLAN "keep JS filter after every
SQL predicate".
Out of scope: queue_snapshots/agg_snapshots_today reads, jobs.ts:289 (its
`done[...]` compare is raw — same as legacy), migration/backfill, remote writes.

### Actions
1. Choose bound form: `gte`/`lte` on the existing filter (dates are contiguous: single date or [today,yesterday]) OR add optional `or?: string` to `StoreFilter` and pass `slot_date.like.<d>*` terms; implement at the 4 read sites.
2. Update hub-aggregates.test.ts bound assertions; add a `slot_date: '2026-05-06T08:00'`-style fixture row that must now reach `dqSubmissionsFor_` output (e.g. appears in check-in slots) — assert it is read AND matched.
3. Best-effort: run the remote `slot_date !~ '^\\d{4}-\\d{2}-\\d{2}$'` count via MCP read-only if available; record outcome or "no MCP/approval" in results.
4. `npx vitest run tests/perf/hub-aggregates.test.ts tests/golden/queue-checkin.test.ts` -> green; `npx tsc --noEmit` scoped or full -> 0 errors.

### Done when
- a stored `'YYYY-MM-DDT…'`/`'YYYY-MM-DD …'` row is returned by the read and survives `dqSubmissionsFor_` (test proves)
- clean-ISO fixtures produce identical page output (existing golden/perf tests green)
- `in`/`eq`-only assertions updated; tsc 0 errors

### Verify
- Run: `npx vitest run tests/perf/hub-aggregates.test.ts` -> green incl. the T-suffixed case

### Handoff
If a remote count later shows non-ISO rows in `queue_snapshots` /
`agg_snapshots_today`, that is a data-cleanup item for the PM (no parity
break — consumers compare raw, as legacy did).
Write results/data2-01.md (<=10 lines); TL alone updates TRACKER.md.

## data3-01: dqRewrite_ evicts live|<table> after rewriting a store table
Kind: mini
ID: data3-01
Parent: data-3
Owner: dev
Depends: none
Criteria: data-1.md data-3 (blocking)
Skills: none
Budget: files=2; actions=3; changed_lines=50; minutes=6

### Goal
`dqRewrite_` (jobs.ts:70-76) evicts `live|<table>` so `dqCachedLive` never
serves up to 45 s of stale rows after an aggregate refresh — matching the
`flushWrites` invalidation (env.ts:422) and the legacy `cache_stamps`
invalidate-on-write.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | `dqRewrite_` body + `cacheRemove` added to the existing repo import (:12)
- Edit: `tests/jobs/queue-tickets-read.test.ts` | one regression case in the existing describe

### Context
- `src/features/cx-queue/lib/jobs.ts:12,70-76` | `cachePut` already imported from repo; `dqRewrite_` deletes then early-returns on `!rows.length` — eviction must cover BOTH branches
- `src/features/shared/platform/stores.ts:83-107` | `dqCachedLive` serves `'live|<name>'` for 45 s; `cacheRemove` is exported from repo.ts:57
- `src/features/shared/jobs/env.ts:416-425` | the `flushWrites` precedent: `cacheRemove('live|' + op.table)` in a best-effort try/catch that must not abort the write path
- `tests/jobs/queue-tickets-read.test.ts:9-102` | working harness: `buildQueueAggregates_` runs against the recording supabase stub (all ops return `{data:[],error:null}`); stores module is mocked but `cachePut`/`cacheGet`/`cacheClear` from repo are real

### Contract
After the delete succeeds (i.e. right after the `delErr` check, so the
`!rows.length` early-return also evicts), call
`cacheRemove('live|' + table)` inside a try/catch that swallows errors —
eviction is best-effort, never aborts the rewrite. One line + catch comment.
Out of scope: `flushWrites`, `dqCachedLive`, other jobs, other test files.

### Actions
1. Add `cacheRemove` to the repo import; add the best-effort `cacheRemove('live|' + table)` after the `delErr` check in `dqRewrite_`.
2. In queue-tickets-read.test.ts add a case: `cacheClear()` + `cachePut('live|agg_queue_now','[{}]',45)` + `cachePut('live|aging_open_tickets','[{}]',45)`, run `buildQueueAggregates_(new Date(...))`, assert both `cacheGet` return null.
3. `npx vitest run tests/jobs/queue-tickets-read.test.ts tests/perf/flush-invalidate.test.ts` -> green; record output.

### Done when
- `live|agg_queue_now` and `live|aging_open_tickets` are evicted by a `buildQueueAggregates_` run (test proves)
- a failed delete still throws before eviction is reached (order preserved)
- targeted vitest green

### Verify
- Run: `npx vitest run tests/jobs/queue-tickets-read.test.ts` -> green

### Handoff
Post-refresh `dqCachedLive` readers (`getQueueHealthPage`, check-in page)
see fresh aggregates immediately.
Write results/data3-01.md (<=10 lines); TL alone updates TRACKER.md.

## data4-01: env upsert dedupes op.rows last-wins per key tuple
Kind: mini
ID: data4-01
Parent: data-4
Owner: dev
Depends: none
Criteria: data-1.md data-4 (blocking)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=7

### Goal
`applyOp`'s upsert path (env.ts:642-666) dedupes `op.rows` by key tuple,
last-wins, BEFORE the `.upsert()` — so one bulk op carrying duplicate key
tuples neither trips "cannot affect row a second time" nor inserts both dup
rows via the delete+insert fallback. Restores the legacy row-by-row last-wins.

### Files
- Edit: `src/features/shared/jobs/env.ts` | the upsert block (:642-666) + a small dedupe helper near `tuplesOf` (:669-680)
- Edit: `tests/perf/fallback-log.test.ts` | one case asserting deduped rows reach `upsert`/`insert`

### Context
- `src/features/shared/jobs/env.ts:636-666` | `op.rows` flows into `.upsert(rows,{onConflict})` AND the fallback `.delete().in()` + `.insert(rows)` — dedupe once, use the deduped array for all three
- `src/features/shared/jobs/env.ts:669-680` | `tuplesOf` keeps FIRST occurrence for delete tuples; the row dedupe must keep LAST (later row overwrites) — e.g. `Map<jsonTuple, row>` iterating in order, `deduped = [...map.values()]`
- `tests/perf/fallback-log.test.ts:29-60` | `fakeDb` records every chained call (`calls` array: method + args) — assert the `upsert`/`insert` call args contain deduped rows
- `tests/perf/fallback-log.test.ts:106-127` | existing env-upsert case to mirror (`env.upsert('t',['k'],rows,null)` + `flushWrites`)

### Contract
Dedupe key = `JSON.stringify(op.keys.map(k => r[k]))`; on collision the LATER
row wins (legacy semantics). Dedupe happens once before the `.upsert()`; the
delete-vals/tuples derive from the deduped set naturally. Non-duplicate inputs
must produce byte-identical queries (no reordering beyond last-wins collapse).
Out of scope: `memoUpsert`, `tuplesOf`, `replaceKeys`/`append` paths, repo.ts.

### Actions
1. Add a last-wins dedupe helper (e.g. `dedupeRows_(keys, rows)`) next to `tuplesOf`; apply it at the top of the upsert branch and use the result for upsert/delete/insert.
2. In fallback-log.test.ts add a case: `env.upsert('t2',['k'],[{k:'a',v:1},{k:'a',v:2},{k:'b',v:3}],null)` + `flushWrites()` -> the recorded `upsert` call gets `[{k:'a',v:2},{k:'b',v:3}]`; a second variant with `CONSTRAINT_ERR` queued -> fallback `insert` gets the same deduped rows.
3. `npx vitest run tests/perf/fallback-log.test.ts tests/perf/flush-invalidate.test.ts` -> green; record output.

### Done when
- duplicate key tuples in one `env.upsert` op collapse last-wins on BOTH the upsert and the fallback insert path (test proves)
- existing fallback-log and flush-invalidate cases stay green

### Verify
- Run: `npx vitest run tests/perf/fallback-log.test.ts` -> green incl. the new case

### Handoff
Bulk job writes with intra-batch dup keys are safe again; data-5 covers the
separate updateRows read-side finding.
Write results/data4-01.md (<=10 lines); TL alone updates TRACKER.md.

## data5-01: updateRows batch — page the `.in(keyField, keys)` select
Kind: mini
ID: data5-01
Parent: data-5
Owner: dev
Depends: none
Criteria: data-1.md data-5 (LOW in report, blocking per PM)
Skills: none
Budget: files=2; actions=3; changed_lines=60; minutes=7

### Goal
`updateRows`' batch select (`repo.ts:323-332`) can no longer silently truncate
when >~1000 existing rows match `keys` (PostgREST max-rows) — every matched
key's update is merged instead of returning `null` for missed keys.

### Files
- Edit: `src/features/shared/platform/repo.ts` | the `updateRows` select (:323-327) only
- Edit: `tests/platform/repo.test.ts` | one regression case in the updateRows describe

### Context
- `src/features/shared/platform/repo.ts:199-217` | `readAllPaged(name, { build })` — PK-ordered `.range` pager that exists precisely for this truncation class; `build` gets the `TableQuery` to apply `.in(keyField, keys)`
- `src/features/shared/platform/repo.ts:312-332` | `updateRows` — `keys` is already `[...new Set(...)]`; `byKey` map collapses dup rows so page ORDER is irrelevant to correctness
- `tests/platform/repo.test.ts:12-80` | `fakeDb(queue)` shifts one canned `{data,error}` per awaited builder + records calls — queue a full first page then a short page to simulate >pageSize matches
- `tests/perf/fallback-log.test.ts:73-104` | existing `updateRows` call-shape expectations (select -> upsert/error -> per-row) — the paged select must not break them

### Contract
Preferred: `readAllPaged(table, { build: (q) => q.in(keyField, keys) })` and
use its full row list for `byKey`. If `keys` can exceed URL-safe `.in` size,
chunk `keys` (<=500/chunk) and `readAllPaged` per chunk — owner picks, but the
acceptance test must prove >1000 matches all merge. Behaviour for <=pageSize
stays identical; `currentRows` content unchanged (select `*`).
Out of scope: env.ts, `updateRowsOneByOne`, the upsert/fallback half of
updateRows (:333+), other callers.

### Actions
1. Replace the single `.select('*').in(keyField, keys)` with paged reads (readAllPaged build-in, optionally chunked); keep `selErr` propagation (`readAllPaged` already throws on error — adapt the `selErr` line accordingly).
2. In repo.test.ts add a case: fake a first page of >1000 rows (e.g. pageSize boundary rows) then a short second page; call `updateRows` with keys spanning both pages; assert every key's patch merges (no `null` results) and `in` was called on `keyField`.
3. `npx vitest run tests/platform/repo.test.ts tests/perf/fallback-log.test.ts` -> green; `npx tsc --noEmit` -> 0 errors.

### Done when
- >pageSize matching rows all merge in `updateRows` (test proves; no missed keys)
- existing updateRows cases (single/fallback/log-once) stay green; tsc 0 errors

### Verify
- Run: `npx vitest run tests/platform/repo.test.ts` -> green incl. the new paged case

### Handoff
Latent >1000-key update truncation closed; no caller changes needed
(`updateRows` signature and result contract unchanged).
Write results/data5-01.md (<=10 lines); TL alone updates TRACKER.md.
