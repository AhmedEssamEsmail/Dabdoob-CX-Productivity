# NAV-01: unified inline nav — all groups, collapsible headers, no full reload
Kind: mini
ID: NAV-01
Parent: NAV
Owner: dev
Depends: none
Criteria: spec/NAV/user-nav-round.md NAV-1..NAV-4
Skills: none
Budget: files=1; actions=7; changed_lines=180; minutes=10

## Goal
Rewrite the `#nav` block so EVERY group in `GROUP_ORDER` renders inline with
its role-gated pages (single app — all registry paths are local Next routes),
each `.nav-group-label` becomes a compact toggle `<button>` with a chevron,
`aria-expanded`/`aria-controls` and a sessionStorage-persisted open-set, and
no nav (or rail) link uses `target="_top"` — killing the full-document
reload that replays BootSplash on feature clicks. Group containing the
current route auto-expands; groups with zero visible pages render nothing.

## Files
- Edit: `src/features/shared/components/shell/AppShell.tsx` | nav map (~L466-548), storage helpers near RAIL_OFF_KEY (~L60-78), open-set state near other useState (~L90-106), brand link (~L405-409), "Open the Hub" (~L378-382), external cx-note link (~L592-595), imports (~L28-45), `isAdmin` (~L368)

## Context
- `AppShell.tsx:466-548` | nav block to rewrite — the `appForGroup(group) !== ctxApp` branch (jump link, `.nav-ext` svg, `.nav-ext-note`, "Opens {name} in {app}"/"not connected" titles) is deleted wholesale; keep the same-app `<ul>` item markup exactly (`.nav-link`, `pageHref`, `navigate`, `aria-current`, `NavIcon`, `.nav-text`, `D()`)
- `AppShell.tsx:62-78` + `L248-253` + `L256-277` | `readRailOff`/`writeRailOff` try/catch storage pattern; `prevRoutePath` setState-during-render adjust pattern; `navigate(event, href)` client-nav wrapper to reuse
- `AppShell.tsx:338-350` | `visible`/`fallback`/`current` — `visible` stays inApp-filtered for fallback; add `navVisible` for the nav; `current` is the effective page for auto-expand
- `src/features/shared/shell/gates.ts:79-143` | `groupEntryAllowed` stays (used by cx-note); `resolveLink` never returns `missing` for registry paths so the "not connected" off-state is dead — drop it; `groupEntryLink`/`GROUP_DEFAULT_PAGE` become unused here (leave exported in gates/registry — non-goal to delete them there)
- `mockups/assets/mock.css:108-134` | `.nav`/`.nav-group`/`.nav-group-label`/`.nav-link` contract — label is compact uppercase; styles land in NAV-02 (class hooks only here)

## Contract
- `const navVisible = PAGES.filter((page) => pageAllowed(page, boot))` — ALL
  groups, NO `inApp` filter (that is the unified-nav change).
- Render `{GROUP_ORDER.map((group) => …)}`: `items = navVisible.filter(p =>
  p.group === group)`; `items.length === 0` -> return null. Otherwise
  `<div className="nav-group" data-tone={GROUP_TONE[group]} key={group}>`
  containing:
  - `<button type="button" id={'nav-label-' + group}
    className="nav-group-label" aria-expanded={open}
    aria-controls={'nav-items-' + group} aria-label={D(GROUP_LABELS[group])}
    onClick={toggle}>`
    `<span className="nav-label-text">{D(GROUP_LABELS[group])}</span>`
    `<svg className="nav-chevron" viewBox="0 0 24 24" aria-hidden="true"
    focusable="false"><path d="m6 9 6 6 6-6" /></svg>`
  - `<ul id={'nav-items-' + group} hidden={!open}
    aria-labelledby={'nav-label-' + group}>` with the SAME `<li><a>` items
    as today's same-app branch (`href={pageHref(page.path)}`,
    `aria-current={page.path === current?.path ? 'page' : undefined}`,
    `onClick={(e) => navigate(e, pageHref(page.path))}`, `NavIcon`,
    `.nav-text`, `D(page.title)`).
- Open-set: `const [openGroups, setOpenGroups] =
  useState<Set<string>>(readNavGroups)`; `readNavGroups()` parses
  `sessionStorage['cx.nav-groups']` (JSON string array) into a `Set`
  inside try/catch returning `new Set()`; `writeNavGroups(set)` writes
  `JSON.stringify([...set])` in try/catch. Toggle: flip membership in a new
  Set, `writeNavGroups`, `setOpenGroups`.
