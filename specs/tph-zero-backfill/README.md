# TPH Zero-State Fix + Jul-2026 Backfill

Status: **Planned, not started.** Source plan: `C:\Users\AHMED\.devin\plans\plan-5de9543b0a10e4a5.md`.

Problem statement (observed 2026-10-31): the TPH page shows all-zero for every day, "Compute touches and cases now" fails with `Could not find the table 'public.fd_activities' in the schema cache`, and "No automatic build found in the run log" (no cron rows in `refresh_log`).

Owner's three requirements:

1. The entire system must produce **proper, clear, specific error messages** for any issue.
2. Fix the zero-everything issue.
3. Recompute everything back to **2026-07-01**.

## Root causes found

1. **Missing mirror tables** — `src/lib/tph/run.ts` (`tphActivityTail_`, `tphBuildCallMinutes_`, `tphBuildCases_`) and `src/app/api/tph/touches/route.ts` query `fd_activities`, `maqsam_calls`, `freshchat` (`ts_ms` + `cols jsonb`). No migration creates them; nothing populates them. `fd_activities` throws PGRST205 → 400; the other two reads are `{ data }`-destructured with `error` ignored → silent empty → "done 0s" fake-success writes.
2. **Cron chain never ran** — `refresh_log` is empty. `dqStep_` logs even failed steps, so crons never reached step bodies: almost certainly `CRON_SECRET` unset on Vercel (route 401s before `buildJobEnv`).
3. **Empty grid** — "Agents on the grid: 0" = no `prod_tph_days` rows. Grid slots cannot be recomputed; they come only from legacy-store migration or fresh TL logging. Without slots, caps/TPH stay legitimately empty.
4. **60-day guard** — `tphPastDay_` in `src/lib/tph/run.ts` rejects dates older than 60 days → blocks any July rebuild (the canonical `tphPastDay_` in `index.ts` has no age limit).
5. **Silent-zero patterns** — unchecked `error` on Supabase reads, `readStore`/`prefetchTables` returning `[]` on missing tables, `tphLoadStore_` ignoring all query errors, per-route error mappers surfacing raw PostgREST text.
6. **Shared-store uncertainty** — `agg_queue_now`, `agg_inflow_hourly`, `agg_snapshots_today`, `aging_open_tickets`, `fcr_daily`, `qa_audits`, `sc_daily` are placeholder/other-app tables (003 comments). Which exist in this project is unverified.

## Owner decisions (confirmed)

- **Read fix:** create the three mirror tables + a sync job (not rewiring reads to Google Sheets).
- **Legacy data:** presence unknown → audit first (00); recompute whatever raw sources allow; migrate only what recompute cannot recover (`prod_tph_days` grid, `prod_tph_cases` 'tl' rows, `prod_intervals`, `prod_flags`).
- **Backfill scope:** everything — TPH (touches/cases/calls), `prod_daily_layers` (raw+effective), flag detection where `prod_intervals` exist.

## Task shards

| File | WP | Task | Depends on |
|---|---|---|---|
| `00-source-health-audit.md` | WP0 | `GET /api/admin/source-health` — one endpoint answering "why is everything zero" | none |
| `01-mirror-tables.md` | WP1 | Migration 004 + `src/lib/jobs/mirrors.ts` sync + admin trigger (+ cron wiring) | 00 |
| `02-error-layer.md` | WP2 | `describeDbError`, error envelope, fail-loud reads, `storeErrors` banner | none (code-wise; land early) |
| `03-backfill.md` | WP3 | `POST /api/admin/backfill` — chunked resumable range runner for TPH/layers/flags | 01, 02 |
| `04-legacy-migration.md` | WP4 | Conditional: run existing `/api/admin/migrate` for legacy `prod_*` tabs | 00 (audit decides) |
| `05-cron-health.md` | WP5 | Verify `CRON_SECRET` + confirm `refresh_log` rows from real cron runs | 01, 02 |
| `06-tests-verification.md` | WP6 | vitest coverage + manual verification checklist | all |

## Execution order

`00` → `01` → `02` (early — everything after must fail loudly) → `04` (if audit finds legacy data) → `03` (backfill Jul→Oct) → `05` → `06`.

## Honest limits

- **Grid stays empty without `prod_tph_days`** — if the legacy store is empty and TLs never logged, caps/TPH remain 0 by design; reported per-day, not faked.
- **Call cases before ~Sep 28** — `agg_inflow_hourly` keeps `inflow_lookback_days`=35; older dates report 'No inbound calls stored'.
- **`prod_intervals`/`prod_flags` for old dates** — only from migration or the daily email; un-computable dates are reported, not faked.
- New mirror tables follow the existing access model (no RLS); tightening is out of scope.

## Evidence conventions

- `[V]` verified in this repo (path and line given).
- `[H]` hypothesis — inferred, flagged for verification during implementation.
