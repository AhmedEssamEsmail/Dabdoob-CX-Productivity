# fix-ux-1 — ui-shell-polish ux-1 findings (4 leaves)

Source report: `specs/ui-shell-polish/reports/ux-1.md` (findings ux-1…ux-4; the
task declares all 4 blocking this round even though the report tags ux-3/ux-4
LOW). Regression spec: `e2e/ui-shell-polish.spec.ts` — each leaf runs only its
`-g` test where relevant. Dev server assumed at http://localhost:3000; e2e creds
in PLAN.md. Supabase auth is rate-limited under test volume — a `Request rate
limit reached` alert during a `-g` run is an environment flake, not a leaf
failure; retry once with `--workers=1`, then record the flake in results.

## ux1-01: /auth/login — bound the login fetch so a hung request can't pin the overlay
Kind: mini
ID: ux1-01
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN #3
Skills: none
Budget: files=1; actions=2; changed_lines=30; minutes=8

### Goal
A hung `/api/auth/login` request no longer leaves the full-viewport
`.login-overlay` blocker up forever: the fetch is capped at ~20s and the
timeout lands on the same error path as a failed login (overlay dismissed,
visible error, form re-enabled).

### Files
- Edit: `src/app/auth/login/page.tsx` | `handleLogin` fetch + `catch` only (~lines 62-96)

### Context
- `src/app/auth/login/page.tsx:62-96` | fetch has no timeout; the 15s `navWatch` interval only starts AFTER `fetch` resolves — a hung request waits forever
- `specs/ui-shell-polish/reports/ux-1.md` | finding ux-1 row (evidence + suggested fix)

### Contract
Add a ~20s bound to the `/api/auth/login` fetch (`AbortController` +
`AbortSignal.timeout(20000)` or an equivalent `setTimeout`+`abort`), and make
the `catch` map an abort/timeout to the existing timeout message
`'Sign-in timed out — try again.'` (an AbortError must not surface as a raw
"AbortError"/"The operation was aborted" message). Keep: request method,
headers, body, `response.json()` handling, the `!response.ok` throw, the
success path (`router.push`/`router.refresh`), the whole navWatch block, and
overlay markup/a11y attributes unchanged. Presentational only — no auth-logic
changes. Do not touch `handleGoogle` or any other file.
Out of scope: overlay creation/markup, navWatch internals, refresh.css,
Google sign-in flow, any other file.

### Actions
1. Bound the fetch to ~20s and translate the abort into the timeout error inside the existing `catch` (e.g. `if (err instanceof DOMException && err.name === 'AbortError')` or `TimeoutError` — cover whichever your approach throws).
2. Run tsc and the item3 spec to confirm no regression to the normal overlay flow.

### Done when
- A hung `/api/auth/login` resolves to the catch path (~20s cap): overlay dismissed, `setError('Sign-in timed out — try again.')`, `setLoading(false)`
- Normal success/failure login behaviour unchanged
- `npx tsc --noEmit` exit 0
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3" --workers=1` passes (rate-limit flake retry once, then record)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3" --workers=1` -> pass

### Handoff
None. Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.


## ux1-02: /admin reminders — visible busy affordance on the Toggle while saving
Kind: mini
ID: ux1-02
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN #5
Skills: none
Budget: files=3; actions=3; changed_lines=60; minutes=10

### Goal
Clicking the Reminders toggle gives an immediate in-flight cue for the whole
request instead of reverting to the old state and dimming (looking dead):
either an optimistic checked state or a visible `Saving…`/spinner affordance,
with `disabled` still blocking re-clicks until the save settles.

### Files
- Edit: `src/features/cx-hub/components/admin-page.tsx` | `Rb` reminders block (~lines 318-368) only
- Edit: `src/features/shared/components/ui/Toggle.tsx` | OPTIONAL — only if the affordance needs an optional prop/hook point; API must stay backward-compatible
- Edit: `src/app/cx-kit.css` | OPTIONAL — only if the affordance needs a new rule; prefer reusing `.spinner`/`--cx-*` tokens

### Context
- `src/features/cx-hub/components/admin-page.tsx:318-368` | `Rb` — `checked={on}` is server-derived and `disabled={busy}`: on click the pill reverts and dims for the whole request
- `src/features/shared/components/ui/Toggle.tsx` | thin controlled checkbox; siblings at admin-page.tsx:295-300 respond instantly via local state
- `specs/ui-shell-polish/reports/ux-1.md` | finding ux-2 row (verified dead-looking at 1.5s artificial latency)

### Contract
While `busy` is true the control must show a visible in-flight affordance —
pick ONE: (a) optimistic checked state (local `pending` value shown in
`checked` while busy, reset to server truth in `finally`/`onSaved`), or
(b) a busy indicator rendered in/next to the pill (`Saving…` text or a
`.spinner`-classed element sized for the pill). Keep `disabled={busy || !row}`
behaviour (no double-submits). The `Ln.saveConfigSetting('reminders_enabled', next)`
call, `onSaved(updated)`, `Ti` success/error toasts, `.between` layout, Chip
status, and `#reminders` id stay unchanged. If `Toggle.tsx` is touched, new
props must be optional so `ap-check` consumers are unaffected; do not restyle
`.cx-toggle` for all consumers. Error path still leaves the toggle back on
server truth.
Out of scope: SettingsSection, other admin sections, saveConfigSetting itself,
any other file.

