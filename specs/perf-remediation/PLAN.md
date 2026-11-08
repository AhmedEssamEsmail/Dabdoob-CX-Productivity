# PLAN: perf-remediation
Type: feature (perf/data remediation + DB hardening)   Status: draft
Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Eliminate the measured latency and DB-cost bottlenecks found in the Nov-8
audit: per-request remote auth calls, whole-table `select('*')` reads,
12-table cron env loads, duplicate 60s client pollers, missing unique
constraints/indexes, dead cron schedules, and the anon-key full-access
exposure (RLS enabled but `app_all` = `using(true)` on every table).

## Success criteria
1. `auth.getUser()` remote calls eliminated from `src/proxy.ts` and
   `identity.ts` request paths via `auth.getClaims()` (local JWT verify);
   `realEmail`/`viewAsState`/`currentUser` memoized per request (React `cache`).
   `/api/bootstrap` warm latency ≤150ms (was ~310–360ms measured).
2. `buildJobEnv` loads tables lazily per `prodRows()` access (or per-job list);
   `job-tph-hourly` reads ≤3 tables instead of 12 + roster + config.
3. `tphLoadStore_`, `readStore`/`dqCachedLive` hot callers (freshchat,
   maqsam_calls, agg_snapshots_today, popups, qa_audits path) issue
   server-side filtered queries — `prod_intervals` full scans drop from the
   measured ~994 calls/137s baseline after deploy.
4. `updateRows` batches updates (≤2 PostgREST calls/batch); `resolvePopups`
   has no per-row write loop.
5. `/api/alerts/one-on-one` + `/api/popups` merged into one polled endpoint;
   one auth chain + one payload per 60s tick per tab.
6. `__CC_BOOT__` bootstrap emitted server-side in root HTML; `/api/options/*`
   fetched lazily on demand.
7. Migration file(s) ready for approval: dedupe pre-flight results +
   uniques on `prod_daily_layers(date,email,layer)` and `queue_submissions`
   (upsert key) + indexes: `prod_intervals(date)`, `refresh_log(job,finished_at)`,
   `tickets(status)`, `tickets(group_name)`, `tickets(created_at)`,
   `prod_flags(date)`, `prod_flags(agent_email)`, `prod_daily_layers(date)`,
   `roster(lower(email))`, `agg_inflow_hourly(year,date)`,
   `queue_submissions(slot_date)`.
8. RLS hardening: server `db()`/clients use `SUPABASE_SERVICE_ROLE_KEY`;
   every public app table denies `public`/`anon`/`authenticated` access
   (replace `app_all` policies). Browser anon used for Auth only (verified:
   no client-side PostgREST table queries — all `.from(` hits are
   `Array.from`). `npm run test:security` + app flows pass.
9. `vercel.json` schedules `job-data-tick` (*/15) + reminder crons
   (oo-reminders, task-reminders, meeting-reminders, missed-1on1-check);
   `job-tph-past-days` internal budget ≤60s or self-chunked per day.
10. my-day section cache shared across function instances (Supabase table
    or equivalent), replacing instance-local Map.
11. Gates: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
    `npm run test:security`, `next build` all clean.

## Scope / Non-goals
In: auth chain, job env, query filtering, batch writes, poll merge,
bootstrap inline, migration files, RLS lockdown, vercel.json crons,
my-day shared cache, ARCHITECTURE.md cron table update.
Out: Supabase Realtime push (deferred), per-user RLS policies (rejected:
app does authz in code + view-as needs cross-user reads; service-role
model chosen), Vercel Pro upgrade, three.js/bundle work, new npm deps,
Freshdesk API changes, Auth session-expiry + region checks (user actions,
documented in report), pg_cron cutover (installed but stays unused).

