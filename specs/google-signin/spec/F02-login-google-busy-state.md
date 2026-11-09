# F02: login page Google busy state on the right control (ux-1)
Kind: mini
ID: F02
Parent: google-signin
Owner: dev
Depends: none
Criteria: PLAN #1 (Google button UX) — ux-1 MED, visibility of system status
Skills: none
Budget: files=1; actions=3; changed_lines=20; minutes=5

## Goal
On `src/app/auth/login/page.tsx`, give the Google OAuth path its own busy
state so clicking "Continue with Google" reports progress on the Google
button ("Redirecting…") and never relabels the email submit. Both buttons
are disabled while either flow is in flight.

## Files
- Edit: `src/app/auth/login/page.tsx` | googleBusy state :31, handleGoogle :61-78, buttons :165/:185

## Context
- `src/app/auth/login/page.tsx:31` | shared `loading` state declaration
- `src/app/auth/login/page.tsx:61-78` | `handleGoogle` sets `setLoading(true)`;
  on success navigates via `window.location.href` (stays busy), on catch resets
- `src/app/auth/login/page.tsx:165-166` | submit label `loading ? 'Signing in…' : 'Sign in'`
- `src/app/auth/login/page.tsx:185-193` | Google button `disabled={loading}`, label "Continue with Google"
- `specs/google-signin/reports/ux-1.md` | finding ux-1 (MED, blocking)

## Contract
- New `const [googleBusy, setGoogleBusy] = useState(false)` next to `loading`.
- `handleGoogle`: `setGoogleBusy(true)` at start; `setGoogleBusy(false)` in the
  catch only (success navigates away, so the busy label persists during redirect).
  It no longer touches `loading`.
- Submit button: `disabled={loading || googleBusy}`; label expression unchanged.
- Google button: `disabled={loading || googleBusy}`; label
  `{googleBusy ? 'Redirecting…' : 'Continue with Google'}` (ellipsis char, per
  loading-label guideline).
- No unit test exists for this client component (vitest env is `node`, no RTL);
  verification is typecheck + lint + unchanged e2e selectors.
Out of scope: ux-2 (Google "G" icon, deferred LOW), ux-3 (error-param
whitelist), ux-4 (forgot-password span), `refresh.css`, any other file.

## Actions
1. Add the `googleBusy` state and switch `handleGoogle` to it (catch resets it;
   `setLoading` removed from `handleGoogle`).
2. Submit button: `disabled={loading || googleBusy}`; keep
   `{loading ? 'Signing in…' : 'Sign in'}`.
3. Google button: `disabled={loading || googleBusy}`; label
   `{googleBusy ? 'Redirecting…' : 'Continue with Google'}`.

## Done when
- During Google kickoff: Google button shows "Redirecting…" and both buttons
  are disabled; email submit label stays "Sign in"
- During email submit: submit shows "Signing in…"; Google button disabled,
  label unchanged
- `npx tsc --noEmit` exit 0; `npx eslint src/app/auth/login/page.tsx` exit 0
- Idle label "Continue with Google" preserved (e2e `getByRole` selector at
  e2e/auth.spec.ts:68,94 unaffected)

## Verify
- Run: `npx tsc --noEmit` -> exit 0
- Run: `npx eslint src/app/auth/login/page.tsx` -> exit 0

## Handoff
Reviewer DELTA scope = `page.tsx` busy-state diff only; e2e selectors unchanged.
Write results/F02.md (<=10 lines); TL alone updates TRACKER.md.
