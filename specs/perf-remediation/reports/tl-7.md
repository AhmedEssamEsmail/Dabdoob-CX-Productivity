# tl report - perf-remediation - round 7 (FIX for reports/qa-3.md)

Source findings: `reports/qa-3.md` — verdict FAIL, 1 MED + 3 LOW; every row
treated as blocking per task. 4 mini-leaves created (`spec/FIX/FIX-20..23`),
preflight PASS (check_shards.py + LIMITS.md), all dispatched in parallel —
files fully disjoint. All 4 done, first attempt each, no RESHARD_NEEDED.

## Leaves + changed files (reviewer DELTA scope)

| Leaf | Finding | Owner | Files changed | Evidence |
|---|---|---|---|---|
| FIX-20 | qa-1 MED | dev | `src/features/cx-queue/lib/jobs.ts`, `tests/jobs/queue-tickets-read.test.ts` | `status.in.("raw","lower","UPPER")` replaced by one `status.ilike."*v*"` or-term per configured open status — covers every case form AND padded values (`'Open '`), matching `dqBuildAging_`'s `st.trim().toLowerCase()`; substring over-match is a safe superset (in-memory filter unchanged, only extra rows fetched). Meta chars `"`/`*`/`%` stripped, values deduped, empty-guard kept; both `gte` terms unchanged. Test asserts ilike shape + `not.toContain('status.in')` (fails on old code). results/FIX-20.md |
| FIX-21 | qa-2 LOW | dev | `src/features/shared/platform/repo.ts`, `tests/platform/repo.test.ts` | `Object.keys(patch).sort().join('')` -> `JSON.stringify(Object.keys(patch).sort())` (repo.ts:242). New regression: `{a,bc}` vs `{ab,c}` patches -> 2 separate upserts; fails on old signature. results/FIX-21.md |
| FIX-22 | qa-3 LOW | dev | deleted `nul`, `specs/perf-remediation/nul`, `tsc-FIX17.log`, `tsc-fix18.log`, `.qa-tmp/` | All 5 strays gone; `git status --porcelain` clean of them. TL also removed `vitest-fix23.log` (stray left at root by the FIX-23 worker — same finding class). results/FIX-22.md |
| FIX-23 | qa-4 LOW | test-engineer | `tests/jobs/routes.test.ts` | `delete process.env.CRON_SECRET` -> `vi.stubEnv('CRON_SECRET', '')` in both fail-closed tests (~:89,:97); restored by `vi.unstubAllEnvs()`; falsy `''` preserves the `!secret` 401 path. results/FIX-23.md |

## Integration gates (round 7; logs in `specs/perf-remediation/logs/fix7-*.log`)
- `npx tsc --noEmit` -> 0 errors (fix7-tsc.log)
- `npx vitest run` -> 55 files, 1129/1129 pass (fix7-vitest.log)
- `npx eslint .` -> 0 errors / 366 warnings — same pre-existing baseline (fix7-eslint.log)
- `npm run test:security` -> 4/4 (fix7-security.log)
- `npx next build` -> exit 0, "Generating static pages (154/154)" (fix7-build.log)
- `npm run test:e2e` -> not run (needs dev server + seeded auth; PM gate)

## Status / blockers
- Completed: FIX-20, FIX-21, FIX-22, FIX-23 — all qa-3 rows addressed.
- Blocked / needs-split: none.
- NEEDS_APPROVAL items unchanged (unapplied migrations + DB settings; see
  TRACKER "Blocked / needs user"). `npm run test:e2e` remains a PM/release gate.
- TRACKER.md updated (rows, round-7 gate log, findings table -> done).
