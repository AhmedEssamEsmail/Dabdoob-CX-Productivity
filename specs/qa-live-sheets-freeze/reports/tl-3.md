# tl report 3 — qa-live-sheets-freeze — FIX round for reports/qa-1.md

Input: `reports/qa-1.md` (FAIL: 0B/0H/1M/3L). Routed per Owner; LOWs fixed per
PM instruction. Fix spec: `spec/fix-qa-1.md` (3 mini-leaves, preflight PASS).

## Findings -> leaves -> results
| Finding | Sev | Leaf (owner) | Status | Changed files |
|---|---|---|---|---|
| qa-1 dbbook `.catch(() => [])` swallows all errors | MED | qa1-01 (dev) | done | `src/features/shared/jobs/dbbook.ts` (`missingOk_` helper — `[]` only on `describeDbError().code === 'missing_store'`, else `throw described(e,{table})`; all 7 sites rewired), `tests/jobs/dbbook.test.ts` (`h.errors` hook + 2 cases) |
| qa-2 stray repo-root `nul` | LOW | qa1-02 (dev) | done | deleted `nul` |
| qa-3 stray `scripts/ops/probe-sync-health.ts` | LOW | qa1-02 (dev) | done | deleted (adopt rejected — recon evidence already in results/S09-01-remote-cron.md) |
| qa-4 stale env.ts EXPECTED entry | LOW | qa1-03 (test-engineer) | done | `tests/freeze/sheets-freeze-scan.test.ts` (entry dropped; env.ts re-verified clean) |

Results: `results/qa1-01.md`, `results/qa1-02.md`, `results/qa1-03.md`.

## Integration gates (round 4, project root)
- `npx tsc --noEmit` -> PASS 0 errors (logs/gate4-tsc.log)
- `npx eslint .` -> PASS 0 errors; same 5 pre-existing warnings in unrelated files (logs/gate4-eslint.log)
- `npx vitest run` -> 1444/1445; sole FAIL `tests/quality/qe-fd-cache.test.ts` — known-external (cx-quality engine-live, user-owned, no leaf file in import graph) (logs/gate4-vitest.log)

## Notes
- No leaf asked for a reviewer/debugger/architect — nothing ignored.
- Scope clean: only the 4 files above + 2 deletions; no cx-quality/qa route/manifest/.env edits.
- PM handoffs unchanged (TRACKER "Blocked / needs user"): remote `supabase db push` (4 migrations), `app.settings.app_url`/`cron_secret` provisioning, prod seed run.
- DELTA scope for re-review: the 5 changed/deleted paths above.
