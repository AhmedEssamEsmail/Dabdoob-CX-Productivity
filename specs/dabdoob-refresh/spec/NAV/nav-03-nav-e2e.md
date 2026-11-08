# NAV-03: e2e — collapsible unified nav + client-side nav regression spec
Kind: mini
ID: NAV-03
Parent: NAV
Owner: test-engineer
Depends: NAV-01 (DOM/aria/sessionStorage hooks must exist)
Criteria: spec/NAV/user-nav-round.md Verify block (all four bullets)
Skills: none
Budget: files=1; actions=5; changed_lines=120; minutes=10

## Goal
Add ONE Playwright spec covering the nav overhaul: group headers toggle
their submenus, the current route's group is expanded, the open-set
persists in sessionStorage across client nav, and every nav link routes
client-side (no full reload, no BootSplash, e2e hooks intact) — incl.
mobile `.nav-open` at 375px.

## Files
- Create: `e2e/nav-collapse.spec.ts` | one spec file, <=4 tests

## Context
- `e2e/users.ts:41-70` | `login(page, E2E_USERS.admin)` + `fillSticky` helpers
- `e2e/responsive.spec.ts:29-45` | established pattern: `page.setViewportSize`, `#nav` visible/hidden, `getByRole('button', { name: 'Menu', exact: true })`
- `spec/NAV/nav-01-unified-collapsible-nav.md` Contract | shipped hooks: `#nav > .nav-group[data-tone] > button.nav-group-label[aria-expanded][aria-controls]` + `ul[hidden]`; items `<a class="nav-link" href>` with `aria-current="page"` on current; open-set = `sessionStorage['cx.nav-groups']` JSON array; brand/cx-note links also client-side
- `src/features/shared/components/shell/BootSplash.tsx:10` | `.boot-splash` only renders on document load (`#app:not(:empty)+.boot-splash{display:none}`) — a full reload re-shows it; absence mid-nav proves SPA routing

## Contract
- Use the existing `login` + `E2E_USERS.admin` fixture; admin sees many
  groups so "a group not containing the current page" always exists:
  locate it via `#nav .nav-group` filtered to those without
  `[aria-current="page"]` (e.g. `locator(..., { hasNot: ... })` or
  equivalent Playwright filter).
- No-reload proof: after boot, `page.evaluate` set `window.__navStay = 1`,
  click a `.nav-link` inside a different group, assert the URL changed AND
  `page.evaluate(() => window.__navStay)` still `=== 1` (a document reload
  would clear it) AND `.boot-splash` is not visible during/after.
- sessionStorage proof: collapse a non-current group, client-navigate,
  then read `sessionStorage.getItem('cx.nav-groups')` and assert the
  collapsed group is absent / open-set JSON contains expected groups;
  assert the NEW route's group label has `aria-expanded="true"`.
- Mobile: 375px viewport -> `#nav` hidden -> Menu -> visible; then one
  header toggle still works (aria-expanded flips).
- Every test must be deterministic: no fixed sleeps except short settling
  waits after clicks (`waitForURL`, `expect(...).toHaveAttribute`, polling
  on evaluate). Do NOT assert `.cc-skel` timing (flaky) — instead assert
  `#main` renders content post-nav (page-level loading states are
  per-page, already covered).
- Out of scope: editing AppShell/CSS (NAV-01/02 own those — a FAIL caused
  by missing hooks means the dep wasn't done: report it, don't patch
  source); other e2e files; seed scripts.

## Actions
1. Test "group headers toggle submenus": login -> `#nav` visible; each
   `.nav-group-label` is a `<button>` with `aria-expanded`; current
   route's group expanded; click another group's label -> its `ul` hidden
   + `aria-expanded="false"`; click again -> re-opens.
2. Test "open-set persists across client nav": collapse a non-current
   group, click a `.nav-link` in an open group -> `waitForURL`; assert
   `cx.nav-groups` sessionStorage reflects the toggle and the new route's
   group shows `aria-expanded="true"`.
3. Test "client-side nav, no reload/BootSplash": `__navStay` marker +
   `.boot-splash` hidden assertions per contract; also assert
   `#nav .nav-link[aria-current="page"]` exists after nav.
4. Test "mobile nav-open + toggle at 375px": per contract.
5. Run: `npx playwright test e2e/nav-collapse.spec.ts` (dev server +
   seeded users required; if unreachable, run
   `npx playwright test e2e/nav-collapse.spec.ts --list` for syntax and
   record the environment blocker in results).

## Done when
- 4 tests exist, all deterministic, covering toggle / persistence /
  no-reload / mobile per spec Verify bullets.
- Spec passes against the app (or env-blocker documented), with
  `npx playwright test e2e/nav-collapse.spec.ts --list` showing all tests.

## Verify
- Run: `npx playwright test e2e/nav-collapse.spec.ts` -> 4 pass (or
  `--list` + documented blocker if dev server/seed users unavailable)

## Handoff
TL runs full `npm run test:e2e` at final integration; this spec is the
NAV regression evidence for the UX/QA gates.
Write results/NAV-03.md (<=10 lines); TL alone updates TRACKER.md.
