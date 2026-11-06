# WP-35 — Migration dry-run + skip ledger

> Real credentialed dry-run of the full Sheets→Supabase pipeline — **read + map only, zero writes**.
> Run 2026-11-06 UTC with `.env.local` creds (SA `migration-reader@` + service-role Supabase).
> Evidence commands:
> 1. `npx tsx migration/migrate-all.ts --dry` — stock CLI, read+count for all 94 mappings (route-core 16 + module QQ/PC/DO 78).
> 2. `npx tsx migration/dryrun-map.ts` — scratch deep pass replicating `engine.ts` `mapRow` **verbatim** (transforms, NULL_AS_EMPTY, JSON/NUM/INT sets) + header checks + remote-schema (PostgREST openapi) column diff + NOT-NULL violation prediction + 6 tracker backfills read-only.
> 3. `npx tsx migration/validate.ts --md --sample 20 --checksum-rows 50` — full 119-table source-vs-DB ledger (output embedded in Appendix A; a ~700 ms pace + quota-retry was added to `readTabError` — without it ~10 tabs died on the per-minute read quota, as seen in pass 1).
>
> Scratch files (gitignored `migration/`): `dryrun-map.ts`, `probe-remote.ts`, `probe-tabs.ts`, `probe-req.ts`, `dbg.ts`, `dbg2.ts`. `validate.ts` got the pacing patch only.

---

## 1. Executive summary

**WP-51 cannot run as-is.** The sheets side is healthy — the SA reads every existing tab in all 6 stores (22/22 stores; only tabs that were *never created* fail) — and 85 of 94 mappings read cleanly (the other 9 fail on absent tabs, §3 B6). But the write side has **four systemic blockers** found by mapping real rows against the *remote* schema:

| # | Blocker | Blast radius |
|---|---|---|
| B1 | **`mapRow` emits `null` for empty cells; `NULL_AS_EMPTY` cannot fire** — `readSheet` converts `''`→`null` upstream, so mapRow's `v === ''` branch (and the `created_at/updated_at/computed_at`→`now()` fallback) only ever triggers on *absent headers*. `NULL_AS_EMPTY` also covers only 9 desk tables — none of the people/core `TEXT NOT NULL DEFAULT ''` tables. | **18 mapped tables + 2 tracker backfills** carry predicted 23502 violations on live data (per-col counts in §3). Whole batches fail at insert. |
| B2 | **ROW_TRANSFORMS wiring ≠ authored contract.** Engine applies `ROW_TRANSFORMS[mapping.table]` to the *mapped* row post-map; the mapping modules authored transforms for the *raw* row pre-map, keyed by `mapping.sheet`. | `sched_offdays` migrates **0/8** rows; `sched_overrides` writes a `{"reason":"","wfh":false}` pack over all 163 rows (real reason/wfh silently dropped); `agg_productivity_daily`→`prod_daily_layers` never injects `layer='effective'` (601 rows land `layer=null`, invisible to app reads); `Trackers`/`TrackerFields`/`Heatmap*` transforms never fire; `sched_team`/`sched_requests`/`sched_plan` packs would also be empty (tabs absent anyway). Transforms that *happen* to work (same-named output cols): year-inject on `queue_snapshots`/`agg_inflow_hourly`, `refresh_log.log_id`, `tlp_shifts`, `tlp_queue_daily`, `mail_sla`, `sched_requests.decided_note`. |
| B3 | **Remote schema drift — V1-shape tables under V2 names.** `CREATE TABLE IF NOT EXISTS` never reshaped them. Openapi-verified: `esc_seen` `[id,agent_email,esc_id,seen_at]`, `agg_queue_now` `[id,agent_email,channel,status,count,updated_at]`, `agg_inflow_daily` `[date,channel,count]` (no country/inflow), `agg_inflow_weekly` `[week,channel,count]`, `agg_inflow_monthly` `[month,channel,count]`, `agg_agent_perf`/`agg_agent_daily` (V1 agent cols), `agg_snapshots_today` `[snapshot_id,at,queue_data]` (jsonb blob), `kpi_ol_cases` `[case_id,date,agent_email,hours,approved_by,approved_at]`, `prod_tph_{days,tasks,cases,touches}` (per-tab payloads ≠ `calls_json`), `prod_quarterly_reports` `[report_id,quarter,year,...]`. | **10 table mappings write columns that don't exist remotely** → PGRST204 at insert. `qe_fd_cache` + `qa_access_log` **don't exist at all** (not in openapi). |
| B4 | **`SUGGESTED_NUM_COLS` contains `'value'`** (added for `tlp_otd.value`) — poisons every `value` column globally: `options.value='Egypt'`→`NaN`→`null`, `qe_catalogue.value='Field Change'`→`null`. | `options` **0/26 mapped**, `qe_catalogue` **0/347 mapped** (require-skip). `sched_config.value='0'`→`0` silently changes jsonb string→number. |

Plus expected/known caveats (not new): 9 source tabs never existed; insert-only tables duplicate on re-run; `prod_daily_layers` is double-mapped; `holidays`/`Ticket Detail Cache`/`QaAccessLog` sheet↔DB column decisions pending.

**Source-read totals:** ~221k rows across 94 mappings (tickets alone 176,582). Largest stores: tickets 176,582 + esc_seen 887; live ~9.2k; core ~4.2k; quality ~18.4k; productivity ~26k; data_2026 ~10.2k; tracker record tabs 2,094 records.

---

## 2. Per-store / per-table ledger