### Actions
1. Implement the chosen busy affordance in `Rb` (and Toggle/cx-kit.css only if the approach requires it).
2. Verify: optimistic/buoyant state still lands on the server-returned value; failure path still toasts the error and reverts.
3. Run tsc and the item5 spec.

### Done when
- During the save request the pill shows an immediate busy cue (optimistic state or `Saving…`/spinner); `disabled` still prevents re-click
- Final state always reflects the server response; error path unchanged (toast + revert)
- `npx tsc --noEmit` exit 0
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item5" --workers=1` passes (rate-limit flake retry once, then record)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item5" --workers=1` -> pass

### Handoff
None. Write results/ux1-02.md (<=10 lines); TL alone updates TRACKER.md.


## ux1-03: theme.css — zero animation-delay in both reduced-motion kill blocks
Kind: mini
ID: ux1-03
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN #4 (reduced-motion honouring)
Skills: none
Budget: files=1; actions=1; changed_lines=4; minutes=5

### Goal
Under `prefers-reduced-motion` / `html[data-reduce-motion]`, children of
`.page` no longer sit at `opacity:0` for up to 360ms (first load) / 144ms
(calm nav) — the kill blocks also zero `animation-delay`, not just
`animation-duration`.

### Files
- Edit: `src/app/theme.css` | the two kill blocks only (~lines 507-514 and 525-530)

### Context
- `src/app/theme.css:507-514` | `html[data-reduce-motion] *` kill block zeroes `animation-duration` but not `animation-delay`
- `src/app/theme.css:525-530` | `@media (prefers-reduced-motion: reduce)` `*` kill block — same gap
- `src/app/cx-kit.css:1572` | `.page>*` uses backwards fill — a nonzero delay pins `opacity:0`
- `specs/ui-shell-polish/reports/ux-1.md` | finding ux-3 row

### Contract
Add exactly `animation-delay: 0s !important;` to BOTH kill blocks listed.
No other property/order/selector changes; no edits to cx-kit.css or the
`--dur*`/`--cc-*` custom-property blocks.
Out of scope: every other file and every other rule in theme.css.

### Actions
1. Insert `animation-delay: 0s !important;` into each of the two kill blocks; verify with grep.

### Done when
- Both kill blocks contain `animation-delay: 0s !important;` (2 occurrences total in the file)
- No other lines changed in theme.css

### Verify
- Run: `grep -c "animation-delay: 0s !important" src/app/theme.css` -> 2

### Handoff
None. Write results/ux1-03.md (<=10 lines); TL alone updates TRACKER.md.


## ux1-04: rail-foot — title attr on truncated .who-name
Kind: mini
ID: ux1-04
Parent: fix-ux-1
Owner: dev
Depends: none
Criteria: PLAN #7
Skills: none
Budget: files=1; actions=1; changed_lines=2; minutes=5

### Goal
A rail-foot user name truncated by `.who-name` ellipsis is recoverable via
its native tooltip: the element carries `title={user.name}`.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | the `.who-name` `<p>` only (~line 632)

### Context
- `src/features/shared/components/shell/AppShell.tsx:632` | `<p className="who who-name">{user.name}</p>` has no title
- `src/app/cx-kit.css:1151` | `.who-name` = nowrap + overflow hidden + ellipsis — truncation is unrecoverable today (topbar shows initials only)
- `specs/ui-shell-polish/reports/ux-1.md` | finding ux-4 row

### Contract
Add `title={user.name}` to the `.who-name` element. Nothing else: no changes
to `.who-meta`/role line, rail-markup, CSS, or other elements' titles.
Out of scope: every other file and every other element in AppShell.tsx.

### Actions
1. Add `title={user.name}` to the `.who-name` `<p>`; run tsc.

### Done when
- `.who-name` renders `title` equal to the full user name
- `npx tsc --noEmit` exit 0

### Verify
- Run: `npx tsc --noEmit` -> exit 0

### Handoff
None. Write results/ux1-04.md (<=10 lines); TL alone updates TRACKER.md.
