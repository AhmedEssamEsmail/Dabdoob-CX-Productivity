# perf report - perf-pushdown - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/2L

Scope: prior open findings perf-1..perf-5 + newly changed files from tl-6/tl-7
(`tlqueue.ts`, `aggregates.ts`, `calendar.ts`, `work-core.ts`, `home-cards.ts`,
`supabase.ts`, `PERF_BASELINE.md`, deleted migration). Auth-re-timing from this
seat impossible (401s only); FIX-report medians on the served builds are cited
as the measured numbers, code shape verified directly.

## Measurements (from tl-6 `perf1-timings.log` build `RQxQ00`; tl-7
`pm3-retime.log` build `OQ3PvV`, `next start -p 3100`, still live)

| endpoint | T0 median s / B | round-1 reading | final build s / B | budget verdict |
|---|---|---|---|---|
| GET /api/prod/analytics | 0.487 (500) / 0 | 3.049 (500) / 31 | **0.121 (200) / 3,448** | PASS — 500->200, -75% |
| GET /api/hub/home | 1.459 / ~7,066 | 2.189 / ~7,304 | **0.859 / 7,300-7,308** | PASS — -41% (perf-5 fixed) |
| GET /api/tph/page | 0.410 / 126,914 | 0.472 / 95,961 | unchanged | PASS time; size -24.4% (perf-4) |

Code verified:
- `tlqueue.ts:609-613` — `maqsamRows`/`fdActivityRows` route through
  `readAllPaged` w/ `columns:'dedupe_key,ts_ms,cols'` + `.gte/.lt('ts_ms')` —
  no unpaged read remains on `fd_activities` (686,753 rows).
- Migration `20261111083859_add_prod_window_hist_date_index.sql` absent from
  `supabase/migrations/` — perf-3 done.
- `aggregates.ts:364-379` — `DQ_HOME_PROVIDERS` via `Promise.all`, order kept,
  per-provider catch -> `[]` (parity preserved).
- `calendar.ts:296-315` — merged `TlSchedule` cached `wc_tl_sched_v1` 600 s +
  `wcTlInflight` dedupe (232-249); `cacheRemove` on state write (:85).
- `work-core.ts:47-63` — `pwRowsInflight_` same-table dedupe, drop-on-settle,
  `rows.slice()` per caller — no staleness change.
- `home-cards.ts:120` — `one_on_one_schedule` one fetch, filtered twice.
- `supabase.ts:32-33` — `pgFetch` `[pg]` tracer installed only when
  `PG_PROFILE==='1'`; zero hot-path cost when off.
- [pg] trace (pm3-retime.log): provider window 258->480 ms warm vs ~1.4-2.2 s
  before; per-table refetch bursts gone. Payload unchanged (~7.3 KB, 200 x3).

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-4 | LOW | docs/PERF_BASELINE.md `## After` | Unchanged from round 1: `>=50%` payload-drop target unmet — tph/page -24.4%, hub/home +3.4% (7,302-7,308 B vs ~7,066 approx T0), analytics first measurable at 3,448 B. Hard `size <= baseline` holds except hub/home margin; tl-6 documented | Accept/documented; only restatement or SQL roll-up (out of scope) would move it | data-engineer |
| perf-6 | LOW | src/features/shared/platform/calendar.ts:305 | `defaultTlScheduleSource` awaits `wcTlScheduleSourceV1()`/`tlpShiftsSource()`/`schedSavedSource()` **serially**; [pg] trace shows source reads 101-464 ms each -> ~0.3-0.9 s serial penalty on each `wc_tl_sched_v1` miss (once per 600 s). Warm path unaffected (endpoint 0.859 s <= budget) | `await Promise.all([...])` the three sources before merge | dev |

## Closed this round
- perf-1 (MED): 500->200, 0.121 s vs T0 0.487 s — verified on final build.
- perf-2 (MED): both windowed reads now paged — verified at tlqueue.ts:609-613.
- perf-3 (LOW): redundant migration deleted — verified absent.
- perf-5 (LOW): hub/home 0.859 s vs T0 1.459 s (-41%); root cause ~27 serial
  PostgREST calls eliminated via Promise.all + 600 s cache + in-flight dedupe.

## Not measured / assumptions
- No remote/EXPLAIN access (unchanged); index coverage asserted from baseline
  `pg_indexes` only (`idx_*_ts` on `maqsam_calls`/`fd_activities` per tl-6).
- PostgREST max-rows still `unknown — default 1000 assumed`.
- Auth re-time from this seat returned 401 only; medians above are from the
  FIX logs on the recorded build IDs (server confirmed live on :3100).
- `/ecosystem` First-Load-JS delta and `/tph-grid` request count still
  uninstrumented/unmeasurable (unchanged from round 1).
- `wc_tl_sched_v1`/`pwRowsInflight_` are process-level: multi-instance deploys
  cache per process — acceptable for schedule data (600 s TTL, same class as
  existing `wc_state_v1`/`dqCachedLive`).
