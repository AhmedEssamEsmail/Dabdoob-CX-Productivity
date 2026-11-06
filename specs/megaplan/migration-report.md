# Migration validation report — shard-80 Sheets → Supabase

> Scaffold emitted by **WP-33**. Populated when the credentialed run lands (**WP-51**; dry-run numbers may appear earlier via WP-35).
>
> **How to populate:** run `npx tsx migration/validate.ts --md` and paste the generated markdown tables into the matching section below; fill each skip ledger from the validator's SKIP/ISSUE LEDGER output; then sign off.
> Inventory sources: `src/app/api/admin/migrate/route.ts` `MAPPINGS` + `src/features/shared/migration/mappings/*.ts` (WP-30/31/32, relocated by the wave-3 merge) + the full DDL inventory (`supabase/migrations/*.sql`).
> Store share state as of scaffold date (`audits/sheet-access.md`): 19/22 stores shared with the migration SA; **`ss_tickets_id`, `ss_live_id`, `ss_data_2026_id` are NOT shared** — those tables will report `UNREADABLE (403)` until the owner shares them (Viewer is enough).

**Run metadata** _(fill at WP-51)_

| Field | Value |
|---|---|
| Run date | _pending_ |
| Runner / commit | _pending_ |
| Command | `npx tsx migration/validate.ts --md` |
| Supabase project | _pending_ |
| Sheet access | service account `migration-reader@…` (Viewer share) |

**Roll-up** _(fill at WP-51)_

| Metric | Count |
|---|---|
| Tables in inventory | _pending_ |
| Count match (source = Supabase) | _pending_ |
| Count mismatch | _pending_ |
| Skipped — no credentials / no store | _pending_ |
| Unreadable source tabs | _pending_ |
| No mapping | _pending_ |
| Field diffs (sampled) | _pending_ |
| Checksum diffs | _pending_ |

---

## Dry-run blocker resolutions (WP-F22 — 2026-11-06)

Fixes for the WP-35 dry-run blockers B3/B5/B6 (`audits/migration-dryrun.md` §3). Engine blockers B1 (`''`→`null`), B2 (transform wiring) and B4 (`'value'` in NUM_COLS) are owned by the engine sibling — `src/features/shared/migration/engine.ts` untouched here.

### B5 — mapping fixes (`mappings/route-core.ts`, `mappings/queue-quality.ts`, `mappings/desk-operations.ts`)

| Mapping | Before | After | Evidence |
|---|---|---|---|
| `prod_tph_days` | cols `date,calls_json,computed_at`; `upsertOn: 'date'` (collapsed 27→3 rows) | cols `date,agent_email,slots_json,sources_json,by,at`; `upsertOn: 'date,agent_email'` | real tab headers (dry-run §2) = remote cols; app upserts `onConflict:'date,agent_email'` (`cx-productivity/lib/tph/write.ts:108`) |
| `prod_tph_tasks` | same wrong cols | cols `task_id,date,agent_email,channel,start,end,by,at,removed`; `upsertOn: 'task_id'` | tab headers `…,removed`; app upserts on `task_id` (write.ts:171,198); remote lacks `removed` → added by 014 |
| `prod_tph_cases` | same wrong cols | cols `date,source,cases_json,by,at`; `upsertOn: 'date,source'` | tab headers; app upserts `onConflict:'date,source'` (write.ts:227) |
| `prod_tph_touches` | same wrong cols | cols `date,touches_json,computed_at`; `upsertOn: 'date'` | tab headers; app upserts `['date']` (tph/index.ts:1517) |
| `prod_tph_calls` | — | unchanged (`date,calls_json,computed_at`; `upsertOn:'date'`) | only correctly-shaped tph mapping (dry-run GO) |
| `prod_daily_layers` (route sheet) | plain insert | `upsertOn: 'date,email,layer'` | `(date,email)` shared by the `raw`+`effective` layers (578 keys ×2 — dry-run B8); app hard-codes `['date','email','layer']` (`shared/jobs/env.ts:349`) |
| `agg_productivity_daily`→`prod_daily_layers` | `upsertOn: 'date,email'` (unusable — non-unique + no remote UNIQUE) | `upsertOn: 'date,email,layer'` | same key; `layer='effective'` lands via the ROW_TRANSFORM once the B2 engine fix applies it pre-map |
| `prod_quarterly_reports` | cols `quarter,agent_email,report_json,computed_at` (matched nothing) | cols `report_id,quarter,year,start_date,end_date,report_json,created_at`; `upsertOn: 'report_id'` | app-append shape (jobs/quarterly.ts:61-71) = 003 DDL = remote V1 shape; tab absent → stub, see B6 |
| `queue_submissions`, `dq_aging_flags`, `tlp_queue_daily`, `tlp_team` | plain insert | `upsertOn` set (`submission_id` / `flag_id` / `date,tl_email` / `tl_email,month`) | the 4 kept 014 uniques — now wired into the mappings as the 014 header intends |
| `qe_fd_cache` | plain insert | `upsertOn: 'id'` | new table gets `id text PRIMARY KEY` (below) |
| `holidays` | `holiday_id,updated_by,updated_at` unmapped | unchanged — **DECISION: map-what-fits** | tab header-only (0 rows); sheet-only cols dropped, noted inline (people-core.ts) — add columns first if the owner later wants `holiday_id` |

