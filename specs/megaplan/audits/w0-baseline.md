# WP-03 — Wave-0 baseline report

Run 2026-11-06 by orchestrator against HEAD (`b63eb9d` + WP-00..02 fixes).

## Gates

| Gate | Result | Evidence |
|---|---|---|
| `npx tsc --noEmit` | **0 errors** | verified post-`84ba588` (heatmap + ops-fakes fixes already in HEAD; WP-01) |
| `npx vitest run` | **817 tests / 41 files / 0 failures** | post-WP-00 auth-mock hardening (`tests/golden/hub-fakes.ts`) |
| `npx eslint .` | **0 errors**, 294 warnings | warnings intentionally out of scope (WP-02) |
| `npx next build` | **success** — 154 static pages, full route table incl. all 36 registry pages + `ecosystem` + catch-all, 90+ API routes, Turbopack compile 10.3s | build log |

## Dev-server smoke (localhost:3000, `.env.local`)

All 200: `/`, `/overview`, `/queue`, `/audit-queue`, `/one-on-ones`, `/admin`, `/my-day`, `/ecosystem`, `/trackers`, `/mail-desk`, `/scheduler`.
All 401 (auth-gated, correct without session): `/api/health`, `/api/bootstrap`, `/api/queue/health`.

## Playwright e2e (`npx playwright test`, 5 projects × 17 specs = 85)

**12 passed / 73 failed.** Failure class is uniform: `beforeEach` login with fixture creds (`tl@example.com`/`password`, `admin@example.com`/`password`) never leaves `/auth/login` — the specs were written against a dev/stub login that no longer exists (post-`84ba588` `FALLBACK_BOOT` is dev-only and real Supabase auth is enforced). Secondary assertions (nav visible, h1 "My Status", `[data-status]` badges) all fail downstream of the same root cause.

**This is a fixture/auth-infra gap, not app regression** — pages render fine unauthenticated-shell (200s above). Follow-up: WP-F1 (e2e auth path: test Supabase users or a login seam for Playwright).

## Notes

- `vercel.json` schedules only productivity crons — known, tracked WP-24/WP-50.
- Dev server left running during test; terminated after baseline.
- Owner commits `84ba588`→`b051bb8` landed during review — several earlier findings already resolved in HEAD (see tracker log).
