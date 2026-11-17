# PLAN: qa-live-sheets-freeze
Type: bugfix   Status: draft
Date: 2026-11-16   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Three coupled items under one coordination brief: (1) quality-page incident —
500s/"canceling statement due to statement timeout" at ~18:25 UTC, caused by
unthrottled full-table recon scans + per-request whole-table paged reads behind a
per-instance Map cache that is always cold on serverless; (2) Sheets-read freeze —
no code/DB job may read Google Sheets except tab `qa_audits` of
`1sOFoYdrbKorQ0WOA6bgJT1ROpzPxq2N-7oWnjhsxm3w` and HCT `Sheet1` inside the manual
"Sync roster from HCT now" action only; (3) finish the queue-engine live flip —
`qa_engine_live` is already TRUE but nothing schedules `/api/cron/job-qa-engine`,
and its history step reads un-allowed Forms sheets.

## Success criteria
1. No request path or scheduled job reads Google Sheets except the two allowed
   exceptions (grep-verifiable: no `readSheet`/`fetchWorkbookTabs` reachable from
   page handlers, cron routes, or `dqStep_` jobs outside the allowlist).
2. `syncRosterNow` (manual button only) persists a full-HCT snapshot — all
   Sheet1 rows incl. out-of-scope — to `public.dq_hct` (15-col record shape +
   synced_at). Contract reported to user; `qaActiveEmails_` repoint is THEIRS
   (do not edit server.ts). Fail-open: empty table -> active set null.
3. `jobRosterSync` cannot reach `dqReadHct_` (manual-only gate; no scheduled
   caller exists today — keep it that way).
4. `/api/cron/job-qa-engine` runs only DB-side steps: `qaQueueStep_` (build +
   import), `qaReconcileQueueLog_`, `qaCtlReminders` — the Forms-history sheet
   import (`qaImportHistory_` via `qaHistoryStep_`) is NOT called from the route.
5. `job-qa-engine` scheduled at `30 7 * * *` UTC (10:30 Kuwait) via vercel.json,
   deployed and verified in `qe_builds`/`qa_queue` + heartbeat ok.
6. Quality pages no longer 500 under normal load; no unthrottled full-table
   scans of qa_audits/qa_queue/qa_ctls from our scripts during work hours.

