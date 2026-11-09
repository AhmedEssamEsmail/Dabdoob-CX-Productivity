# TL report 2: google-signin (FIX, source reports/qa-1.md)

## Outcome
Blocking finding qa-1 (MED) fixed via leaf F01 (dev, preflight PASS).
LOW findings qa-2..qa-5 deferred per FIX rules.

## Changed files (reviewer DELTA scope)
- M `src/app/auth/callback/route.ts` — `roleForEmail` call wrapped in
  try/catch (lines 33-39): on throw `signOut()` once + redirect
  `/auth/login?error=auth`; `denied` branch unchanged.
- M `tests/auth/callback-route.test.ts` — new case: `roleForEmail`
  rejects -> signOut once + `?error=auth` (no 500).
Churn ~23 handwritten lines vs budget 40. No out-of-scope edits.

## Integration gates (round 2, all PASS; exit codes recorded, logs deleted)
- `npx tsc --noEmit` -> exit 0, clean.
- `npx eslint <2 changed files>` -> exit 0.
- `npx vitest run` -> exit 0, 1145/1145 (58 files; +1 new regression test).
Full gate re-run (build/e2e/security) left for the reviewer's DELTA pass.

## Findings disposition
| Finding | Disposition |
|---|---|
| qa-1 MED | FIXED (F01) |
| qa-2 LOW (migration comment) | deferred — supabase-expert if PM re-opens |
| qa-3 LOW (Host-header redirectTo) | deferred — dev |
| qa-4 LOW (untested `!email` branch) | deferred — test-engineer |
| qa-5 LOW (foreign staged files) | deferred — needs `git reset`/unstage, forbidden for TL; user/PM action |

## Status
Leaves: 8 done / 0 blocked / 0 needs-split. Blocking findings: 0 open.
NEEDS_APPROVAL still standing: remote migration apply + dashboard setup.
