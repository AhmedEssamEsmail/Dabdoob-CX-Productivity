# TL report 1 — ctls-page-cleanup (BUILD)

## Leaves
| ID | Owner | Status | Files changed |
|---|---|---|---|
| S01-01 | supabase-expert | done | `supabase/migrations/20261120121758_close_historical_ctls.sql` (new) |
| S01-02 | dev | done | `lib/core.ts` (+`qaCtlScopeVisible_`), `lib/server.ts` (scope/actSet/canClose/scope echo), `api/qa/[action]/route.ts`, `tests/quality/qa-ctl-scope.test.ts` (new) |
| S01-03 | dev | done | `components/ctls-page.tsx`, `components/qa-shared.tsx` |

All dispatched as `Kind: mini` after structural PASS + semantic LIMITS check.
Results: `results/S01-01.md`, `S01-02.md`, `S01-03.md`. Scoped diffs verified
against each leaf's Files list; churn well under budget.

## Integration gates (TL-run)
- `npx tsc --noEmit` — PASS (logs/tsc.log)
- `npx vitest run tests/quality/qa-ctl-scope.test.ts` — PASS 4/4 (logs/vitest.log)
- `npm run lint` — FAIL on 1 PRE-EXISTING error: `tests/golden/queue-aggregates.test.ts:123`
  `no-explicit-any` (file untouched by this diff; baseline). 7 baseline warnings.
  All changed files lint-clean (worker ran eslint on them). logs/lint.log

## Notes for PM
- Migration is data-only UPDATE, idempotent; auto-applies on merge to main — no
  remote action taken (per AGENTS.md / worker's NEEDS_APPROVAL is moot).
- Live row counts not verified (local stack down; shard permitted).
- PM-run gates remaining per index: `npm run test:security` (db flag), QA +
  Security + UX/UI reviews.
- No reviewer/debugger shards were requested or spawned.
- Baseline dirty tree preserved: `scripts/ops/qa-ctls-*.ts` untouched.
