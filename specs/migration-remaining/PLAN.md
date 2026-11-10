# PLAN: migration-remaining
Type: data   Status: spec
Date: 2026-11-09   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal

Complete shard-80's "migrate everything" (decision D-DATA) for the sheet stores
that were readable but had no mapping at the WP-51 run (2026-11-06, ~254k rows
into 71 tables — `specs/megaplan/audits/migration-run.md`): add mappings /
ported-import runs for the ~10 remaining shared stores, and make every
insert-only target table idempotent (dedupe + natural-key unique) so no
mapping can ever append duplicates again. **Sources stay strictly read-only** —
the service account has `spreadsheets.readonly` scope and Viewer-only shares;
nothing in this plan writes to a source sheet.

## Success criteria

1. Every store in `specs/megaplan/audits/sheet-access.md` that is readable by
   `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` ends in exactly one
   state, with evidence in `specs/migration-remaining/source-inventory.md`:
   **migrated** (rows landed in a named table), **covered** (already fed by an
   app mirror/job — shown by row-count parity), or **rejected** (documented
   reason, e.g. stale duplicate of an already-migrated table).
2. `dq_hct` exists and is populated from the Egypt Operations HCT sheet
   (`1LtUZbF4fdlLIaQMCMgrY7xZbs2C4zAfLAqlEWbKvNEw`), so `dqReadHct_` /
   `runRosterSync` stop returning the "roster master is not connected" refusal
   (`src/features/cx-hub/lib/roster.ts:239`).
3. `freshchat` mirror holds the Daily-Report 'Freshchat' tab history (table is
   0 rows today); `fd_activities` verified complete vs the 'Activities' tab or
   gap-backfilled (195,553 rows today).
4. V1 sources landed: V1 ops workbook (`1hul-T8Tc2h1nmk_9wM9bj8HmWM-_2ZeVIu_kOYpicyA`)
   → lead tasks; each configured `productivity_files[month]` workbook (today:
   2026-09 → `1I29yjZ2XaX5yJnnHgKLxthBsKfSgBrK7aCRfafniuVI`) → `scRefreshMonth_`
   tables; QA_HIST_SOURCES voice+text response sheets → QA audit history via the
   ported import path or raw mirror (decision recorded per store).
5. Every previously insert-only mapped table (23, ledger in
   `audits/migration-run.md` §4) has a chosen dedupe key, existing duplicates
   removed, a UNIQUE index applied, and its mapping flipped to `upsertOn` —
   verified by re-running `migrate-all --dry` then a real targeted re-run on one
   table producing **0 new rows**.
6. `npx tsx migration/validate.ts --md` covers the new mappings; its ledger and
   `specs/megaplan/migration-report.md` are updated to post-run state; a new
   `specs/megaplan/audits/migration-run-2.md` (or appended section) records
   per-store read/write/skip counts.
7. Read-only proof: `git grep -nE "values\.(update|append)|batchUpdate" -- migration/ src/features/shared/migration/` returns only comments; SA scope in
   every auth path stays `spreadsheets.readonly`.

## Scope / Non-goals

In: remaining readable sheet stores (HCT, V1 ops DB, Oct-2026 productivity
workbook, voice/text QA form responses, Daily Report tabs, FD status-activity,
Freshchat Detailed Msgs, FD touch archive, qa_engine_source FD dump, stale
qa_queue sheet); dedupe + unique-key hardening of insert-only targets;
validator/report updates. New table allowed: `dq_hct` (+ staging/mirror tables
only where a ported import has no natural target).