Columns: **src** = rows read from sheet · **mapped** = rows surviving require-filter + upsert dedupe under engine-faithful mapping · **skips** = `req` missing-required / `dup` duplicate upsert key · **NN** = predicted NOT-NULL violations `col:rows` (empty cell → explicit null into a remote-required/`NOT NULL` column; NULL_AS_EMPTY cannot save these — B1) · **db** = current remote row count · **verdict**.

Legend — verdict: **GO** ready today · **GO-Δ** ready but count/state drift expected (upsert reconciles; insert-only re-run dupes) · **EMPTY** tab empty or header-only → trivially migrates 0 · **FIX** migrates but insert/mapping breaks or corrupts — fix first · **SRC?** tab missing (remote table OK) · **SCHEMA** remote table absent or wrong shape.

### Core store (`core` = `GOOGLE_SHEET_ID`, CC2 Core) — 34 tabs

| Sheet → table | src | mapped | skips req/dup | NN viol (col:rows) | db | Verdict |
|---|---|---|---|---|---|---|
| ViewAs → view_as | 12 | 12 | 0/0 | — | 12 | GO — already in sync (COUNT-OK) |
| Options → options | 26 | **0** | 26/0 | — | 0 | **FIX-B4** — `value`→NaN→null→all require-skipped |
| Popups → popups | 773 | 773 | 0/0 | — | 0 | GO-Δ |
| MailLog → mail_log | 1,580 | 1,580 | 0/0 | cc:734, error:1580 | 0 | **FIX-B1** — every row hits `error NOT NULL ''` |
| Health → health | 30 | 30 | 0/0 | last_note:23, last_error:22 | 10 | **FIX-B1** |
| holidays → holidays | 0 | 0 | — | — | 0 | EMPTY — headers `holiday_id,updated_by,updated_at` have no DB cols (schema decision pending; 0 rows today) |
| FollowUpDone → follow_up_done | 2 | 2 | 0/0 | — | 0 | GO-Δ |
| queue_status_submissions → queue_submissions | 0 | 0 | — | — | 0 | EMPTY — headers match; insert-only table |
| aging_flags → dq_aging_flags | — | — | — | — | 0 | **SRC?** — tab absent; remote table OK |
| sched_config → sched_config | 2 | 2 | 0/0 | — | 0 | GO ±B4 — `value:'0'`→`0` (jsonb string→num) |
| sched_team → sched_team | — | — | — | — | 0 | **SRC?** — tab absent; also transform packs would be empty (B2) |
| sched_offdays → sched_offdays | 8 | **0** | 8/0 | — | 0 | **FIX-B2** — month+`off_days` format confirmed live; transform needs raw row → all `require[date]` skipped |
| sched_overrides → sched_overrides | 163 | 163 | 0/0 | — | 0 | **FIX-B2** — no `note` header by design; transform on `out` writes `{"reason":"","wfh":false}` on all 163 — real `reason`/`wfh` cells dropped |
| sched_hour_overrides → sched_hour_overrides | — | — | — | — | 0 | **SRC?** — tab absent |
| sched_requests → sched_requests | — | — | — | — | 0 | **SRC?** — tab absent |
| sched_plan → sched_plan | — | — | — | — | 0 | **SRC?** — tab absent |
| QaAccessLog → qa_access_log | 1 | 1 | 0/0 | — | n/a | **SCHEMA** — remote table absent; 014 DDL shape (`at,actor,action,detail`) ≠ mapping (`email,action,submitted_by,submitted_at`) |
| actions → actions | 24 | 24 | 0/0 | description:20, series_id:15, topic:20, outcome_note:18, closed_by:18 | 0 | **FIX-B1** |
| action_reviews → action_reviews | 11 | 11 | 0/0 | note:10, prev_outcome_note:11 | 0 | **FIX-B1** |
| action_updates → action_updates | 1 | 1 | 0/0 | rag,next_step,drive_file_id,file_name,mime_type,planned_milestone_id (:1) | 0 | **FIX-B1** |
| action_task_details → action_task_details | 15 | 15 | 0/0 | priority:15, blocked_reason:15, rag_self:15, delivery_ref:10, expectation:15, outcome_rating:15, outcome_note:15, rated_by:15 | 0 | **FIX-B1** + MISS-HDR `expectation,outcome_rating,outcome_note,rated_by,rated_at` (headers absent — newer cols) |
| action_planned_milestones → action_planned_milestones | — | — | — | — | 0 | **SRC?** — tab absent; remote table OK |
| one_on_one_schedule → one_on_one_schedule | 5 | 5 | 0/0 | log_id:4, rescheduled_to:3, reason:3, deleted_by:4, delete_reason:4, prev_status:4 | 0 | **FIX-B1** |
| one_on_one_logs → one_on_one_logs | 4 | 4 | 0/0 | schedule_id:3, no_action_reason:4, deleted_by:4, delete_reason:4, delete_cascade_json:4 | 0 | **FIX-B1** |
| one_on_one_topics → one_on_one_topics | 9 | 9 | 0/0 | skipped_reason:9, evidence_json:8 | 0 | **FIX-B1**; insert-only |
| one_on_one_private_notes → one_on_one_private_notes | 1 | 1 | 0/0 | — | 0 | GO-Δ; insert-only |
| one_on_one_topic_prompts | — | — | — | — | 0 | NO-MAPPING by design (WP-31 out of scope) + tab absent |
| meeting_series → meeting_series | 1 | 1 | 0/0 | — | 0 | GO-Δ |
| meeting_series_members → meeting_series_members | 5 | 5 | 0/0 | — | 0 | GO-Δ; insert-only |
| meetings → meetings | 3 | 3 | 0/0 | notes:3, decisions:2 | 0 | **FIX-B1** |
| meeting_attendees → meeting_attendees | 15 | 15 | 0/0 | attended:5 | 0 | **FIX-B1** — `attended` empty→null into `BOOLEAN NOT NULL` |
| pw_reminder_log → pw_reminder_log | 107 | 107 | 0/0 | — | 0 | GO-Δ |
| people_signals → people_signals | — | — | — | — | 0 | **SRC?** — tab absent; remote table OK |
| my_notes → my_notes | 1 | 1 | 0/0 | tag:1 | 0 | **FIX-B1** |
| Trackers → trackers | 6 | 6 | 0/0 | spreadsheet_id:1, record_id_format:5, editor_roles:1, owner_email:5, archived_at:6 | 5 | **FIX-B1** — NULL_AS_EMPTY lists these cols but can't fire; upsert overlays 5 seeds + inserts `damaged_items_5917` (row 7 verified) |
| TrackerFields → tracker_fields | 66 | 66 | 0/0 | list_key:55, parent_field_id:66, auto:65 | 0 | **FIX-B1** — same; remote has 0 (013 seed not applied) |
| HeatmapInputs → heatmap_inputs | 0 | 0 | — | — | 0 | EMPTY |
| HeatmapAssumptionSets → heatmap_assumption_sets | — | — | — | — | 0 | SRC? — expected absent (lazy create, WP-32 DECISIONS) |

