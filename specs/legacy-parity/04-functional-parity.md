# 04 - Functional Parity (Phase 4 plan)

Every business rule, calculation, validation, automation, permission, approval, filter, report, aggregation, scheduled job and integration in the legacy system must exist in the new one. No simplified replacements. This document catalogues what is known, where to port it from, and how equivalence is proven.

## 1. Method: differential testing against the legacy code

Most legacy rules are **pure functions** written to be tested directly (`ProdValidation.js` header: "the pure rules, tested directly by scripts/test-productivity.mjs"; `ProdTph.js`: "pure functions (`tph*_` without a sheet)"; `KpiPayout.js`, `Health.js hbComputeHealth_` "Pure ... exported for tests"). They can be loaded unchanged in Node with a small `vm` shim for GAS globals (`Utilities`, `Session`, `CacheService`, `ScriptApp` stubbed as the legacy tests did).

For each ported rule:
1. Load the legacy function (golden oracle) in a Node `vm` context.
2. Generate fixtures: hand-written edge cases from the legacy comments plus randomised/property inputs, plus real rows from `Systems_Rawdata_Full.xlsx` and the migrated tables.
3. Run oracle and TypeScript port on identical inputs; assert deep equality (rounding included: `prodRound2_`, `kpiR2_`, `scRound1_`).
4. Keep the fixtures and expected outputs as committed golden files so the oracle is not needed at CI time.

Tests must import the real module. The existing `tph.test.ts` and `productivity.test.ts` (inline literals only) are to be replaced, not extended.

## 2. Rule catalogue

### 2.1 Productivity validation (`ProdValidation.js`, `productivity.js`, `ProductivityApp.js`) - source complete
| Rule | Legacy definition | Port from |
|---|---|---|
| Flag detection | IDLE interval (`prod_flag_statuses`) >= `prod_flag_min_interval_min` (5) with `x` (2) distinct cases inside some window of `prod_flag_window_min` (10). Window anchored at a case, half-open `[t, t+W)`. Flagged minutes = union of qualifying windows clipped to the interval | `prodQualifyingSpans_`, `prodDetectFlags_`, `prodMergeSpans_` |
| Cases | A ticket status change, or any activity on a ticket in a chat group (`prod_chat_groups`), from the Freshdesk Activities log; WA groups from `prod_wa_groups`; counted by distinct ticket id | `prodCasesFromActivityRows_`, `prodCasesByEmail_` |
| Suggested status | Channel with most distinct cases; ties ticket > chat > wa; mapped through `prod_channel_status` | `prodSuggestStatus_` |
| Flag id | djb2 base-36 hash of email, start ms, status (stable across re-detection) | `prodHash_`, `prodFlagId_` |
| Effective status | pending -> suggested; reviewed -> validated; void -> none | `prodEffectiveStatus_` |
| Effective layer | Move each flag's minutes from raw to effective status; never more than the agent-day-status holds (clipped, reported) | `prodAdjustAux_` |
| Decision validation | Accept: status required, must be on `prod_replacement_statuses`, must differ from raw, `prod_reason_statuses` (Busy) need reason >= 5 chars. Revert: reason >= 5 chars. Already decided -> error. No bulk action | `prodCheckDecision_` |
| Auto accept / review deadline | `prod_flag_auto_accept` (default true): accepted on detection; else due on `creation day + prod_review_days (7)`; daily job auto-accepts due flags, logged as `auto` | `prodDueDate_`, `prodIsAutoDue_`, `prodAutoAccept_` |
| Confidence score | Base 50; +/- from distinct cases (10+: +20, 5-9: +15, 3-4: +10, 2: +5, 1: -10), duration (30+: +15, 15-29: +10, 5-14: +5, <5: -5), density (>=0.5: +10, >=0.3: +5, >0: -5), channel count (1: +10, 2: 0, 3+: -10), history neutral; clamp 0-100; level high >= 70, medium >= 50, low >= 30, else very_low; thresholds `prod_confidence_auto_threshold` 50, `prod_confidence_warning_threshold` 30 | `prodConfidenceScore_` |
| Calibration histogram | Cut each IDLE/working interval into consecutive full windows; count distinct cases per window | `prodWindowHist_` |
| Productivity bands | 95+, 86-94.9, 80-85.9, below 80; week starts Sunday | `prodBand_`, `prodWeekStart_` |
| Analytics | Per agent: logged min (offline statuses excluded), raw/effective idle, delta, productivity raw/effective %, delta pp, band change; per TL: raised, accepted/reverted/auto/pending %, median hours to decision, median open seconds, mix, channel match %, TL median row; trend (4 weeks, partial flag, flags per 100 h, precision %); hour x weekday heatmap; calibration | `prodAnalytics_`, `prodAnalyticsFor_`, `prodAggregateFlags_`, `prodIdleSegments_`, `prodMedian_`, `prodPct_` |
| Productivity % engine | 26 columns per agent-day (inbound, texting, waiting-address availability / target / achieved / %; overall %; audits; productive/idle minutes), run twice (raw, effective layers) | `computeProductivityForDate_`, `prodComputeRange_`, `dqProductivityRollup_` |
| Quarterly report | JSON report to `prod_quarterly_reports`, emailed to `quarterly_report_recipients` (disabled when empty), 1st of month | `prodQuarterlyReport_`, `prodSendQuarterlyReport_`, `jobQuarterlyReport` |
| Visibility | Agent: own; TL: agents they manage (`pwIsManagerOf_`); admin: all | `prodScope_` |
| Settings migration | `setupProductivity` replaces a stored value only if equal to a superseded default; never touches edited values | `PROD_SETTINGS_SUPERSEDED`, `prodSettingToWrite_` |

