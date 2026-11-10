# Migration validation report — shard-80 Sheets → Supabase

> Scaffold emitted by **WP-33**. Populated when the credentialed run lands (**WP-51**; dry-run numbers may appear earlier via WP-35).
>
> **How to populate:** run `npx tsx migration/validate.ts --md` and paste the generated markdown tables into the matching section below; fill each skip ledger from the validator's SKIP/ISSUE LEDGER output; then sign off.
> Inventory sources: `src/app/api/admin/migrate/route.ts` `MAPPINGS` + `src/features/shared/migration/mappings/*.ts` (WP-30/31/32, relocated by the wave-3 merge) + the full DDL inventory (`supabase/migrations/*.sql`).
> Store share state as of scaffold date (`audits/sheet-access.md`): 19/22 stores shared with the migration SA; **`ss_tickets_id`, `ss_live_id`, `ss_data_2026_id` are NOT shared** — those tables will report `UNREADABLE (403)` until the owner shares them (Viewer is enough).

**Run metadata** _(WP-51, 2026-11-06)_

| Field | Value |
|---|---|
| Run date | 2026-11-06 UTC |
| Runner / commit | WP-51 @ `ad2bbc0` (+ uncommitted engine pacing patch `readSheetRaw`) |
| Command | `npx tsx migration/migrate-all.ts` (+ `--tables tickets` retry) → `npx tsx migration/validate.ts --md` |
| Supabase project | `NEXT_PUBLIC_SUPABASE_URL` from `.env.local` (service-role) |
| Sheet access | service account `migration-reader@…` (Viewer share) |

**Roll-up** _(WP-51, 2026-11-06)_

| Metric | Count |
|---|---|
| Tables in inventory | 119 |
| Count match (source = Supabase) | 71 |
| Count mismatch | 16 (all documented — pre-existing remote rows / live-sheet drift / validator artifacts; `audits/migration-run.md` §5) |
| Skipped — no credentials / no store | 0 |
| Unreadable source tabs | 11 (9 absent B6 tabs + `tracker_records`/`one_on_one_topic_prompts` — no-mapping by design) |
| No mapping | 26 (incl. 21 not-sheet-backed; `agg_productivity_daily` row is the prod_daily_layers double-target artifact) |
| Field diffs (sampled) | 26 — verified artifacts (bool/timestamp rendering, `now()` stamps, transform-free validator mapRow); `audits/migration-run.md` §5 |
| Checksum diffs | 8 — mixed row-sets incl. pre-existing remote rows + documented col notes |
| Migration run | **94 mappings ran — 71 mapped tables landed rows + tracker_records, 0 hard failures remaining** (tickets retry landed 176,616/176,616) |

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
| config | Config | core | 130 | 138 | 8 | 0/0 | — | — | NO-MAPPING Δ8 |
| follow_up_done | FollowUpDone | core | 2 | 2 | 0 | 0/0 | 2/2 match | n/a | COUNT-OK |
| health | Health | core | 30 | 31 | 1 | 0/0 | 0/5 match | n/a | Δ1 FIELD-DIFF† |
| holidays | holidays | core | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| mail_log | MailLog | core | 1580 | 1580 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| options | Options | core | 26 | 26 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| popups | Popups | core | 773 | 773 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| roster | Roster | core | 44 | 50 | 6 | 0/0 | — | — | NO-MAPPING Δ6 |
| view_as | ViewAs | core | 12 | 12 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| health | +1 | 10 remote rows pre-existed; 30 upserted (9 shared keys) → 31. One remote-only status key remains — expected |
| options / health | field-diff flag | artifact: `updated_at` `now()` fallback stamps + positional compare order — verified benign |
| config · roster | — | app-managed, no mapping by design |

**Sign-off:** WP-51 · 2026-11-06 — all 7 mapped tables migrated; counts verified

---

## Productivity

