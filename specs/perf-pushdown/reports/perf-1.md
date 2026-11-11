# perf report - perf-pushdown - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/2M/3L

Scope: PLAN.md perf budgets + tl-1..tl-5 changed files (`identity.ts`, `repo.ts`,
`stores.ts`, `env.ts`, `analytics.ts`, `scorecard-server.ts`, `one-on-ones-page.ts`,
cx-queue `jobs.ts`/`server.ts`/`pages.ts`, `tph-grid-views.tsx`, `audit-queue-page.tsx`,
new migration `20261111083859_add_prod_window_hist_date_index.sql`) and what they call.

## Measurements (re-timed 2026-11-11 ~11:55, same method as T0: curl 3-run median,
fixture user e2e.admin, prod server `next start -p 3100`)

Served build = `j9VYURDOIBrw5keTFlR1Sv` (analytics still returns the pre-pm2-01
31 B error body). .next was rebuilt 11:07 but the running server predates it;
tl-4/tl-5 file edits (11:27-11:47) are in no served build.

| endpoint | T0 median s / B | recorded After s / B | re-time median s / B | budget verdict |
|---|---|---|---|---|
| GET /api/prod/analytics | 0.487 (500) / 0 | 1.817 (500) / 31 | 3.049 (500) / 31 | still 500 — see perf-1 |
| GET /api/tph/page | 0.410 / 126,914 | 0.374 / 95,961 | 0.472 / 95,961 | PASS time; size -24.4% vs >=50% target (perf-4) |
| POST /api/tph/slots `{}` | 0.368 (500 exp.) / 37 | 0.329 (500 exp.) / 37 | 0.395 (500 exp.) / 37 | +7% vs baseline — noise band |
| GET /api/hub/home | 1.459 / ~7,066 | 1.296 / 7,084 | 1.957 / 7,301-7,308 | breach on this sample (perf-5) |
| GET /api/queue/aging | 0.432 / 704 | 0.193 / 704 | 0.289 / 704 | PASS (-33% vs baseline) |
| GET /api/queue/analytics | 0.365 / 20,496 | 0.187 / 20,496 | 0.245 / 20,496 | PASS (-33% vs baseline) |
| GET /api/qa/getQaScoresPage `[…,"interaction"]` | 0.271 (500) / 46 | 0.125 (200) / 7,989 | 0.101 (200) / 7,989 | PASS — 500->200, -63% |

Verified in code (no remote access; per PLAN criteria):
- `readAllPaged` PK-ordered `.range` pager + `PK_OVERRIDES` (repo.ts:130-217);
  `readRows`/`readStore`/`buildJobEnv` all route through it — no silent truncation
  on covered paths. `updateRows` batch path now chunks keys 500/readAllPaged (repo.ts:324-333).
- Job preloads bounded via `TABLE_BOUNDS` (env.ts:265-274) incl. `tickets.created_at`;
  `dedupeRows_` (env.ts:670); `flushWrites` invalidates `live|<table>` (env.ts:422);
  `dqCachedLive` 45 s TTL (stores.ts:83) — inside the 30-60 s plan band.
- `roleForEmail` `.eq('email')` + projected cols (identity.ts:98-101), ilike kept
  only as error fallback ending in exact `normEmail` match; `pwDirectory`/`currentUser`
  React `cache()` → 1 roster read/authenticated request.
- `scReadRange_` or-form `date.is.null,date.eq.,and(gte,lte)` + JS guard
  (scorecard-server.ts:205-216) — covers `idx_sc_daily_range (date,email)`.
- eval('from') removed; hist guard `String(r.date) < inp.weeks[0]` (analytics.ts:293).
- slot_date predicates: zero raw `.eq/.in` left on `queue_submissions` consumers;
  gte/lte prefix bounds + `.order('slot_date')` tie-break (jobs.ts:297-298,
  server.ts:299-302) — served by `queue_submissions`'s unique `(slot_date,slot)`.