*Unmapped core tabs observed:* `Sheet1`, `cache_stamps` (vendor-derived), `Config` + `Roster` (app-managed, no mapping by design — db 138/50).

### Productivity store (`productivity`, CC2 Prod) — 13 tabs

| Sheet → table | src | mapped | skips req/dup | NN | db | Verdict |
|---|---|---|---|---|---|---|
| prod_intervals → prod_intervals | 23,247 | 23,059 | 67/121 | — | 21,183 | GO-Δ — 67 rows missing `interval_key|agent_email`, 121 dup `interval_key` (legit skips, logged) |
| prod_flags → prod_flags | 1,263 | 1,263 | 0/0 | — | 1,330 | GO-Δ |
| prod_flag_log → prod_flag_log | 1,771 | 1,771 | 0/0 | — | 1,839 | GO-Δ |
| prod_daily_layers → prod_daily_layers | 1,156 | 1,156 | 0/0 | — | 2,579 | GO-Δ — plain insert (no upsert); sheet holds exactly 578×`effective` + 578×`raw` (see B9) |
| prod_window_hist → prod_window_hist | 118 | 118 | 0/0 | — | 114 | GO-Δ |
| prod_flag_analytics → prod_flag_analytics | 219 | 219 | 0/0 | — | 219 | GO |
| prod_quarterly_reports → prod_quarterly_reports | — | — | — | — | 0 | **SRC?+SCHEMA** — tab absent; remote is V1 `[report_id,quarter,year,start_date,end_date,report_json,created_at]` ≠ mapping `[quarter,agent_email,report_json,computed_at]` anyway |
| prod_tph_days → prod_tph_days | 27 | 3* | 0/24 | — | 63 | **FIX-map** — sheet cols `date,agent_email,slots_json,sources_json,by,at` match remote; mapping wrongly assumes `calls_json,computed_at` (MISS-HDR) and `upsertOn:'date'` collapses agent rows (27→3) |
| prod_tph_tasks → prod_tph_tasks | 0 | 0 | — | — | 0 | EMPTY + FIX-map — sheet cols `task_id,date,agent_email,channel,start,end,by,at,removed`; remote lacks `removed` |
| prod_tph_cases → prod_tph_cases | 13 | 13 | 0/0 | — | 125 | **FIX-map** — sheet `date,source,cases_json,by,at`; mapping wants `calls_json` |
| prod_tph_touches → prod_tph_touches | 13 | 13 | 0/0 | — | 125 | **FIX-map** — sheet `date,touches_json,computed_at`; mapping wants `calls_json` |
| prod_tph_calls → prod_tph_calls | 13 | 13 | 0/0 | — | 125 | GO — the only correctly-shaped tph mapping |

*Unmapped productivity tab:* `prod_disputes` — remote table ABSENT (openapi); legacy remnant, no target.

### Quality store (`quality`, CC2 Quality) — 17 tabs