### 2.2 TPH and caps (`ProdTph.js`) - source complete
Grid per agent per day in 15-minute slots (96) on the Kuwait wall clock; task (start/end) fills slots by majority (8 of 15 minutes); unlogged slot repeats previous (carried) until `off`, end of known shift, or now; slot may carry Inbound calls flag (stored `internal+calls`); actual call minutes (Maqsam, next day, states `tph_call_states`) always come off queue-channel minutes in that hour, estimated same day with `tph_calls_minute_factor` (0.5). Cases per hour per channel = open required-action stock at hour start + new cases; precedence TL number > automatic (from `agg_queue_now`, Freshchat queue) > carried previous hour. Cap = min(share of cases `cases x minutes / total minutes on channel`, time study `minutes / tph_minutes_per_case (3)`, cases offered); only minutes in :00-:55 (`tph_cap_window_min`) count. Touches = distinct tickets/conversations touched per hour per channel, computed next morning (today shows pending). TL edit window `tph_tl_edit_days` (3), older days admin only. Steps `runTphStep` / `runTphDay`; hourly `jobTphHourly`; backfill `jobTphPastDays` (missing or older than 6 h). Port functions: `tphResolveSlots_`, `tphTaskSlots_`, `tphCapMinutes_`, `tphResolveCases_`, `tphAutoCases_`, `tphCap_`, `tphTable_`, `tphDayTotals_`, `tphCallVariance_`, `tphTouchesFromRows_`, `tphChatCases_`, `tphTicketCases_`, `tphCallCases_`, `tphMergeRebuilt_`, `tphEligible_`, `tphCanEdit_`, `tphCheckDate_`, `tphEditDay_`, `getTphPage`, `getTphTrend`, `saveTph*`.

### 2.3 KPI payout (`KpiPayout.js`) - source complete
Weights: productivity 35, quality 35, FCR 15, behaviour 15. Payout bands (value -> payout %): productivity >=95: 100, 86-94.x: 75, 80-85.x: 50, <80: 0; quality >=97: 100, 93-96.x: 75, 90-92.x: 50, <90: 0; FCR >=90: 100, 85-89.x: 75, 80-84.x: 50, <80: 0 (85 exactly -> 75, flagged "ASK MOHAMED" in source). Behaviour: any HR-confirmed case in the month -> 0 else 100. OL case: total x 50%. Leaves: 3 unplanned leaves within any 61-day window of the 92 days to `asOf` -> ineligible (0). Probation (month 1-3 from hiring month): pass/fail per KPI (productivity >= 50/65/80, quality >= 80/85/90, FCR > 50/65/80: FCR strictly greater) with the same weights; flags (productivity < 40 red zone m1, <50/<65 action plan; quality <70/80/85; FCR <40/50/65). A KPI with no data is not re-weighted: 0 points, "incomplete" with missing list; total null only if all four missing. Rounding `kpiR2_` 2 dp. Port `kpiPayout_`, `kpiBandPay_`, `kpiProbationMonth_`, `kpiLeaveIneligible_` verbatim; manual logs `kpi_behaviour_log`, `kpi_leave_log` (types Sick, Emergency, Absent without notice, Other), `kpi_ol_cases`.

