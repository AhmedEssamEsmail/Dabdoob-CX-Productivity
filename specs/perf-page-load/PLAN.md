# PLAN: perf-page-load
Type: feature (perf)   Status: draft, analysis only (no code changed)
Date: 2026-11-18   Root: C:\Users\AHMED\KPIs\CX-Hub   Flags: perf, db, ui(none)

## Goal
Cut page and API latency across the app, based on evidence from server logs and DB measurements.

## Evidence and its limits (read first)
- `logs/dev-server.log` (Nov 16-17, Next dev server, ~2,000 requests). Durations include on-demand compile and run against the live Supabase project, so absolute numbers are inflated for first hits. Ranking is reliable; exact values are not.
- Vercel production: `get_runtime_errors` (works) and `get_runtime_logs` (Hobby plan keeps 1 hour, with no durations). Production p50/p95 cannot be read from logs.
- Live PostgREST probes from this machine (read-only): table sizes, per-request round trip 125-230 ms from Cairo (not representative of Vercel -> Supabase RTT).
- Supabase MCP: failed to connect (per .devin/lessons.md the local OAuth entry shadows the global one). Query logs, pg_stat_statements, advisors and region were NOT readable. Index and query-plan findings are therefore code-derived hypotheses, flagged as such.

## Findings
| # | Finding | Evidence | Confidence |
|---|---|---|---|
| F1 | QA pages are the slowest in the app. `getQaAnalyticsPage` p50 18.2 s, `getQaCtlPage` 15.7 s, `getQaQueuePage` 14.0 s, `getQaDisputesPage` 5.4 s | dev log; code `cx-quality/lib/server.ts` | High on ranking |
| F2 | `qaActiveEmails_` calls `dqReadHct_` (a Google Sheets read) on every active-mode request. The Sheets freeze guard rejects it, so it fails every time and is never negative-cached. Result: a dynamic import of the migration engine plus googleapis per request, and the active filter silently disabled. Also 26 production `SHEETS_FREEZE_VIOLATION` errors since Nov 17, route `/api/qa/[action]` | Vercel runtime errors; `roster.ts:276`, `sheets-freeze.ts:28`, `server.ts:1799` | High |
| F3 | Whole-table reads in the QA path. `qaRows_`/`qaRowsWhere_(..., {})` page 1,000 rows at a time, sequentially: `qa_audits` 6,817 rows = 7 round trips (about 0.3-0.7 s each here), `qa_queue` 2,315, `qa_ctls` 1,863. 41 call sites. Interaction basis reads the full `qa_audits` table | row counts; `repo.ts readAllPaged`; `server.ts:1861` | High |
| F4 | `/api/bootstrap` is called 375 times (p50 739 ms, p90 1.5 s, max 3.7 s): more than one per page load. It chains about 6-8 sequential DB round trips: roster by email in `roleForEmail`, roster `select *` again in `pwDirectory`, `remindersOn` (deliberately uncached), popups, qa flags | dev log; `bootstrap.ts`, `identity.ts`, `settings.ts:186` | High |
| F5 | Page shells: `/` p50 772 ms / p90 2.5 s, `/my-day` p50 1.7 s, `/auth/login` p50 278 ms / p90 1.3 s, `POST /api/auth/login` p50 529 ms. `proxy.ts` runs `getClaims()` on every navigation. If the project still uses the legacy HS256 secret, `getClaims` falls back to a remote `getUser` call each time | dev log; `proxy.ts` | Medium (needs Supabase auth setting check) |
| F6 | Slow data endpoints with no code inspected yet: `/api/hub/home` p50 2.2 s / p90 9.1 s, `/people-holidays` p50 7.8 s, `/api/prod/flags` 4.5 s, `/api/tl/page` 3.4 s, `/api/people/tasks` 2.8 s, `/api/people/scorecard?view=page` 1.6 s (p90 4.8 s), `/api/tph/page` 1.7 s, `/api/hub/roster` 1.1 s | dev log | Medium (cause unknown) |
| F7 | `/my-day` fires 4 parallel part requests, mostly `refresh=1` (403 calls, 150-1,000 ms each). Each one repeats the whole auth + roster chain | dev log; `my-day-page.tsx` | Medium |
| F8 | The cache is a process-local `Map` (`repo.ts`). On serverless, each instance starts cold and the `qa_ver` cache key resets, so the 5-10 minute caches (config, QA pages, active emails) hit rarely | `repo.ts:35`, `server.ts:170` | High |
| F9 | Region is unverified. `vercel.json` sets no `regions`. If Vercel's default (iad1) is not near the Supabase project, every sequential round trip costs 80-150 ms instead of 2-10 ms, and F1, F3, F4, F6 all multiply | `vercel.json`; Supabase region not readable | Unknown, highest upside |
| F10 | Noise only: 26 `localStorage is not available` Node warnings. No latency impact | Vercel runtime errors | High |

