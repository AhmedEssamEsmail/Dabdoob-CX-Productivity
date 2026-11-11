# fix-perf-1: performance review findings (reports/perf-1.md, 2026-11-11)
Source: `specs/perf-pushdown/reports/perf-1.md`. All 5 rows are blocking per PM.
Mapped: perf-1+perf-4+perf-5 -> perf1-01 (one build+restart+measure session and
one PERF_BASELINE.md update; perf-4's analytics payload only exists after the
500->200 fix, and perf-5 is the same re-time). perf-2 -> perf1-02. perf-3 ->
perf1-03 (user note: index approved, but remove the migration + record evidence
in PERF_BASELINE.md if the `(date,class)` unique index provably covers it).

## perf1-02: page maqsam_calls/fd_activities window reads via readAllPaged
Kind: mini
ID: perf1-02
Parent: perf-1
Owner: dev
Depends: none
Criteria: PLAN #2 (P-01 no silent truncation) — fixes perf-1.md row perf-2 (MED)
Skills: none
Budget: files=1; actions=3; changed_lines=40; minutes=6

### Goal
`maqsamRows` and `fdActivityRows` in `tlqIo_()` return ALL rows in their `ts_ms`
windows through `readAllPaged` — the same silent-truncation class P-01 fixed
everywhere else (`fd_activities` n_live_tup 686,753, the largest table; TL-queue
~1 day + padding windows can exceed the assumed 1000-row PostgREST cap).

### Files
- Edit: `src/features/cx-queue/lib/tlqueue.ts` | `tlqIo_()` `maqsamRows` (:609-617) and `fdActivityRows` (:618-625) bodies only

### Context
- `src/features/shared/platform/repo.ts:187-217` | `readAllPaged(name, { columns, build })` — PK-ordered `.range` pager; default pk `id` is correct for both tables
- `docs/perf/pk-drift-evidence.md:22-24` | fd_activities/maqsam_calls verified `id` identity PK; `idx_fd_activities_ts`/`idx_maqsam_calls_ts` btrees serve the ts_ms predicates
- `src/features/cx-queue/lib/tlqueue.ts:34-45` | imports — add `readAllPaged` to the repo import; `db`/`described` stay (other seams still use them)

### Contract
Same row set per call: maqsam `ts_ms >= fromMs-86400000 AND < toMs+86400000`;
fd `ts_ms >= fromMs-86400000`. Columns stay `dedupe_key,ts_ms,cols`. Row order
becomes id-asc page order (was unordered) — callers consume sets and dedupe by
`dedupe_key`, so no downstream change. `TlqIo` signatures unchanged. Error path:
`readAllPaged` throws `Error(error.message)` instead of `described(...)` —
accepted (same class as every other readAllPaged caller).
Out of scope: all other `tlqIo_` seams, callers, the `TlqIo` type, other files.

### Actions
1. `maqsamRows` body -> `return (await readAllPaged('maqsam_calls', { columns: 'dedupe_key,ts_ms,cols', build: (q) => q.gte('ts_ms', fromMs - 86400000).lt('ts_ms', toMs + 86400000) })) as Row[]`.
2. `fdActivityRows` body -> same shape on `'fd_activities'` with only `.gte('ts_ms', fromMs - 86400000)`.
3. Run the Verify commands; record output in results.

### Done when
- Both reads page via `readAllPaged`; no unpaged `db().from('maqsam_calls'|'fd_activities')` windowed select remains in `tlqIo_`
- Targeted vitest + scoped tsc green; no signature/behaviour change beyond completeness

### Verify
- Run: `npx vitest run tests/golden/queue-tlqueue.test.ts tests/perf/read-all-paged.test.ts` -> all green; `npx tsc --noEmit` -> 0 errors (scoped run acceptable per prior leaves)

### Handoff
TL-queue window reads can no longer truncate at the PostgREST cap; perf-2
closed. Write results/perf1-02.md (<=10 lines); TL alone updates TRACKER.md.

## perf1-03: drop redundant prod_window_hist date index; record coverage evidence
Kind: mini
ID: perf1-03
Parent: perf-1
Owner: supabase-expert
Depends: none
Criteria: PLAN #7 — fixes perf-1.md row perf-3 (LOW, blocking per PM; user
conditionally approved removal: delete only if coverage is provable)
Skills: none
Budget: files=2; actions=4; changed_lines=30; minutes=6

### Goal
Decide from RECORDED evidence whether baseline `prod_window_hist_date_class_key`
UNIQUE `(date, class)` covers the pushed `date` predicates (gte week-21 / lte
week+6 in prod analytics). If yes: delete
`supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` and
record the coverage evidence + removal decision in `docs/PERF_BASELINE.md`. If
not provable: keep the file (it stays user-approved) and record why instead.

### Files
- Edit: `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` | whole file — delete it, only on the proven-coverage path
- Edit: `docs/PERF_BASELINE.md` | append one `### prod_window_hist index decision (perf-3)` note at the end of the `## After` section

### Context
- `docs/PERF_BASELINE.md:76-77` | baseline pg_indexes rows: pkey `(id)` + `prod_window_hist_date_class_key` UNIQUE btree `(date, class)`; table is 126 rows (:58)
- `supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql` | the candidate single-col `(date)` index under review
- `specs/perf-pushdown/results/pm1-02.md` | original approval context (file-only, never applied remotely)
- `src/app/api/prod/analytics/route.ts` | `prod_window_hist` read bounds `date` with gte/lte — a leftmost `date` btree column serves both predicates

