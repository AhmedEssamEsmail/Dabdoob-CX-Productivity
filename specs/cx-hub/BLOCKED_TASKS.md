# Blocked tasks — manual action required

Everything that cannot be completed autonomously lands here. Each entry: the issue, why it's blocked, and the fix needed from the owner.

---

## B1 — Supabase DDL access — RESOLVED 2026-11-06

**Resolved:** Supabase MCP authenticated (`database:write`). Applied via `apply_migration`, all recorded in `supabase_migrations.schema_migrations`:

| Migration | Result |
|---|---|
| `005_hub` | ✅ follow_up_done, cache_stamps, roster columns |
| `006_quality` | ✅ qa_forms/ctls/disputes/calibrations/kb_gaps + qe_* (5) |
| `007_queue` | ✅ 22 queue/sched/tlp/heatmap tables + app_all policies |
| `002_platform_gap` | ✅ options, popups, mail_log, holidays, one_on_one_schedule — **remote never received 002** |
| `003_domain_gap` | ✅ kpi_behaviour_log, kpi_leave_log, tlp_team, tlp_area_metrics, dq_aging_flags, queue_submissions — **remote never received these either** |
| `008a_rename_legacy_sc` | ✅ colliding empty `sc_*` tables (unrelated `agent_email`/`behaviour_score` shape) renamed to `*_legacy_pre008` |
| `008_people` | ✅ 19 people/actions/1:1/meeting/scorecard tables |
| `009_operations` | ✅ trackers + 5 built-in seeds |
| `010_desk` | ✅ 7 desk tables (fixed `"to"` quoting bug in file) |
| `011_rls_policies` | ✅ RLS enabled + `app_all` policies on all 70 module tables |
| `012_pg_cron` / `013_pg_net` | ✅ extensions installed (pg_cron 1.6.4) |
| `014_fix_tickets_schema` | ✅ colliding JSON-shape `tickets` (0 rows) renamed to `tickets_legacy_pre003`; real FD_TICKET_HEADERS schema created |

Remote-only operations recorded in `supabase/migrations/011_remote_reconcile.sql` for fresh-environment replay. `supabase/APPLY_PENDING_MIGRATIONS.sql` is **applied** — kept as reference only.

**Verified after apply:** 119 public tables, all RLS-enabled; `qa_audits`/`health` match expected schemas exactly; pg_cron 1.6.4 + pg_net installed.

**Remaining (moved to B5):** actually scheduling `cron.schedule(...)` jobs needs the deployed app URL + `CRON_SECRET`.

---

## B2 — Google access (shard 90 — STOP gate)

**Issue:** Per decision D-GOOGLE, all Google-dependent work is deferred to the end and requires a live-access discussion. Items:

| # | Item | Needs |
|---|------|-------|
| G1 | Roster sync (HCT master sheet) | Service-account share or export of `CC_DATA_SPREADSHEET_ID` roster tab |
| G2 | Mail Desk sync | Gmail read/modify scope on the ops mailbox (or a delegated service account) |
| G3 | My Day live data (calendar/mail widgets) | Calendar read scope; mailbox read scope |
| G4 | Gmail Agents-Activity import | Gmail search access + label conventions from `MailDesk.js` |
| G5 | QA Google Forms imports (`qa_queue_import`, `qa_history_import`) | Form response sheets shared to service account + form IDs |
| G6 | Full Sheets→Supabase historical migration | All `Stores.js` spreadsheet IDs shared to `GOOGLE_SERVICE_ACCOUNT_EMAIL`, or one-time CSV exports |
| G7 | Drive file attachments (task/action `drive_file_id`) | Drive read scope on legacy files, or export archive |

**ENV AUDIT 2026-11-05 (correction):** `.env.local` contains ONLY `NEXT_PUBLIC_SUPABASE_*`, `SUPABASE_*`, `VERCEL_OIDC_TOKEN` — no Google/vendor/cron keys. **BUT `.env.production` DOES contain `GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_PROJECT_ID`, `GOOGLE_SHEET_ID`, `FRESHDESK_*`, `FRESHCHAT_*`, `MAQSAM_*`** — real keys exist in the repo's production env. So the creds question is partly solved: (a) copy `.env.production`'s Google/vendor vars into `.env.local` for local runs, and (b) confirm those keys carry the scopes above (Gmail/Calendar/Drive/Sheet shares). `CRON_SECRET`/`MIGRATION_SECRET_KEY` still absent everywhere.

