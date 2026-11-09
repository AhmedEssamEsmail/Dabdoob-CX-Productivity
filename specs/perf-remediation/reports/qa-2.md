# qa report - perf-remediation - round 2 (DELTA)

Verdict: **PASS** — all 4 qa-1 findings fixed and verified; no new findings.
Open: 0 BLOCKER / 0 HIGH / 0 MED / 0 LOW

Scope this round: qa-1 open findings + tl-2 changed files (src/app/layout.tsx,
src/app/api/cron/job-data-tick/route.ts, src/features/shared/lib/{auth.ts,
auth.test.ts}, src/features/shared/shell/context.ts, tests/golden/hub-fakes.ts,
vercel.json, docs/ARCHITECTURE.md, supabase/migrations/
20261108231643_job_data_tick_pg_cron.sql).

Checks run (exit codes; logs in `specs/perf-remediation/logs/qa2-*.log`):
- `npx tsc --noEmit` -> 0 (qa2-tsc.log, empty)
- `npx eslint .` -> 0 errors / 366 warnings — identical to qa-1 baseline (qa2-eslint.log:440)
- `npx vitest run` -> 0, 54 files / 1120 tests (qa2-vitest.log; -4 vs 1124 = the deleted getUser/requireAuth stub describes)
- `npm run test:security` -> 0, 4/4 (qa2-security.log)
- `next build` -> exit 0, "Generating static pages (154/154)" — no error lines (qa2-build.log:16); qa-1 BLOCKER cleared
- `npm run test:e2e` -> not run (needs dev server + seeded Supabase auth; same limitation as qa-1 — PM gate)

## Prior findings — all verified fixed

| ID | Status | Evidence |
|----|--------|----------|
| qa-1 (BLOCKER, layout async -> prerender fail) | FIXED | `export const instant = false` added at src/app/layout.tsx:15-17. `instant.md:85-89` documents root-layout `false` disables static-shell validation app-wide; Next 16.4.3 >= 16.3.0 stabilization. Build now exits 0 with 154/154 pages (was exit 1 on /audit-queue). Matches my recommended fix — every route is behind auth. |
| qa-2 (MED, job-data-tick daily not */15) | FIXED | vercel.json daily `0 5 * * *` entry removed (11 unique paths remain, matches ARCHITECTURE.md). New migration `20261108231643_job_data_tick_pg_cron.sql` schedules `cxh-job-data-tick` `*/15 * * * *` via pg_cron + `net.http_get` (correct arg order: url, params, headers, 60000ms) with Bearer from `current_setting('app.settings.cron_secret')` — no secrets in file, unprovisioned config raises loudly, unschedule guard makes re-apply idempotent. Route GET already accepts `Bearer CRON_SECRET` (route.ts:11-19). Docstring + ARCHITECTURE.md + PLAN criterion 9 amended (user-approved per PLAN). Apply-before-deploy ordering documented in migration header + TRACKER NEEDS_APPROVAL. |
| qa-3 (LOW, getUser/requireAuth stubs) | FIXED | Stubs deleted from lib/auth.ts; their describes removed from auth.test.ts; matching entries removed from hub-fakes `authModule()`. Zero `getUser`/`requireAuth` references left in src; test hits are client-level `auth.getUser` mocks (hub-fakes.ts:249, security.spec.ts:27) — intentionally kept. Vitest -4 tests is exactly the deleted describes. |
| qa-4 (LOW, pollTick client-clock `now`) | FIXED | context.ts:117-123 now returns `data.now ?? new Date().toISOString()`; `/api/popups` route returns `now` (route.ts:10). Type widened to `now?: string` — backward compatible. |

## Regression / scope check on changed files
- Diff contains exactly the tl-2 file list + PLAN/TRACKER spec bookkeeping. No edits outside scope; no forbidden files (package.json, lockfile, .env*) touched; no new deps.
- auth.ts: deletions only; `createAuthClient`, `getViewAsUser`, `requireRole` re-export untouched.
- route.ts docstring change avoids the literal `*/15` that broke attempt 1 (block-comment `*/`) — "every 15 min via Supabase pg_cron+pg_net". tsc confirms.
- vercel.json parses as valid JSON.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| — | — | — | none | — | — |

Not verified / assumptions:
- `npm run test:e2e` not run (dev server + seeded auth unavailable locally); PM/release gate.
- Migration `20261108231643` is FILE-ONLY; NEEDS_APPROVAL sequence per TRACKER: provision `app.settings.app_url`/`cron_secret` -> apply migration -> deploy vercel.json. Reversing leaves job-data-tick unscheduled. pg_cron job behaviour unverifiable until applied (empty-string settings would produce an invalid URL and fail loudly in `cron.job_run_details` — acceptable).
- pg_net `net.http_get` timeout is the HTTP wait; the route runs `jobDataTick()` to completion — Vercel function cap still applies on the app side.
- `.qa-tmp/` empty stray dir still present at repo root (carried from qa-1; outside diff — housekeeping only).