| Sheet → table | src | mapped | skips | NN | db | Verdict |
|---|---|---|---|---|---|---|
| qa_audits → qa_audits | 6,560 | 6,560 | 0/0 | — | 6,266 | GO-Δ — upsert `audit_id`; src>db 294 + checksum drift (scores) reconciles |
| qa_queue → qa_queue | 2,314 | 2,314 | 0/0 | — | 1,668 | GO-Δ |
| qa_volume → qa_volume | 1,391 | 1,391 | 0/0 | — | 892 | GO-Δ; insert-only |
| qa_forms → qa_forms | 8 | 8 | 0/0 | — | 0 | GO-Δ |
| qa_ctls → qa_ctls | 74 | 74 | 0/0 | — | 0 | GO-Δ |
| qa_disputes → qa_disputes | 3 | 3 | 0/0 | — | 0 | GO-Δ |
| qa_calibrations → qa_calibrations | 0 | 0 | — | — | 0 | EMPTY |
| qa_kb_gaps → qa_kb_gaps | 9 | 9 | 0/0 | — | 0 | GO-Δ |
| Queue Log → qe_queue_log | 3,887 | 3,887 | 0/0 | — | 0 | GO-Δ — Title-Case headers all resolve via sheetToDb |
| Candidates → qe_candidates | 11 | 11 | 0/0 | — | 0 | GO-Δ |
| Build Outcomes → qe_outcomes | 20 | 20 | 0/0 | — | 0 | GO-Δ |
| Build Log → qe_builds | 117 | 117 | 0/0 | — | 0 | GO-Δ; insert-only |
| Catalogue → qe_catalogue | 347 | **0** | 347/0 | — | 0 | **FIX-B4** — `value`→NaN→null→all require-skipped |
| Ticket Detail Cache → qe_fd_cache | 11,645 | 11,645 | 0/0 | — | n/a | **SCHEMA** — remote absent; 014 drafts `(ticket_id,detail_json,cached_at)` ≠ mapping's 13 verbatim cols |

*Unmapped quality tabs:* `Sheet1`, `qa_audits_flat`, `Pivot Table 1` (legacy artifacts).

### Tickets store (`tickets`, CC2 Tickets) — 2 tabs

| Sheet → table | src | mapped | skips | NN | db | Verdict |
|---|---|---|---|---|---|---|
| tickets → tickets | 176,582 | 176,582 | 0/0 | — | 0 | GO-Δ — ~353×500-row batches; `created_at` header exists so the engine's now()-fallback never fires — empty cells land null (nullable col, benign) |
| esc_seen → esc_seen | 887 | 887 | 0/0 | — | 0 | **SCHEMA** — remote V1 `[id,agent_email,esc_id,seen_at]`; mapping writes `ticket_id,status,source` (absent) and can't fill `agent_email,esc_id` — different entity under same name |

### Live store (`live`, CC2 Live) — 24 tabs

| Sheet → table | src | mapped | skips | NN | db | Verdict |
|---|---|---|---|---|---|---|
| aging_open_tickets → aging_open_tickets | 166 | 166 | 0/0 | — | 0 | GO-Δ; insert-only |
| agg_queue_now → agg_queue_now | 18 | 18 | 0/0 | — | 0 | **SCHEMA** — remote V1 `[id,agent_email,channel,status,count]` vs V2 mapping (all 14 cols absent) |
| agg_inflow_daily → agg_inflow_daily | 548 | 548 | 0/0 | — | 0 | **SCHEMA** — remote `[date,channel,count]` lacks `country,inflow` |
| agg_inflow_weekly → agg_inflow_weekly | 95 | 95 | 0/0 | — | 0 | **SCHEMA** — remote `[week,channel,count]` vs `period,country,inflow,days,partial` |
| agg_inflow_monthly → agg_inflow_monthly | 32 | 32 | 0/0 | — | 0 | **SCHEMA** — remote `[month,channel,count]` |
| agg_agent_perf → agg_agent_perf | 48 | 48 | 0/0 | — | 0 | **SCHEMA** — remote V1 `[date,agent_email,productivity_pct,quality_score,fcr_pct,tph]` (all 19 mapped cols absent) |
| agg_agent_daily → agg_agent_daily | 324 | 324 | 0/0 | — | 0 | **SCHEMA** — remote `[date,agent_email,available_min,productive_min,cases_handled]` |
| agg_snapshots_today → agg_snapshots_today | 50 | 50 | 0/0 | — | 0 | **SCHEMA** — remote `[snapshot_id,at,queue_data]` jsonb-blob shape (all 17 cols absent) |
| refresh_log → refresh_log | 8,190 | 8,190 | 0/0 | — | 46 | GO-Δ — remote is hybrid (legacy `completed_at,error_message` + new cols); required `[log_id,status,started_at]` all produced (`log_id`←`mig-N` transform works); insert-only |
| sc_months → sc_months | 3 | 3 | 0/0 | error:3, fcr_note:3, behaviour_note:3 | 0 | **FIX-B1** |
| kpi_behaviour_log → kpi_behaviour_log | 0 | 0 | — | — | 0 | EMPTY |
| kpi_leave_log → kpi_leave_log | 0 | 0 | — | — | 0 | EMPTY |
| kpi_ol_cases → kpi_ol_cases | 0 | 0 | — | — | 0 | EMPTY + SCHEMA — remote V1 `[case_id,date,agent_email,hours,approved_by,approved_at]` vs `key,month,email,cases` |
| tlp_resp_ratings → tlp_resp_ratings | 0 | 0 | — | — | 0 | EMPTY |
| tlp_kb → tlp_kb | 0 | 0 | — | — | 0 | EMPTY |
| tlp_otd → tlp_otd | 0 | 0 | — | — | 0 | EMPTY |
| tlp_ticket_exclusions → tlp_ticket_exclusions | 0 | 0 | — | — | 0 | EMPTY |
| tlp_shifts → tlp_shifts | 117 | 117 | 0/0 | — | 0 | GO-Δ — epoch-ms→ISO + queue_json parse verified working on `out` |
| tlp_queue_daily → tlp_queue_daily | 106 | 106 | 0/0 | — | 0 | GO-Δ — `"09:30-17:00"`→window-count verified; insert-only (014 idx pending) |
| tlp_team → tlp_team | 4 | 4 | 0/0 | — | 0 | GO-Δ; insert-only (014 idx pending) |
| tlp_area_metrics → tlp_area_metrics | 3 | 3 | 0/0 | — | 0 | GO-Δ |
| mail_sla → mail_sla | 50 | 50 | 0/0 | replied_by:2 | 0 | **FIX-B1** — 'TRUE'/'FALSE'→bool verified; 2 empty `replied_by` |
| mail_approvals → mail_approvals | 21 | 21 | 0/0 | reply_to,decision_text,decided_by,sent_status,sent_message_id,client_token ×21 | 0 | **FIX-B1** — WP-32's predicted pending-row case confirmed: NULL_AS_EMPTY lists the cols but can't fire |
| mail_approval_log → mail_approval_log | 0 | 0 | — | — | 0 | EMPTY |

