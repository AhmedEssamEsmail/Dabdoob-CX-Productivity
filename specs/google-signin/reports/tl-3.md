# TL report 3: google-signin (FIX, source reports/ux-1.md)

## Outcome
Blocking finding ux-1 (MED) fixed via leaf F02 (dev, preflight structural +
semantic PASS). LOW findings ux-2..ux-4 deferred per FIX rules.

## Changed files (reviewer DELTA scope)
- M `src/app/auth/login/page.tsx` — new `googleBusy` state (:32);
  `handleGoogle` uses `setGoogleBusy` (:63, reset on catch :77 only — stays
  busy through `window.location.href` redirect); submit Button
  `disabled={loading || googleBusy}` (:166) with label unchanged
  (`loading ? 'Signing in…' : 'Sign in'`); Google Button
  `disabled={loading || googleBusy}` (:191), label
  `{googleBusy ? 'Redirecting…' : 'Continue with Google'}` (:193).
Churn ~15 handwritten lines vs budget 20. No out-of-scope edits.
Note: worker wrote `results/F02.md` to project-root `results/`; TL relocated
it to `specs/google-signin/results/F02.md` (same content).

## Integration gates (round 3, all PASS)
- `npx tsc --noEmit` -> exit 0 (fix3-tsc.log)
- `npx eslint src/app/auth/login/page.tsx` -> exit 0 (fix3-eslint.log)
- `npx vitest run` -> exit 0, 1145/1145 (58 files; fix3-vitest.log)
e2e selectors unaffected: idle label "Continue with Google" preserved;
`getByRole('button', { name: 'Continue with Google' })` (e2e/auth.spec.ts:68,94)
still matches. No client-component unit test exists (vitest env `node`, no RTL).
Full gate re-run (build/e2e/security) left for the reviewer's DELTA pass.

## Findings disposition
| Finding | Disposition |
|---|---|
| ux-1 MED (busy feedback on wrong control) | FIXED (F02) |
| ux-2 LOW (quiet CTA lacks Google "G" mark) | deferred — dev if PM re-opens |
| ux-3 LOW (unfiltered `?error=` banner, param persists) | deferred — dev |
| ux-4 LOW, pre-existing (dead "Forgot password?" span) | deferred — dev |

## Status
Leaves: 9 done / 0 blocked / 0 needs-split. Blocking findings: 0 open.
NEEDS_APPROVAL still standing: remote migration apply + dashboard setup.