### 2.4 Scorecard (`WorkCore.js`) - partial source
`scAggregate_`, `scDayRows_`, `scLoad_` (behaviour from workbook log plus manual log, de-duplicated by email|date|note; undated cases count when their month overlaps), `scDerive_` (`WorkCore.js:418`, present: feeds `kpiPayout_`), `scMonthView_`, `scRank_`. Derivation `[V]` (`WorkCore.js:418`): productivity % = total achieved / total target across inbound, texting and waiting-address (`matrix_day` days only), 1 dp; quality % = sum(score x audits) / sum(audits), 1 dp (audit-weighted); FCR % = passed / (passed + failed), rounded 1 dp, excluded ignored; whole month when the FCR tab has no date column; notes for unreadable tabs.

### 2.5 Queue, aging, check-ins (`QueueCore.js`, `Stores.js`) - partial source
Queue view per queue: open, actionable, unassigned, oldest hours, 13 band counts from `aging_bands_h` edges `[4,12,24,48,72,96,120,144,168,192,216,240]`, created/resolved today, delta vs latest snapshot of the day, by-status, stale flag; "our" queues (group name contains `our_queue_text`, or chats) first, busiest first. Group matching ignores case, spaces and dash variants (`dqGroupKey_`). Excluded groups (`inflow_excluded_groups`, `queue_excluded_text`), open statuses, actionable statuses, `queue_map`. Check-in slots 09:30/13:00/18:30/22:00 Kuwait with names, read delay 20 min, form opens 15 min before, missed after 30 min; missed -> mail to `checkin_owner_emails[slot]` or all active TLs; today's snapshots and per-slot series. Port `dqQueueView_`, `dqSortQueues_`, `dqBandCounts_`, `dqAgingBand_`, `dqTodaySnapshots_`, `dqCheckpoints_`, `dqSlotState_`, `getQueueHealthPage`. Aggregation/sync code (Freshdesk sync, aggregates, inflow) is absent.

### 2.6 People core and work calendar (`PeopleCore.js`, `WorkCalendar.js`, `WorkCore.js`)
Kuwait time helpers (fixed UTC+3), working-day arithmetic (`pwAddWorkingDays_`, `pwWorkingDaysBetween_`), directory and manager checks, soft-deleted 1:1 records hidden by default, working calendar order: public holiday in based-in country -> TL schedule (ShiftPlan AM/PM/OFF/LEAVE, TLOffDays weekday, default AM shift estimated) -> days off per person/country/default (no fixed default for agents: rotational). Task hours, fit (`fits` / `tight` > 80% of free hours / `does_not_fit`), risk, next meetings, open series actions (`open` or `blocked`). 1:1 alerts: window 15 min, start grace 15 min, booked `scheduled` only, cached 2 min per app, email 15 min before (`one_on_one_email_15min`), in-app (`one_on_one_inapp_15min`, `one_on_one_inapp_start`), missed 1:1 cutoff `one_on_one_cutoff` 22:00 Kuwait.

### 2.7 Platform rules (`Auth.js`, `Config.js`, `Options.js`, `Popups.js`, `Mailer.js`, `Notify.js`, `Health.js`, `Repo.js`, `ViewAs.js`)
- **Identity/roles/scoping/View as/write guard**: see `01` section G. Port as a server-side resolver plus a data-layer guard (every mutation path checks "View as active").
- **Config**: keys `lower_snake_case` <= 64 chars; typed values (bool/number/JSON/string) with validation against the current type (`validateConfigValue_`), `updated_by/updated_at`, 5-minute cache invalidated on write; defaults seeded without overwriting.
- **Options ("Other" rule)**: key regex `^[a-z0-9_.-]{1,64}$`; value trimmed, whitespace-collapsed, max 120, not "Other", case-insensitive de-dupe returns existing spelling; active flag; sort order.
- **Popups**: raised once per recipient+kind+ref; resolved only by the server when the underlying thing is fixed; "Later" hides for the page load only.
- **Mail**: `mail_dry_run` default true (log only); policy: only `qa_*` kinds and admin-only recipients are sent; every attempt logged (`sent_at,to,cc,subject,kind,ref,status,error,quota_left`); `notify_` never throws (returns `{mail: sent|dry_run|failed|skipped, popups}`); HTML template (intro, facts table, outro, "where to act"); `escapeHtml_`.
- **Repo semantics**: server stamps `submitted_by/at`, strips client-supplied stamps, stamps `updated_by/at`; strings starting `=`, `+`, `@` or `-`+non-digit are neutralised (becomes unnecessary in SQL but spreadsheet export must keep it); writes serialised under a lock; idempotent upserts by key; dates leave as ISO strings.
- **Health**: `hbComputeHealth_` state machine (`01` section H), 60 s cache, HB_PLAN windows editable, events (last 15), "operations" no-jobs note, `fcr` not built.

