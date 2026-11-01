# 06 — Tests & verification

## Unit tests (vitest)

| File | Coverage |
|---|---|
| `src/lib/errors.test.ts` | every `describeDbError` mapping row in 02: PGRST205, 42P01, missing config, missing creds, 429, 403/404 sheet, constraint errors, fallback |
| `src/lib/mirrors.test.ts` | sheet row → `{ts_ms, cols, dedupe_key}` transforms for all 3 tables; tz parsing (activity_local_tz vs data_tz); dedupe-key stability across identical rows; slice lengths (10/7/7) |
| `src/lib/backfill.test.ts` (or fold into an existing suite) | cursor advance; stop-at-budget; `force` vs skip-done; per-kind skipped reasons (missing `productivity_files` month, no intervals); ordering mirrors→tph→layers→flags |
| run-step error propagation | mock Supabase client returning PGRST205 → route returns `{code:'missing_store', hint}` envelope |

Keep the repo rule: tests import real code — no inline-literal assertions (the README already flags the existing fake-test debt; don't add to it).

## Manual verification script (in order)

1. `GET /api/admin/source-health` → save output; it is the pre-fix baseline.
2. Apply migration 004 → `POST /api/admin/mirrors {full:true, since:'2026-06-24'}` → confirm 3 tables populated, rerun → idempotent.
3. `POST /api/admin/backfill` for one recent day → KPI cards populate on the TPH page.
4. `POST /api/admin/backfill` full range `2026-07-01 → yesterday` across cursor chunks → `done`/`failed`/`skipped` look sane.
5. Spot-check a `prod_daily_layers` day against the sheet; spot-check a TPH caps row against `prod_tph_cases`/`prod_tph_touches`.
6. `refresh_log` shows `backfill` + cron job rows; `health` updates.
7. Rerun step 1 — confirm all checks green or carry explicit hints.

## Static gates

- `npm run lint` — baseline is 19 pre-existing errors outside ported files; do not regress.
- `npx tsc --noEmit` — clean.
- Existing vitest suite green (352 tests per the tracker).

## Definition of done

- "Compute touches and cases now" succeeds on a day with sheet activity → nonzero `prod_tph_touches`.
- A missing-source failure returns `{code, error, hint}` — never raw PostgREST, never silent `[]`.
- The TPH page distinguishes "no grid" / "no cases" / "store missing" from real zeros.
- Backfill lands Jul→Oct for whatever sources allow, with a written per-kind coverage report (done/skipped/failed counts).
