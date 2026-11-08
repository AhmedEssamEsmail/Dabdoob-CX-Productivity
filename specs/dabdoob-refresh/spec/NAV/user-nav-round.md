# Nav overhaul — user round 2 (dabdoob-refresh)
User request verbatim: "I don't like the transition between features from nav
bar as I'm switching between one app and other. I need each button to have
collapsable sub menu with its options and remove the shitty icon from the
headers and make all headers in nav bar compact as mockup and remove the dumb
loading screen when clicking on one of the features and make the system load
the page with the needed screen and loading animations for any data still
being populated."

Current behavior (AppShell.tsx ~L443-541): groups in another "app"
(`appForGroup(group) !== ctxApp`) render a single jump link with a
`.nav-ext` external-icon + `target="_top"` -> FULL DOCUMENT RELOAD -> the
BootSplash replays = the "dumb loading screen". Same-app groups render
inline with `pageHref` + `navigate()` (router.push + startViewTransition).
All PAGES are local Next routes, so the app-jump model is unnecessary.

## Required changes

| ID | Requirement | Region |
|----|-------------|--------|
| NAV-1 | Unified nav: render ALL GROUP_ORDER groups inline like the mockup (`mockups/assets/mock.css` `.nav-group`/`.nav-group-label`/`.nav-link`). Remove the cross-app branch entirely: no `.nav-ext` icon, no `target="_top"`, no `nav-group--app` jump links, no "opens in {app}" tooltips. | AppShell.tsx nav block |
| NAV-2 | Collapsible groups: each `.nav-group-label` becomes a `<button>` (compact, mockup style) with a small chevron indicating state (NOT the removed external icon). `aria-expanded` + `aria-controls` on the button, its `<ul>` collapses/expands. The group containing the current route starts expanded; other groups start collapsed; multiple groups may be open; persist the open-set in sessionStorage for the session. Groups with zero visible pages for the current role: do not render at all. | AppShell.tsx + refresh.css/cx-kit.css |
| NAV-3 | All links client-side: every nav-link uses `pageHref` + `navigate()` — no `target="_top"` anywhere in nav. Result: no BootSplash on feature clicks (BootSplash remains only for the initial document load). Pages keep their own skeletons (`.cc-skel*` / per-page skeleton states) during client nav — that IS the "loading animations for data still being populated" the user wants; verify skeletons still show, e.g. /overview `.cc-skel__tiles`. | AppShell.tsx |
| NAV-4 | Keep shell contracts: `#nav`, `.nav-link`, `aria-current="page"`, `.nav-ind` indicator tracking, `data-tone`, `data-app`, NavIcon per item, `D()` strings, role gating via `pageAllowed`/`visible`, groupEntryAllowed semantics for "not connected" only where a group has pages but none resolvable (keep existing treatment if it still applies — otherwise drop). Rail-off and mobile `.nav-open` behavior must still work; chevron + header remain accessible at 320px. | AppShell.tsx + css |

## Non-goals
- No changes to route gating, `resolveLink`/`groupEntryLink` helpers (may become dead — leave exported helpers; do not delete registry code unless trivially unused).
- BootSplash redesign — only ensure it does NOT appear on client-side nav.
- No data/API changes.

## Verify
- Clicking any group header toggles its submenu; current-route group is expanded; state persists across client nav (sessionStorage).
- Clicking a link in ANY group navigates SPA-style: no full reload, no BootSplash; target page shows its own skeleton while data loads.
- No `.nav-ext` icons remain; headers match mockup compactness.
- e2e `#nav`/`.nav-link`/`aria-current` hooks intact; tsc/eslint/vitest green; reshoot rail in light+dark.
