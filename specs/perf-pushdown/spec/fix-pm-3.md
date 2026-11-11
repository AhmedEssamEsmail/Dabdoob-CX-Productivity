# fix-pm-3: PM findings round 3 (reports/pm-3.md, 2026-11-11)
Source: `specs/perf-pushdown/reports/pm-3.md`. One blocking row (F4).
Mapping: F4 -> pm3-01 (instrument + profile + isolate) then pm3-02 (fix +
re-time + PERF_BASELINE update — leaf authored after pm3-01 names the
regressed read(s); its file list depends on the finding).
Note: pm-3 suggests "debugger for isolation" — debugger is not a spawnable
owner for the TL; the dev leaf pm3-01 covers isolation via instrumentation.

## pm3-01: instrument per-read timings in getHomePage; isolate the regressed read(s)
Kind: mini
ID: pm3-01
Parent: pm-3
Owner: dev
Depends: none
Criteria: pm-3.md F4 (blocking); PLAN perf budgets (`<= T0 baseline` per pushed-down endpoint)
Skills: none
Budget: files=3; actions=6; changed_lines=90; minutes=10

### Goal
`GET /api/hub/home` regressed from T0 median 1.459 s to 2.189 s (+50%,
reproducible all 3 runs; `logs/perf1-timings.log`) on the final build
`RQxQ00OoPfT22Fj8nO3wI`. Turn the existing no-op `perf_` lap recorder in
`aggregates.ts` into a real emitter that times every awaited read in
`getHomePage`, serve the instrumented production build on :3100, capture 3
runs, and report which stage(s)/read(s) account for the ~+0.7 s delta.

### Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | `perf_` helper (:53-66) + instrumentation inside `getHomePage` (:155-401) only — no query/filter/order/payload change
- Create: `specs/perf-pushdown/logs/pm3-server.log` | `next start` stdout; the perf line lands here
- Create: `specs/perf-pushdown/logs/pm3-profile.log` | harvested per-stage timings + the 3 curl runs

### Context
- `src/features/cx-hub/lib/aggregates.ts:53-66` | `perf_(name)` already returns `{lap, end}` collecting `[mark, ms]` — `end()` discards them; extend it (e.g. `time(label, promise)` for durations + emit one line in `end()`)
- `src/features/cx-hub/lib/aggregates.ts:165-178` | the 7-read `Promise.all` (aging_open_tickets, roster, queue_submissions, dq_aging_flags, sc_daily, prod_daily_layers, fcr_daily) — concurrent reads need per-promise durations, not lap-from-start
- `src/features/cx-hub/lib/aggregates.ts:158-160,330-339,365-367,377-388,390-398` | untimed awaits: requireRole, configAll, provider loop (already lapped by name), dqLastRun, dqSetting, admin block (queue_snapshots + agg_queue_now), ecosystemHealth
- `specs/perf-pushdown/results/perf1-01.md` + `docs/PERF_BASELINE.md` T0-method section | run mechanics: `npm run build`, kill stale :3100 server, `next start -p 3100`, login `e2e.admin@dabdoob.com` via `POST /api/auth/login` cookie jar, `curl -w '%{time_total} %{http_code}'`, median of 3
- `specs/perf-pushdown/reports/pm-3.md` | suspect list: P-04/P-15 pushed predicates (stores.ts gte/lte, aggregates.ts bounds), `configAll()`/`pwDirectory()` adoption, `dqCachedLive` TTL invalidation, `readAllPaged` extra roundtrips, Promise.all regrouping

### Contract
Instrument ONLY — response stays byte-identical (same rows/keys/order); no
query, filter, order, cache, or provider-sequencing change in this leaf.
Emit ONE `console.log` line per `getHomePage` call (e.g.
`[perf] getHomePage total=2189 requireRole=120 configAll=3 read:sc_daily=812 ...`)
capturing: requireRole, configAll, EACH of the 7 Promise.all reads by table
name, dqLastRun, dqSetting, each provider (`perf.lap(fn.name)` semantics kept),
the admin-block reads, ecosystemHealth, and total elapsed. Concurrent reads
record per-promise duration. No per-row logging, no new src files, no `.env*`,
no changes outside `aggregates.ts`. `next start` must serve the instrumented
build (record BUILD_ID). Keep the instrumentation (it is the deliverable);
pm3-02 decides whether it stays.
Out of scope: any fix, `docs/PERF_BASELINE.md` edits, other endpoints/files,
remote DB access.

