# fix-qa-1 — ui-shell-polish qa-1 findings (4 leaves)

Source report: `specs/ui-shell-polish/reports/qa-1.md` (findings qa-1…qa-4; the
task declares all 4 blocking this round even though the report tags qa-3/qa-4
LOW). Regression spec: `e2e/ui-shell-polish.spec.ts` — each leaf runs only its
`-g` test. Dev server assumed at http://localhost:3000; e2e creds in PLAN.md.
Supabase auth is rate-limited under test volume — a `Request rate limit
reached` alert during a `-g` run is an environment flake, not a leaf failure;
retry once with `--workers=1`, then record the flake in results.

## qa1-01: /auth/login — clear stuck busy state when nav never commits
Kind: mini
ID: qa1-01
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #3
Skills: none
Budget: files=1; actions=2; changed_lines=25; minutes=5

### Goal
If `router.push('/')` never navigates (chunk load failure/offline/abort), the
navWatch 15s timeout no longer leaves a permanently disabled "Signing in…"
button — the form re-enables with a visible error.

### Files
- Edit: `src/app/auth/login/page.tsx` | navWatch interval branch only (~lines 79-85)

### Context
- `src/app/auth/login/page.tsx:78-90` | current navWatch clears overlay on timeout but `setLoading(false)`/`setError` only run in `catch` — success path leaves `loading===true` forever if nav no-ops
- `specs/ui-shell-polish/reports/qa-1.md` | finding qa-1 row (evidence + suggested fix)

### Contract
Presentational only: do not touch the fetch, credentials, `router.push`/
`router.refresh` calls, or the `catch` error semantics. In the navWatch stop
branch distinguish the two exits: pathname changed → just dismiss overlay
(existing behaviour); still on `/auth/login` at the 15s cap → dismiss overlay
AND `setError('Sign-in timed out — try again.')` + `setLoading(false)` so the
form is usable. Keep the 500ms post-dismiss settle if simple, or drop it — the
state reset must happen either way.
Out of scope: overlay creation/markup, refresh.css, Google sign-in flow,
any other file.

### Actions
1. Rework the navWatch callback (lines ~80-85) so the timeout-while-still-on-`/auth/login` case clears the overlay, sets the timeout error message, and resets `loading`; the navigated case keeps current behaviour.
2. Run tsc and the item3 spec to confirm no regression to the normal overlay flow.

### Done when
- Timeout branch resets `loading` and shows an error when still on `/auth/login`; navigated branch unchanged
- `npx tsc --noEmit` exit 0
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3" --workers=1` passes (rate-limit flake retry once, then record)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item3" --workers=1` -> pass

### Handoff
None. Write results/qa1-01.md (<=10 lines); TL alone updates TRACKER.md.


## qa1-02: e2e spec — assert real alignment (item1) and busy-while-on-login (item3)
Kind: mini
ID: qa1-02
Parent: fix-qa-1
Owner: test-engineer
Depends: none
Criteria: PLAN #1, #3 (test honesty)
Skills: none
Budget: files=1; actions=2; changed_lines=25; minutes=8

### Goal
`e2e/ui-shell-polish.spec.ts` item1 actually fails on header/cell misposition
(asserts the measurements it already collects), and item3's terminal assertion
no longer races the overlay's 500ms post-nav dismiss.

### Files
- Edit: `e2e/ui-shell-polish.spec.ts` | item1 tail assertion (~line 85) and item3 tail assertion (~lines 168-174) only

### Context
- `e2e/ui-shell-polish.spec.ts:65-85` | item1 collects `align` (per-col `thLeft`/`tdLeft`/`thTextLeft`) but only asserts `align.length===6`
- `e2e/ui-shell-polish.spec.ts:141-174` | item3 collects `samples` incl. per-sample `busy`+`url`; terminal `.spinner toHaveCount(1,{timeout:500})` races overlay dismiss
- `specs/ui-shell-polish/reports/qa-1.md` | finding qa-2 row

### Contract
Test-only hardening; keep test names, structure, screenshots, and console.log
evidence lines. (1) item1: assert every column's measured header edge aligns
with its cell edge — `tdLeft !== null` and `Math.abs(thLeft - tdLeft) <= 1`
per column (assert all 6, report which col failed in the message).
(2) item3: assert on collected `samples` — at least one sample with
`url === '/auth/login' && busy === true` — instead of locating `.spinner`
after navigation; keep the `dead` count log, and assert `dead.length === 0`
only if that was already implicit (it was log-only — adding it is allowed and
preferred since qa-2 is about catching regressions).
Do NOT weaken any existing assertion or edit other tests.
Out of scope: other spec files, app source, page-contract.spec.ts.

### Actions
1. item1: replace `expect(align.length).toBe(6)` with a per-column loop asserting `Math.abs(thLeft - tdLeft) <= 1` (keep a `align.length === 6` guard first so a missing column fails clearly).
2. item3: replace the terminal `.spinner` locator assertion with `expect(samples.some(s => s.url === '/auth/login' && s.busy)).toBe(true)` plus `expect(dead.length).toBe(0)`.

### Done when
- item1 fails if any of the 6 columns' header/cell left edges differ by >1px (and passes on the current fixed layout)
- item3 asserts busy-while-on-login from samples — no post-nav `.spinner` locator race
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item1|item3" --workers=1` passes on current code (rate-limit flake retry once, then record)
- `npx tsc --noEmit` exit 0

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item1|item3" --workers=1` -> pass