| # | Item | Needs |
|---|------|-------|
| G1 | Roster sync (`dq_hct` — HCT master; `roster.ts` refuses honestly without it) | SA creds + HCT sheet share, or exported roster tab → `dq_hct` mirror |
| G2 | Mail Desk sync (`maildesk.ts` gmail seams) | Gmail read/modify/send on ops mailbox |
| G3 | My Day live data (`myday-google.ts`: awaiting-reply, mail search, calendar/focus blocks, Drive recents, morning digest) | Gmail read + Calendar + Drive scopes; returns `{configured:false}` today |
| G4 | Gmail Agents-Activity import | Gmail search + label conventions |
| G5 | QA imports (`qaImportHistory` Sheets env, form response sheets) | SA + form IDs/sheet shares |
| G6 | Full Sheets→Supabase historical migration (shard 80) | SA share on every legacy sheet, or one-time CSV exports |
| G7 | Drive attachments (`pwSaveTaskFile_`, `action_updates.drive_file_id`) | Drive read scope or export archive |
| G8 | V1 task import (`MigrateV1Tasks.js` V1 spreadsheet) + scorecard workbook refresh (`scRefreshMonth_` `fetchWorkbookTabs`) | Same SA share as G6 |

**Status:** pending — scheduled as the final phase; every seam already degrades gracefully (skipped runs / `{configured:false}` / honest refusals).

---

## B3 — Vendor credential validation (Freshdesk / Freshchat / Maqsam)

**Issue (revised after env audit):** `FRESHCHAT_API_KEY`, `FRESHDESK_API_KEY`/`FRESHDESK_DOMAIN`, `MAQSAM_*` are **absent from `.env.local`** — only referenced in code. `freshdesk.ts` records a skipped run when the key is missing; `qeFdFillMissingDetail_` and mail/maqsam seams are the same.

**Impact:** Queue sync jobs (`freshdesk_sync`, `inflow`, `fc_messages`), TL queue metrics, `qeFdFillMissingDetail_`, mail-desk send/read — all degrade honestly but produce no data.

**Fix:** provide the live keys (`.env.local` + Vercel env). Non-destructive `GET` probes can run once present.

**Status:** pending — keys don't exist locally at all.

---

## B4 — Vercel project name (cosmetic)

**Issue:** Vercel project is still named `dabdoob-cx-productivity`; the repo is now `CX-Hub`. Deploys keep working (linked by `projectId`).

**Fix:** rename in Vercel dashboard → Settings → General, at owner's convenience. Zero code impact.

**Status:** pending — cosmetic, anytime.

---

## B5 — Cron secret & job scheduling

**Issue:** `pg_cron` 1.6.4 + `pg_net` are now installed remotely, but scheduling the actual `cron.schedule(...)` jobs needs two things that aren't confirmed:

1. `CRON_SECRET` in Vercel env (absent locally) — the jobs call `/api/cron/*` via `net.http_get` with the secret header; scheduling them without a matching secret means every run 401s.
2. The canonical app base URL for `net.http_get('<url>/api/cron/...')` — likely the production Vercel URL; confirm before baking into SQL.

**Job list ready to schedule once those exist** (from `007_queue.sql` + people crons, all 15-min/daily per D-SCHED, no 1-min cadences):
- `jobDataTick` `*/15 * * * *` → `/api/cron/job-data-tick`
- `jobNightlyAggregates` `30 6 * * *` → `/api/cron/job-nightly-aggregates`
- `jobTlQueueMetrics` `15 0 * * *` → `/api/cron/job-tl-queue-metrics`
- People crons (`oo-reminders`, `meeting-reminders`, etc. — see `src/app/api/cron/`)

**Fix:** set `CRON_SECRET` in Vercel env + confirm the app URL, then the schedule SQL is a one-shot `cron.schedule` batch.

**Status:** pending — infrastructure ready, needs the two secrets/URL.

---

*Non-blockers already resolved: repo rename `Dabdoob-CX-Productivity` → `CX-Hub` (done by owner, 2026-11-05).*
