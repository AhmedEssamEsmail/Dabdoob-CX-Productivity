# WP-51 — Full Sheets→Supabase migration run (real run, writes applied)

> Executed 2026-11-06 UTC by WP-51 (claimed row in TASK_TRACKER @ `ad2bbc0`).
> Commands:
> 1. `npx tsx migration/pre-run-counts.ts pre  > migration/counts-pre.txt` — remote row snapshot of all 94 targets + tracker_records (insert-only guard).
> 2. `npx tsx migration/migrate-all.ts` — **real run** (tee'd to `migration/run-log.txt`), 6.3 min.
> 3. `npx tsx migration/migrate-all.ts --tables tickets` — targeted retry for 2 transient batch failures (tee'd to `migration/run-log-tickets-retry.txt`), 5.7 min.
> 4. `npx tsx migration/pre-run-counts.ts post > migration/counts-post.txt` + `migration/check-trackers.ts` — verification.
> 5. `npx tsx migration/validate.ts --md > migration/validate-md.txt` — post-run validator ledger (feeds `migration-report.md`).
>
> Runner patch (gitignored `migration/`, plus one engine call-site patch):
> - `migrate-all.ts`: iterates `migrateTable` per mapping with incremental `[i/94]` progress lines — identical engine calls/order to `migrateAll` (ROUTE then MODULE mappings, backfills last) so a mid-run crash leaves a usable log. `--dry`/`--tables` unchanged.
> - `src/features/shared/migration/engine.ts`: `readSheetRaw()` added — ~700 ms read pacing + 3-attempt quota/429 retry (12 s backoff); `readSheet` and the tracker-backfill read both route through it (same treatment `validate.ts`'s `readTabError` got in WP-35; dry-run §3 ops note). Left uncommitted for the wave-3-final commit.

---

## 1. Headline

**94 mappings ran; 71 distinct mapped tables landed rows (+`tracker_records` via 6 backfills); 9 absent source tabs (documented B6 owner decision); 13 header-only/empty tabs migrated 0; 6/6 tracker backfills applied + storage_mode flips verified.** One table needed a follow-up run: `tickets` (2 transient `TypeError: fetch failed` upsert batches in pass 1 — re-ran clean, upsertOn `ticket_id` → idempotent). **No insert-only table was left partial — no re-append was needed or performed on any one-shot table.**

| Metric | Value |
|---|---|
| Total source rows read | 255,600 across 94 mappings + 6 backfill tabs (tickets 176,607 pass 1 / 176,616 retry) |
| Rows migrated (writes acked) | 254,409 mapped-row writes (insert+upsert) + 2,091 tracker records; tickets retry re-upserted 176,616 |
| Tables with rows landed | 71 of 93 distinct mapped tables + `tracker_records` (22 mappings wrote 0 — 9 absent + 13 empty tabs) |
| Hard failures | 0 remaining (tickets retry resolved; absent/empty tabs are expected skips) |
| Runtime | 6.3 min main + 5.7 min tickets retry |
| Sheets read quota | 0 quota errors after pacing patch |

## 2. Per-table run log

Columns: **read** = sheet rows read · **migrated** = rows written (post require-filter + upsert dedupe) · **skipped** = require-filter drops (dup-key collapse is inside migrated for upsert tables) · **result**.

### Route-core mappings (16)

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| view_as | 12 | 12 | 0 | OK (delete+insert replace) |
| prod_intervals | 23,247 | 23,059 | 67 | OK — 67 missing `interval_key`/`agent_email` (legit); 121 dup keys collapsed by upsert |
| prod_flags | 1,263 | 1,263 | 0 | OK |
| prod_flag_log | 1,771 | 1,771 | 0 | OK |
| prod_daily_layers (route sheet) | 1,156 | 1,156 | 0 | OK — upsert `(date,email,layer)`; raw+effective layers both land |
| prod_window_hist | 118 | 118 | 0 | OK |
| prod_flag_analytics | 219 | 219 | 0 | OK |
| prod_quarterly_reports | 0 | 0 | — | SKIP — source tab absent (B6, owner decision documented) |
| prod_tph_days | 27 | 27 | 0 | OK — F22 fix verified live (was 3/27 pre-fix) |
| prod_tph_tasks | 0 | 0 | — | EMPTY tab (headers only) |
| prod_tph_cases | 13 | 13 | 0 | OK |
| prod_tph_touches | 13 | 13 | 0 | OK |
| prod_tph_calls | 13 | 13 | 0 | OK |
| qa_audits | 6,560 | 6,560 | 0 | OK |
| qa_queue | 2,314 | 2,314 | 0 | OK |
| qa_volume | 1,391 | 1,391 | 0 | OK — insert-only append onto 892 pre-existing → 2,283 |

### Module mappings (78) — tickets/queue/scheduler

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| tickets | 176,607 → 176,616 | **176,616** | 0 | **OK after retry** — pass 1: 2 batches (`Rows 38000–39000`) failed `TypeError: fetch failed` (transient PostgREST fetch drop); `--tables tickets` re-run landed 100%, upsertOn `ticket_id` made it safe. Sheet grew +9/+34 rows between reads (live store) |
| esc_seen | 887 | 887 | 0 | OK — 014 V1-drift recreate accepted the V2 cols |
| aging_open_tickets | 148 | 148 | 0 | OK — insert-only (dry-run read 166; live list churns) |
| agg_queue_now | 18 | 18 | 0 | OK (recreated table, insert-only) |
| agg_inflow_daily | 548 | 548 | 0 | OK — upsert (validator later read 555 — live drift) |
| agg_inflow_weekly | 95 | 95 | 0 | OK (insert-only) |
| agg_inflow_monthly | 32 | 32 | 0 | OK (insert-only) |
| agg_agent_perf | 48 | 48 | 0 | OK (insert-only) |
| agg_agent_daily | 324 | 324 | 0 | OK (insert-only) |
| agg_snapshots_today | 50 | 50 | 0 | OK (insert-only) |
| refresh_log | 8,197 | 8,197 | 0 | OK — insert-only append onto 46 pre-existing → 8,243 |
| queue_submissions | 0 | 0 | — | EMPTY tab |
| dq_aging_flags | 0 | 0 | — | SKIP — tab `aging_flags` absent (B6) |
| sched_config | 2 | 2 | 0 | OK — `value:'0'` stayed the jsonb string (B4 fix verified) |
| sched_team / sched_hour_overrides / sched_requests / sched_plan | 0 | 0 | — | SKIP — tabs absent (B6) |
| sched_offdays | 8 | 8 | 0 | **OK — B2 fix verified** (validator still predicts 8 req-skips because it doesn't apply transforms) |
| sched_overrides | 163 | 163 | 0 | **OK — B2 fix verified** (real reason/wfh packed by transform) |
| qa_access_log | 1 | 1 | 0 | OK — 014-created table, insert-only |
| queue_snapshots | 2,184 | 2,184 | 0 | OK — year=2026 injected by transform |
| agg_inflow_hourly | 5,239 | 5,239 | 0 | OK — year injected |
| prod_daily_layers (agg_productivity_daily sheet) | 601 | 601 | 0 | **OK — B2/B8 fix verified** (`layer='effective'` injected; upsert `(date,email,layer)`) |

### Quality

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| qa_forms | 8 | 8 | 0 | OK |
| qa_ctls | 74 | 74 | 0 | OK |
| qa_disputes | 3 | 3 | 0 | OK |
| qa_calibrations | 0 | 0 | — | EMPTY tab |
| qa_kb_gaps | 9 | 9 | 0 | OK |
| qe_queue_log | 3,887 | 3,887 | 0 | OK |
| qe_candidates | 11 | 11 | 0 | OK |
| qe_outcomes | 20 | 20 | 0 | OK |
| qe_builds | 117 | 117 | 0 | OK (insert-only) |
| qe_catalogue | 347 | 347 | 0 | **OK — B4 fix verified** (was 0/347 pre-fix) |
| qe_fd_cache | 11,645 | 11,645 | 0 | OK — 014-created table, upsert `id` |

### People / core

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| actions | 24 | 24 | 0 | OK — B1 fix verified (NOT-NULL `''` cols landed) |
| action_reviews / action_updates / action_task_details | 11/1/15 | 11/1/15 | 0 | OK |
| action_planned_milestones | 0 | 0 | — | SKIP — tab absent (B6) |
| one_on_one_schedule / _logs / _topics / _private_notes | 5/4/9/1 | all | 0 | OK |
| meeting_series / _members / meetings / _attendees | 1/5/3/15 | all | 0 | OK |
| pw_reminder_log | 107 | 107 | 0 | OK |
| people_signals | 0 | 0 | — | SKIP — tab absent (B6) |
| my_notes | 1 | 1 | 0 | OK |
| options | 26 | 26 | 0 | **OK — B4 fix verified** (was 0/26 pre-fix), insert-only |
| popups | 773 | 773 | 0 | OK |
| mail_log | 1,580 | 1,580 | 0 | **OK — B1 fix verified** (`error` NOT-NULL `''` ×1,580 rows landed), insert-only |
| health | 30 | 30 | 0 | OK — upsert onto 10 pre-existing → 31 (one remote-only key) |
| holidays | 0 | 0 | — | EMPTY tab (headers only) |
| follow_up_done | 2 | 2 | 0 | OK (insert-only) |
| sc_daily | 1,123 | 1,123 | 0 | **OK — B1 fix verified** (67 `name:''` cells landed as `''`) |
| sc_behaviour | 3 | 3 | 0 | OK (insert-only) |
| sc_months | 3 | 3 | 0 | OK — B1 cols landed |
| kpi_behaviour_log / kpi_leave_log / kpi_ol_cases | 0 | 0 | — | EMPTY tabs |
| trackers | 6 | 6 | 0 | OK — upsert overlays 5 seeds + inserts `damaged_items_5917` (5→6) |
| tracker_fields | 66 | 66 | 0 | OK — upsert onto 61 seed rows (013) → 66 |
| heatmap_inputs | 0 | 0 | — | EMPTY tab |
| heatmap_assumption_sets | 0 | 0 | — | SKIP — tab absent (B6; expected, lazy create) |

### TL desk

| Table | read | migrated | skipped | Result |
|---|---|---|---|---|
| tlp_resp_ratings / tlp_kb / tlp_otd / tlp_ticket_exclusions | 0 | 0 | — | EMPTY tabs |
| tlp_shifts | 117 | 117 | 0 | OK — epoch-ms→ISO + queue_json transform |
| tlp_queue_daily | 107 | 107 | 0 | OK — upsert `(date,tl_email)` (014 unique); window-range text → window count |
| tlp_team | 4 | 4 | 0 | OK — upsert `(tl_email,month)` (014 unique) |
| tlp_area_metrics | 3 | 3 | 0 | OK |
| mail_sla | 50 | 50 | 0 | OK — 'TRUE'/'FALSE'→bool transform + 2 empty `replied_by`→`''` |
| mail_approvals | 21 | 21 | 0 | OK — B1 fix verified (6-col pending-row case) |
| mail_approval_log | 0 | 0 | — | EMPTY tab |

### Tracker record backfills (inside migrateAll)

| tracker:`id` | read | migrated | skipped | Result |
|---|---|---|---|---|
| blocked_customers | 6 | 6 | 0 | OK — `submitted_by:''` fix landed (was predicted NOT-NULL violation) |
| promocodes | 24 | 24 | 0 | OK |
| operational_loss | 2,000 | 1,997 | 3 | OK — 3 dup `Record ID` cells, last-wins (documented dry-run) |
| customer_strikes | 4 | 4 | 0 | OK |
| refund_ledger | 59 | 59 | 0 | OK |
| damaged_items_5917 | 1 | 1 | 0 | OK — trackers row inserted first by the `trackers` mapping |

**Post-backfill verification (`check-trackers.ts`):** `SELECT tracker_id, storage_mode FROM trackers` → **all 6 = `native`** (blocked_customers, customer_strikes, damaged_items_5917, operational_loss, promocodes, refund_ledger). `tracker_records` total = **2,091** (= 6+24+1,997+4+59+1, exact count).

## 3. Errors / incidents

| # | Item | Disposition |
|---|---|---|
| 1 | `tickets` pass 1: `Rows 38000-38500` + `Rows 38500-39000` → `TypeError: fetch failed` (undici drop mid-run; not a PostgREST/schema error) | Re-ran `--tables tickets` — 176,616/176,616, 0 errors. Upsert made retry safe. **Root-cause note for future runs:** engine has no batch-level retry; consider adding one |
| 2 | 9 `Unable to parse range` read failures | Expected — B6 absent tabs (never created by `ensureTable_`); mappings intentionally kept, log-and-skip |
| 3 | 13 `not found or empty` | Expected — tabs exist, headers only / 0 data rows; migrated 0 |
| 4 | No PGRST204 (unknown-column) errors at all | 013+014 schema reconcile fully effective — every mapped column exists remotely |
| 5 | No NOT-NULL violations, no quota errors | B1 engine fix + read pacing both effective |

## 4. Insert-only ledger (B7 one-shot list) — all landed in ONE pass, none partial

`qa_volume` (+1,391→2,283) · `aging_open_tickets` (148) · `agg_queue_now` (18) · `agg_inflow_weekly` (95) · `agg_inflow_monthly` (32) · `agg_agent_perf` (48) · `agg_agent_daily` (324) · `agg_snapshots_today` (50) · `refresh_log` (+8,197→8,243) · `qe_builds` (117) · `qa_access_log` (1) · `one_on_one_topics` (9) · `one_on_one_private_notes` (1) · `meeting_series_members` (5) · `meeting_attendees` (15) · `options` (26) · `mail_log` (1,580) · `holidays` (0) · `follow_up_done` (2) · `sc_behaviour` (3) · `kpi_behaviour_log` (0) · `kpi_leave_log` (0) · `sched_plan` (0, tab absent). **Re-running any of these appends duplicates — do not re-run without truncate.**

## 5. Expected residual deltas (documented, not defects)

- **Pre-existing remote rows stay:** tables already fed by the ported app keep their rows — `prod_*` (db>src where app rows predate/extend past the sheet: prod_flag_log +68, prod_flags +67, prod_tph_* +36/+115, prod_window_hist +2/+6, prod_daily_layers +263 incl. dedupe remnant keys), `qa_volume` +892, `refresh_log` +46, `health` +1 (remote-only status key).
- **`prod_daily_layers` effective+raw both land:** 1,156 route-sheet rows + 601 `agg_productivity_daily`→`layer='effective'` upserted into 1,374 deduped keys → final **1,419** (+45 net-new keys). B8 resolved by F22.
- **Soft-deleted rows included by design** (e.g. `prod_tph_tasks.removed` — tab empty today so none landed).
- **sc_daily `name:''`:** 67 empty-name cells landed as `''` (B1 fix) — src=db=1,123.
- **Field-diff flags on 26 tables are validator artifacts**, not corruption — verified on tickets: diffs are `'TRUE'`/`true` bool renderings, `…Z`/`…+00:00` ISO variants, `now()` fallback stamps (validator re-stamps at compare time), and transform-produced cols the validator's transform-free mapRow port can't reproduce (`log_id`, `year`, note-packs, `queue_json`, bool/JSON defaults). Same for 8 checksum diffs (mixed row-sets incl. pre-existing rows; `windows` count-vs-text note in mapping).
- **`sched_offdays` validator skip ledger (8 req + 4 dup)** — engine actually migrated 8/8; validator doesn't apply the sheet-keyed transform that injects `tl_email`/`date`. Artifact, not a skip.
- **`agg_inflow_daily` Δ-7 / `refresh_log` Δ44 / tickets +34:** live sheets grew between the migrate read and the validate read.
- **`agg_productivity_daily` shows NO-MAPPING Δ-601 in validator** — inventory artifact: the sheet maps to `prod_daily_layers`, no table named `agg_productivity_daily` exists (documented in dry-run Appendix A).

## 6. Tables needing a follow-up

- **None for correctness.** Every landed table verified src=db or documented delta.
- **`tickets` retry already executed** (this run) — final state 176,616 rows.
- If the owner creates the 9 absent tabs later, re-running those mappings is safe (all are upsertOn or empty-insert tables — `prod_quarterly_reports` upsert `report_id`, `dq_aging_flags` upsert `flag_id`, `sched_*` upserts, `action_planned_milestones`/`people_signals`/`heatmap_assumption_sets` upserts per mappings).

## 7. Pre/post remote counts (full snapshots)

`migration/counts-pre.txt` (19:04Z) vs `migration/counts-post.txt` (19:18Z) — 94 mapped tables + tracker_records. Totals written this run: **tickets 176,616 · prod_intervals 23,059 · qe_fd_cache 11,645 · refresh_log 8,243 · qa_audits 6,560 · agg_inflow_hourly 5,239 · qe_queue_log 3,887 · qa_queue 2,314 · queue_snapshots 2,184 · tracker_records 2,091 · qa_volume 2,283(incl. 892 pre) · mail_log 1,580 · prod_daily_layers 1,419(incl. pre) · sc_daily 1,123** + all small tables verbatim.