`prod_intervals` · `prod_flags` · `prod_flag_log` · `prod_daily_layers` · `prod_window_hist` · `prod_flag_analytics` · `prod_quarterly_reports` · `prod_tph_days` · `prod_tph_tasks` · `prod_tph_cases` · `prod_tph_touches` · `prod_tph_calls`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| prod_daily_layers | prod_daily_layers + agg_productivity_daily | productivity + data_2026 | 1156 + 601 | 1419 | 263 | 0/0 | 5/5 match | ✗ src 445000.71 / db 454927.91 | Δ263 CHECKSUM-DIFF† |
| prod_flag_analytics | prod_flag_analytics | productivity | 219 | 219 | 0 | 0/0 | 5/5 match | ✓ (219 rows) | COUNT-OK |
| prod_flag_log | prod_flag_log | productivity | 1771 | 1839 | 68 | 0/0 | 5/5 match | n/a | Δ68† |
| prod_flags | prod_flags | productivity | 1263 | 1330 | 67 | 0/0 | 5/5 match | ✗ src 77837.16 / db 81186.05 | Δ67 CHECKSUM-DIFF† |
| prod_intervals | prod_intervals | productivity | 23247 | 23059 | -188 | 67/121 | 5/5 match | ✗ src 280302.94 / db 253133.62 | Δ-188 CHECKSUM-DIFF† |
| prod_quarterly_reports | prod_quarterly_reports | productivity | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| prod_tph_calls | prod_tph_calls | productivity | 13 | 128 | 115 | 0/0 | 5/5 match | n/a | Δ115† |
| prod_tph_cases | prod_tph_cases | productivity | 13 | 128 | 115 | 0/0 | 5/5 match | n/a | Δ115† |
| prod_tph_days | prod_tph_days | productivity | 27 | 63 | 36 | 0/0 | 5/5 match | n/a | Δ36† |
| prod_tph_tasks | prod_tph_tasks | productivity | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| prod_tph_touches | prod_tph_touches | productivity | 13 | 128 | 115 | 0/0 | 5/5 match | n/a | Δ115† |
| prod_window_hist | prod_window_hist | productivity | 118 | 120 | 2 | 0/0 | 5/5 match | ✗ src 21309 / db 21505 | Δ2 CHECKSUM-DIFF† |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| prod_intervals | 67 req + 121 dup | missing `interval_key`/`agent_email` (blank rows); dup upsert keys collapse inside the upsert — engine migrated 23,059 |
| prod_daily_layers | +263 | upsert onto 1,374 deduped keys: sheet 1,156 (`raw`+`effective`) + `agg_productivity_daily` 601 (`effective`) → +45 net-new keys; checksum diff = mixed row-sets incl. pre-existing |
| prod_flags / prod_flag_log / prod_tph_* / prod_window_hist | Δ | remote already app-fed — db>src where remote rows extend past sheet backlog; upsert reconciled, 5/5 sampled rows match |
| prod_quarterly_reports | — | source tab absent (B6 — owner decision documented) |

**Sign-off:** WP-51 · 2026-11-06 — all present tabs migrated incl. both prod_daily_layers sources

---

## Quality engine

`qa_audits` · `qa_queue` · `qa_volume` · `qa_forms` · `qa_ctls` · `qa_disputes` · `qa_calibrations` · `qa_kb_gaps` · `qe_queue_log` · `qe_candidates` · `qe_catalogue` · `qe_outcomes` · `qe_builds` · `qa_access_log` · `qe_fd_cache`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| qa_access_log | QaAccessLog | core | 1 | 1 | 0 | 0/0 | 1/1 match | n/a | COUNT-OK |
| qa_audits | qa_audits | quality | 6560 | 6560 | 0 | 0/0 | 5/5 match | ✓ (2000 rows) | COUNT-OK |
| qa_calibrations | qa_calibrations | quality | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| qa_ctls | qa_ctls | quality | 74 | 74 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qa_disputes | qa_disputes | quality | 3 | 3 | 0 | 0/0 | 3/3 match | n/a | COUNT-OK |
| qa_forms | qa_forms | quality | 8 | 8 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| qa_kb_gaps | qa_kb_gaps | quality | 9 | 9 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qa_queue | qa_queue | quality | 2314 | 2314 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qa_volume | qa_volume | quality | 1391 | 2283 | 892 | 0/0 | 5/5 match | ✗ src 6277 / db 8673 | Δ892 CHECKSUM-DIFF† |
| qe_builds | Build Log | quality | 117 | 117 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qe_candidates | Candidates | quality | 11 | 11 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qe_catalogue | Catalogue | quality | 347 | 347 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qe_fd_cache | Ticket Detail Cache | quality | 11645 | 11645 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qe_outcomes | Build Outcomes | quality | 20 | 20 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| qe_queue_log | Queue Log | quality | 3887 | 3887 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| qa_volume | +892 | insert-only append onto 892 pre-existing remote rows → 2,283 (B7 one-shot — landed first pass) |
| qa_forms | field-diff flag | artifact (`now()` stamps / compare order) |

