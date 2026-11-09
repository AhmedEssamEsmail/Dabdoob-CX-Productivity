# ux report - google-signin - round 1 (FULL)

Verdict: FAIL        (1 MED open)
Open: 0 B / 0 H / 1 M / 3 L

Scope: `src/app/auth/login/page.tsx` (Google button + `?error` banner),
`src/app/refresh.css` (`.login-divider`, `.login-google`), `src/app/auth/callback/route.ts`
(redirect/error-param contract), `src/app/api/auth/google/route.ts` (trigger).
Baseline: existing login card + shared `.cx-btn` / Field kit — the spec is the sibling look.

States checked: loading, error (denied + generic), disabled, long text, dark, keyboard, focus.
Not verified: empty, 320px render, 200% text (see bottom).

Verified (no finding):
- Labels: `Field` wires `htmlFor`→input id (Field.tsx:36-57); `type="email"`, `required`,
  `autoComplete="username"|"current-password"` — correct input types + autofill.
- Error display: `.login-error` uses `role="alert"` (announces on insertion), text + icon,
  not color-only (3.3.1). Denied copy is actionable ("Ask the CX admin to add you to the roster").
- Contrast (measured from tokens, card bg `--cx-surface`):
  error fg/bg #b3261e/#fbe9e7 = **5.6:1** light, #ff9a90/#3d1a18 = **7.6:1** dark;
  divider "or" `--cx-ink-3` ≈ **4.7:1** light / 5.2:1 dark;
  quiet-button label `--cx-ink-2` = **6.8:1** light / 6.6:1 dark. All ≥4.5:1.
- Focus: global `:focus-visible` ring (theme.css:446, cx-kit.css:115) covers both buttons/inputs.
- Targets: both CTAs 2.5rem (40px) ≥24px (2.5.8). Keyboard-operable native `<button>`;
  `type="button"` won't submit the form. Decorative SVGs all `aria-hidden` + `focusable="false"`.
- `Suspense` around `useSearchParams` (required for prerender) — correct, fallback null, no CLS.
- Disabled-during-submit prevents double-submit on both paths; forms keep input on error.
- Dark mode: all new styles use tokens only; no ad-hoc colors. Reduced-motion unaffected
  (no new animation).

| ID | Sev | file:line | Evidence | Exact fix | Owner |
|----|-----|-----------|----------|-----------|-------|
| ux-1 | MED | src/app/auth/login/page.tsx:31,61-78,165,190 | Shared `loading` flag: clicking "Continue with Google" sets `loading=true`, which relabels the **email** submit to "Signing in…" (line 166) while the clicked Google button only dims (`opacity:.55`) with no busy label. Feedback lands on the wrong control — user can't tell which action is in progress (visibility of system status). | Use a separate `googleBusy` state: disable both buttons, keep submit label "Sign in", change Google label to "Redirecting…" (guidelines: loading labels end with `…`). | dev |
| ux-2 | LOW | src/app/auth/login/page.tsx:185-193; refresh.css:557 | `variant="quiet"` is borderless/transparent — full-width ghost CTA under a filled primary; `gap:.5rem` reserved but no Google "G" mark rendered (Google brand guidelines require it). | Add the Google "G" SVG (aria-hidden) inside the button; consider default `.cx-btn` (bordered) if it reads too weak — quiet is the app's secondary idiom, so icon alone is acceptable. | dev |
| ux-3 | LOW | src/app/auth/login/page.tsx:11-17 | Any `?error=<x>` (not just `auth`) shows "Google sign-in failed" — e.g. a stale link `?error=foo`. Param also persists after display (refresh re-announces). | Whitelist `denied`/`auth` → else no banner; optionally `router.replace` to strip the param once consumed. | dev |
| ux-4 | LOW (pre-existing) | src/app/auth/login/page.tsx:144-152 | "Forgot password?" is a plain `<span>` styled `color:--cx-accent-text` + weight 600 — looks like a link, is dead: not focusable, no handler, no destination. | Either wire it to the real reset flow or restyle as non-interactive (muted) so it stops promising a link. Flagged because the file was touched; not part of this feature. | dev |

Not verified / assumptions:
- No Playwright run — layout judged from code (fixed 26.5rem card, column flex, no new
  media queries). Unverified: 320px reflow (`.login-foot` flex row + long lock-up copy could
  crowd ~256px wide card), 200% text, focus-not-obscured (2.4.11), 1.4.4 — none expected to
  fail; flag only if a render shows otherwise.
- Google OAuth round-trip untestable in env (PLAN note); error-banner states verified by
  code path `?error=denied|auth` from `callback/route.ts:14,24,30,38,42`.
- `signInWithOAuth` error string is surfaced verbatim via `data.error` (google/route.ts:16) —
  provider copy may be English technical text; acceptable, matches existing login path.
