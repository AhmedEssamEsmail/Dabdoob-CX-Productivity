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