### Actions
1. Extend `perf_` in aggregates.ts: add named-duration capture (`time(label, promise)` or equivalent) and make `end()` emit the marks+durations as ONE console.log line.
2. Instrument `getHomePage`: wrap each Promise.all entry individually (label by table name) plus the sequential awaits listed in Context; keep provider laps.
3. `npm run build` -> record BUILD_ID; stop the stale `next start` on :3100; start `next start -p 3100` with stdout to `logs/pm3-server.log`; probe until Ready.
4. Login `e2e.admin@dabdoob.com` (cookie jar); `curl GET /api/hub/home` x3 recording `time_total`/`http_code`/`size_download` -> `pm3-profile.log`.
5. Harvest the perf lines from `pm3-server.log` into `pm3-profile.log` as a per-run stage=ms table; identify the stage(s)/read(s) dominating vs the T0 profile (1.459 s total).
6. Write `results/pm3-01.md` (<=10 lines): BUILD_ID, 3 totals, the named regressed read(s)/stage(s) with ms, one-line fix hypothesis for pm3-02.

### Done when
- :3100 serves the instrumented build; 3 runs captured; per-stage/read ms harvested for each run
- results names the read(s)/stage(s) accounting for the +0.73 s median delta (or states the delta is diffuse with the breakdown)
- Endpoint still 200, ~7.3 KB payload; diff to aggregates.ts is instrumentation-only

### Verify
- Run: `curl -s -o NUL -w "%{http_code}" -b <cookie-jar> http://localhost:3100/api/hub/home` -> 200; `git diff src/features/cx-hub/lib/aggregates.ts` -> timing-only changes (no query/return-shape edits)

### Handoff
pm3-02 traces the calls inside the provider span at fetch level; pm3-03 fixes
the identified call(s) inside the pushdown contract (index-covered predicates
stay; no reversion to whole-table reads), re-times 3 warm runs vs 1.459 s,
and updates the `## After` row in docs/PERF_BASELINE.md. Write
results/pm3-01.md; TL alone updates TRACKER.md.

## pm3-02: fetch-level `[pg]` trace of hub/home; isolate the call(s) inside the provider span
Kind: mini
ID: pm3-02
Parent: pm-3
Owner: dev
Depends: pm3-01
Criteria: pm-3.md F4 (blocking); PLAN perf budgets (`<= T0 baseline` per pushed-down endpoint)
Skills: none
Budget: files=3; actions=6; changed_lines=80; minutes=10

### Goal
pm3-01 proved all 9 direct getHomePage reads are <=212 ms warm; the ~+0.8 s
regression lives inside the DQ_HOME_PROVIDERS span (people ~658-695 ms, work
~566-1299 ms, plan ~227-258 ms; logs/pm3-profile.log). The providers' internal
reads are uninstrumented and fan out through `pwRows_`/`readStore`
(`readAllPaged`), `configAll`/`dqSetting`/`getConfig` (300 s cache),
`getWorkingCalendar`/`wcState`/`wcTlScheduleSourceV1` (60/600 s caches),
`pendingPopupsFor` and `pwDirectory` (React cache). Add ONE env-gated timing
fetch on the shared supabase client so every PostgREST call logs
`[pg] <METHOD> <path>?<query> <ms>`, rebuild + re-serve :3100, capture 3
hub/home runs, and name the call(s)/pattern accounting for the provider span.

### Files
- Edit: `src/features/shared/lib/supabase.ts` | `getClient()` body only — pass a `global.fetch` timing wrapper to `createSupabaseClient`, gated on `process.env.PG_PROFILE === '1'` (off by default; unchanged client when unset)
- Create: `specs/perf-pushdown/logs/pm3-pg-server.log` | `PG_PROFILE=1 next start -p 3100` stdout (perf + [pg] lines land here)
- Create: `specs/perf-pushdown/logs/pm3-pg.log` | harvested per-run call tables + the 3 curl runs