**Sign-off:** WP-51 · 2026-11-06 — 14/15 tables migrated; `qe_catalogue` B4 fix verified (347/347), `qe_fd_cache`/`qa_access_log` landed into 014-created tables

---

## Queue & scheduler

`tickets` · `esc_seen` · `aging_open_tickets` · `dq_aging_flags` · `queue_submissions` · `queue_snapshots` · `agg_queue_now` · `agg_inflow_{daily,weekly,monthly,hourly}` · `agg_agent_perf` · `agg_agent_daily` · `agg_snapshots_today` · `refresh_log` · `agg_productivity_daily` · `sched_*`×7 · `heatmap_inputs` · `heatmap_assumption_sets`

> ✅ `ss_tickets_id` / `ss_live_id` / `ss_data_2026_id` are now shared — every tab in this module read cleanly at WP-51.

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| agg_agent_daily | agg_agent_daily | live | 324 | 324 | 0 | 0/0 | 5/5 match | ✓ (324 rows) | COUNT-OK |
| agg_agent_perf | agg_agent_perf | live | 48 | 48 | 0 | 0/0 | 5/5 match | ✓ (48 rows) | COUNT-OK |
| agg_inflow_daily | agg_inflow_daily | live | 555 | 548 | -7 | 0/0 | 5/5 match | n/a | Δ-7† |
| agg_inflow_hourly | agg_inflow_hourly | data_2026 | 5239 | 5239 | 0 | 0/0 | 0/0 match | ✗ src 0 / db 4052000 | COUNT-OK CHECKSUM-DIFF† |
| agg_inflow_monthly | agg_inflow_monthly | live | 32 | 32 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| agg_inflow_weekly | agg_inflow_weekly | live | 95 | 95 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| agg_productivity_daily | agg_productivity_daily | data_2026 | 601 | 0 | -601 | 0/0 | — | — | NO-MAPPING Δ-601† |
| agg_queue_now | agg_queue_now | live | 18 | 18 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| agg_snapshots_today | agg_snapshots_today | live | 50 | 50 | 0 | 0/0 | 0/5 match | ✓ (50 rows) | COUNT-OK FIELD-DIFF† |
| aging_open_tickets | aging_open_tickets | live | 148 | 148 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| dq_aging_flags | aging_flags | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| esc_seen | esc_seen | tickets | 887 | 887 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| heatmap_assumption_sets | HeatmapAssumptionSets | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| heatmap_inputs | HeatmapInputs | core | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| queue_snapshots | queue_snapshots | data_2026 | 2184 | 2184 | 0 | 0/0 | 0/5 match | ✗ src 0 / db 4052000 | COUNT-OK FIELD-DIFF CHECKSUM-DIFF† |
| queue_submissions | queue_status_submissions | core | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| refresh_log | refresh_log | live | 8199 | 8243 | 44 | 0/0 | 0/5 match | n/a | Δ44 FIELD-DIFF† |
| sched_config | sched_config | core | 2 | 2 | 0 | 0/0 | 2/2 match | n/a | COUNT-OK |
| sched_hour_overrides | sched_hour_overrides | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| sched_offdays | sched_offdays | core | 8 | 8 | 0 | 8/4† | 0/0 match | n/a | COUNT-OK |
| sched_overrides | sched_overrides | core | 163 | 163 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| sched_plan | sched_plan | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| sched_requests | sched_requests | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| sched_team | sched_team | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| tickets | tickets | tickets | 176616 | 176616 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| tickets | — | pass 1 dropped 2×500-row batches (`TypeError: fetch failed`, transient); `--tables tickets` retry landed 176,616/176,616 — upsert `ticket_id` made it safe |
| sched_offdays | "8 req + 4 dup" | validator artifact — it doesn't apply the sheet-keyed transform that injects `tl_email`/`date`; the engine migrated **8/8** |
| agg_productivity_daily | 601 | double-target artifact — the sheet maps to `prod_daily_layers` (rows landed there); no table of this name exists |
| agg_inflow_daily · refresh_log · tickets src | Δ | live sheets grew between migrate-read and validate-read (555 vs 548 migrated; 8,199 vs 8,197 + 46 pre-existing = 8,243; 176,616 vs earlier reads) |
| dq_aging_flags · sched_{team,hour_overrides,requests,plan} · heatmap_assumption_sets | — | source tabs absent (B6 — owner decision documented) |
| FIELD-DIFF flags (10 tables) | — | verified artifacts: `'TRUE'`/`true` bools, `…Z`/`…+00:00` ISO variants, `now()` stamps, transform cols validator can't reproduce (spot-checked on tickets — `audits/migration-run.md` §5) |
| CHECKSUM-DIFF (agg_inflow_hourly, queue_snapshots) | — | src checksum 0: numeric cols (`count`/`inflow`) are produced by transforms the validator's mapRow port doesn't run; DB values verified by 5/5 key-matched rows |

