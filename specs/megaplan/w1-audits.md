# Wave 1 — Module audits (9 parallel WPs)

> Each WP produces `specs/megaplan/audits/<module>.md` — a defensible, function-level parity statement — plus small in-scope fixes. Big gaps become new tracker rows (append; don't silently absorb).
> Method below is identical for every module; only the inventory differs. Read `../cx-hub/PORTING-GUIDE.md` + your module's shard doc (`../cx-hub/{10,20,30,40,50,60}-*.md`) + `00-gap-review.md` §5 for the already-verified state.

## The audit method (all WPs)

1. **Function surface.** List every legacy public function in your module's server files (`*_deprecated/<dir>/*.js` — `function` without trailing `_`). For each: ported equivalent + file:line, API route that exposes it, or gap classification (`MISS`/`DIAG`/`GATED`/`PORTED-AS`). The shard doc has the canonical list — verify it is complete by grepping the legacy dir yourself (`grep -n "^function [a-zA-Z]*[^_](\|var [A-Za-z]* = function" <legacy>/*.js`).
2. **Page checklist.** For each registry page: compare `src/features/cx-<mod>/components/<page>-page.tsx` against `.devin/work/extract/<app>/pages/<route>.closure.js` — class vocabulary (must be legacy classes, not cx-* substitutes), copy strings (verbatim incl. empty states), element order, attribute wiring, `ce`/`api` call coverage (every `oi("fn")` maps to a fetch), gate metadata vs `data/legacy-route-registry.json` roles/reqs. Report per-page: `parity | divergence: <list>`.
3. **Gates.** Every route's role/extra gate (`auditor`, `kbEditor`, `specialist`, owner-only) enforced at API + page level; view-as write refusal present on writes.
4. **Jobs.** Module's HB_PLAN rows: implementation file, route, heartbeat `dqStep_`/`hbBeat_` name matches the job key exactly.
5. **Output.** `audits/<module>.md` with the four matrices + a "residual gaps" table. Each residual gap: fix inline if ≤ ~30 lines diff, else append to `TASK_TRACKER.md` as `WP-F<n>` under wave "follow-ups" with your module tag.

## WP-10 — cx-hub audit

- Shard: `../cx-hub/10-hub.md` + `wave2-hub-brief.md`. Legacy dir `Command_Center_V2_deprecated` (`Aggregates, Assistant, FreshdeskSync, FreshchatSync, HomeCards, Queue, RosterSync, Setup, Health, Mailer, Notify, Options, PeopleCore, Popups, ProdCore, QueueCore, Repo, Stores, TlSnapshots, ViewAs, WorkCalendar, WorkCore, Apps, Auth, Code, Config, KpiPayout, OneOnOneAlerts, AppBuild`).
- Pages to checklist: `overview` (Rg), `admin` (Nm + deps Dm/Im/Ln/Pf/Tm), `people-holidays` (Ig), `my-day` (Zm), `ecosystem` (Zb + Three.js deps).
- Known residuals from §5.1: `diagnoseAging` (DIAG), `debugMyDay`/`doPost` (`[H]`), `runRosterSync`/`jobRosterSync` (GATED), freshchat fns (GATED), `connectToHub` (N/A D1).

## WP-11 — cx-quality audit

- Shard: `../cx-hub/20-quality.md`. Legacy dir `Quality_deprecated` (`Quality.js` 3621 lines, `QaEngine.js` 2166, `QaMigrate.js` 628).
- Pages: all 10 (closures in `.devin/work/extract/quality/pages/`).
- Known residuals: verify `jobQualityDaily`/`jobQualityBuildRetry`/`jobQualityHistory` step-chains vs `qaQueueStep_`/`qaReconcileQueueLog`/`qaCtlReminders` consolidation; `exportQaAuditsFlat` MISS; setup/diagnostic fns (`setupQuality`, `installQualityTriggers`, `qaFreshdeskSetupHelp`, `verifyQaFreshdesk`, `diagnoseQaQueue`, `diagnoseQaQueueRows`); QaMigrate one-shots (`restartQualityQueueMigration`, `addCallControlToTextForms`, `seedQaNonTicketAudits`, `useVoiceFormForInboundCalls`); `boot.quality` flags in `/api/bootstrap`.

## WP-12 — cx-queue audit

- Shard: `../cx-hub/30-queue.md`. Legacy dir `Queue_deprecated` (`QueuePages, QueueCore, AgingHelp, Heatmap, Scheduler, TlQueue`).
- Pages: `queue, aging, checkins, analytics, heatmap, scheduler` (closures `.devin/work/extract/queue/pages/`).
- Known residuals: `queue_snapshot` 4×/day + `daily_report` cadence vs `dqCheckinTick_` fold — confirm `hbBeat_` job names; scheduler/heatmap internals vs oracle coverage (feeds WP-22).

## WP-13 — cx-people audit

- Shard: `../cx-hub/40-people.md`. Legacy dir `People_deprecated` (12 module files).
- Pages: `agents, one-on-ones, tl-tasks, meetings, my-actions, notes, coaching` (+ confirm `hard-cases`/`kpi-close` placeholders are parity-correct per extract-notes).
- Known residuals: `run*_` job naming deviation (document or add verbatim aliases); `setupPeopleTables` DIAG; `importV1LeadTasks` GATED G8; KPI-payout band-edge coverage feeds WP-23.

## WP-14 — cx-operations audit

- Shard: `../cx-hub/50-operations.md`. Legacy `Operations_deprecated/Trackers.js` (802 lines).
- Pages: `trackers` closure; confirm `escalation-matrix` is parity-correct (unbuilt — extract-notes).
- Known residuals: `storage_mode` sheet-backed trackers (port live-read vs migrate-to-internal decision record), field-type coercion golden vectors (feeds WP-20), `access_mode` enforcement.

## WP-15 — cx-desk audit

- Shard: `../cx-hub/60-desk.md`. Legacy `Desk_deprecated` (`TlPerformance.js`, `KpiLogs.js`, `MailDesk.js`).
- Pages: `tl-performance, kb-tracker, kpi-logs, mail-desk`.
- Known residuals: mail-desk Gmail seams (`{configured:false}` correctness), `mail_approval_dry_run` default-true preserved, SLA breach rule coverage (feeds WP-21), `tlp_*` shared-table reads.

## WP-16 — cx-productivity audit

- Shard: WP-8 history in `../legacy-parity/IMPLEMENTATION-TRACKER.md` + `../cx-hub/README.md` (existing code carried forward).
- Pages: `status-validation, my-status, tph, productivity-analytics` (+ `tph-grid` extra).
- Known residuals: `getFlagAnalytics` (PORTED-AS `prodFlagAnalyticsStep_` — is the page-facing analytics fn needed?), `backfillProductivityIntervals`/`redetectProductivityFlags` (admin maintenance), `importProductivityEmail` (GATED G4), `jobTphHourly` cadence 30-vs-15-min (WP-24), dispute UI dead-code check (`disputes: []` per D5).

## WP-17 — shared/platform + shell audit

- All-core legacy files (identical across 8 apps): `Auth, Config, Options, Popups, Notify, Mailer, Repo, Stores, Health, ViewAs, WorkCore, WorkCalendar, PeopleCore, ProdCore, QueueCore, KpiPayout, TlSnapshots, OneOnOneAlerts, Apps, Code`.
- Verify: `dqReadObjects_`/`dqRewrite_`/`dqUpsert_`/`dqReadLean_`/`dqMarkRun_`/`dqBumpCacheVersion_` in `platform/stores.ts`; bootstrap payload completeness (user/popups/options/appUrls/quality flags/viewAs/isOwner); shell parity checklist per `../legacy-parity/03` (rail indicator, icons×40, tones, collapse, mobile, state screens, splash, appearance, i18n 80-string dictionary coverage); `BUILT_ROUTES` vs route-audit.

## WP-18 — API surface cross-check

- Independent of modules: enumerate `src/app/api/**/route.ts`; for each: auth gate used (`requireRole`/`requireJobCaller`/admin), module fn called, view-as write guard on writes, error envelope shape. Cross-check each page's `ce`/`api` object actually calls existing routes (no dead fetches, no unimplemented `oi` targets). Produce `audits/api-surface.md` matrix.

## Wave-1 exit criteria

9 audit docs committed; every residual gap classified; new `WP-F*` rows appended to tracker for anything ≥30 lines; tsc/vitest/eslint still green.