Out: Gmail/Calendar/Drive-file content (SA can't reach — WP-52/shard-90);
Freshchat/Maqsam/Freshdesk **API** pulls (WP-53); re-migrating tables already
landed by WP-51 except the dedupe pass; pg_cron scheduling (WP-50); any write
to a source spreadsheet; legacy `_deprecated` dirs; `package.json`/`.env*`/
`cx-kpis-*.json`.

## Risk flags (y/n)

arch n · db y · data y · auth n · external-api y · ui n · perf n · deps n ·
tests n · docs y · deploy n

Review gates: QA (always) · Security: run (external-api: sheet creds path +
dedupe DDL on live DB) · Data: run (flag `data`) · Performance: skip · UX/UI: skip
Skipped-gate reason: perf/ui — no user-facing surface or latency budget touched.

## Gate commands (run from project root)

typecheck: `npx tsc --noEmit` · lint: `npx eslint .` · unit: `npx vitest run`
migration probe: `npx tsx scripts/check-sheet-access.mts` (re-runnable read-only
probe) · validation: `npx tsx migration/validate.ts --md`
dry-run: `npx tsx migration/migrate-all.ts --dry`
run (approval-gated): `npx tsx migration/migrate-all.ts --tables <list>`

## Conventions (<=10 lines: workflow.md + relevant lessons)

- Forbidden for agents: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- DB: Supabase MCP targets the LIVE remote project — agents write migration
  files only; applying them + the migration run itself need owner approval.
- `migration/` is gitignored scratch; committed pipeline lives in
  `src/features/shared/migration/` (engine + mappings) — extend, don't fork.
- Sources are ingest-only (`DQ_READ_ONLY_IDS`): never write back; dedupe on
  natural keys; log skipped rows + reasons (WP-51 pattern).
- SA auth: keyfile `cx-kpis-513312-62811753ea9c.json` via
  `GOOGLE_APPLICATION_CREDENTIALS` or `GOOGLE_*` split vars in `.env.local`.
- Sheets quota: reads go through `readSheetRaw` pacing + 429 retry (uncommitted
  engine patch from WP-51 — commit it or fold into the first shard).
- No secrets in specs/commits; sheet IDs are fine (they're already in specs).

## Research notes

- WP-51 ran 2026-11-06: 94 mappings, 254,409 writes + 2,091 tracker_records, 0
  hard failures (`specs/megaplan/audits/migration-run.md`).
- 22/22 configured stores readable; only `ss_data_2026_id` exists (system
  started ~2026-04, no prior-year stores) (`audits/sheet-access.md`).
- The readable-but-unmigrated set (per sheet-access inventory):
  HCT `1LtUZb…` · v1_ops `1hul-T8…` · Oct-2026 workbook `1I29yj…` ·
  voice QA `1bna3_…` · text QA `1BNzinv…` · daily_report `1Ll5Bx…` ·
  fd_activity `1Fc6VC…` · fc_messages `1ZxDxS…` · touch archive `1qch1v…` ·
  qa_engine_source `1VtBT8…` · qa_queue(stale?) `1ArWBr…`.
- `dq_hct` deliberately has no DDL (005_hub.sql:13) — roster.ts reads it via the
  generic store seam; expected cols: name,email,position,department,section,
  hct_role, hct_tl_email (roster.ts:47,218-242).
- Mirror jobs already define the live shapes: `fd_activities`←'Activities' tab,
  `freshchat`←'Freshchat' tab of daily_report_ss_id, `maqsam_calls`←month
  workbooks/API (`src/features/shared/jobs/mirrors.ts:36-90`).
- `scRefreshMonth_` is the ported V1-workbook path — reads SC_MATRIX/SC_FCR/
  behaviour tabs per configured month (`scorecard-server.ts:449-476`).
- `cx-quality/lib/migrate.ts` holds QA_HIST_SOURCES + the verbatim import
  engine (chunked reads, dedupe by response id) — prefer running the ported
  import over a raw mirror where it exists.
- Insert-only re-run hazard list (23 tables): qa_volume, aging_open_tickets,
  agg_queue_now, agg_inflow_{weekly,monthly}, agg_agent_{perf,daily},
  agg_snapshots_today, refresh_log, qe_builds, qa_access_log,
  one_on_one_{topics,private_notes}, meeting_series_members, meeting_attendees,
  options, mail_log, holidays, follow_up_done, sc_behaviour,
  kpi_{behaviour,leave}_log, sched_plan (migration-report.md B7).
- Append-only tables with no natural key (e.g. refresh_log, mail_log) may need
  a deterministic content-hash key column — dedupe decision per table.

## Key pointers

- `specs/megaplan/audits/sheet-access.md` — the 22-store share inventory + IDs.
- `specs/megaplan/audits/migration-run.md` §4-5 — insert-only ledger, residual
  deltas, engine patches still uncommitted.
- `src/features/shared/migration/engine.ts` + `mappings/*.ts` — extend here.
- `src/features/shared/jobs/mirrors.ts`, `jobs/sheets.ts` — existing read seams
  (`fetchWorkbookTabs`, `sheetCreds`) reused by the migration scripts.
- `src/features/cx-hub/lib/roster.ts:234-242` — dq_hct contract.
- `src/features/cx-people/lib/scorecard-server.ts:449` — scRefreshMonth_.
- `src/features/cx-quality/lib/migrate.ts:148` — QA_HIST_SOURCES + import fns.
- `scripts/check-sheet-access.mts` — probe to extend for the new inventory doc.
- `migration/validate.ts` — extend with new mappings (WP-33 architecture).
- `supabase/migrations/` — new file(s) for dq_hct + dedupe uniques (015+).

## Proposed shard shape (for spec-architect)

1. Probe & per-store inventory → `source-inventory.md` + go/reject per store.
2. Dedupe DDL `015_migration_uniques.sql` (draft) + mapping `upsertOn` flips.
3. `dq_hct` table + HCT mapping + run.
4. Mirror backfills: freshchat (daily_report), fd_activities gap check,
   fc_messages raw mirror, FD archive/engine-source decisions.
5. V1 imports: V1 ops lead tasks + scRefreshMonth_ months + QA hist import.
6. Validator extension + report/audit write-up + read-only proof gate.
Remote apply + live run: **APPROVAL REQUIRED** before execution.
