# tl-6 report — perf-remediation FIX round 6 (perf-1 findings)

Source report: `reports/perf-1.md` (verdict FAIL; 5 findings, all treated blocking per PM task).
All 5 findings routed to bounded mini-leaves, dispatched to `dev` (preflighted vs LIMITS.md — all PASS).
Result: **all findings resolved; integration gates green.**

## Leaf status

| Leaf | Finding | Files | Status |
|---|---|---|---|
| FIX-15a | perf-1 | `src/features/cx-quality/lib/server.ts` | done — results/FIX-15a.md |
| FIX-15b | perf-1 | `src/features/cx-quality/lib/server.ts` | done — results/FIX-15b.md |
| FIX-16 | perf-2 | `src/features/cx-queue/lib/jobs.ts`, `tests/jobs/queue-tickets-read.test.ts` (new) | done — results/FIX-16.md |
| FIX-17 | perf-3 | `src/app/api/prod/intervals/route.ts`, `src/app/api/prod/daily-layers/route.ts` | done — results/FIX-17.md |
| FIX-18 | perf-4 | `src/app/api/prod/flags/route.ts` | done — results/FIX-18.md |
| FIX-19 | perf-5 | `src/features/cx-queue/lib/jobs.ts`, `tests/jobs/queue-tickets-read.test.ts` | done — results/FIX-19.md |

needs-split / blocked: none.

## What changed (DELTA scope for re-review)

- `server.ts`: new `qaRowsWhere_(name,{eq,in,is,gte})` (missingOk like `qaRows_`; empty `in` -> `[]`).
  All 7 cited `qaRows_('qa_audits')` sites now bounded: `eq ticket_id` (clash),
  `eq kind+agent_email` (my-audits, in-memory conjuncts retained), `eq kind='calibration'`,
  `gte audit_date=today-90` (quota page — covers 8 quota weeks + 90d fail-memory),
  `in audit_ids` reordered joins (CTL page `mine`, submitQaCtl open-ctls+ctlId, disputes filtered set).
  Extra bounded read `monthAudits` (`gte month-01`) preserves `qaDisputeStats_` output identically.
- `jobs.ts`: `buildQueueAggregates_` tickets read gains `.or(dqTicketsReadOr_(opts,now))` —
  `status.in.(open statuses, case variants)` OR `created_at`/`resolved_at` `>=` bizTz today-1d 00:00.
  `buildAgentAggregates_` prod_daily_layers read gains `.gte('date', today-45d)` (verified horizon: mtd+30d).
- `intervals`/`daily-layers` routes: `gte('date', today-31d)` when no `date` param + `.limit(5000)`.
- `flags` route: `.or('decision.eq.pending,date.gte.'+decidedFrom)` — pending unbounded, decided windowed.
- `tests/jobs/queue-tickets-read.test.ts` (new): asserts `.or`/`status.in`/`gte` recorded on the
  tickets chain and `.gte('date')` on prod_daily_layers (fails on unbounded reads).

## Integration gates (round 6, logs/fix6-*)

| Gate | Result |
|---|---|
| tsc --noEmit | PASS (0 errors) |
| vitest run | PASS (55 files, 1128/1128) |
| eslint . | PASS (0 errors; 366 warnings pre-existing) |
| test:security | PASS (4/4) |
| next build | PASS (154/154 pages) |

## Notes

- Un-applied remote work is unchanged: all 7 migrations + pg_cron settings still NEEDS_APPROVAL (TRACKER).
- Residual out-of-scope whole-table reads noted by the perf report (other `qaRows_` tables/sites,
  `readStore` small tables) were NOT touched — findings scope only.
- No review gates run by TL (PM-owned). Report ready for perf round-2 re-review.