### Data store (`data_2026`, CC2 Data 2026) — 5 tabs (complete)

| Sheet → table | src | mapped | skips | NN | db | Verdict |
|---|---|---|---|---|---|---|
| queue_snapshots → queue_snapshots | 2,184 | 2,184 | 0/0 | — | 0 | GO-Δ — `year` header absent by design; transform injects 2026 on `out` (works) |
| agg_inflow_hourly → agg_inflow_hourly | 5,239 | 5,239 | 0/0 | — | 0 | GO-Δ — `year` inject works |
| agg_productivity_daily → prod_daily_layers | 601 | 601 | 0/0 | — | 2,579 | **FIX-B2/B9** — `layer` never injected (transform keyed by sheet ≠ table) → 601 rows land `layer=null`; `upsertOn:'date,email'` unusable ((date,email) not unique in the model — 578 keys ×2 layers — and no UNIQUE idx remotely) |
| sc_daily → sc_daily | 1,123 | 1,123 | 0/0 | name:67 | 0 | **FIX-B1** |
| sc_behaviour → sc_behaviour | 3 | 3 | 0/0 | — | 0 | GO-Δ today — `date` legitimately empty on undated cases would violate `NOT NULL ''` (latent B1) |

### Tracker record backfills (`TRACKER_RECORD_BACKFILLS`, read-only pass)

| tracker | store/tab | rows | records (dedup) | missing field headers | sys hdrs rid/by/at | verdict |
|---|---|---|---|---|---|---|
| blocked_customers | `1KFC…PEA`/Sheet1 | 6 | 6 | none | -1/-1/-1 | **FIX** — no submitter cols → `submitted_by:null` → `tracker_records.submitted_by NOT NULL` violation (engine emits `\|\| null`, needs `''`) |
| promocodes | `1GsB…gTw`/Form Responses 1 | 24 | 24 | none | -1/1/0 | GO |
| operational_loss | `12jV…e5Uc`/Sheet1 | 2,000 | 1,997 | none | 0/-1/-1 | **FIX** — same `submitted_by:null` violation + 3 dup `Record ID` cells (last-wins) |
| customer_strikes | `1Odi…OMmQ`/Form Responses 1 | 4 | 4 | none | 7/1/0 | GO |
| refund_ledger | `1ZaJ…GU8`/Refund Log | 59 | 59 | none | -1/1/0 | GO — view_only flip safe per WP-32 |
| damaged_items_5917 | core/Tracker Damaged Items | 1 | 1 | none | 0/1/2 | GO — already native; needs `trackers` row upsert first (registry has it, remote lacks it) |

All 6 record tabs read clean; every declared field header resolves (0 missing).

### Not sheet-backed (validator inventory; db counts only)

`fd_activities` 195,553 · `maqsam_calls` 112,037 · `freshchat` 0 · `cache_stamps` 0 — vendor mirrors, out of migration scope. Legacy V1-only tables (`qa_flags`, `kpi_logs`, `headcount`, `tlp`, `md`, etc., 17 tables) all 0 remotely — nothing to migrate.

---

## 3. Blockers before WP-51 (ordered)

