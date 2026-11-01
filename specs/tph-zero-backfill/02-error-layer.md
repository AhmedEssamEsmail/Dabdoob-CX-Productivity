# 02 — Error-clarity layer

Owner requirement: "the entire system must have proper, clear, specific error messages for any issue." Land early — every package after this must fail loudly.

## New module — `src/lib/errors.ts` (or extend `src/lib/api-error.ts`)

`describeDbError(e) → { code, message, detail?, hint? }`:

| Condition | code | message / hint shape |
|---|---|---|
| PGRST205 / `Could not find the table 'public.X'` / PG 42P01 | `missing_store` | "Store 'X' is not set up (missing table) — run migration `<file>` or the mirror sync" |
| Sheet open/fetch failure | `source_unreachable` | names workbook id + tab + owning config key |
| Missing/blank config key | `missing_config` | names the key + where to set it (Admin config) |
| Google creds absent | `missing_credentials` | names `GOOGLE_SERVICE_ACCOUNT_EMAIL` / `GOOGLE_PRIVATE_KEY` |
| Google 429 / quota | `rate_limited` | says rate-limited + retry guidance |
| Sheets 404/403 | `source_forbidden` | "workbook not shared with the service account" |
| Postgres unique/constraint/fk | `write_conflict` | names the table + constraint |
| anything else | `internal` | raw message preserved verbatim in `detail` |

## Response envelope

Routes return `{ error, code?, detail?, hint? }` — `error` stays a string so the existing `fetchJson` client keeps working; UI surfaces `hint` when present.

Convert handlers to `apiError()`: `api/tph/run-step`, `api/tph/run-day`, `api/tph/touches`, `api/tph/day`, `api/prod/*`, plus the consistency sweep below.

## Fail-loud reads (the silent-zero fixes)

- **`src/lib/tph/run.ts`** — check `error` on every `.from()` (currently `{ data }` destructured, error dropped). Throw `describeDbError` wrapped with step+date context, e.g. `Touches 2026-10-31 — fd_activities read failed: …`. A step whose source returns 0 rows must report `sourceRows: 0` + a `warning` field — never write silently-empty `prod_tph_calls`/`cases_json` and report "done 0s" as success.
- **`src/app/api/tph/touches/route.ts`** — same treatment.
- **`src/lib/tph/page.ts`** — `tphLoadStore_` collects per-query errors into `storeErrors: string[]` on the page payload.
- **`src/lib/platform/stores.ts`** — `readStore` already returns `exists:false` for missing tables; audit every consumer to ensure `exists:false` is surfaced (today several callers treat it as `[]` and continue).
- **`src/lib/jobs/sheets.ts`** — `fetchWorkbookTabs` / `openSpreadsheet` errors name the workbook id + tab + config key.
- **`src/lib/jobs/env.ts`** — prefetch/write errors already name tables in places; normalize to `describeDbError`.

## UI surfacing

- **`src/app/tph-grid/page.tsx`** — render `storeErrors` as a warning banner (distinct from "all zero"), with a link to `/api/admin/source-health` for admins. Per-step rebuild toasts already aggregate `errs[]` — messages become specific once run.ts throws described errors.
- **`src/app/api/tph/run-day/route.ts`** — keep per-step capture; each step error carries step/date/source/hint.

## Consistency sweep — same convention elsewhere

`api/fcr/daily`, `api/quality/audits`, queue `agg_*` reads: use the `exists`/unavailable-marker convention `getQueueHealthPage` already uses (`snapshots:'unavailable'`) — never return invented zeros when a store is missing.

## Acceptance

- Reproducing the original failure (`run-step` with `fd_activities` absent) returns `{ code:'missing_store', error:'…', hint:'Run migration 004…' }` — not raw PGRST205.
- `run-step` on an empty-but-present source returns `sourceRows: 0` + warning, not "done 0s".
- `tph-grid` shows the `storeErrors` banner when `prod_tph_days` is missing/empty vs silently rendering all zeros.
- No route returns bare PostgREST messages; all go through the envelope.
- Unit tests for `describeDbError` mappings (in `src/lib/errors.test.ts`, counted in 06).