### Context
- `src/features/shared/lib/supabase.ts:12-21` | `getClient()` builds the singleton `createSupabaseClient(url, key)` — third arg `{ global: { fetch } }` is the supported hook; the singleton must be created fresh in the new server process anyway
- `specs/perf-pushdown/logs/pm3-profile.log` | pm3-01 evidence: per-run `[perf]` laps give the provider-span window (tickets@end -> plan@end) to attribute `[pg]` calls to people/work/plan
- `specs/perf-pushdown/results/perf1-01.md` | run mechanics: `npm run build`, kill stale :3100, `next start -p 3100`, login `e2e.admin@dabdoob.com` cookie jar, 3-run curl
- `src/features/cx-hub/lib/home-cards.ts:110-274` | provider awaits to correlate: `pwRows_` (work-core.ts:47 -> `readStore`), `pwTaskContext_` per-owner `getWorkingCalendar` (work-core.ts:120-130), `pwNextMeetings_`, `pendingPopupsFor` (popups.ts:34), `pwWorkingDaysBetween` (calendar)
- `src/features/cx-hub/lib/aggregates.ts` | pm3-01 instrumentation stays in place (it provides the lap window); do not remove or alter it

### Contract
Transparent passthrough: the wrapper calls `globalThis.fetch(input, init)`,
records wall ms, and returns the response untouched — never mutates
url/headers/body, never logs secrets (apikey/authorization live in headers:
log ONLY method + URL pathname + query string params, e.g.
`GET /rest/v1/sc_daily?select=*&date=gte...`). ONE `[pg]` line per HTTP call.
Default OFF: with `PG_PROFILE` unset the client is built exactly as today.
No other behaviour/code change; payload stays byte-identical.
Out of scope: any fix, removing pm3-01 instrumentation, PERF_BASELINE.md,
other files (provider code must NOT be edited this leaf), remote DB access.

### Actions
1. In `getClient()`: `createSupabaseClient(supabaseUrl, supabaseServiceRoleKey, { global: { fetch: pgFetch } })` where `pgFetch` times `globalThis.fetch` and console.logs the `[pg]` line; gate the option on `PG_PROFILE === '1'` (ternary options arg).
2. `npm run build` -> record BUILD_ID; stop the stale :3100 server; start `PG_PROFILE=1 npx next start -p 3100` with stdout to `logs/pm3-pg-server.log`; probe until Ready.
3. Login `e2e.admin@dabdoob.com` (cookie jar); `curl GET /api/hub/home` x3 (time_total/http_code/size) -> `pm3-pg.log`.
4. Harvest `[pg]` lines per run; correlate their timestamps/order against the `[perf]` provider-span window to attribute calls to people/work/plan.
5. Identify the dominant pattern with numbers: repeated sequential calls to one table, one slow query (ms), a retry/error loop, or `no [pg] calls inside the span` (=> CPU-bound, say so).
6. Write `results/pm3-02.md` (<=10 lines): BUILD_ID, 3 totals, dominant call(s)/pattern with count + ms per provider, one-line fix hypothesis for pm3-03.

### Done when
- `PG_PROFILE=1` build serving :3100; 3 runs captured; `[pg]` per-call table harvested per run
- results names the concrete dominant call(s)/pattern (or CPU-bound verdict) behind the ~1.4-2.2 s provider span
- Endpoint still 200, ~7.3 KB; diff = fetch wrapper only (supabase.ts)

### Verify
- Run: `curl -s -o NUL -w "%{http_code}" -b <cookie-jar> http://localhost:3100/api/hub/home` -> 200; `git diff src/features/shared/lib/supabase.ts` -> wrapper-only diff; `grep -c '\[pg\]' specs/perf-pushdown/logs/pm3-pg-server.log` > 0

