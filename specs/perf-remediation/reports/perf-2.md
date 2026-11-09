# perf report - perf-remediation - round 2 (DELTA)

Verdict: PASS  (1 LOW open; all round-1 findings resolved)
Open: 0B / 0H / 0M / 1L

Scope: prior open findings perf-1..perf-5 + files changed in tl-6
(`server.ts`, `jobs.ts`, `prod/intervals`, `prod/daily-layers`, `prod/flags`
routes, `tests/jobs/queue-tickets-read.test.ts`).

## Measurements

|| Metric | Before -> After | Budget | Tool |
|---|---|---|---|---|
| qa_audits reads on cited request paths (perf-1) | `qaRows_` whole-table x7 sites -> `qaRowsWhere_` server-side predicates: `gte audit_date=-90d` (server.ts:641), `eq ticket_id` (:920), `eq kind+agent_email` (:1028), `in audit_ids` (:1131,:1190,:1308), `gte month-01` (:1312), `eq kind=calibration` (:1454) | no unbounded reads; class baseline 241 calls/41s ~170ms mean | grep + source inspection |
| tickets read per job-data-tick (perf-2) | 9-col full scan of 176k rows/72MB, no where -> `.or(status.in.(open variants),created_at.gte.bound,resolved_at.gte.bound)` (jobs.ts:89-124) | typical query <100ms; no unbounded result sets | source inspection + new regression test |
| prod_intervals / prod_daily_layers route reads (perf-3) | zero-param -> whole table -> `gte('date',today-31d)` + `.limit(5000)` both routes (intervals/route.ts:18,24; daily-layers/route.ts:19,28) | bounded payload | source inspection |
| prod_flags admin branch (perf-4) | `neq('decision','void')` unbounded -> `.or('decision.eq.pending,date.gte.'+decidedFrom)` decidedFrom=today-30d (flags/route.ts:57,82); TL branch keeps scope `.or` (AND-ed by PostgREST) | bounded | source inspection |
| prod_daily_layers nightly read (perf-5) | `select('*')` unbounded -> `.gte('date',today-45d)` (jobs.ts:254); verified `dqAgentPerf_` max lookback = mtd (~32d) and daily (-30d) (index.ts:766-775) -> 45d covers | bounded | source inspection |
| Regression coverage | none -> `tests/jobs/queue-tickets-read.test.ts` asserts `.or`/`status.in`/both `gte` on tickets chain and `gte('date')` on prod_daily_layers; fails on unbounded reads | — | file inspection |
| Gates (tl-6, logs/fix6-*) | tsc 0 err (empty log); vitest 55 files 1128/1128; eslint 0 err/366 warn; test:security 4/4; build "Compiled successfully in 1985ms" | all green | log tails/greps |

## Findings

|| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|---|
| perf-6 | LOW | src/features/cx-quality/lib/server.ts:1600,1684,1759,1802,1829,2212,2241,2264 | Residual `qaRows_('qa_audits')` whole-table `select('*')` on remaining paths: `getQaMyAuditorKpis` (uncached per page load), `getQaAnalyticsAudits` drill-down (uncached), `getQaKbGapsPage`; scores (:1759) and analytics (:1802) sit behind a 10-min version-keyed cache so full scan is amortised; :2212 is a cron/admin popup-ensure; :2241/:2264 are one-off backfills. Same measured class: ~170ms mean vs 100ms budget, unbounded table growth. Lower call frequency than round-1 sites (auditor/TL pages, not pollers) -> LOW. | Reuse `qaRowsWhere_`: kpis page `gte audit_date` (month union -90d window used at :1705/:1714), drill-down bound to the requested period, kb-gaps `eq ticket_id`-style joins where feasible; backfills may stay (admin-run). | dev |

## Resolved (round-1 findings)

- perf-1 MED -> FIXED (all 7 cited sites bounded; helper at server.ts:95).
- perf-2 MED -> FIXED (jobs.ts:124 `.or` bound; aging needs only open-status rows —
  closed rows older than today-1d were already discarded by `dqBuildAging_`;
  `out.byStatus` now counts the filtered set — display-only statusline,
  no consumer needs historical totals).
- perf-3 LOW -> FIXED (both routes bounded + capped 5000).
- perf-4 LOW -> FIXED (pending unbounded, decided windowed to 30d — matches the
  documented "last 30 days of decisions" semantics, route.ts:44).
- perf-5 LOW -> FIXED (45d bound covers verified mtd+30d horizon).

## Not measured / assumptions

- No live DB access in this pass: all "after" numbers are static predicate
  verification; real row-count/latency deltas need post-deploy pg_stat_statements.
- PostgREST semantics assumed for chained `.or()` calls in flags route
  (multiple `or` params AND together) — consistent with supabase-js behaviour.
- qa_audits residual severity is LOW because callers are human page loads /
  cron, not the 60s pollers; if QA usage grows, re-grade.
- Migrations (uniques/indexes, RLS lockdown, pg_cron `*/15`) still unapplied —
  NEEDS_APPROVAL per TRACKER; prod_intervals full-scan ~0 goal unverifiable
  until then.