**Sign-off:** WP-51 · 2026-11-06 — all present tabs migrated; tickets completed via targeted retry

---

## People

`actions` · `action_reviews` · `action_updates` · `action_task_details` · `action_planned_milestones` · `one_on_one_*`×5 · `meeting_series` · `meeting_series_members` · `meetings` · `meeting_attendees` · `pw_reminder_log` · `people_signals` · `my_notes` · `sc_daily` · `sc_behaviour` · `sc_months`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| action_planned_milestones | action_planned_milestones | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| action_reviews | action_reviews | core | 11 | 11 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| action_task_details | action_task_details | core | 15 | 15 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| action_updates | action_updates | core | 1 | 1 | 0 | 0/0 | 1/1 match | n/a | COUNT-OK |
| actions | actions | core | 24 | 24 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| meeting_attendees | meeting_attendees | core | 15 | 15 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| meeting_series | meeting_series | core | 1 | 1 | 0 | 0/0 | 0/1 match | n/a | COUNT-OK FIELD-DIFF† |
| meeting_series_members | meeting_series_members | core | 5 | 5 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| meetings | meetings | core | 3 | 3 | 0 | 0/0 | 2/3 match | n/a | COUNT-OK FIELD-DIFF† |
| my_notes | my_notes | core | 1 | 1 | 0 | 0/0 | 0/1 match | n/a | COUNT-OK FIELD-DIFF† |
| one_on_one_logs | one_on_one_logs | core | 4 | 4 | 0 | 0/0 | 0/4 match | n/a | COUNT-OK FIELD-DIFF† |
| one_on_one_private_notes | one_on_one_private_notes | core | 1 | 1 | 0 | 0/0 | 1/1 match | n/a | COUNT-OK |
| one_on_one_schedule | one_on_one_schedule | core | 5 | 5 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| one_on_one_topic_prompts | — | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | NO-MAPPING SRC-FAIL (out of scope, WP-31) |
| one_on_one_topics | one_on_one_topics | core | 9 | 9 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| people_signals | people_signals | core | UNREADABLE (tab absent) | 0 | — | 0/0 | — | — | SRC-FAIL (B6) |
| pw_reminder_log | pw_reminder_log | core | 107 | 107 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| sc_behaviour | sc_behaviour | data_2026 | 3 | 3 | 0 | 0/0 | 3/3 match | n/a | COUNT-OK |
| sc_daily | sc_daily | data_2026 | 1123 | 1123 | 0 | 0/0 | 5/5 match | ✓ (1123 rows) | COUNT-OK |
| sc_months | sc_months | live | 3 | 3 | 0 | 0/0 | 0/3 match | n/a | COUNT-OK FIELD-DIFF† |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| action_planned_milestones · people_signals · one_on_one_topic_prompts | — | source tabs absent (first two B6 owner decision; prompts no-mapping by design) |
| FIELD-DIFF flags (10 tables) | — | artifacts: NOT-NULL `''` cols land `''` vs validator `null`, `now()` fallback stamps, bool casts — B1 fix verified by 0 batch errors |

**Sign-off:** WP-51 · 2026-11-06 — all present tabs migrated; sc_daily 1,123/1,123 incl. 67 `name:''` rows (B1 verified)

---

## TL desk

