# qa report - google-signin - round 3 (DELTA)

Verdict: PASS        (ux-1 MED verified fixed; only LOWs open)
Open: 0 B / 0 H / 0 M / 5 L

Checks run (from project root; logs deleted after capture):
- `npx tsc --noEmit` -> exit 0, clean.
- `npx eslint src/app/auth/login/page.tsx` -> exit 0.
- `npx vitest run` -> exit 0, **1145/1145** (58 files).
- Not re-run: `next build`, `npm run test:e2e`, `npm run test:security` — green in round 1; delta is
  ~15 client-state lines in the login page. Idle label "Continue with Google" preserved, so
  `getByRole('button', { name: 'Continue with Google' })` (e2e/auth.spec.ts:68,94) still matches;
  Google leg remains e2e-untestable per PLAN note.

Delta verification (TL-3 changed file: `src/app/auth/login/page.tsx` only — accurate):
- **ux-1 (MED) FIXED** — separate `googleBusy` state (:32). `handleGoogle` sets it (:63), resets
  only in `catch` (:77); Google button now shows `googleBusy ? 'Redirecting…' : 'Continue with
  Google'` (:193) and is disabled `loading || googleBusy` (:191); email submit keeps its own label,
  disabled during either flow (:166). Busy feedback now lands on the correct control; concurrent
  submits blocked. No client-component unit test possible (vitest env `node`, no RTL) — consistent
  with prior rounds.
- No scope creep, debug leftovers, or TODOs in the hunk. `results/F02.md` present at
  `specs/google-signin/results/F02.md` as TL stated.

Findings disposition (round-2 IDs carried; ux IDs kept for cross-ref):
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| ux-1 | MED | src/app/auth/login/page.tsx:32,63,166,191 | CLOSED — separate busy state, correct control, e2e selector intact. | — | dev |
| qa-2 | LOW | supabase/migrations/20261109123839_before_user_created_domain_gate.sql:15-16 | OPEN (deferred) — comment still says "No email … allow" while code 403s empty email. | Fix comment to match deny-by-default. | supabase-expert |
| qa-3 | LOW | src/app/api/auth/google/route.ts:9 | OPEN (deferred) — `redirectTo` still derived from `req.url` Host header. | Pin origin via env site URL. | dev |
| qa-4 | LOW | tests/auth/callback-route.test.ts | OPEN (deferred) — `error:null` + missing `user.email` (`!email`, route.ts:28) still untested. | Add `{data:{user:{}},error:null}` case -> signOut + `?error=auth`. | test-engineer |
| qa-5 | LOW | specs/perf-remediation/TRACKER.md (staged) | OPEN — TRACKER.md still staged (`git status` = `M `), `styles/quality.css`, `tests/ui/qa-strip-overflow.pw.ts`, `specs/ctl-strip-overflow/`, `specs/migration-remaining/` still in tree. | Unstage/exclude foreign files before commit; needs user/PM action. | dev |
| qa-6 | LOW | src/app/auth/login/page.tsx:63-77 | NEW — `googleBusy` is never reset on the success path (intentional) and no `pageshow`/visibility reset exists; if the page is bfcache-restored after Back from Google, both CTAs stay disabled on "Redirecting…" until manual reload. | Add `useEffect` on `pageshow` (`e.persisted` -> `setGoogleBusy(false)`) or accept. | dev |

Not verified / assumptions:
- qa-6 severity kept LOW: bfcache eligibility depends on response cache headers, unverified in
  this env; full reload on Back would make it moot.
- Real Google OAuth round-trip untestable here; verdict rests on unit coverage + reused
  `currentUser` verdict logic.
- Migration NOT applied; dashboard setup pending — NEEDS_APPROVAL stands (TL-3).