**B1 — `''`→`null` breaks ~20 tables' `NOT NULL DEFAULT ''` columns (P0).**
`readSheet` normalises empty cells to `null`; `mapRow` only emits `''`/`now()` on `v === undefined || v === ''` — `null` never reaches that branch, so **NULL_AS_EMPTY and the timestamp fallback only fire for absent headers, never for empty cells**. Predicted violations measured on live data (§2 NN column): actions, action_reviews, action_updates, action_task_details, one_on_one_schedule, one_on_one_logs, one_on_one_topics, meetings, meeting_attendees, my_notes, mail_log (error:1580/1580), health, sc_daily, sc_months, trackers, tracker_fields, mail_sla, mail_approvals (WP-32's verified 6-col case — fires as predicted, ×21 rows) + tracker backfills blocked_customers/operational_loss (`submitted_by`). Also latent: sc_behaviour.date, any future empty cell in any NOT-NULL col.
*Fix direction:* emit `''` instead of `null` for every `TEXT NOT NULL DEFAULT ''` column (the union of NULL_AS_EMPTY + the same col set for people/core tables — enumerable from DDL), or relax the columns. Until then WP-51 fails whole batches on these tables.

**B2 — transform wiring (P0).** Engine calls `ROW_TRANSFORMS[mapping.table]` on the *mapped* row; authored contract is raw row keyed by `mapping.sheet` pre-mapRow. Measured impact: `sched_offdays` 0/8, `sched_overrides` note-pack corrupted (reason/wfh dropped) ×163, `prod_daily_layers` layer=null ×601, `sched_team`/`sched_requests`/`sched_plan` would lose extra_json/note-pack/segments_json, `Trackers`/`TrackerFields`/`Heatmap*` bool+JSON defaults unfired (values still cast OK; `''`→null persists → feeds B1).
*Fix direction:* apply transforms to the raw sheet row, keyed by `mapping.sheet`, inside `migrateTable` between `readSheet` and `mapRow` (the documented hook).

**B3 — remote schema reconcile (P0).**
- Missing tables: `qe_fd_cache` (11,645 rows staged), `qa_access_log` (1 row). 014's drafted shapes don't match the mappings — `qe_fd_cache` needs the 13 verbatim columns, `qa_access_log` needs `(email,action,submitted_by,submitted_at)`. Rewrite 014 or the mappings before applying.
- V1-shape tables (rename-or-rebuild decision; V1 rows are 0 on all of them — checked): `esc_seen`, `agg_queue_now`, `agg_inflow_{daily,weekly,monthly}`, `agg_agent_{perf,daily}`, `agg_snapshots_today`, `kpi_ol_cases`, `prod_quarterly_reports`. Since remote holds no V1 data in these, simplest is DROP + recreate at the 007 shape (plus `prod_tph_*` already match remote — see B5).

**B4 — global `'value'` in NUM_COLS (P0).** Remove `'value'` from the merged `SUGGESTED_NUM_COLS` or scope parse-sets per-table. Restores `options` (0→26) and `qe_catalogue` (0→347); check `sched_config.value` string-ness after fix.

**B5 — wrong route-core mappings: `prod_tph_{days,tasks,cases,touches}` (P1).** Live tabs carry per-tab payloads that *match remote exactly* (`slots_json+sources_json+by+at`; `task_id,channel,start,end,by,at,removed`; `cases_json,by,at`; `touches_json`). Rewrite the 4 mappings 1:1 (remote additionally lacks `removed` on prod_tph_tasks — add col or drop from mapping). `prod_tph_calls` already correct. Also `prod_tph_days` upsert must be `date,agent_email`, not `date`.

**B6 — missing source tabs (P1, decide per-tab).** Absent in CC2 Core: `aging_flags`, `sched_team`, `sched_hour_overrides`, `sched_requests`, `sched_plan`, `action_planned_milestones`, `people_signals`, `HeatmapAssumptionSets` (expected — lazy create); productivity: `prod_quarterly_reports`. Legacy `ensureTable_` creates tabs on first write — these features wrote nothing. Options: create the tab + headers (then EMPTY migration), or drop/retire the mapping. Not share problems — SA reads everything that exists.

**B7 — insert-only tables re-run-duplicate (P1, runbook decision).** No `upsertOn`/no UNIQUE: `aging_open_tickets`, `agg_queue_now`*, `agg_inflow_{weekly,monthly}`*, `agg_agent_{perf,daily}`*, `agg_snapshots_today`*, `queue_submissions`, `dq_aging_flags`, `sched_plan`, `qe_builds`, `qa_volume`, `prod_daily_layers` (route mapping), `prod_tph_*`, `one_on_one_topics`, `one_on_one_private_notes`, `meeting_series_members`, `meeting_attendees`, `options`, `mail_log`, `holidays`, `follow_up_done`, `sc_behaviour`, `kpi_behaviour_log`, `kpi_leave_log`, `tlp_queue_daily`, `tlp_team`, `heatmap_*`, `refresh_log` (+ every `*`-B3 table post-reconcile). 014 covers only `tlp_queue_daily`, `tlp_team`, `queue_submissions`, `dq_aging_flags`. Decide: truncate-first per table, extend 014 uniques, or accept one-shot-only.

**B8 — `prod_daily_layers` double-targeting (P1).** Route mapping plain-inserts 1,156 rows (578 `effective` + 578 `raw` — verified); `agg_productivity_daily`→same table upserts 601 intended-`effective` rows but `upsertOn:'date,email'` can't work ((date,email) non-unique by design — and no remote UNIQUE). Needs `layer` in the upsert key (e.g. `layer,date,email` + UNIQUE idx) once B2 injects it, else it plain-fails or clobbers.

**B9 — pending schema decisions (P2).** `holidays.{holiday_id,updated_by,updated_at}` no DB cols (tab empty today — decide before rows appear); `mail_sla` boolean cells + `Trackers`/`TrackerFields` 'TRUE'/'FALSE' cast fine but B1 still applies to empty cells; `action_task_details` missing 5 newer headers (lands null → counted in B1); `prod_disputes`/`qa_audits_flat`/`Sheet1`/`Pivot Table 1` tabs unmigratable by design; `tracker_records` archive tabs ("Refund Log (pre-*)", operational_loss pivots) intentionally skipped per WP-32 DECISIONS.

**Ops note.** Sheets per-minute read quota is real: un-paced runs lose tabs to `429/quota` (pass 1 lost 8 Core tabs mid-run; re-read OK). WP-51's runner needs the same ~1 req/s pacing or per-store batching — `validate.ts` now paces (`readTabError`).

---

## 4. WP-51 sign-off (per-table)

| Verdict | Tables |
|---|---|
| **GO now** (35) | view_as · prod_intervals, prod_flags, prod_flag_log, prod_daily_layers (route half — see B8 for overlap), prod_window_hist, prod_flag_analytics, prod_tph_calls · qa_audits, qa_queue, qa_volume, qa_forms, qa_ctls, qa_disputes, qa_kb_gaps, qe_queue_log, qe_candidates, qe_outcomes, qe_builds · tickets, aging_open_tickets, refresh_log, queue_snapshots, agg_inflow_hourly · one_on_one_private_notes, meeting_series, meeting_series_members, pw_reminder_log, popups, follow_up_done, sc_behaviour (latent-B1 note) · tlp_shifts, tlp_queue_daily, tlp_team, tlp_area_metrics — all with insert-only/re-run caveats where marked |
| **GO-EMPTY** (12) | prod_tph_tasks†, qa_calibrations, holidays, queue_submissions, heatmap_inputs, kpi_behaviour_log, kpi_leave_log, mail_approval_log, tlp_resp_ratings, tlp_kb, tlp_otd†, tlp_ticket_exclusions (†also needs mapping fix — B5/B4 — before it ever has data) |
| **FIX first — engine/mapping (27 + 2 backfills)** | options, qe_catalogue, sched_config (B4); actions, action_reviews, action_updates, action_task_details, one_on_one_schedule, one_on_one_logs, one_on_one_topics, meetings, meeting_attendees, my_notes, mail_log, health, sc_daily, sc_months, trackers, tracker_fields, mail_sla, mail_approvals (B1); sched_offdays, sched_overrides, agg_productivity_daily→prod_daily_layers (B2/B8); prod_tph_days, prod_tph_cases, prod_tph_touches (B5); + tracker backfills blocked_customers, operational_loss (B1) |
| **FIX first — remote schema (11)** | qe_fd_cache, qa_access_log (need corrected 014); esc_seen, agg_queue_now, agg_inflow_daily, agg_inflow_weekly, agg_inflow_monthly, agg_agent_perf, agg_agent_daily, agg_snapshots_today, kpi_ol_cases (need V1→V2 reconcile; prod_tph_* handled in B5 instead) |
| **Blocked on source tab (9)** | dq_aging_flags, sched_team, sched_hour_overrides, sched_requests, sched_plan, action_planned_milestones, people_signals, heatmap_assumption_sets, prod_quarterly_reports — create tab or drop mapping (B6) |
| **No-mapping / N/A** | config, roster (app-managed), one_on_one_topic_prompts (out of scope), tracker_records (fed by the 6 backfills), prod_disputes + Sheet1/qa_audits_flat/Pivot tabs (no target), 4 vendor mirrors + 17 legacy V1 tables (not sheet-backed) |

**Gate:** WP-51 may proceed **table-by-table** — the 47 GO/GO-EMPTY mapping targets are migratable today (pending the B7 one-shot decision). The other 47 need B1–B6 resolved first; do **not** fire the full `migrateAll` until at least B1+B2+B4 land — they would produce silent corruption (`sched_overrides`, `prod_daily_layers.layer`) or hard batch failures, not just skips.

---

## Appendix A — `validate.ts --md --sample 20 --checksum-rows 50` output (verbatim)

```
Inventory: 0 route.ts mappings + 94 mappings/*.ts mappings   (route.ts is now a thin delegate — parse note only)
```

| Module | table | sheet | src | db | Δ | skip req/dup | status |
|---|---|---|---|---|---|---|---|
| core | config | Config | 130 | 138 | +8 | 0/0 | NO-MAPPING (by design) |
| core | follow_up_done | FollowUpDone | 2 | 0 | -2 | 0/0 | Δ-2 |
| core | health | Health | 30 | 10 | -20 | 0/0 | Δ-20 |
| core | holidays | holidays | 0 | 0 | 0 | — | EMPTY |
| core | mail_log | MailLog | 1,580 | 0 | -1580 | 0/0 | Δ-1580 |
| core | options | Options | 26 | 0 | -26 | 0/0 | Δ-26 |
| core | popups | Popups | 773 | 0 | -773 | 0/0 | Δ-773 |
| core | roster | Roster | 44 | 50 | +6 | — | NO-MAPPING (by design) |
| core | view_as | ViewAs | 12 | 12 | 0 | 0/0 | COUNT-OK |
| productivity | prod_daily_layers | prod_daily_layers | 1,156 | 2,579 | +1423 | 0/578† | Δ FIELD-DIFF CHECKSUM-DIFF |
| productivity | prod_flag_analytics | prod_flag_analytics | 219 | 219 | 0 | 0/0 | COUNT-OK |
| productivity | prod_flag_log | prod_flag_log | 1,771 | 1,839 | +68 | 0/0 | Δ68 |
| productivity | prod_flags | prod_flags | 1,263 | 1,330 | +67 | 0/0 | Δ CHECKSUM-DIFF |
| productivity | prod_intervals | prod_intervals | 23,247 | 21,183 | -2064 | 67/121 | Δ CHECKSUM-DIFF |
| productivity | prod_quarterly_reports | — | UNREADABLE | 0 | — | — | SRC-FAIL (tab absent) |
| productivity | prod_tph_calls/cases/touches | same | 13 ea | 125 ea | +112 | 0/0 | Δ FIELD-DIFF (mapping col mismatch) |
| productivity | prod_tph_days | same | 27 | 63 | +36 | 0/24 | Δ FIELD-DIFF |
| productivity | prod_tph_tasks | same | 0 | 0 | 0 | — | EMPTY |
| productivity | prod_window_hist | same | 118 | 114 | -4 | 0/0 | Δ FIELD-DIFF CHECKSUM-DIFF |
| quality | qa_access_log | QaAccessLog | 1 | 0 | -1 | 0/0 | Δ-1 (remote table absent — count via postgrest = n/a) |
| quality | qa_audits | qa_audits | 6,560 | 6,266 | -294 | 0/0 | Δ CHECKSUM-DIFF |
| quality | qa_calibrations | qa_calibrations | 0 | 0 | 0 | — | EMPTY |
| quality | qa_ctls | qa_ctls | 74 | 0 | -74 | 0/0 | Δ-74 |
| quality | qa_disputes | qa_disputes | 3 | 0 | -3 | 0/0 | Δ-3 |
| quality | qa_forms | qa_forms | 8 | 0 | -8 | 0/0 | Δ-8 |
| quality | qa_kb_gaps | qa_kb_gaps | 9 | 0 | -9 | 0/0 | Δ-9 |
| quality | qa_queue | qa_queue | 2,314 | 1,668 | -646 | 0/0 | Δ-646 |
| quality | qa_volume | qa_volume | 1,391 | 892 | -499 | 0/0 | Δ CHECKSUM-DIFF |
| quality | qe_builds | Build Log | 117 | 0 | -117 | 0/0 | Δ-117 |
| quality | qe_candidates | Candidates | 11 | 0 | -11 | 0/0 | Δ-11 |
| quality | qe_catalogue | Catalogue | 347 | 0 | -347 | 0/0 | Δ-347 |
| quality | qe_fd_cache | Ticket Detail Cache | 11,645 | 0 | -11645 | 0/0 | Δ-11645 (remote absent) |
| quality | qe_outcomes | Build Outcomes | 20 | 0 | -20 | 0/0 | Δ-20 |
| quality | qe_queue_log | Queue Log | 3,887 | 0 | -3887 | 0/0 | Δ-3887 |
| queue | agg_* / esc_seen / aging_open_tickets / refresh_log / queue_snapshots | live/data_2026/tickets | 186,806 total | 46 (refresh_log) | — | 0/0 | Δ — V1-shape blockers per §3 B3 |
| queue | dq_aging_flags | aging_flags | UNREADABLE | 0 | — | — | SRC-FAIL (tab absent) |
| queue | queue_submissions | queue_status_submissions | 0 | 0 | 0 | — | EMPTY |
| queue | sched_config/offdays/overrides | core | 2/8/163 | 0 | — | 0/0, 8/4, 0/0 | Δ / skip |
| queue | sched_{team,hour_overrides,requests,plan} | core | UNREADABLE | 0 | — | — | SRC-FAIL (tabs absent) |
| queue | tickets | tickets | 176,582 | 0 | -176582 | 0/0 | Δ-176582 |
| people | actions…sc_months | core/live/data_2026 | 1,339 total | 0 | — | 0/0 | Δ; tabs absent: action_planned_milestones, people_signals, one_on_one_topic_prompts |
| desk | kpi_*/mail_*/tlp_* | live | 351 total | 0 | — | 0/0 | Δ; 8 EMPTY tabs |
| operations | trackers/tracker_fields | core | 6/66 | 5/0 | — | 0/0 | Δ FIELD-DIFF (seed rows differ — expected: upsert overlays) |
| operations | tracker_records | — | UNREADABLE | 0 | — | — | NO-MAPPING SRC-FAIL (fed by backfills) |
| vendor | fd_activities, maqsam_calls, freshchat, cache_stamps | — | N/A | 195,553 / 112,037 / 0 / 0 | — | — | N/A-SRC |
| legacy | 17 V1 tables | — | N/A | 0 | — | — | N/A-SRC |

Validator tally: 119 tables · 93 mapped / 26 unmapped · count match 15 · mismatch 72 · src unreadable 11 · not sheet-backed 21 · field diffs 8 · checksum diffs 6 · db failures 0.
† validator dedupes prod_daily_layers under the *sibling* (date,email) upsertOn — the merged view; the real engine runs route's plain-insert for that sheet (578 dup keys = the 2-layer structure, see B8).

Ledger lines worth keeping verbatim: `prod_intervals: 67 rows skipped — missing required [interval_key, agent_email]` · `121 rows skipped — duplicate upsert key (interval_key)` · `sched_offdays: 8 rows skipped — missing required [tl_email, date]` · `prod_tph_days: 24 rows skipped — duplicate upsert key (date)` · unreadable-tabs list identical to §3 B6 · `inventory: route.ts MAPPINGS literal could not be parsed` (thin route — expected post-merge) · `config/roster/one_on_one_topic_prompts/tracker_records/agg_productivity_daily: no mapping yet` (all intended except the last, which is the prod_daily_layers double-count artifact).

## Appendix B — probes used

- Remote schema: `GET {SUPABASE_URL}/rest/v1/` openapi definitions (cols + `required` per table; `required` = all NOT NULL cols incl. `DEFAULT ''`) — via `migration/probe-remote.ts` + `probe-req.ts`.
- Tab inventories: `spreadsheets.get` per store — core 34, productivity 13, live 24, data_2026 5, quality 17, tickets 2.
- Raw tab spot-checks (`probe-tabs.ts`, `dbg2.ts`): Options/sched_offdays/sched_overrides/Trackers/TrackerFields/Catalogue/Ticket Detail Cache/mail_approvals/mail_sla/tlp_*/prod_tph_*/agg_productivity_daily/holidays/QaAccessLog/kpi_ol_cases/refresh_log/queue_status_submissions headers + first rows; prod_daily_layers layer histogram; sched_config values; Trackers row 7 (damaged_items_5917 confirmed).
- No secrets in this doc. `.env.local` only (per WP-34 — Vercel pulls are `[SENSITIVE]`-redacted).