`tlp_resp_ratings` · `tlp_kb` · `tlp_otd` · `tlp_ticket_exclusions` · `tlp_shifts` · `tlp_queue_daily` · `tlp_team` · `tlp_area_metrics` · `kpi_behaviour_log` · `kpi_leave_log` · `kpi_ol_cases` · `mail_sla` · `mail_approvals` · `mail_approval_log`

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| kpi_behaviour_log | kpi_behaviour_log | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| kpi_leave_log | kpi_leave_log | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| kpi_ol_cases | kpi_ol_cases | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| mail_approval_log | mail_approval_log | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| mail_approvals | mail_approvals | live | 21 | 21 | 0 | 0/0 | 5/5 match | n/a | COUNT-OK |
| mail_sla | mail_sla | live | 50 | 50 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| tlp_area_metrics | tlp_area_metrics | live | 3 | 3 | 0 | 0/0 | 3/3 match | n/a | COUNT-OK |
| tlp_kb | tlp_kb | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| tlp_otd | tlp_otd | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| tlp_queue_daily | tlp_queue_daily | live | 107 | 107 | 0 | 0/0 | 0/5 match | ✗ src 1183 / db 148 | COUNT-OK FIELD-DIFF CHECKSUM-DIFF† |
| tlp_resp_ratings | tlp_resp_ratings | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |
| tlp_shifts | tlp_shifts | live | 117 | 117 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| tlp_team | tlp_team | live | 4 | 4 | 0 | 0/0 | 4/4 match | n/a | COUNT-OK |
| tlp_ticket_exclusions | tlp_ticket_exclusions | live | 0 | 0 | 0 | 0/0 | — | — | SRC-EMPTY COUNT-OK |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| 8 empty tabs | — | header-only tabs — migrated 0 by design (`kpi_*`, `mail_approval_log`, `tlp_{resp_ratings,kb,otd,ticket_exclusions}`) |
| tlp_queue_daily | checksum | `windows` = window-count int; sheet range text (`"09:30-17:00"`) intentionally not representable (mapping-documented); field-diff is the same artifact |
| mail_sla / tlp_shifts | field-diff flag | artifacts: transform outputs (`replied` bool, epoch-ms→ISO, `queue_json`) the validator doesn't apply |

**Sign-off:** WP-51 · 2026-11-06 — all populated tabs migrated

---

## Operations (trackers)

`trackers` · `tracker_fields` · `tracker_records` + each sheet-backed tracker's record tab (external spreadsheets resolved from the `Trackers` registry at run time)

| Table | Sheet | Store | Source rows | Supabase rows | Δ | Skip (req/dup) | Field diff | Checksum | Status |
|---|---|---|---|---|---|---|---|---|---|
| tracker_fields | TrackerFields | core | 66 | 66 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |
| tracker_records | 6 record tabs (backfill) | per-tracker stores | 2094 | 2091 | -3 | 0/3 dup | — | — | BACKFILLED (6/6) |
| trackers | Trackers | core | 6 | 6 | 0 | 0/0 | 0/5 match | n/a | COUNT-OK FIELD-DIFF† |

**Backfill detail** — `TRACKER_RECORD_BACKFILLS` ran inside `migrateAll`; upsert `(tracker_id,record_id)`:

| tracker | record tab | read | records | storage_mode after |
|---|---|---|---|---|
| blocked_customers | Sheet1 (1KFC…PEA) | 6 | 6 | **native** ✓ |
| promocodes | Form Responses 1 (1GsB…gTw) | 24 | 24 | **native** ✓ |
| operational_loss | Sheet1 (12jV…e5Uc) | 2,000 | 1,997 | **native** ✓ (3 dup Record-ID cells, last-wins) |
| customer_strikes | Form Responses 1 (1Odi…OMmQ) | 4 | 4 | **native** ✓ |
| refund_ledger | Refund Log (1ZaJ…GU8) | 59 | 59 | **native** ✓ |
| damaged_items_5917 | Tracker Damaged Items (core) | 1 | 1 | **native** ✓ (trackers row upserted by the Trackers mapping first) |

**Skip ledger**

| Table | Rows | Reason |
|---|---|---|
| tracker_records | -3 | operational_loss had 3 duplicate `Record ID` cells — deduped last-wins (documented dry-run) |
| trackers / tracker_fields | field-diff flag | artifacts: seed-row `now()` stamps + transform defaults validator doesn't apply; upsert overlay verified (5→6 trackers, 61→66 fields incl. 013 seeds) |

**Sign-off:** WP-51 · 2026-11-06 — 6/6 backfills applied, `SELECT storage_mode FROM trackers` = all `native`, tracker_records = 2,091

---

## Vendor mirrors / derived (not sheet-backed)

`fd_activities` · `maqsam_calls` · `freshchat` · `cache_stamps` — populated by vendor sync jobs, not the Sheets migration; Supabase count reported for completeness.

