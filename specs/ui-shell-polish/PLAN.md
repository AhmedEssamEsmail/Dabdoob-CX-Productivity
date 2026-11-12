# ui-shell-polish — 7 user-reported UI fixes (bugfix path)

## Goal
Fix seven UI defects reported by the user (with screenshots) in the CX-Hub app.
Project root: `C:\Users\AHMED\KPIs\CX-Hub`. Next.js 16, verbatim legacy port —
keep markup structure/class names aligned with the legacy DOM where possible.

## Success criteria (numbered, testable)

1. `/quality-scores`: after clicking a team-lead row ("Who is behind the score"
   table -> agents-for-TL view), column labels/headers and cell content are
   correctly positioned/aligned (currently "labels wrongly positioned" — see
   user screenshot 1: agents table under `All team leads / <TL>` crumbs).
   Pinpoint exact misposition with a real-browser screenshot at ~1440px and
   375px before fixing.
2. `/calibration`: the assign form (`AssignForm`, `.qa-grid` fields: Ticket
   number, Channel, Auditor, Reference (team lead), Agent, submit button) —
   field/input box borders no longer overlap each other at desktop width
   (user screenshot 3). Suspect: `.qa-grid` tracks `minmax(14rem,1fr)` +
   `.cx-field`/`.cx-select` children without `min-inline-size:0` — compare
   with `.cx-settings-section` fixes in cx-kit.css:535-537.
3. `/auth/login`: clicking Sign in shows an immediate, persistent busy
   affordance — a popup/overlay with a circle loading spinner ("Signing
   in…") — that stays until navigation completes or an error shows. Today
   the button dims ~2s (`loading` -> "Signing in…" + disabled), resets in
   `finally` before `router.push('/')` resolves, then the app logs in dead
   seconds later (src/app/auth/login/page.tsx). Reuse `.spinner` class
   (cx-kit.css:231). Presentational only — do not change the auth request,
   credentials handling, or error handling semantics.
4. Nav rail: clicking any nav link gives immediate visual feedback AND a
   visible transition instead of a dead 2-3s wait. Root causes found:
   (a) `document.startViewTransition(go)` in AppShell.tsx:351-371 wraps
   `router.push` — snapshot captures identical DOM (push is async), so no
   animation; (b) `view-transition-name` is set NOWHERE, so the
   `::view-transition-old/new(page)` rules (cx-kit.css:1566-1568) are dead;
   (c) `data-entry` flips to `"calm"` after the first route (AppShell
   ~line 220) but only `[data-entry="first"]` has a CSS rule
   (cx-kit.css:1559) → subsequent navigations have zero entry animation.
   Fix = visible feedback on click (e.g. pending state on clicked link /
   sliding .nav-ind / top progress bar) + a real transition or entry
   animation for the new page (a `"calm"` variant is the minimal honest
   fix). Respect `prefersReducedMotion` (helper exists in shell/i18n).
5. `/admin` Reminders section (`Rb` in
   src/features/cx-hub/components/admin-page.tsx:318-364): currently a
   full-width `cx-settings-section` with Chip + "Turn on/off" Button
   (screenshot 4). Should be a compact single row: hint text left, a
   `Toggle` (cx-toggle switch, src/features/shared/components/ui/Toggle.tsx)
   anchored far right; keep loading/error/busy states and the
   `Ln.saveConfigSetting('reminders_enabled', !on)` call + `Ti` toast.
   Keep `#reminders` id (TOC anchor).
6. Rail footer (AppShell.tsx rail-foot ~639-660): remove the `.avatar`
   circle left of the user name (screenshot 5). Drop now-unused
   `whoParts`/`initials` computation if nothing else uses it (check —
   `topInitials` for Topbar is computed separately and stays).
7. Rail footer: user name font much smaller (screenshot 5: name wraps 3
   lines at --cx-text-md). Target ~`--cx-text-sm`/`--cx-text-xs` + ellipsis
   truncation; keep role line readable and the sign-out/collapse buttons
   aligned.

## Non-goals
- No behavior/data/auth-logic changes; no new dependencies; no edits to
  `package.json`/lockfiles, `.env*`, `cx-kpis-*.json`.
- Do not restyle unrelated sections/pages.

## Risk flags
`ui` (UX gate) · `auth`-adjacent (login form touched → security gate) ·
`tests` light (page-contract e2e may cover these pages — TL runs relevant
e2e only, not the whole suite).

## Gates (run from CX-Hub root)
- `npx tsc --noEmit`
- `npx eslint .` (scope to changed files if repo-wide has foreign failures —
  see lessons: attribute, never revert foreign edits)
- `npx vitest run`
- e2e: `npx playwright test e2e/page-contract.spec.ts` if it exists/covers
  touched pages (admin/login/shell); Playwright may live outside repo deps.

## Conventions (from .devin/workflow.md + lessons)
- Next.js 16 differs from training data — check `node_modules/next/dist/docs/`
  before Next-specific APIs (e.g. view transitions support).
- Verbatim-port files: keep legacy class names/DOM shape; this is
  user-requested polish, so deviations are OK but stay in the same
  class/token vocabulary (`--cx-*`, `.cx-*`, `.qa-*`, `.qs-*`).
- Heavy command output → log file + bounded tail (OUTPUT-BUDGET).
- Dev server is already running at http://localhost:3000.
- Repro login creds (e2e fixtures, already seeded):
  `e2e.admin@dabdoob.com` / `E2E-cx-local-2026!` (admin → /admin, view-as);
  `e2e.tl@dabdoob.com`, `e2e.agent@dabdoob.com` same password.
- Playwright: `webapp-testing` approach ok; baseURL http://localhost:3000;
  store screenshots/logs under `specs/ui-shell-polish/reports/` or results/.
- `prefers-reduced-motion` must be honored for new animations.

## Research notes / key pointers
- `src/features/shared/components/shell/AppShell.tsx` — rail/nav/navigate()
  (351-371), rail-foot (639-680), data-entry effect (~217-221).
- `src/features/shared/components/ui/` — Toggle, Button, Chip, Select,
  SettingsSection, ListSelect lives in cx-quality `qa-shared`.
- `src/app/cx-kit.css` — `.nav-ind` (1050), `.nav-link` (1028), `.rail-foot`
  (1116), `.who`/`.who-meta` (1136), `.spinner` (231), `.cx-settings-section`
  (532), view-transition rules (1566-1568), `data-entry` (1494,1559).
- `src/app/styles/quality.css` — `.qa-grid` (85), `.qs-crumbs` (232),
  `.qa-sub` (80), `.qa-range` (183).
- `src/app/refresh.css` — `.avatar` (94), `.login-*` (396-460).
- `src/features/cx-quality/components/quality-scores-page.tsx` —
  BreakdownTable (265-389), ScoreCell (236-262); markup verified 1:1 with
  `.devin/work/extract/quality/pages/quality-scores.closure.js` — so item 1
  is most likely CSS, not markup.
- `src/features/cx-quality/components/calibration-page.tsx` — AssignForm
  (170-269).
- `src/features/cx-hub/components/admin-page.tsx` — `Rb` reminders (318-364).
- `src/app/auth/login/page.tsx` — handleLogin (36-61), submit button (149-163).