### Contract
Standard btree leftmost-prefix semantics: UNIQUE `(date, class)` serves any
`date` equality/range predicate; a second `(date)` index is a narrower duplicate
a planner would not prefer — and the table is 126 rows (seq-scan trivially cheap
regardless). Proof source = the recorded pg_indexes snapshot + migration DDL;
NO remote access, NO new migration, NO remote write. The doc note must state:
which index covers, the evidence quoted, that pm1-02's approval is superseded
(or retained) by perf-3, and the file disposition.
Out of scope: other migrations, other PERF_BASELINE sections, remote DB.

### Actions
1. Verify `date` is leftmost in `prod_window_hist_date_class_key` per the recorded indexdef and that the app's `prod_window_hist` predicates are `date`-only (gte/lte; route.ts + analytics caller).
2. Coverage proven -> delete the migration file. Not provable -> keep it.
3. Append the `### prod_window_hist index decision (perf-3)` note to `docs/PERF_BASELINE.md` with the pg_indexes evidence + disposition (removed or retained + reason).
4. `git status -- supabase/migrations docs/PERF_BASELINE.md` -> expected disposition; record output in results.

### Done when
- Exactly one disposition: migration file absent + evidence note, or file retained + documented rationale
- PERF_BASELINE.md note quotes the `(date, class)` UNIQUE indexdef and names the predicates it covers

### Verify
- Run: `git status -- supabase/migrations docs/PERF_BASELINE.md` -> migration deleted + doc modified (path A) or doc-only (path B)

### Handoff
perf-3 closed with recorded evidence; pm1-02 approval resolved. PERF_BASELINE.md
gets one further `## After` update from perf1-01 — keep the appended note last.
Write results/perf1-03.md (<=10 lines); TL alone updates TRACKER.md.

## perf1-01: serve final build; re-time analytics + hub/home; record verdicts
Kind: mini
ID: perf1-01
Parent: perf-1
Owner: data-engineer
Depends: perf1-02, perf1-03
Criteria: PLAN perf budgets — fixes perf-1.md rows perf-1, perf-4, perf-5
Skills: none
Budget: files=2; actions=7; changed_lines=80; minutes=10

### Goal
The served production build predates pm2-01's `eval('from')` fix, so P-02 is
unverifiable and hub/home was re-timed on stale code. Rebuild, restart
`next start -p 3100`, and produce the final 3-run evidence:
`GET /api/prod/analytics` expect **200** with warm median <= T0 0.487 s;
`GET /api/hub/home` expect median <= T0 1.459 s. Then update
`docs/PERF_BASELINE.md` `## After` rows + Delta verdicts, including the
P-02/P-03/P-04 payload reality vs the >=50% drop target (perf-4).

### Files
- Edit: `docs/PERF_BASELINE.md` | `## After` table rows (analytics, hub/home) + Delta verdicts + one payload-target note only
- Create: `specs/perf-pushdown/logs/perf1-timings.log` | raw build/curl output

### Context
- `docs/PERF_BASELINE.md:114-139` | T0 method — `curl -w '%{time_total} %{size_download} %{http_code}'`, login `POST /api/auth/login` as `e2e.admin@dabdoob.com`, cookie jar, 3 runs, prod server `next start -p 3100`
- `docs/PERF_BASELINE.md:214-250` | `## After` table + Delta verdicts to update (keep perf1-03's appended note last)
- `specs/perf-pushdown/results/qa1-02.md` + `results/after-timing-01.md` | prior run mechanics + log format
- `specs/perf-pushdown/reports/perf-1.md` | rows perf-1/perf-4/perf-5 ONLY — the stale-build diagnosis and payload numbers (tph/page -24.4%, hub/home +3.4%)

### Contract
Build must postdate all src edits: run `npm run build` fresh, record the new
BUILD_ID, then stop the stale `next start` on :3100 and start the new one.
Re-measure ONLY the two endpoints; all other rows stand. Median of 3 runs as at
T0 (cold run1 included). Record numbers as measured — if analytics is not 200 or
hub/home is reproducibly > 1.459 s, mark the verdict BREACH with the numbers;
do NOT attempt any code fix. Payload verdict (perf-4): document per-endpoint
reality and restate the target vs the pushed-down reads (the pushed tables are a
minor share of total payload; tph/page -24.4%, hub/home ~+3%, analytics size now
measurable for the first time on a 200).
Out of scope: source edits, other endpoints, migrations, remote DB, any e2e/dev
server on :3000.

### Actions
1. `npm run build` -> log; record BUILD_ID + timestamp.
2. Stop the stale `next start` on :3100; start `next start -p 3100` on the new build; confirm it serves (probe one endpoint).
3. Login `e2e.admin@dabdoob.com` (cookie jar); curl `GET /api/prod/analytics` x3 (time_total, size_download, http_code) -> log.
4. curl `GET /api/hub/home` x3 -> log.
5. Update the `## After` rows + Delta verdicts for both endpoints (status, median, size, vs T0 budget verdict).
6. Add the perf-4 payload note: per-endpoint deltas vs the >=50% target and the restated acceptance (or breach) with one-line rationale.
7. Write results/perf1-01.md with the medians/status/verdicts + BUILD_ID.

### Done when
- Served build is the fresh build (BUILD_ID recorded); analytics row shows 200 + median/size (or recorded BREACH)
- hub/home row shows median vs 1.459 s with PASS/BREACH verdict
- PERF_BASELINE.md updated (perf1-03 note preserved); raw log exists

### Verify
- Run: `curl -s -o NUL -w "%{http_code}" -b <cookie-jar> http://localhost:3100/api/prod/analytics` -> 200 expected; `git diff --stat docs/PERF_BASELINE.md` -> After rows + note changed

### Handoff
Final-build evidence for the perf reviewer's DELTA re-check; closes perf-1,
perf-4, perf-5. Write results/perf1-01.md (<=10 lines); TL alone updates
TRACKER.md.