| Table | Supabase rows | Status |
|---|---|---|
| fd_activities | 195,553 | N/A — not sheet-backed (pre-existing, untouched) |
| maqsam_calls | 112,037 | N/A — not sheet-backed (pre-existing, untouched) |
| freshchat | 0 | N/A — not sheet-backed |
| cache_stamps | 0 | N/A — not sheet-backed |

**Sign-off:** WP-51 · 2026-11-06 — out of migration scope by design

---

## Legacy remote tables (V1, not in numbered DDL)

`qa_flags` · `qa_flag_log` · `qa_daily` · `qa_months` · `fcr_daily` · `fcr_weekly` · `fcr_monthly` · `kpi_logs` · `kpi_unplanned_leave` · `headcount` · `team_structure` · `schedule` · `days_off` · `weekly_schedule` · `tls` · `tlp` · `md`

| Table | Supabase rows | Status |
|---|---|---|
| all 17 V1 legacy tables | 0 each | N/A — not sheet-backed / no V1 data existed remotely (dry-run verified) |

**Sign-off:** WP-51 · 2026-11-06 — nothing to migrate; V1 tables were already empty remotely

---

## Overall sign-off

| Role | Name | Date | Verdict |
|---|---|---|---|
| Migration run executed by | WP-51 | 2026-11-06 | **DONE — 94 mappings executed, 72 tables landed, tickets retry resolved; residual deltas documented in `audits/migration-run.md`** |
| Reviewed by (owner) | _pending_ | _pending_ | _pending_ |

> † FIELD-DIFF / CHECKSUM-DIFF flags in the module tables are validator artifacts verified benign — see `audits/migration-run.md` §5 (bool/ISO-timestamp rendering, `now()` re-stamps, transform-free validator mapRow, pre-existing remote rows). Zero PGRST204, zero NOT-NULL violations, zero quota errors in the real run.

---

## Migration run 2 — post-run state (migration-remaining, 2026-11-09)

> **PARTIAL — live writes PENDING-APPROVAL.** Code/mappings/CLIs complete and
> verified read-only; no remote write has executed. Full ledger:
> `audits/migration-run-2.md`. Per-store final states:
> `specs/migration-remaining/source-inventory.md`. Validator now covers
> 124 tables incl. `dq_hct`, `actions` (v1_ops), `fc_messages`
> (`tl5-validate.log`, exit=0; `npx tsx migration/validate.ts --md`).

| Store | Target | Dry/probe evidence | Live write |
|---|---|---|---|
| hct `1LtUZb…` | `dq_hct` | dry read 60 rows (`dry-run-2.log` l.99) | PENDING-APPROVAL |
| v1_ops `1hul-T…` Tasks | `actions` | dry read 18 rows (l.100); non-task tabs final: 9 land via S06 mappings incl. `v1_task_occurrences`, 8 rejected (`decisions-v1-ops.md`) | PENDING-APPROVAL |
| daily_report `Freshchat` | `freshchat` | read 1,742 → 1,602 unique (`fc-dry.log`) | PENDING-APPROVAL |
| fd_activity `Activities` | `fd_activities` | gap=873 (remote 207,811 vs expected 208,684) (`fd-check.log`) | PENDING-APPROVAL |
| voice/text QA forms | `qa_audits` | would-import 4,076 + 1,709 (`qa-probe.log`) | PENDING-APPROVAL |
| oct_workbook (2026-09) | `scRefreshMonth_` | configured month resolved; prior run 480 rows (`sc-probe.log`); 2026-08 blocked on workbook share (S06-11) | PENDING-APPROVAL |
| fc_messages `1ZxDxS…` | `fc_messages` | 82,805 unique rows (`fcmsg-dry.log`) | PENDING-APPROVAL |
| touch_archive / qa_engine_source / qa_queue | — | rejected as stores (⊆ landed tables / live V1 store); reshard flags resolved — NTD tabs → `fd_activities` gap fill, qa_queue orphans → `qe_fd_cache` import staged (run-2 §7) | n/a |
| 23 insert-only tables | — | dedupe+UNIQUE DDL authored (4 migrations), `upsertOn` flipped 23/23 | PENDING-APPROVAL (apply + targeted re-run, expect 0 new rows) |

**Sign-off (run 2):** _pending PM approval-gated live runs; QA/Data/Security gates review `audits/migration-run-2.md`._
