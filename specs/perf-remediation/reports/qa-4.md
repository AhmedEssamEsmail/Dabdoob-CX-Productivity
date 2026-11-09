# qa report - perf-remediation - round 4 (DELTA)

Verdict: **PASS** — all 4 qa-3 findings verified fixed; no new findings; gates green.

Open: 0 BLOCKER / 0 HIGH / 0 MED / 0 LOW

Scope this round: tl-7 (FIX-20..23) changed files only — `src/features/cx-queue/lib/jobs.ts`,
`src/features/shared/platform/repo.ts`, `tests/jobs/queue-tickets-read.test.ts` (new),
`tests/jobs/routes.test.ts`, `tests/platform/repo.test.ts`, stray-file deletions.

Checks run (exit codes; logs in `specs/perf-remediation/logs/qa4-*.log`):
- `npx tsc --noEmit` -> 0 (qa4-tsc.log, empty)
- `npx vitest run` -> 0, 55 files / 1129 tests (qa4-vitest.log)
- `npx eslint .` -> 0 errors / 366 warnings — same baseline as qa-1..3 (qa4-eslint.log)
- `npm run test:security` -> 0, 4/4 (qa4-security.log)
- `npx next build` -> 0, "Generating static pages (154/154)" (qa4-build.log:8-16)
- `npm run test:e2e` -> not run (needs dev server + seeded auth; PM/release gate, unchanged)

## Prior findings — all verified fixed

| Finding | Status | Evidence |
|---|---|---|
| qa-1 MED queue-aging status filter misses case variants | FIXED | `dqTicketsReadOr_` (jobs.ts:88-110) emits one `status.ilike."*v*"` or-term per configured open status — ilike covers every case form, `*` wildcards cover padding (`'Open '`), substring over-match is a safe superset since `dqBuildAging_`'s `trim().toLowerCase()` filter still applies. Meta chars `"`/`*`/`%` stripped (no wildcard injection / quoted-term break), values deduped, empty-guard kept, both `gte` terms unchanged. `now` defaulted at :115 before use at :124; `dqWallToUtc_` exists (adapters.ts:159). Test asserts ilike shape + `not.toContain('status.in')` — fails on old code (queue-tickets-read.test.ts:85-101). |
| qa-2 LOW updateRows key-signature concat collision | FIXED | repo.ts:242 `JSON.stringify(Object.keys(patch).sort())` — `['a','bc']` vs `['ab','c']` now distinct. Regression test asserts the two patches produce 2 separate upserts (repo.test.ts); fails on old `join('')`. |
| qa-3 LOW stray files from FIX runs | FIXED | `nul` (root + spec dir), `tsc-FIX17.log`, `tsc-fix18.log`, `.qa-tmp/`, plus `vitest-fix23.log` all absent; `git status --porcelain` shows none of them. |
| qa-4 LOW CRON_SECRET not restored in routes.test | FIXED | routes.test.ts:88,:96 use `vi.stubEnv('CRON_SECRET','')` + `vi.unstubAllEnvs()` in both fail-closed tests; falsy `''` preserves the `!secret` -> 401 path; no env bleed to later tests. |

## Regression / scope check (tl-7 files)
- repo.ts grouped upsert: per-signature groups each get one `upsert` inside try/catch;
  `/constraint|conflict|42P10/` still falls back to `updateRowsOneByOne`, other errors
  rethrow — semantics unchanged; `mergedByKey`/`out` and per-key patch-merge
  (`patchByKey.set(u.key, {...prev, [keyField], ...data})`) intact.
- jobs.ts `.or()` bound: still `created_at.gte` + `resolved_at.gte` at bizTz
  yesterday-00:00 UTC — the qa-3-verified superset of the `isToday` counters' window.
- Residual (not a finding): LIKE `_` meta char and `,` inside quoted or-values could
  over-fetch / (worst case) mis-parse on pathological status names; in-memory filter
  bounds correctness — over-match only, never under-match. Prior `status.in` form had
  the same exposure.
- No out-of-scope edits in tl-7 set; no forbidden files (package.json, lockfile,
  `.env*`, `cx-kpis-*.json`); no new deps; test asserts real builder calls (would
  fail without the change).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| — none — | | | | | |

Not verified / assumptions:
- `npm run test:e2e` not run (PM/release gate).
- Migrations remain FILE-ONLY / NEEDS_APPROVAL (dedupe uniques, indexes, roster
  unique, pg_cron tick + health job) — correctness unverifiable until applied.
- Perf budgets (bootstrap ≤150ms, prod_intervals scans ~0) are post-deploy
  measurements; code-side bounds verified by query-builder tests.