## Risk flags (y/n)
arch n · db y · data y · auth y · external-api y · ui n · perf y · deps n ·
tests y · docs y (ARCHITECTURE.md cron table) · deploy y
Review gates: QA (always) · Security: run (auth+db+external-api) ·
Data: run (cron jobs/pipelines) · Performance: run · UX/UI: skip (no screens)
Budgets (perf flag): bootstrap ≤150ms warm; tph-day payload <500KB;
prod_intervals full-scan calls ~0 post-deploy.

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`  build: `next build`

## Conventions (<=10 lines)
- Agents write migration FILES only; applying to remote needs user approval
  (Supabase MCP targets the live project).
- Forbidden for agents: package.json/lockfile, .env*, cx-kpis-*.json.
- Next.js 16 differs from training data: cite `node_modules/next/dist/docs/`
  guides in shards that touch Next APIs (cache(), proxy/middleware, RSC).
- Never create env-dependent clients at module top level (breaks Vercel
  builds); lazy-init. `import 'server-only'` on secret/DB modules.
- `SUPABASE_SERVICE_ROLE_KEY` already exists in env (local + Vercel).
- React `cache()` memoization is per-request in route handlers/RSC —
  verify via Next docs before use in proxy/API code.
- git push triggers a Vercel build — deploy step polls to READY/ERROR.
- Not legacy-parity work: improvements allowed, but keep exported
  function names/signatures used by existing callers.

## Research notes
- pg_stat_statements (2026-11-08): prod_intervals full scans ~994 calls/137s
  (mean 129–151ms); popups count 2,907 calls/44s; qa_audits 241 calls/41s;
  roster select(*) 13,443 calls; auth session+refresh inserts ~1,031+1,041
  (session churn); set_config preamble 45,263 calls total.
- Table sizes: fd_activities 205k/85MB, tickets 176k/72MB,
  maqsam_calls 111k/44MB, prod_intervals 23k/12MB.
- RLS enabled on all tables but every policy `app_all` = `using(true)` /
  `with_check(true)` for `roles={public}` — anon key has full table access.
- Migration 014 applied: prod_tph_days/cases uniques exist; prod_daily_layers
  + queue_submissions still lack uniques → applyOp falls back to
  delete+insert on those tables.
- cron.job empty: 012_pg_cron/013_pg_net applied but nothing scheduled;
  reminder routes + job-data-tick never run.
- `vercel logs` 12h: /api/alerts/one-on-one ×75, job-tph-hourly ×24,
  bootstrap ×17 — polling is the top client-driven API volume.
- @supabase/ssr ^0.12.7 supports `auth.getClaims()` (local JWT verify,
  no network) — Supabase-recommended for proxy/API authz.
- service_role key bypasses RLS entirely; deny-all policies then only
  affect anon/authenticated clients (browser has none for tables).

## Key pointers
- src/proxy.ts:26-32 — per-page-request auth.getUser()
- src/features/shared/platform/identity.ts:32-110 — realEmail/currentUser
  chain (getUser ×2 + config ×3 + roster scan)
- src/features/shared/platform/viewas.ts — second realEmail call/request
- src/features/shared/jobs/env.ts:229-290 — buildJobEnv 12-table preload;
  applyOp delete+insert fallback ~L576-622
- src/features/shared/platform/stores.ts:27-40 — readStore/dqCachedLive
  select(*) whole-table
- src/features/cx-productivity/lib/tph/page.ts:131-141 — tphLoadStore_
  8-table full reads for one day
- src/features/cx-queue/lib/jobs.ts:94-160 — tickets/freshchat/maqsam
  full reads in aggregates
- src/features/shared/platform/repo.ts:197-230 — updateRows find+update
  per row; CACHE = instance-local Map
- src/features/shared/platform/popups.ts:34-141 — whole-table popup reads
  + per-row resolve loop
- src/features/shared/platform/notify.ts:231-261 — oneOnOneAlerts poll work
- src/features/shared/components/shell/{Popups,OneOnOneAlerts}.tsx —
  two 60s pollers
- src/features/shared/components/shell/context.ts — fetch cache:'no-store';
  __CC_BOOT__ consumer exists, nothing emits it
- src/app/api/bootstrap/route.ts:13-53 — auth chain + 4 parallel + serial reads
- src/features/shared/lib/supabase.ts:1-11 — db()/createClient use anon key
- src/features/shared/lib/auth.ts:51 — server-side auth client
- vercel.json — 8 crons; missing data-tick + reminders; tph-hourly ×2/h
- src/features/cx-productivity/jobs/tph.ts:22-31 — tph-hourly reads env
- supabase/migrations/014_migration_hardening.sql — partially applied remote
- src/features/cx-hub/lib/myday.ts — instance-local section cache