## Scope / Non-goals
In: dq_hct snapshot write path, roster-sync gating, job-qa-engine route step
selection + vercel.json schedule, durable-cache seam in shared platform repo,
remote `qe_migration_done` (DONE this session).
Out: edits to src/features/cx-quality/** and src/app/api/qa/[action]/route.ts
(user-owned — contract handed back instead); scorecard/heatmap/tlqueue/mirror
sheet readers (flagged for user decision); rewriting page-level query
architecture inside cx-quality (advisory note only).

## Risk flags (y/n)
arch n · db y · data y · auth n · external-api y · ui n · perf y · deps n · tests y · docs n · deploy y
Review gates: QA (always) · Security: run (freeze + cron auth) · Data: run (roster snapshot) · Performance: run (incident) · UX/UI: skip (no screen changes)
Budgets (perf flag): page loads must not issue >N sequential PostgREST pages of >1000-row tables on cold cache; zero sheet reads on request path.

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npx next build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Migrations ship only via `npx supabase migration new <name>`; merge-to-main auto-applies. No dashboard SQL. Remote writes need approval (qe_migration_done write already approved+done).
- Forbidden edits: package.json/lockfile, .env*, cx-kpis-*.json; USER-OWNED: src/features/cx-quality/**, src/app/api/qa/[action]/route.ts — do not edit, ping user.
- Supabase CLI remote ops: `--remote` + `env -u SUPABASE_ACCESS_TOKEN`; verify `Target:` line.
- Heavy command output -> log files + bounded tails (OOM renderer risk).
- Roster sync cron `jobRosterSync` currently has NO scheduled caller — keep manual-only.
- `qe_migration_done` set to true 2026-11-16 (qe_queue_log holds migrated Queue Log, 3887 rows Aug–Nov).
- Contract to preserve: qa handler trailing `active` arg ('active'|'all'); cache suffix `:act`; `qa_hct_active` key; `dqHctActive_` is canonical active predicate.

## Research notes
- Incident: recon scripts range(0,999)-scanned qa_audits/qa_queue/qa_ctls -> statement timeouts; qa_ctls LIMIT 1 = 21.5s during incident.
- prod remote (uugeyulccyytvgcabzzx): qa_engine_live=TRUE (set 2026-10-10); qe_queue_log/qe_builds/qe_outcomes are migrated sheet copies (last old-app build 2026-11-06); engine never built; queue stale since ~Nov 6.
- `dq_hct` migration files exist (20261109131140 + 20261112142701 adds code/gender/"contactNumber") but table was DROPPED by 20261116171029_drop_dead_v1_tables.sql -> needs recreate migration with FULL 15-col shape.
- `app_cache` table exists remotely (4 rows) — server-only KV w/ expires_at; repo.ts cacheGet/cachePut still sync Map. New async durable helpers possible without breaking sync callers.
- pg_cron schedule migration (20261106201210) is marked DO NOT APPLY (placeholders {{APP_URL}}/{{CRON_SECRET}}); use vercel.json crons instead.
- Engine inputs ready: fd_activities 192k rows (fresh today), tickets 65k (synced today), roster 50 rows, qa_engine_settings configured.
- Other sheet readers outside quality scope: scorecard-server.ts, heatmap.ts, tlqueue.ts, jobs/env.ts mirrors — freeze scope over these is a USER DECISION (they feed prod pages).

## Key pointers
- src/features/cx-hub/lib/roster.ts:271-287 — dqReadHct_ Sheet1 read + DQ_HCT_COLUMNS(15)/DQ_HCT_SHEET_TO_DB projection (:60-75)
- src/features/cx-hub/lib/roster.ts:299-406 — dqSyncRoster_ (inject snapshot write after dqReadHct_)
- src/features/cx-hub/lib/roster.ts:422-436 — jobRosterSync (gate to manual-only)
- src/features/cx-hub/lib/roster.ts:175-179 — dqHctActive_ canonical predicate
- src/app/api/cron/job-qa-engine/route.ts:27-36 — calls qaHistoryStep_ (sheets) -> replace with DB-only steps (import qaReconcileQueueLog_ from cx-quality/lib/migrate — read-only import, not an edit)
- src/features/cx-quality/lib/server.ts:2453-2467 — qaHistoryStep_ = qaImportHistory_ (Sheets) + qaReconcileQueueLog_ (DB); do not call from cron
- src/features/shared/platform/repo.ts:28-64 — sync Map cache; app_cache seam goes here
- supabase/migrations/20261108205645_app_cache_table.sql — app_cache schema
- vercel.json — add {"path":"/api/cron/job-qa-engine","schedule":"30 7 * * *"}

## Amendment 2026-11-16 — user decisions
- Freeze scope: LITERAL, exceptions = (a) `qa_audits` tab of ss_quality_id,
  (b) HCT Sheet1 in manual syncRosterNow only, (c) FD activity workbook
  (fd_activity_ss_id / 'Activities' — feeds fd_activities mirror). ALL other
  sheet reads must be removed: prod month workbooks (Assumptions, Maqsam Calls,
  FD_AUX, AUXes Exceptions, Quality, Headcount), daily-report workbook
  (Freshchat), scorecard matrix/FCR/behaviour workbooks, heatmap workbook,
  tlqueue workbook, QA Forms history sheets. Replacements must compute from DB
  or import via existing API integrations (Freshdesk/Maqsam/Freshchat keys on
  Vercel) — automatic, no manual sheet reads.
- Scheduling: pg_cron — apply a scoped variant of 20261106201210_pg_cron_schedule.sql
  for ONLY the routes with no current scheduler (verify cron.job remotely first;
  cxh-job-data-tick appears already scheduled). Candidates: cxh-job-qa-engine,
  cxh-job-nightly-aggregates, cxh-job-tl-queue, cxh-scorecard-nightly,
  cxh-mail-desk. Needs {{APP_URL}} + {{CRON_SECRET}} from Vercel env; verify
  WP-F18 Bearer gate present in deployed /api/desk/job/mail before mail-desk.
- Deploy: APPROVED push+deploy once gates pass (watch Vercel deployment to READY).
- Recon discipline: no unthrottled full-table scans on prod during work hours;
  snapshot once, iterate offline; small write transactions.

## Amendment 2 — wave split (user: core only first)
Wave 1 (this run): S01 freeze guard (+grandfather list for deferred readers:
scorecard, heatmap, tlqueue, admin/migrate — logs [SHEETS_FREEZE_VIOLATION],
does NOT throw, removed in wave 2), S02 dbbook synthesizers, S03 env.ts rewire,
S07 dq_hct recreate + snapshot write + roster manual-gate, S08 job-qa-engine
route DB-only steps, S09 pg_cron scoped migration + remote verify.
Wave 2 (deferred): scorecard/heatmap/tlqueue de-sheeting, FCR source, FD_AUX
upstream, freshchat message pairs, guard strict-mode flip.
Status: draft -> spec

## Amendment 3 — NEEDS_USER resolutions
- prod_assumptions: ONE-TIME exempt sheet read of latest month workbook
  Assumptions tab (grandfathered, logged) -> setConfig('prod_assumptions',
  {mq,text,wa}); PLUS an admin-page config control so the values are editable
  going forward (new small leaf under S02/S10 as spec-architect sees fit).
- aux_spans: RECREATE the dropped table (empty) so future imports have a
  target. FD_AUX synth emits empty until an upstream exists.
- FUTURE (post-plan, hold): email-attachment ingestion flow — user receives a
  daily attachment (FD_AUX source) at their email; build a mailbox->DB import
  job later. Not this wave.
- Remote cron.job verify + `supabase db push`: approved by user (pg_cron
  choice + "any needed tools"). Must still verify Target: line before apply.
