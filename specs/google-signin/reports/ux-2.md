# ux report - google-signin - round 2 (DELTA)

Verdict: PASS        (ux-1 FIXED; 3 LOW deferred remain open)
Open: 0 B / 0 H / 0 M / 3 L

Scope: `src/app/auth/login/page.tsx` only (tl-3 changed-files list; ~15-line churn).
No other UI files touched this round. Layout judged from code — no Playwright needed.

## Fix verification — ux-1 (MED) → FIXED
- Separate `googleBusy` state added (:32); `handleGoogle` sets it (:63) and resets it in
  `catch` only (:77) — stays busy through `window.location.href` navigation, correct.
- Clicking Google: submit Button now `disabled={loading || googleBusy}` (:166) and keeps
  label "Sign in" (:167); Google button shows `{googleBusy ? 'Redirecting…' : 'Continue
  with Google'}` (:193). Busy feedback lands on the clicked control — finding resolved.
- Clicking Sign in: Google button disabled+dimmed, label stays "Continue with Google" —
  no false busy state on the wrong control; double-submit still blocked on both paths.
- "Redirecting…" ends with `…` per busy-label convention; accessible name still plain
  text (4.1.2 ok); e2e selector `getByRole('button', {name:'Continue with Google'})`
  still matches idle state. No new a11y regressions introduced.

States checked: loading (both paths), error, disabled (cross-path), keyboard, focus.
Not verified: empty, 320px render, 200% text (unchanged since round 1).

## Still open (deferred LOW, unchanged from round 1)
| ID | Sev | file:line | Evidence | Exact fix | Owner |
|----|-----|-----------|----------|-----------|-------|
| ux-2 | LOW | src/app/auth/login/page.tsx:186-194 | Quiet CTA still lacks Google "G" mark (Google brand guidelines); `gap:.5rem` reserved, no icon rendered. | Add Google "G" SVG (aria-hidden) inside the button. | dev |
| ux-3 | LOW | src/app/auth/login/page.tsx:10-18 | Any `?error=<x>` shows "Google sign-in failed"; param persists after display (re-announces on refresh). | Whitelist `denied`/`auth`; optionally `router.replace` to strip param once consumed. | dev |
| ux-4 | LOW (pre-existing) | src/app/auth/login/page.tsx:147-152 | "Forgot password?" span styled as link (`--cx-accent-text`, weight 600) but dead — not focusable, no handler. | Wire to real reset flow or restyle as non-interactive muted text. | dev |

Not verified / assumptions:
- `googleBusy` has no reset if `window.location.href` assignment fails to navigate —
  standard pattern; `data.url` is Supabase-provided so always valid when present. Edge
  case only, not a finding.
- 320px reflow, 200% text, focus-obscured (2.4.11) still unverified — no render run;
  none expected to fail (fixed-width card, no new media queries/sticky chrome).
- TL gates PASS: tsc, eslint (file), vitest 1145/1145.