### B3 — `supabase/migrations/014_migration_hardening.sql` rewritten (draft; NOT applied)

- **Kept:** the 4 natural uniques (`tlp_queue_daily(date,tl_email)`, `tlp_team(tl_email,month)`, `queue_submissions(submission_id)`, `dq_aging_flags(flag_id)`).
- **Replaced:** `qe_fd_cache` now the mapping's 13 verbatim cols with `id text PRIMARY KEY` (was `(ticket_id,detail_json,cached_at)`); `qa_access_log` now `(email,action,submitted_by,submitted_at)` + identity PK (was `(at,actor,action,detail)`).
- **Added:** conflict-target indexes the live app already upserts on — `prod_daily_layers(date,email,layer)`, `prod_tph_days(date,agent_email)`, `prod_tph_tasks(task_id)`, `prod_tph_cases(date,source)`, `prod_tph_touches(date)`, `prod_tph_calls(date)`, `prod_quarterly_reports(report_id)` — plus `ALTER prod_tph_tasks ADD COLUMN IF NOT EXISTS removed`.
- **DROP+CREATE (guarded):** the 10 remote-schema-drifted EMPTY tables from the dry-run — `esc_seen`, `agg_queue_now`, `agg_inflow_{daily,weekly,monthly}`, `agg_agent_{perf,daily}`, `agg_snapshots_today`, `kpi_ol_cases`, `prod_quarterly_reports` (all 0 rows remotely, dry-run §3 B3). Each drops only when its target-shape signature column is absent, then recreates at the verbatim 003/007 shape the mappings write — correctly-shaped tables are untouched and re-apply is a no-op. `prod_quarterly_reports` V1 already equals the target shape → its guard never fires; only the `report_id` UNIQUE is added.
- **RLS:** all 12 recreated/new tables get `ENABLE ROW LEVEL SECURITY` + `app_all FOR ALL USING (true) WITH CHECK (true)` (011 convention).
- ⚠️ WP-51: `prod_daily_layers` has 2,579 remote rows — if live dup `(date,email,layer)` rows exist, that one index fails; dedupe first, then re-apply.

### B6 — absent source tabs (9) + one-shot vs idempotent ledger

All 9 absent tabs are legacy `ensureTable_` lazy tabs the features never wrote — **no sheet data exists to migrate**, and every target table is fed by the ported app (Supabase-native), so no table stays empty for lack of the tab. Verdict per tab: **drop-mapping recommended** (a created tab would only ever run an EMPTY migration); owner sign-off required — the mappings stay in place meanwhile (they log "not found or empty" and skip):

| Sheet tab (store) | Target table | App write path (table stays fed) | Verdict |
|---|---|---|---|
| `aging_flags` (core) | `dq_aging_flags` | `/api/queue/aging-flags` → dq_aging_flags | drop-mapping — owner decision |
| `sched_team` (core) | `sched_team` | `cx-queue/lib/scheduler.ts` (SCH tables :22-23) | drop-mapping — owner decision |
| `sched_hour_overrides` (core) | `sched_hour_overrides` | scheduler.ts | drop-mapping — owner decision |
| `sched_requests` (core) | `sched_requests` | scheduler.ts | drop-mapping — owner decision |
| `sched_plan` (core) | `sched_plan` | scheduler.ts | drop-mapping — owner decision |
| `action_planned_milestones` (core) | `action_planned_milestones` | `cx-people/lib/tasks.ts:308,378,404` | drop-mapping — owner decision |
| `people_signals` (core) | `people_signals` | `cx-people/lib/coaching.ts:43,88` | drop-mapping — owner decision |
| `HeatmapAssumptionSets` (core) | `heatmap_assumption_sets` | `cx-queue/lib/heatmap.ts:32` (expected absent — WP-32) | drop-mapping — owner decision |
| `prod_quarterly_reports` (productivity) | `prod_quarterly_reports` | `jobs/quarterly.ts:61` appends quarterly | drop-mapping — owner decision (mapping now corrected to the app shape regardless) |

**One-shot mappings (plain insert — a re-run duplicates; truncate first or accept dupes).** After WP-F22, everything NOT listed here either has `upsertOn` backed by a remote unique/PK or is `view_as` (delete-then-insert special case → idempotent by replace):