### Handoff
pm3-03 fixes the named call(s)/pattern within the pushdown contract
(index-covered predicates stay; no whole-table reversions), keeps or reverts
the two instrumentation points (decide + say so), re-times 3 warm runs vs
1.459 s, updates `## After` in docs/PERF_BASELINE.md, vitest green. Write
results/pm3-02.md; TL alone updates TRACKER.md.

## pm3-03: collapse the providers' redundant serial schedule reads; re-time vs T0
Kind: mini
ID: pm3-03
Parent: pm-3
Owner: dev
Depends: pm3-02
Criteria: pm-3.md F4 (blocking) — fix within the pushdown contract; PLAN perf budgets
Skills: none
Budget: files=6; actions=9; changed_lines=250; minutes=10

### Goal
`GET /api/hub/home` median <= T0 1.459 s warm (currently ~1.9-2.2 s; pm3-01
`[perf]` laps + pm3-02 `[pg]` trace: the provider span fires ~27 PostgREST
calls — the same ~9 schedule/calendar tables (`team_leads`, `tl_shift_plan`,
`tl_off_days`, `tlp_shifts`, `sched_plan`, `sched_offdays`,
`one_on_one_schedule`, `actions`, `roster`) `select=*`-fetched once per
provider, serially; worst repeat `tlp_shifts` at 101-464 ms each). Remove the
redundant fetches and the serial provider wall WITHOUT changing the payload.

### Files
- Edit: `src/features/cx-hub/lib/aggregates.ts` | the `DQ_HOME_PROVIDERS` loop (:330-339) -> concurrent `Promise.all`, cards flattened in provider order; `perf_` instrumentation stays
- Edit: `src/features/shared/platform/calendar.ts` | `wcTlSchedule`/`defaultTlScheduleSource`/`wcState` region (:66-87,:231-343) only — stop the per-call schedule-source refetch (memoize the merged `TlSchedule` on the cached state AND/OR store the in-flight promise so concurrent first calls share one fetch; a new process-cache key is allowed if its TTL <= the existing `wc_v1_tl` 600 s family)
- Edit: `src/features/cx-people/lib/work-core.ts` | `pwRows_` (:47-53) may gain an in-flight dedupe (key = table name; promise dropped on settle; hand each caller `rows.slice()`); `pwTaskContext_` only if needed
- Edit: `src/features/cx-hub/lib/home-cards.ts` | `peopleHomeCards_` may read `one_on_one_schedule` once and reuse the rows for the missed + own-card predicates (:63-74,:113-140) — only if still needed after the other two changes
- Edit: `docs/PERF_BASELINE.md` | `## After` hub/home row + Delta verdict only
- Create: `specs/perf-pushdown/logs/pm3-retime.log` | build + server + 3-run curl + harvested `[perf]`/`[pg]` evidence

### Context
- `specs/perf-pushdown/logs/pm3-pg.log` + `results/pm3-02.md` | the measured redundancy: provider span ~27 calls, 9 tables x3, serial
- `src/features/shared/platform/calendar.ts:231-343` | `wcTlSchedule(st)` memoizes `st.tl` on the wcState object (60 s TTL); `defaultTlScheduleSource` runs `wcTlScheduleSourceV1` (already `wc_v1_tl` 600 s) + `tlpShiftsSource` + `schedSavedSource` — the two uncached sources refetch per build, and concurrent `getWorkingCalendar` calls race past an unset `st.tl`
- `src/features/cx-hub/lib/home-cards.ts:61-141,221-274` | provider read chains: `pwRows_` (`work-core.ts:47` -> `readStore` -> `readAllPaged`), `pwTaskContext_` per-owner `getWorkingCalendar`, `pwNextMeetings_`, `pendingPopupsFor`, `pwWorkingDaysBetween`
- `src/features/cx-hub/lib/aggregates.ts:328-339` | provider loop + per-provider try/catch (one provider throwing must not blank Home — keep that invariant)
- `specs/perf-pushdown/results/perf1-01.md` + `docs/PERF_BASELINE.md` T0-method | run mechanics (build, restart :3100, login `e2e.admin@dabdoob.com`, median of 3)