- `/ecosystem` wrapped via `next/dynamic` `ssr:false` client wrapper
  (`ecosystem-dynamic.tsx`); `googleapis` lazily `await import`ed at both call
  sites (list-sheets/route.ts:18, myday-google.ts:67).

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-1 | MED | src/app/api/prod/analytics/route.ts (served build) | GET still **500** (`{"error":"from is not defined"}`, 31 B) — pm2-01 fix (analytics.ts:290-296) postdates served build `j9VYU`; P-02 pushdown unverifiable. Error-path medians 1.82-3.05 s vs T0 0.487 s (also 500 — parity holds, no regression provable either) | `npm run build`, restart `next start -p 3100`, re-run timing loop; expect 200 + warm median <=0.487 s | data-engineer |
| perf-2 | MED | src/features/cx-queue/lib/tlqueue.ts:604-620 | `maqsamRows`/`fdActivityRows` windowed `.gte/.lt('ts_ms')` but **no `.range`/`.limit`/pagination** — `fd_activities` is the largest table (n_live_tup **686,753**); assumed PostgREST cap 1000 → same silent-truncation class P-01 fixed everywhere else. TL-queue stat windows (~1 day + padding) plausibly exceed 1000 rows | Route both through `readAllPaged('fd_activities'\|'maqsam_calls', { build: q => q.gte('ts_ms',…).lt(…), columns: 'dedupe_key,ts_ms,cols' })` | dev |
| perf-3 | LOW | supabase/migrations/20261111083859_add_prod_window_hist_date_index.sql | Redundant: baseline `pg_indexes` already lists `prod_window_hist_date_class_key` UNIQUE `(date,class)` — a date-leading btree serving `date=`/range lookups; table is 126 rows (planner seq-scans anyway). Pending NEEDS_APPROVAL — not yet applied | Drop the migration file before merge, or record why a second date-prefix index is wanted | supabase-expert |
| perf-4 | LOW | docs/PERF_BASELINE.md:224-232 | PLAN `>=50%` payload-drop target for P-02/P-03/P-04 unmet on measured endpoints: `/api/tph/page` **-24.4%** (126,914→95,961 B); `/api/hub/home` **+3.4%** (~7,066→7,308 B); P-02 unmeasurable (500). Hard budget `size <= baseline` holds except hub/home marginally (approximate baseline) | Accept/document per-endpoint reality (tiny pushed tables are minor payload share), or restate target vs the pushed-down reads only | data-engineer |
| perf-5 | LOW | /api/hub/home re-time | Median **1.957 s** vs T0 1.459 s (+34%) on the same served build that recorded 1.296 s — run1 3.00 s cold; suspected cross-session/DB-latency variance, but 2/3 warm runs breach the `<= baseline` budget | Re-confirm on the final build (same restart+measure as perf-1); only investigate if reproducibly >1.459 s | data-engineer |

## Not measured / assumptions
- No remote access (no MCP; remote SELECTs need user approval): `EXPLAIN
  (ANALYZE)` not run. Index coverage asserted from baseline `pg_indexes` only:
  sc_daily `(date,email)`, qa_audits `(agent_email,audit_date)`, roster `(email)`,
  queue_submissions `(slot_date,slot)`, prod_window_hist `(date,class)` all cover
  the pushed predicates.
- PostgREST max-rows still `unknown — default 1000 assumed` (baseline).
- `/ecosystem` First-Load-JS delta: Next 16.4.3 emits no route-size table; no
  baseline manifest snapshot exists → bundle claim verified by import shape only
  (`ssr:false` wrapper in place). Other-route <=2% growth likewise unmeasurable.
- Supabase requests per `/tph-grid` load: no instrumentation; not measured.
- `PK_OVERRIDES` `prod_tph_calls:'date'`/`prod_tph_touches:'date'`: repo DDL
  declares `UNIQUE (date)` via `IF NOT EXISTS` — may have skipped remotely if
  dup dates existed; both tables ~131 rows (< 1 page) so zero impact today.
- Re-time ran on served build `j9VYU` (pre tl-4/tl-5 source edits); recorded
  After numbers stand as the same-code reference. qa getQaScoresPage run1
  5.14 s = cold compute, median uses all 3 runs as at T0.
- fdActivityRows window density unproven (no remote COUNT per window); perf-2
  severity is structural (largest table × no page cap), not a confirmed truncation.
