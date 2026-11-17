# TL report 1 — qa-live-sheets-freeze (BUILD, wave 1)

## Leaf verdicts
| Leaf | Owner | Status | Evidence |
|---|---|---|---|
| S01-01 | dev | done | sheets-freeze.ts + test; vitest 5/5 |
| S01-02 | dev | done | sheets.ts/engine.ts/env.ts seams wired; tsc 0 |
| S01-03 | dev | done | 6 call-site files flagged; tsc 0 |
| S01-04 | test-engineer | done | tests/freeze scan gate; probe-fail sanity ok |
| S02-01 | dev | **needs-split** | preflight FAIL: 6 context pointers > 5 limit → RESHARD_NEEDED to PM (fix may be as small as merging two pointers; blocks S02-02, S03-01) |
| S02-02 | dev | blocked | waits S02-01 reshard |
| S03-01 | dev | blocked | waits S02 reshard |
| S07-01 | supabase-expert | done | 20261116202604_recreate_dq_hct.sql (15 cols+synced_at, uniq email, RLS/no-policies) |
| S07-02 | dev | done | roster.ts snapshot upsert ≤500 + admin-only gate; 21/21; cx-quality hand-back contract in results/S07-02.md |
| S08-01 | dev | done | job-qa-engine route DB-only (qaReconcileQueueLog_ dynamic import); tsc 0 |
| S09-01 | supabase-expert | done | 20261116202809_pg_cron_scoped_wave1.sql — all 5 candidates uncovered, scheduled; 0 literals; evidence results/S09-01-remote-cron.md |

## Integration gates (after all writers)
- `npx tsc --noEmit` → PASS (0)
- `npx eslint .` → PASS (0 errors; 5 warnings pre-existing, untouched files)
- `npx vitest run` → 1425/1426. FAIL `tests/quality/qe-fd-cache.test.ts` — user-owned cx-quality engine-live import graph; no leaf file involved → pre-existing/parallel-workstream failure, not ours.
- Logs: specs/qa-live-sheets-freeze/logs/{tsc,eslint,vitest}.log

## Spec gaps → PM (approved scope, no leaf)
1. **RESHARD_NEEDED**: `spec/S02.md#S02-01` — context 6 > 5 (LIMITS). Blocks S02-02, S03-01.
2. aux_spans recreate-empty migration: approved, un-spec'd.
3. prod_assumptions seed leaf (one-time exempt Assumptions read → setConfig + admin-page config control): approved, un-spec'd.

## NEEDS_USER / NEEDS_APPROVAL
- Remote `supabase db push` (pre-approved per task; PM executes): applies dq_hct recreate + pg_cron scoped + pending 20261116175742. Verify `Target:` + `env -u SUPABASE_ACCESS_TOKEN`.
- Remote `app.settings.app_url`/`cron_secret` BOTH UNSET — provision via ALTER DATABASE (values from Vercel env; never print) before/with pg_cron apply or jobs fail loudly.
- cx-quality hand-back: server.ts:383 throws SheetsFreezeError on dead path (user-owned repoint); dq_hct consumer contract in results/S07-02.md; qe-fd-cache test failure is theirs.
- Baseline: `bootstrap.ts` modified mid-run by parallel workstream — not leaf work, left intact.