## Success criteria (measured by task T0 harness, before vs after)
1. QA analytics, queue, CTL page p50 each at or below 3 s warm (dev baseline 14-18 s).
2. `/api/bootstrap` warm p50 at or below 250 ms and at most 3 DB round trips.
3. Zero `SHEETS_FREEZE_VIOLATION` errors from `/api/qa/[action]`.
4. No page-level API above 2 s p50 after F6 fixes.
5. No behavior change (existing `npm run test:unit`, `test:integration`, `test:security` stay green).

## Non-goals
Schema redesign, UI changes, replacing Supabase, cron schedule changes.

## Gates
`npx tsc --noEmit`, `npm run lint`, `npm run test:unit`, `npm run test:integration`, `npm run test:performance`.
Any new migration ships as a timestamped file via `npx supabase migration new` (per AGENTS.md); remote writes need user approval.

## Conventions
Follow AGENTS.md: Next 16 docs in `node_modules/next/dist/docs/` before touching routing or cache code. No hand DDL. Keep verbatim-port comments.

## Waves and status (implemented 2026-11-18, uncommitted)
### Wave 1 - HIGH
- T1 DONE: `qaActiveEmails_` reads `public.dq_hct` (empty table fails open) instead of the frozen Sheet; no more SHEETS_FREEZE_VIOLATION from /api/qa. NOTE: `dq_hct` is currently empty in prod, so the active filter stays off until the roster HCT sync is run once.
- T2 DONE: `readAllPaged` fetches page 1 with an exact count, then the other pages concurrently (waves of 6); `qaRowsWhere_` chunks long IN lists (150) and runs them concurrently; CTL, Disputes, Queue and Analytics pages load their independent tables in parallel; CTL/Disputes fetch only the audits/disputes they display; queue page reuses one `qa_queue` read for handled dates.
- T3 DONE: `pendingPopupsFor` reads the reminders switch and popups together; `roleForEmail` and `pwDirectory` read config and roster together; `configAll` shares one in-flight read.
- T5 DONE (needs deploy): `vercel.json` `regions: ["fra1"]`. Supabase is eu-central-1 (supabase/.temp/pooler-url); Vercel default was iad1.
### Wave 2 - MID
- T4 DONE: `sharedCacheGet/Put` (local Map + `public.app_cache`); QA scores/analytics/coverage payloads, active emails and the `qa_ver` cache version are shared across instances (version memo 30 s).
- T6 PARTIAL: hub/home, prod/flags already read in parallel; remaining latency is round-trip depth x region (fixed by T5). No further code change without production traces.
- T7 CLOSED, no change: JWKS shows ES256 asymmetric signing keys, so `getClaims()` verifies locally.
### Wave 3 - LOW
- T8 CLOSED, no change: my-day `refresh=1` calls are the intentional stale-while-revalidate background refresh, not on the render path.
- T9 NOT APPLIED: the warning comes from a dependency (no `localStorage` use in src); fix is a Vercel env change (`NODE_OPTIONS=--no-experimental-webstorage`), needs approval.
- T0 DONE: `scripts/perf/bench-paged.mjs` (sequential vs concurrent paging benchmark) + `tests/perf/read-all-paged-concurrent.test.ts`.
