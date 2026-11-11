# tl-7 — FIX report: pm-3.md F4 (hub/home regression)

Source: `reports/pm-3.md` (one blocking finding, F4). Spec: `spec/fix-pm-3.md`
(leaves pm3-01/02/03). Note: pm-3 routed isolation to `debugger` — not a
spawnable owner for the TL; the dev leaves covered profile → trace → fix.

## Root cause
Not a slow query and not CPU. The `DQ_HOME_PROVIDERS` span (people/work/plan
home cards) issued ~27 serial PostgREST calls: ~9 schedule/calendar tables
(`team_leads`, `tl_shift_plan`, `tl_off_days`, `tlp_shifts`, `sched_plan`,
`sched_offdays`, `one_on_one_schedule`, `actions`, `roster`) `select=*`-fetched
once per provider, plus uncached schedule sources refetching per
`getWorkingCalendar` burst (`tlp_shifts` x14 @ 101-464 ms). Direct getHomePage
reads were all <=212 ms warm (pm3-01 `[perf]` instrumentation; pm3-02
`PG_PROFILE` fetch-level `[pg]` trace, 259 calls harvested).

## Leaves / evidence
| Leaf | Owner | Outcome | Evidence |
|---|---|---|---|
| pm3-01 | dev | instrumented getHomePage ([perf] line kept); isolated regression to provider span ~1.45-2.25 s | results/pm3-01.md, logs/pm3-profile.log |
| pm3-02 | dev | PG_PROFILE-gated `pgFetch` wrapper (supabase.ts); named the x3 table-fetch pattern | results/pm3-02.md, logs/pm3-pg{,-server}.log |
| pm3-03 | dev | fixed + re-timed: median **0.859 s vs T0 1.459 s = PASS (-41%)** | results/pm3-03.md, logs/pm3-retime.log |

## Changed files (pm3-03; ~170+/46- in src)
- `aggregates.ts`: providers via `Promise.all` (order-preserving flatten; per-provider catch kept).
- `calendar.ts`: merged `TlSchedule` cached `wc_tl_sched_v1` + in-flight dedupe in `wcTlSchedule` (no more per-call source refetch).
- `work-core.ts`: `pwRows_` in-flight dedupe by table (drop-on-settle; `rows.slice()` per caller — no staleness change).
- `home-cards.ts`: `one_on_one_schedule` fetched once, filtered twice.
- `supabase.ts`: `[pg]` fetch tracer (env-gated `PG_PROFILE`, default off — kept).
- `docs/PERF_BASELINE.md`: `## After` hub/home row + verdict (prod_window_hist note preserved last).
- Payload unchanged: 200 x3, ~7.3 KB, card order/parity intact.

## Integration gates (round 11)
- `npx vitest run`: **PASS 1298/1298** (logs/pm3-gate-vitest.log)
- `npx tsc --noEmit`: **PASS 0 errors** (logs/pm3-gate-tsc.log)
- `npx eslint` (5 touched files): **PASS 0** (logs/pm3-gate-eslint.log)
- Served build `OQ3PvVtUCyDf_oX63UwoY` on :3100; hub/home median 0.859 s (3 runs: 2.753 cold / 0.859 / 0.848).

## Blocked / needs user
- None new. `next start -p 3100` still running the instrumented build (perf
  line + PG_PROFILE wrapper retained; harmless, off-by-default tracer).
- For the perf reviewer's DELTA: logs/pm3-retime.log + PERF_BASELINE `## After`.
