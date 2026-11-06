# Migration validation report — shard-80 Sheets → Supabase

> Scaffold emitted by **WP-33**. Populated when the credentialed run lands (**WP-51**; dry-run numbers may appear earlier via WP-35).
>
> **How to populate:** run `npx tsx migration/validate.ts --md` and paste the generated markdown tables into the matching section below; fill each skip ledger from the validator's SKIP/ISSUE LEDGER output; then sign off.
> Inventory sources: `src/app/api/admin/migrate/route.ts` `MAPPINGS` + `migration/mappings/*.ts` (WP-30/31/32) + the full DDL inventory (`supabase/migrations/*.sql`).
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