### Contract
Fix the measured redundancy within the pushdown contract — NO reversion to
whole-table reads where bounds exist, no new tables/endpoints, no
behaviour/payload change: `needs` order stays people-then-work-then-plan
(Promise.all preserves array order; flatten in index order), per-provider
try/catch kept (a throw logs + yields []), identical card ids/fields, and the
response stays ~7.3 KB / 200. Allowed mechanisms (pick the minimal set that
hits the target; say which you used):
  a) providers run via `Promise.all` (concurrent, order-preserving flatten);
  b) the merged TL schedule is fetched once per cache window (memoized result
     or shared in-flight promise on `wcTlSchedule` — not both per-call and
     never per-owner); TTL must be <= the existing `wc_v1_tl` 600 s family and
     use the same `cacheGet`/`cachePut`/`cacheRemove` layer (consistent
     staleness semantics);
  c) `pwRows_`/provider-table in-flight dedupe: same-table concurrent calls
     share ONE fetch; promise is dropped on settle (no completed-result
     caching -> zero staleness change); each caller gets `rows.slice()`;
  d) peopleHomeCards_ fetches `one_on_one_schedule` once, filters it twice.
Freshness invariant: no new COMPLETED-result cache on `readStore` itself
(non-live tables stay uncached beyond the in-flight window). `view_as` reads
stay as they are (requireRole path, out of scope). Keep pm3-01's `[perf]`
line and the `PG_PROFILE` wrapper (env-gated, default off) — state that in
results.
Out of scope: other routes/endpoints, `pwTasksOut_` compute, PERF_BASELINE
sections other than the hub/home `## After` row, migrations, remote DB.

### Actions
1. Providers: `DQ_HOME_PROVIDERS` -> `Promise.all(fns.map(fn => fn(homeUser).catch(...same log, [])))`, flatten in index order into `needs` (byte-identical ordering).
2. Calendar: make `wcTlSchedule` share the fetch — store the in-flight promise (or memoize the merged schedule under one `wc_tl_*` cache key, TTL <= 600 s) so N concurrent/serial `getWorkingCalendar` calls trigger <=1 source read set.
3. If repeats remain: `pwRows_` in-flight dedupe by table name (drop-on-settle, `rows.slice()` per caller) and/or single-fetch `one_on_one_schedule` in peopleHomeCards_.
4. `npm run build` -> record BUILD_ID; restart `next start -p 3100` (`PG_PROFILE=1` to keep the `[pg]` evidence); probe Ready.
5. Login `e2e.admin@dabdoob.com`; `curl GET /api/hub/home` x3 (time_total/size/http_code) -> `pm3-retime.log`.
6. Harvest the `[perf]`/`[pg]` lines into `pm3-retime.log`: provider-span ms + call count before vs after.
7. If median > 1.459 s: capture which stage/read now dominates in results and stop at that checkpoint (TL decides next step — do NOT scope-creep further).
8. On PASS: update the `## After` hub/home row (median, size, PASS verdict vs 1.459 s) preserving the appended `### prod_window_hist index decision` note last.
9. Write `results/pm3-03.md` (<=10 lines): mechanisms used, call-count delta, 3-run medians, verdict, vitest run.

### Done when
- hub/home median (3 warm runs) <= 1.459 s on the rebuilt :3100 server, 200 + ~7.3 KB, cards/queues/pulse unchanged
- provider-span `[pg]` call count measurably lower (target ~= one fetch set per table per request)
- `## After` row updated; pm3-01 `[perf]` + `PG_PROFILE` wrapper retained (or reverted with stated reason)
- Targeted vitest for hub/home + stores/calendar paths green

### Verify
- Run: `curl -s -o NUL -w "%{time_total} %{http_code} %{size_download}" -b <cookie-jar> http://localhost:3100/api/hub/home` x3 -> medians in results; `npx vitest run tests/golden/ tests/perf/` -> green; `git diff --stat` -> only the listed files

### Handoff
Closes pm-3.md F4 if median <=1.459 s. Evidence for the perf reviewer's DELTA
re-check: `logs/pm3-retime.log` + `## After` row. Write results/pm3-03.md;
TL alone updates TRACKER.md.