- Auto-expand (adjust-during-render, same pattern as `prevRoutePath`,
  placed post-boot near `current`): if `current?.group` (fallback
  `route.group`) is not in `openGroups`, `setOpenGroups(prev => { const
  next = new Set(prev); next.add(<group>); writeNavGroups(next); return
  next })`. Net effect: the current route's group is always expanded after
  nav; user's manual collapse of OTHER groups persists for the session.
- Delete: the whole cross-app branch, `.nav-ext` svg, `.nav-ext-note`,
  `.nav-group--app`, `nav-link--off` usage, `target="_top"` in nav, the
  `isAdmin` const, and now-unused imports `groupEntryLink`,
  `GROUP_DEFAULT_PAGE`. Keep imported: `groupEntryAllowed`, `resolveLink`,
  `inApp`, `appForGroup` (all still used).
- Convert residual shell `target="_top"` links to client nav: brand `<a>`
  (`onClick={(e) => navigate(e, <resolved href>)}`, drop `target`),
  external cx-note `<a href={note.link.href}>` (drop `target`, add
  `onClick` navigate), "Open the Hub" `<a>` (same). All remain real hrefs.
- Unchanged contracts: `#nav`, `.nav`, `.nav-ind` tracking (it repositions
  every render — collapse/expand re-renders reposition it; a hidden
  current link can't occur since its group auto-expands), `data-app`,
  `data-tone`, `NavIcon`, `D()` on all strings, `pageAllowed` gating,
  mobile `.nav-open`, rail-off markup. BootSplash (layout.tsx) NOT touched —
  client nav simply never triggers it. Page skeletons (`.cc-skel*`) are
  page-owned and unaffected.
- Out of scope: refresh.css/cx-kit.css edits (NAV-02), gates.ts/registry.ts
  edits (dead exports stay), e2e specs (NAV-03), BootSplash, route gating.

## Actions
1. Add `NAV_GROUPS_KEY = 'cx.nav-groups'` + `readNavGroups`/`writeNavGroups`
   beside `readRailOff`; add `openGroups`/`setOpenGroups` state.
2. Rewrite the `GROUP_ORDER.map` nav block to the unified collapsible
   markup per Contract (delete cross-app branch).
3. Add `toggleGroup` + the post-boot auto-expand adjust-during-render.
4. Convert brand, cx-note external and "Open the Hub" `_top` links to
   `navigate()`; drop all `target="_top"`.
5. Remove unused `isAdmin`, `groupEntryLink`, `GROUP_DEFAULT_PAGE` imports.
6. `npx eslint src/features/shared/components/shell/AppShell.tsx` clean.
7. `npx tsc --noEmit` clean.

## Done when
- Every `GROUP_ORDER` group with >=1 `pageAllowed` page renders a
  `button.nav-group-label` + `ul` that toggles via `hidden`; zero-item
  groups absent; clicking a header flips `aria-expanded` and persists to
  `sessionStorage['cx.nav-groups']`; multiple groups can be open.
- `grep` for `nav-ext`, `nav-group--app`, `target="_top"`,
  `groupEntryLink`, `GROUP_DEFAULT_PAGE`, `isAdmin` in AppShell.tsx -> 0.
- Navigating by any `.nav-link` (incl. another group's page) changes the
  URL via `router.push` — no document reload, so BootSplash cannot appear;
  the new route's group is expanded; `#nav` `.nav-link[aria-current]`,
  `.nav-ind`, `data-app`, `data-tone`, `NavIcon`, `D()` all intact.
- `npx tsc --noEmit` clean; eslint 0 errors on AppShell.tsx.

## Verify
- Run: `npx eslint src/features/shared/components/shell/AppShell.tsx && npx tsc --noEmit` -> clean
- Run: `grep -n 'nav-ext\|nav-group--app\|target="_top"\|groupEntryLink\|GROUP_DEFAULT_PAGE\|isAdmin' src/features/shared/components/shell/AppShell.tsx` -> no output

## Handoff
Hooks for NAV-02 CSS: `button.nav-group-label`, `.nav-label-text`,
`.nav-chevron`, `ul[hidden]`, `[aria-expanded]`; e2e hooks for NAV-03:
`aria-expanded`/`aria-controls`/`hidden` + `sessionStorage['cx.nav-groups']`.
Write results/NAV-01.md (<=10 lines); TL alone updates TRACKER.md.
