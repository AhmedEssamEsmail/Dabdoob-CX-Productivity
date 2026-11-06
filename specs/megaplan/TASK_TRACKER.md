# Megaplan Task Tracker

> **The execution tracker.** Protocol in `README.md`: orchestrator assigns; agent claims one `pending` WP whose deps are `done`; sets `claimed-by` + `in-progress`; finishes → `done` + evidence. Do not edit rows you didn't claim. New gaps → append `WP-F<n>` rows under "Follow-ups".
> Status values: `pending` `in-progress` `done` `blocked` `deferred` `verified`.

## Wave 0 — Foundations (sequential)

| WP | Scope | Depends | Files | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-00 | Fix auth-mock regression (`requireRole` etc. in `authModule()`), audit all golden fakes | — | `tests/golden/hub-fakes.ts`, `desk-fakes.ts`, `ops-fakes.ts`, `fixtures-people.js` | done | wave0-agent-A | vitest 41 files/817 tests green; tsc 0 errors. Regression already fixed in HEAD (requireRole unified in `platform/identity`, port imports via `platform`); hardened `authModule()`→full `lib/auth` surface (requireRole lazy-delegates to real identity.ts; getUser/requireAuth/getViewAsUser vs hubDb) + `createClient` added to `supabaseModule()`. ops-fakes/desk-fakes/fixtures-people audited — no mock gaps; ops-fakes tsc errs absent at HEAD |
| WP-01 | tsc: heatmap.ts:230 null-safety | — | `src/features/cx-queue/lib/heatmap.ts` | done | wave0-agent-B | `npx tsc --noEmit` → 0 errors; `sh.getLastColumn ? … : 0` guard already at :230 in HEAD (84ba588) — baseline err count stale; ops-fakes errs also absent from HEAD |
| WP-02 | eslint: prefer-const heatmap-engine.ts:262 | — | `src/features/cx-queue/lib/heatmap-engine.ts` | done | wave0-agent-C | `npx eslint .` → 0 errors, 294 warnings; `ue` already `const` at :262 in HEAD (baseline err count stale) |
| WP-03 | Build + dev smoke + e2e baseline → `audits/w0-baseline.md` | WP-00,01,02 | none (report only) | done | orchestrator | build ✓ 154 pages; smoke 11×200/3×401; e2e 12/85 — auth-fixture gap → WP-F1 |

## Wave 1 — Module audits (parallel)

| WP | Module | Depends | Audit output | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-10 | cx-hub (5 pages, Aggregates/Assistant/RosterSync/Setup/Health/Fresh*Sync) | W0 | `audits/hub.md` | pending | — | residuals: diagnoseAging, debugMyDay/doPost, GATED roster/freshchat fns |
| WP-11 | cx-quality (10 pages, Quality/QaEngine/QaMigrate) | W0 | `audits/quality.md` | pending | — | residuals: job* step-chain map, exportQaAuditsFlat, setup/diag fns |
| WP-12 | cx-queue (6 pages, QueuePages/QueueCore/AgingHelp/Heatmap/Scheduler/TlQueue) | W0 | `audits/queue.md` | pending | — | residuals: queue_snapshot/daily_report fold check |
| WP-13 | cx-people (7 pages + 2 placeholders, all people files) | W0 | `audits/people.md` | pending | — | residuals: run*_ naming, setupPeopleTables, importV1LeadTasks |
| WP-14 | cx-operations (trackers; Trackers.js) | W0 | `audits/operations.md` | pending | — | residuals: storage_mode decision, escalation-matrix parity |
| WP-15 | cx-desk (4 pages, TlPerformance/KpiLogs/MailDesk) | W0 | `audits/desk.md` | pending | — | residuals: gmail seams, SLA rules |
| WP-16 | cx-productivity (4 pages + tph-grid; prod engine/jobs) | W0 | `audits/productivity.md` | pending | — | residuals: getFlagAnalytics, redetect/backfill admin fns, tph cadence |
| WP-17 | shared/platform + shell (all-core libs, shell components) | W0 | `audits/platform.md` | pending | — | residuals: stores fns verify, bootstrap payload, registry |
| WP-18 | API-surface cross-check (all `app/api/**` routes) | W0 | `audits/api-surface.md` | pending | — | |

## Wave 2 — Tests & jobs (parallel)

| WP | Scope | Depends | Files | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-20 | operations golden tests vs Trackers.js | W0(+WP-00) | `tests/golden/ops.test.ts`, `ops-fakes.ts` | pending | — | fakes scaffolded, no test file |
| WP-21 | desk golden tests vs TlPerformance/KpiLogs/MailDesk | W0 | `tests/golden/desk.test.ts`, `desk-fakes.ts` | pending | — | fakes scaffolded, no test file |
| WP-22 | queue golden coverage extension (scheduler/heatmap/aging/slots) | W0 | `tests/golden/queue.test.ts` | pending | — | |
| WP-23 | people golden coverage extension (kpi edges, 1:1 lifecycle, scorecard) | W0 | `tests/golden/{people,scorecard,kpi}.test.ts` | pending | — | |
| WP-24 | jobs/heartbeat/scheduling audit + pg_cron SQL draft | W0 | `audits/jobs.md`, `supabase/migrations/0NN_pg_cron_schedule.sql` | pending | — | incl. jobTphHourly 30-vs-15-min reconcile |
| WP-25 | retire literal-assertion tests (prod tph/productivity) | W0 | `src/features/cx-productivity/lib/*.test.ts` | pending | — | verify golden coverage first |