### Handoff
None. Write results/qa1-02.md (<=10 lines); TL alone updates TRACKER.md.


## qa1-03: AppShell — bound pendingHref so a silent nav no-op can't stick the link
Kind: mini
ID: qa1-03
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: PLAN #4
Skills: none
Budget: files=1; actions=1; changed_lines=15; minutes=5

### Goal
If `router.push(href)` silently no-ops, the clicked `.nav-link`'s
`data-pending`/`aria-busy` clears itself after ~8s instead of staying stuck
until some later successful navigation.

### Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | `navigate` callback only (~lines 346-363)

### Context
- `src/features/shared/components/shell/AppShell.tsx:346-363` | `navigate` sets `setPendingHref(href)` then `router.push(href)` — cleared only by the route-change check at lines 338-344
- `specs/ui-shell-polish/reports/qa-1.md` | finding qa-3 row

### Contract
Add a bounded self-clear: after `setPendingHref(href)`, schedule
`window.setTimeout(() => setPendingHref(h => (h === href ? null : h)), 8000)`
inside `navigate` (the `h === href` guard prevents an old timer clearing a
newer pending link). Keep every existing guard clause, `router.push`, and the
route-change clearing logic untouched. No new deps, no CSS changes.
Out of scope: the route-change effect (338-344), nav markup/CSS, Topbar,
any other file.

### Actions
1. Add the guarded `setTimeout` clear inside `navigate` per the contract; run tsc.

### Done when
- `pendingHref` self-clears ~8s after a nav that never commits; normal fast navs unaffected
- `npx tsc --noEmit` exit 0
- `npx playwright test e2e/ui-shell-polish.spec.ts -g "item4" --workers=1` still passes (rate-limit flake retry once, then record)

### Verify
- Run: `npx playwright test e2e/ui-shell-polish.spec.ts -g "item4" --workers=1` -> pass

### Handoff
None. Write results/qa1-03.md (<=10 lines); TL alone updates TRACKER.md.


## qa1-04: Repo root — remove scratch artifacts, ignore logs/
Kind: mini
ID: qa1-04
Parent: fix-qa-1
Owner: dev
Depends: none
Criteria: repo hygiene (qa-1 finding qa-4)
Skills: none
Budget: files=5; actions=3; changed_lines=5; minutes=5

### Goal
Untracked scratch at repo root is gone or ignored: delete the stray 0-byte
`nul` file and the stale gate logs; keep the live `logs/dev-server.log` and
stop `logs/` showing as untracked noise.

### Files
- Edit: `nul` | delete this stray 0-byte artifact at repo root
- Edit: `.gitignore` | add `logs/` entry
- Edit: `logs/data2-gate-vitest.log` | delete (stale gate log)
- Edit: `logs/p3-c2-01-toc-links-r2.log` | delete (stale gate log)
- Edit: `logs/p3-c2-01-toc-links.log` | delete (stale gate log)

### Context
- `specs/ui-shell-polish/reports/qa-1.md` | finding qa-4 row
- Repo root listing | `nul` is 0 bytes; `logs/` holds the 3 stale logs + live `dev-server.log` (~1.3MB, mtime = now)
- `.gitignore` | currently has no `logs/` entry (both show `??` in git status)

### Contract
Deletion + ignore only. Do NOT delete `logs/dev-server.log` — the live dev
server is writing it (mtime = now). Do not
touch `specs/**/logs/` (spec gate logs live there deliberately), do not edit
`package.json`/lockfiles/`.env*`. `.gitignore` gets a single `logs/` line in a
sensible section.
Out of scope: everything else — no source edits.

### Actions
1. `rm nul` and remove the three stale log files listed.
2. Append `logs/` to `.gitignore`.
3. Confirm `git status --porcelain -- nul logs .gitignore` shows only `.gitignore` modified.

### Done when
- `nul` and the 3 stale logs deleted; `logs/dev-server.log` still present
- `logs/` no longer appears in `git status` untracked output
- `git status --porcelain -- nul logs .gitignore` -> ` M .gitignore` only

### Verify
- Run: `git status --porcelain -- nul logs .gitignore` -> ` M .gitignore` only

### Handoff
None. Write results/qa1-04.md (<=10 lines); TL alone updates TRACKER.md.
