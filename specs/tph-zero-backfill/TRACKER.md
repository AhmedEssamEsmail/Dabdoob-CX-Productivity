# TPH Zero-Backfill — Implementation Tracker

Rule (carried from `../legacy-parity/IMPLEMENTATION-TRACKER.md`): each shard commits separately after its gates pass.

| Shard | Task | Status | Notes |
|---|---|---|---|
| 00 | Source-health audit endpoint | done `d300c19` | `GET /api/admin/source-health` — tables/config/env/sheets/legacy/cron checks; legacy probe decides whether 04 runs |
| 01 | Mirror tables + sync | done `891ceef` | migration 004 + `src/lib/jobs/mirrors.ts` (watermark + sha1 dedupe) + `POST /api/admin/mirrors` + `mirror_sync` step first in the daily chain |
| 02 | Error layer | done `2633879` | `describeDbError`/`described`, `{error,code,detail,hint}` envelope via `apiError`/`dbErr`, fail-loud mirror reads, `storeErrors` on the TPH page |
| 03 | Backfill runner | done `78b1919` | `POST /api/admin/backfill` → `runBackfill`: mirrors once → per date tph(4 steps)→layers→flags, 240s budget + `{date}` cursor, force/skip-done, honest month/interval skips |
| 04 | Legacy migration | done `691909a` | all `prod_*` stores already mapped (`layer='effective'` lives in `prod_daily_layers`); added per-table `read` counts; fail-closed `MIGRATION_SECRET_KEY` |
| 05 | Cron health | done `0721be7` | `mirror_sync` watched; `health`-table staleness via `hbRowState_`; vercel.json already folds intra-day cadence into per-hour daily entries (Hobby limit) |
| 06 | Tests & verification | done | 384 vitest green; tsc/lint/build gates green; manual verification requires deployed env (see below) |

## Log

- 2026-10-31: shards written from plan `C:\Users\AHMED\.devin\plans\plan-5de9543b0a10e4a5.md`. Root causes recorded in README. Owner decisions: mirror tables (not Sheets rewiring); legacy audit-first; backfill scope = everything incl. flags.
- Implementation order executed: 02 → 00 → 01 → 04 → 03 → 05 → 06 (02 first because every later shard uses the described-error layer).
- Tests added: `tests/lib/errors.test.ts` (18), `tests/jobs/mirrors.test.ts` (7), `tests/jobs/backfill.test.ts` (5), `tests/jobs/run-step-errors.test.ts` (2). Suite total 384.
- Gates: `tsc --noEmit` clean; `npm run lint` 0 errors (50 pre-existing warnings); `npm run build` compiled — `/api/admin/backfill`, `/api/admin/mirrors`, `/api/admin/source-health` in the route table.

## Manual verification — pending deployed environment

The steps in `06-tests-verification.md` need the deployed app + live Google service-account creds (not runnable from this workspace): source-health baseline → migration 004 → mirrors full sync → backfill range → spot-checks → cron `refresh_log`/`health` rows. Order to follow on the deploy: 00 audit first (it reports whether the legacy `prod_*` workbook holds Jul–Oct history → whether `/api/admin/migrate` runs before `/api/admin/backfill`).

## Post-implementation diagnosis log (2026-11-01)

Production backfill executed remotely against `dabdoob-cx-productivity.vercel.app`:

- `Intl.DateTimeFormat` per-row construction caused every 300s timeout (`9719adb` — memoized per tz, ~200-400x faster; unblocked flags/layers/TPH).
- TPH touches computed `{}` on all 115 dates: backfill prefetch never called `env.ensureHeadcount()`, and the live `roster` table has no `source='hct'` rows → `env.headcount=[]` → `prodNameToEmail_({})` dropped every row. Post-August Activities performers are mostly `Unknown Agent - raw id <fdId>` — resolvable only via the Headcount tab's `Freshdesk User` column. Fixed `5a5022a`.
- Activities tab is 193,372 rows but `values.get` fetched `A1:ZZ100000` — everything after ~Sep-10 silently missing. Fixed `74b17e4` (100k-row paging, max 10 pages).
- Format findings: early rows ISO-UTC `2026-07-02T16:45:40Z` (9 cols, no Date); later rows `MM-DD-YYYY HH:mm:ss` local + col J `MM-DD-YYYY`. Parsers were already correct for both.
- Result: `prod_tph_touches` non-empty on 122/123 dates (Jul-02..Oct-31; Jul-01 precedes the log). Cases rebuilt on all dates with described reasons (upstream `tickets`/`agg_*` stores are empty). Calls non-empty where Maqsam tabs carry the date. Grid: 12 dates interval-derived. Flags: 35 dates / 1000 rows. Layers: 39 dates / 1000 rows.
- Still pending user action: paste `scripts/ops/004-paste.sql` in the Supabase SQL editor (mirror tables + `refresh_log` column superset — live table is a legacy shape so `logRun` writes soft-fail; `log_id`/`type` NOT NULL columns are written by the updated writers).
- Config gaps (honest skips, not bugs): `productivity_files` only has `2026-09` → layers skip other months; `tickets`/`agg_queue_now`/`agg_snapshots_today` are empty upstream stores → cases_tickets described-zero.

## Vendor-API mirrors (2026-11-01)

Replaced the Sheets source for `maqsam_calls` + `freshchat` with direct vendor APIs; `fd_activities` keeps the email→sheet→mirror path per owner decision.

- `005-rls-paste.sql` run by owner — anon-key writes were denied on the RLS-default new tables; permissive `app_all` policies added (also folded into migration 004).
- `src/lib/vendor/{http,maqsam,freshchat}.ts` + `src/lib/jobs/vendor-apis.ts` mappers emit the same 7-cell `cols` shapes readers consume, with ISO timestamps (sheet cols were mixed `DD-MM`/`MM-DD` in one row — could misattribute days ≤12).
- Fixes found by live testing: env-var paths doubled the API path (`e514dd7`); Maqsam index returns `{result:'success',message:[calls]}` with `timestamp`/`agents[{email}]`/`handlingTime` fields (`200b13e`); monolithic fetch died at maxDuration → resumable 7-day **windowed** sync, watermark persisted per window, 240s budget + `partial` resume (`ba2291b`); 5-page parallel fetch (`552ee99`); per-window `dedupe_key` collisions collapsed pre-upsert (`955ac47`).
- Result: `maqsam_calls` = **111,430 rows** (Jun-01 → Nov-01, API-direct); `fd_activities` = **193,555 rows** (sheet). `syncAllMirrors` keeps incrementals cheap for the daily cron.
- **Blocked — user action**: `freshchat` = 0 rows. `FRESHCHAT_API_KEY` returns `javax.security.sasl.AuthenticationException: Auth failure` under BOTH `Bearer` and `Token token=` schemes — the key itself is rejected (wrong/expired/not a Freshchat key). Regenerate in Freshchat Admin → API Settings, update the Vercel env, then `POST /api/admin/mirrors {table:'freshchat'}`.
