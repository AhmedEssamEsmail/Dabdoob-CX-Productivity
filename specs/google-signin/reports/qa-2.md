# qa report - google-signin - round 2 (DELTA)

Verdict: PASS        (blocking MED fixed; only LOWs remain open)
Open: 0 B / 0 H / 0 M / 4 L

Checks run (all from project root, logs deleted after capture):
- `npx tsc --noEmit` -> exit 0, clean.
- `npx eslint src/app/auth/callback/route.ts tests/auth/callback-route.test.ts` -> exit 0.
- `npx vitest run` -> exit 0, **1145/1145** (58 files; +1 vs round 1 = new regression test).
- Not re-run this round: `next build`, `npm run test:e2e`, `npm run test:security` — all green in round 1;
  the delta (try/catch + 1 unit test, ~23 lines) touches no e2e-exercisable surface (Google leg cannot
  be e2e'd per PLAN research note; password path untouched).

Delta verification:
- **qa-1 (MED) FIXED** — `src/app/auth/callback/route.ts:33-39`: `roleForEmail` wrapped in try/catch;
  on throw `signOut()` runs once then `?error=auth` redirect. Denied-flow guarantee now holds on DB
  failure. New test `tests/auth/callback-route.test.ts:85-96` asserts signOut-once + `?error=auth`
  and would fail without the fix (unhandled rejection). No regression: happy path, `denied` branch,
  and exchange-error branches unchanged; no debug leftovers or scope creep in the 2 changed files.
- `src/app/refresh.css` modification confirmed in-scope (`.login-divider`/`.login-google` styles for
  the new button) — omitted from TL file lists but feature-related, not foreign.

Findings disposition (round-1 IDs carried):
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | MED | src/app/auth/callback/route.ts:33 | CLOSED — fixed and regression-tested. | — | dev |
| qa-2 | LOW | supabase/migrations/20261109123839_before_user_created_domain_gate.sql:15-16 | OPEN (deferred) — comment still says "No email … allow" while code 403s empty email. | Fix comment to match deny-by-default. | supabase-expert |
| qa-3 | LOW | src/app/api/auth/google/route.ts:9 | OPEN (deferred) — `redirectTo` still derived from `req.url` Host header. | Pin origin via env site URL. | dev |
| qa-4 | LOW | tests/auth/callback-route.test.ts | OPEN (deferred) — `error:null` + missing `user.email` (`!email`, route.ts:28) still untested. | Add `{data:{user:{}},error:null}` case -> signOut + `?error=auth`. | test-engineer |
| qa-5 | LOW | specs/perf-remediation/TRACKER.md (staged) | OPEN — TRACKER.md still staged (`git diff --cached`), `styles/quality.css`, `tests/ui/qa-strip-overflow.pw.ts`, `specs/ctl-strip-overflow/`, `specs/migration-remaining/` still in tree. | Unstage/exclude foreign files before commit; needs user/PM action (TL cannot `git reset`). | dev |

Not verified / assumptions:
- Real Google OAuth round-trip untestable in this env (PLAN research note); verdict rests on unit
  coverage + reused `currentUser` verdict logic.
- Migration NOT applied and dashboard setup pending — NEEDS_APPROVAL stands (TL-2).
- `signOut()` inside a catch could itself throw -> 500; same exposure as the file's existing
  signOut paths — consistent, not flagged.