`qa_volume` · `aging_open_tickets` · `agg_queue_now` · `agg_inflow_weekly` · `agg_inflow_monthly` · `agg_agent_perf` · `agg_agent_daily` · `agg_snapshots_today` · `refresh_log` · `qe_builds` · `qa_access_log` · `one_on_one_topics` · `one_on_one_private_notes` · `meeting_series_members` · `meeting_attendees` · `options` (its unique is the expression `(list_key, lower(value))` — unusable as ON CONFLICT) · `mail_log` · `holidays` · `follow_up_done` · `sc_behaviour` · `kpi_behaviour_log` · `kpi_leave_log` · `sched_plan` (tab absent anyway)

Newly idempotent after WP-F22 (previously one-shot): `prod_daily_layers` (both source sheets), `prod_tph_{days,tasks,cases,touches,calls}`, `queue_submissions`, `dq_aging_flags`, `tlp_queue_daily`, `tlp_team`, `qe_fd_cache`, `esc_seen`, `agg_inflow_daily`, `kpi_ol_cases`, `prod_quarterly_reports` — all contingent on **014 being applied before WP-51**.

**kpi_\* dedupe (WP-31 vs WP-32):** confirmed — only `people-core.ts` carries `kpi_behaviour_log`/`kpi_leave_log`/`kpi_ol_cases`; `desk-operations.ts` has none. One copy survives.

---

## Core stores

`config` · `roster` · `view_as` · `options` · `popups` · `mail_log` · `health` · `holidays` · `follow_up_done`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## Productivity

`prod_intervals` · `prod_flags` · `prod_flag_log` · `prod_daily_layers` · `prod_window_hist` · `prod_flag_analytics` · `prod_quarterly_reports` · `prod_tph_days` · `prod_tph_tasks` · `prod_tph_cases` · `prod_tph_touches` · `prod_tph_calls`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## Quality engine

`qa_audits` · `qa_queue` · `qa_volume` · `qa_forms` · `qa_ctls` · `qa_disputes` · `qa_calibrations` · `qa_kb_gaps` · `qe_queue_log` · `qe_candidates` · `qe_catalogue` · `qe_outcomes` · `qe_builds` · `qa_access_log` · `qe_fd_cache`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## Queue & scheduler

`tickets` · `esc_seen` · `aging_open_tickets` · `dq_aging_flags` · `queue_submissions` · `queue_snapshots` · `agg_queue_now` · `agg_inflow_{daily,weekly,monthly,hourly}` · `agg_agent_perf` · `agg_agent_daily` · `agg_snapshots_today` · `refresh_log` · `agg_productivity_daily` · `sched_*`×7 · `heatmap_inputs` · `heatmap_assumption_sets`

> ⚠️ Most of this module reads from `ss_tickets_id` / `ss_live_id` / `ss_data_{year}_id` — **not shared with the SA** as of `audits/sheet-access.md`. Expect `UNREADABLE (403)` rows here until the owner shares those stores.

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## People

`actions` · `action_reviews` · `action_updates` · `action_task_details` · `action_planned_milestones` · `one_on_one_*`×5 · `meeting_series` · `meeting_series_members` · `meetings` · `meeting_attendees` · `pw_reminder_log` · `people_signals` · `my_notes` · `sc_daily` · `sc_behaviour` · `sc_months`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## TL desk

`tlp_resp_ratings` · `tlp_kb` · `tlp_otd` · `tlp_ticket_exclusions` · `tlp_shifts` · `tlp_queue_daily` · `tlp_team` · `tlp_area_metrics` · `kpi_behaviour_log` · `kpi_leave_log` · `kpi_ol_cases` · `mail_sla` · `mail_approvals` · `mail_approval_log`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## Operations (trackers)

`trackers` · `tracker_fields` · `tracker_records` + each sheet-backed tracker's record tab (external spreadsheets resolved from the `Trackers` registry at run time)

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| _pending — populated at WP-51_ | | | | | | | | | |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| _pending_ | | |

**Sign-off:** _pending — name / date_

---

## Vendor mirrors / derived (not sheet-backed)

`fd_activities` · `maqsam_calls` · `freshchat` · `cache_stamps` — populated by vendor sync jobs, not the Sheets migration; Supabase count reported for completeness.

| Table | Supabase rows | Status |
|---|---|---|
| _pending — populated at WP-51_ | | |

**Sign-off:** _pending — name / date_

---

## Legacy remote tables (V1, not in numbered DDL)

`qa_flags` · `qa_flag_log` · `qa_daily` · `qa_months` · `fcr_daily` · `fcr_weekly` · `fcr_monthly` · `kpi_logs` · `kpi_unplanned_leave` · `headcount` · `team_structure` · `schedule` · `days_off` · `weekly_schedule` · `tls` · `tlp` · `md`

| Table | Supabase rows | Status |
|---|---|---|
| _pending — populated at WP-51_ | | |

**Sign-off:** _pending — name / date_

---

## Overall sign-off

| Role | Name | Date | Verdict |
|---|---|---|---|
| Migration run executed by | _pending_ | _pending_ | _pending_ |
| Reviewed by (owner) | _pending_ | _pending_ | _pending_ |