## Wave 3 — Migration & vendors (code unblocked; data run gated)

| WP | Scope | Depends | Files | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-30 | queue + quality-engine migration mappings | W0 | `src/app/api/admin/migrate/route.ts` (MAPPINGS) | pending | — | ~28 tables incl. agg_*, sched_*, qe_* |
| WP-31 | people + core migration mappings | W0 | same | pending | — | ~21 tables incl. PW_*, sc_*, options/popups/mail_log |
| WP-32 | desk + operations migration mappings | W0 | same | pending | — | ~16 tables + tracker record tabs |
| WP-33 | validator extension + report scaffold | W0 | `migration/validate.ts`, `specs/megaplan/migration-report.md` | pending | — | |
| WP-34 | creds `.env.production`→`.env.local` + vendor GET probes | W0 | `audits/credentials.md` | pending | — | freshchat expected fail |
| WP-35 | migration dry-run where creds allow + skip ledger | WP-30..34 | `audits/migration-dryrun.md` | pending | — | |

## Wave 4 — Platform & ops sweep (parallel)

| WP | Scope | Depends | Output | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-40 | admin health/jobs UI parity (heartbeat states, refresh_log, connected apps) | W0 | `audits/admin-ui.md` | pending | — | |
| WP-41 | admin coverage: mail log + options + popups vs legacy admin | W0 | `audits/admin-ui.md` append | pending | — | |
| WP-42 | view-as write-refusal sweep (all mutating routes) | W0 | `audits/viewas-sweep.md` + fixes | pending | — | |
| WP-43 | routing/compat sweep + route-audit regen | W0 | `route-audit.json`, `audits/routing.md` | pending | — | |
| WP-44 | appearance/i18n matrix verification | W0 | `audits/appearance.md` | pending | — | |
| WP-45 | parity-verification tooling: DOM/class-diff harness OR documented code-level acceptance | W0 | `audits/parity-method.md` (+ tooling) | pending | — | |

## Wave 5 — Blocked gates (owner action required first)

| WP | Scope | Blocker | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|
| WP-50 | apply pg_cron schedules | `CRON_SECRET` + prod app URL (B5) | blocked | — | SQL draft from WP-24 |
| WP-51 | run shard-80 full migration | Google sheet access (B2/G6) | blocked | — | mappings from WP-30/31/32 |
| WP-52 | shard-90 items G1–G9 | owner per-item discussion (STOP gate) | blocked | — | roster sync, mail desk, my-day, gmail imports, drive files, V1 import |
| WP-53 | freshchat fns + fc_messages + daily_report | `FRESHCHAT_API_KEY` absent (B3) | blocked | — | |
| WP-54 | cutover readiness docs | waves 0–4 done | blocked | — | `audits/cutover-plan.md` |

## Follow-ups (appended by wave-1 audits)

| WP | Module | Scope | Depends | Status | Claimed-by | Evidence/Notes |
|---|---|---|---|---|---|---|
| WP-F1 | e2e auth path: Playwright specs can't log in (`tl@example.com`/`password` — stub login gone post-`84ba588`); needs test Supabase users or login seam | — | `e2e/`, auth config | pending | — | 73/85 e2e failures, single root cause (WP-03 baseline) |

## Blocked register (mirrors `../cx-hub/BLOCKED_TASKS.md`; keep in sync)

| # | Item | Needs | Blocks |
|---|---|---|---|
| B2 | Google sheet/workspace access | SA share or CSV exports; per-item scopes | WP-51, WP-52 (G1–G8) |
| B3 | Vendor keys | `FRESHCHAT_API_KEY`; verify Freshdesk/Maqsam post-WP-34 | WP-53 |
| B5 | Cron scheduling | `CRON_SECRET` + canonical app URL | WP-50 |
| B4 | Vercel project rename (cosmetic) | dashboard rename `dabdoob-cx-productivity` → `cx-hub` | — |

## Log

- 2026-11-06 — Megaplan created. Gate baseline: tsc 4 errors · vitest 24 fail/504 pass · eslint 1 err+295 warn. Root causes identified: stale `authModule()` mock (requireRole moved to `shared/lib/auth`), heatmap null-safety, unfinished ops/desk golden scaffolds.
- 2026-11-06 (later) — **Re-baseline:** commits `84ba588`→`b051bb8` landed in parallel (requireRole unified into `platform/identity`, `qa-shared2` deleted, verbatim queue re-ports, `desk.test.ts` 130 tests + `operations.test.ts` created, FALLBACK_BOOT dev-gated). WP-20/WP-21 scope may be substantially owner-done — agents must verify against HEAD, not the review text. WP-02 verified `done`: eslint already 0 errors at execution.
