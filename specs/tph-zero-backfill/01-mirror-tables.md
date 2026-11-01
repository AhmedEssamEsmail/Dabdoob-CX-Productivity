# 01 — Mirror tables + sync job

Create the three Supabase mirror tables the TPH compute path already reads, plus a job that keeps them populated from the source Google Sheets. **Owner-confirmed approach** (vs rewiring reads to Sheets directly).

## Why

`src/lib/tph/run.ts` and `src/app/api/tph/touches/route.ts` already read `fd_activities` / `maqsam_calls` / `freshchat` with `ts_ms` + `cols` columns. The design intent is a Supabase mirror of the sheet tabs; only the tables and the syncer were never built.

## Migration — `supabase/migrations/004_mirror_tables.sql`

```sql
-- one table per mirror, same shape:
id          bigserial primary key,
ts_ms       double precision not null,
date        text not null,               -- YYYY-MM-DD in business tz
cols        jsonb not null,              -- exact row slice readers consume
dedupe_key  text not null unique,
synced_at   timestamptz default now()
-- indexes: (ts_ms), (date)
```

## Row shapes — must match readers exactly

| Table | `cols` content | `ts_ms` parses via | `dedupe_key` |
|---|---|---|---|
| `fd_activities` | Activities tab cols **A..J** (10 cols) | col A in `activity_local_tz` (MM-dd-yyyy) | `prodActivityKey_(row, tz)` — already exists in `src/lib/prod/adapters.ts` |
| `maqsam_calls` | Maqsam Calls tab cols **D..J** (7 cols; r[6]=duration-days) | col D in `data_tz` (Africa/Cairo) | `ts|email|direction|state|dur` composite |
| `freshchat` | Freshchat tab cols **A..G** (7 cols) | col A in `data_tz` | conversation id (`r[6]||r[2]`), else row hash |

Store `ts_ms` precomputed so `.gte('ts_ms')` range queries are cheap; readers still parse `cols` themselves — keep slices exact so `tphTouchesFromRows_`, `tphActIndex_`, `tphCallMinutesFromRows_`, `tphChatCases_` work unchanged.

## Sync — `src/lib/jobs/mirrors.ts`

`syncMirror_(env, name, opts: { full?: boolean, since?: string, through?: string })`:

- `fd_activities`: `fetchWorkbookTabs(fd_activity_ss_id, ['Activities'])`, take the tail since watermark; map → `{ts_ms, date, cols, dedupe_key}`; upsert on `dedupe_key`.
- `maqsam_calls`: for each configured month in `productivity_files` (+fallback), `Maqsam Calls` D..J tail; composite dedupe.
- `freshchat`: `daily_report_ss_id` `Freshchat` tail. Rows mutate → resync a rolling 7-day window each run; upsert by conversation id.
- Watermarks in `config.mirror_state` JSON: `{ fd_activities: {last_ts_ms,last_run}, ... }`. Incremental = `watermark − 1d`; `full:true` = `opts.since` (backfill passes `2026-06-24` = July minus the 7-day touch-history window).
- Per-table result `{ synced, skipped, lastTs, errors[] }` → `refresh_log` via `dqStep_`.

## Trigger + cron

- `POST /api/admin/mirrors` — admin manual trigger `{ table?, full?, since?, through? }`. Chunked by month to fit `maxDuration = 300`; returns per-table results + a `cursor` for continuation like 03's backfill.
- Cron wiring decision at implementation time (Hobby plan = daily crons only): either fold `syncMirror_` as the first step of `job-tph-hourly` + `job-productivity-daily`, or add a `job-mirrors` route + `vercel.json` entry. Folding into existing jobs needs no new cron slot — prefer that if cadence is acceptable.

## Acceptance

- Migration applies cleanly; tables queryable.
- `POST /api/admin/mirrors {full:true, since:'2026-06-24'}` populates all three tables; rerun is idempotent (dedupe_key upsert, no dupes).
- `fd_activities` rows satisfy `tphActivityTail_`'s query shape (`.select('cols').gte('ts_ms', from)`).
- A day with known sheet activity produces nonzero `prod_tph_touches` after `run-step`.
- Errors: sheet unreachable → named workbook + tab + config key in the thrown error (uses 02's `describeDbError` once available; until then, format inline).