### 2.8 Modules with no source (rules known only from purpose text)
Quality (audit quota 4/agent/day, live scoring, result mail, CTL 2 working days (3 over a day off), TL-on-shift closure, dispute weekly meeting/escalation, calibration vs TL reference, KB gaps/KB update list, auditor KPIs, forms with weights and critical zeroing questions); 1:1s (topic-driven, same-day logging reminder), TL tasks (timeline start to deadline, progress updates, reminders), meetings and BRs (action items reviewed at next meeting), my actions, notes (private, owner-only, convert to task), coaching signals (suggest a 1:1 topic reaching the TL), hard cases (linkable to 1:1), month-end KPI close (settled data, deductions, exceptions with reason, month lock), trackers (blocked customers, promocodes, operational loss, customer strikes, more), escalation matrix, TL performance (team scores, responsibilities, projects vs expectation, queue hours, mails to answer), KB tracker (asked/done/accurate), KPI logs, mail desk (approval mails answered in thread; MyFatoorah refund updates and chargebacks; who was on queue, who replied, when), analytics (inflow by day/week/month, inbound calls, chats, internal escalations), heatmap (headcount needed per interval and shift, by country, editable assumptions), TL scheduler (shifts and hourly activity per TL), My day (meetings, deadlines, waiting mail, recent files, bookable focus blocks), Home (what needs you now, queue ages).
**These cannot be ported faithfully until the source is supplied** (`06`).

## 3. Scheduled jobs: parity requirements

- All 23 heartbeat jobs plus the 4 Productivity triggers must exist with the legacy cadence, expected windows and grace, idempotency, and heartbeat reporting (`hbRun_` semantics: worst status wins within one run, failures swallowed in heartbeat writer, rethrow so the platform reports failure; high-frequency jobs rewrite an unchanged heartbeat at most every 10 min).
- Schedules in `business_tz` (Asia/Kuwait): daily ~08:30 productivity chain, 10:00 task reminders, 10:30 meeting reminders and QA queue import, 11:30 QA history import, 22:30 missed 1:1 check; every minute 1:1 reminders; every 10 min mail desk; every 15 min Freshdesk sync / queue aggregates / check-in tick / `jobTphHourly`; hourly inflow, TPH past days, TL queue metrics; 4/day queue snapshots; monthly quarterly report.
- A job run by a person (admin) writes under their name and View as refuses it; a platform-triggered run is the "system" (`actorEmail_` returns `system:<installer>`).
- Platform choice (Vercel Cron vs Supabase pg_cron/Edge Functions) must support per-minute and timezone-pinned schedules; Vercel Hobby limits do not (verify plan before choosing).

## 4. Integrations: parity requirements

- Gmail read: newest message matching `PROD_MAIL_QUERY` (Freshdesk "Agents Activity"), first CSV attachment, parsed with `prodIntervalsFromRows_` (time zone `prod_activity_tz`, status map `prod_status_map`), de-duplicated per date and per message id, replacing a date already stored.
- Freshdesk: ticket sync from `freshdesk_full_sync_start`, activities log, deep links `ticketUrl + id`; Freshchat / Maqsam daily report ingestion (read-only sources; staleness flag after `daily_report_stale_after_min` 90).
- Roster sync from the HCT master (scope "Customer Experience", manager aliases, admin and non-agent positions).
- Mail: MailApp semantics (quota per sender, dry-run, policy) and Gmail thread replies.
- Source spreadsheets are read-only (`dqAssertWritable_`): the new system must never write back.
- Credentials already exist in Vercel for Freshdesk, Freshchat, Maqsam, Google service account; Gmail OAuth is not yet set up (tracker: "needs OAuth").

## 5. Permissions: parity requirements

Server enforces every role gate (`requireRole_`), scoping, owner-only features, auditor/KB-editor flags (`boot.quality`), specialist rules, inactive roster rows, domain restriction, and write refusal during View as. Client gating (`En()`) only hides navigation; it is never the control.
