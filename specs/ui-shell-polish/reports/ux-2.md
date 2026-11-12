# ux report — ui-shell-polish — round 2 (DELTA)

Verdict: PASS
Open: 0B / 0H / 0M / 1L

DELTA scope (per `reports/tl-5.md`): `src/app/auth/login/page.tsx`,
`src/features/cx-hub/components/admin-page.tsx` (Rb), `src/app/theme.css`
(kill blocks), `src/features/shared/components/shell/AppShell.tsx` (.who-name).
Verified against `web-interface-guidelines` + WCAG 2.2 AA checklist items in
scope; code-verified (no new live run — fixes are logic/CSS-readable and the
task e2e `ui-shell-polish.spec.ts` passed 30/30 per tl-5 int-4).

## Prior findings — verified fixed

| ID | Sev | Status | Evidence |
|---|---|---|---|
| ux-1 | MED | FIXED | `login/page.tsx:67` `AbortSignal.timeout(20000)` on the fetch — absolute signal also covers `response.json()`. `catch` at :93-101 maps `AbortError`/`TimeoutError` → `'Sign-in timed out — try again.'`, calls `dismissOverlay()`, `setLoading(false)`. Overlay can no longer pin forever: fetch hang → 20s abort; nav hang → existing 15s `navWatch`. |
| ux-2 | MED | FIXED | `admin-page.tsx:319-360`: `checked={pending ?? on}`, `disabled={busy \|\| !row}` — pill flips instantly on click, stays disabled for the request, `finally` clears `pending` (revert on error; on success `onSaved` rows replace it, batched — no flicker). Toggle remains label-wrapped checkbox, name "Reminders", keyboard-native. |
| ux-3 | LOW | FIXED | `theme.css:511` and `:528` — `animation-delay: 0s !important` now in both `html[data-reduce-motion] *` and `@media (prefers-reduced-motion)` kill blocks; `.page>*` backwards-fill can't hold `opacity:0`. |
| ux-4 | LOW | FIXED | `AppShell.tsx:632` — `title={user.name}` on `.who-name`; truncated rail name recoverable via native tooltip. |

## New findings

| ID | Sev | file:line | Evidence | Fix | Owner |
|---|---|---|---|---|---|
| ux-5 | LOW | `src/app/auth/login/page.tsx:166-189` + `refresh.css:462-466` | While `.login-overlay` is up (submit → nav, up to 20s on timeout), both Inputs stay enabled/focusable behind the 72%-opaque scrim (buttons are `disabled`, inputs are not) — Tab can land on a field behind the overlay and typing is near-invisible. | `disabled={loading}` on both `<Input>`s, or set `inert` on `.login-card` while `loading`. | dev |

Not verified / assumptions: hung-fetch path assessed from code (20s
`AbortSignal.timeout` + same dismiss/`setLoading` path already proven live in
round 1); no re-screenshot this round — markup/CSS of fixes is identical in
shape to the round-1-verified UI. tl-5 gates: tsc 0, eslint 0, vitest
1295/1299 (4 foreign pre-existing), e2e 30/30.
