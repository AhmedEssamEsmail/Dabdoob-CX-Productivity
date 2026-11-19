# PLAN: unified-page-format
Type: feature   Status: draft
Date: 2026-11-18   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
1. **One page frame.** Every routed page (~39 under `src/app/*/page.tsx`, 8 feature dirs under `src/features/*/components`) uses the same positions, sizes and spacing for: page title (h1), sub-title/purpose, notes/status line, refresh/primary buttons, filters/segmented controls/search, KPI/stat card row, and content sections. Scrolling from page to page must show the title, toolbar and first card row at the same x/y and with the same font sizes. Each page's own content design (charts, tables, grids, colours) is NOT changed.
2. **Instant page switching, no logo splash.** Clicking a nav item must never show the Dabdoob bear/logo boot animation. Navigation feels instant (shell stays, only the content area swaps). When a wait is unavoidable, show a modern small spinner (circle) in the content area, not the logo. The logo splash remains only for true cold load (first paint before JS), if at all.

## Evidence from the 3 screenshots (Home, Queue health, Aging cases)
- Home: no h1 size match (smaller title, "Good afternoon" greeting), refresh button top-right ABOVE the title, status note right-aligned under it, "Next: 18:30" floating, no breadcrumb-level title.
- Queue health: big h1, one-line subtitle, search + Export + Refresh in the title row, stat cards below.
- Aging cases: big h1, 2-line subtitle (wraps narrow), filter seg + note on a row below, Refresh at far right of that row; no cards.
- Differing: left offsets (Home ~44px, Queue ~32px, Aging ~40px), title sizes, where Refresh lives, where notes live, card gaps.

## Success criteria
1. A documented **Page Frame Contract** (`docs/PAGE-FRAME.md`) defines slots: `breadcrumb/topbar` (shell), `title` (h1), `sub` (one-line purpose, max 2 lines), `actions` (right of title: refresh + primary/secondary buttons), `toolbar` (filters, seg, search; left) + `status` (freshness note; right of toolbar, never above title), `stats` (card row), `body`. With token values (font sizes, gaps, max width, left inset) all from `--cx-*` tokens.
2. A single shared component API (extend existing `PageShell` in `features/shared/components/ui/PageShell.tsx` + `.page-head` CSS in `app/cx-kit.css`/`app/refresh.css`) implements the slots; one shared `RefreshButton`/status pattern replaces the 2 duplicate `RefreshNow` implementations (`cx-queue/components/shared.tsx`, `cx-hub/components/hub-shared.tsx`) while preserving the cooldown/ARIA behaviour. Stat-card row (`stats` slot) uses one grid (gap, min width, radius, padding, value/label/sub font sizes).
3. Every page in the route inventory renders title/sub/actions/toolbar/stats at identical coordinates at 1024 and 1440 px (tolerance 2 px) and stacks identically at 375 px; measured by a new e2e spec (`e2e/page-frame.spec.ts`) that visits every route and asserts h1 font-size, h1 top/left offset, sub font-size, actions alignment, stats row top offset.
4. No page keeps a bespoke head: per-feature `*-page-head`/`kicker`/inline-styled title blocks removed or mapped onto the shared slots. Home's greeting is allowed as title text but sits in the same h1 slot/size.
5. Route changes from the nav: no `.boot-splash`/logo visible at any time after first load (e2e asserts by clicking through all nav links with throttled network/CPU); shell (rail/topbar) never unmounts; content area shows a spinner only if the route takes >150 ms (delayed show, no flash), via `loading.tsx` per route group or a shared Suspense fallback.
6. A modern circular spinner component (`Spinner`, CSS-only, token colours, respects `prefers-reduced-motion` and `data-reduce-motion`, `role="status"` + sr label) in shared UI; used by all route-level loading and replaces `LinesSkeleton` flashes only where the old fallback was the logo.
7. Existing contracts stay green: `e2e/page-contract.spec.ts` (8-question contract), density contract, light/dark, RTL (`ar`) title alignment, 375 px no horizontal scroll.
8. Gates pass: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npm run test:e2e` (UI subset).

## Non-goals
- Redesigning page internals (charts, tables, grids, colours, copy), new features, DB/API changes, new npm dependencies, rebranding.
- Removing the cold-load splash for the very first document paint (only the in-app navigation path is in scope; decide in architect step whether to retire it).

## Risk flags
`ui`, `tests`, `docs`, `arch` (cross-cutting; 39 pages + shell loading behaviour; needs a decision on slot API and splash root cause). No `db`, `data`, `auth`, `deps`, `deploy`. `perf` gate is relevant for the navigation-latency criterion; include (route-switch timing, no extra bundle).

## Gates
- typecheck: `npx tsc --noEmit` · lint: `npx eslint .` · unit: `npx vitest run` · e2e: `npm run test:e2e` (page-frame + page-contract specs) · run from `CX-Hub/`.
- Start dev server via PM `exec` in background (`npm run dev > logs/dev-server.log 2>&1 &`), never from agents.

## Conventions
- Read `node_modules/next/dist/docs/` for `loading.tsx`, Suspense and navigation before touching Next code (Next 16, `instant=false` in root layout); cite the doc path in shards.
- Reuse tokens `--cx-*`, `--space-*`, `--cx-text-*`; no hardcoded px/colours (ux-ui-audit-v3 B4/B5/B12/B13). Shared UI from `features/shared/components/ui`.
- Do not rename legacy function names in ported pages (parity rule); change only head/toolbar markup and CSS.
- Forbidden: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`. One commit per package, only when user asks.
- Leaf results under `specs/unified-page-format/results/`.

## Research notes
- `PageShell` (`shared/components/ui/PageShell.tsx`) already renders `.page > header.page-head > (h1.page-title + p.page-purpose) + aside`; `PageHead` in `shell/ui.tsx` wraps it. Not every page uses it (e.g. `queue-page.tsx` uses a custom `aging-page-head` block; overview mixes both).
- CSS: `.page`, `.page-head`, `.page-title`, `.page-purpose` in `app/cx-kit.css` (~1206-1250, 1554-1555) and overrides in `app/refresh.css` (21-45, `.aging-page-head`, `.cx-refresh`); per-feature styles in `app/styles/*.css`.
- Splash: `BootSplash` is a sibling after `<div id="app">` in `app/layout.tsx`, hidden only by `#app:not(:empty)+.boot-splash`. `SiteChrome` wraps the shell in `<Suspense fallback={null}>`, and `AppShell` returns `null` when `!boot`. Hypothesis: a client navigation that re-suspends the root boundary empties `#app`, making the splash reappear. No `loading.tsx` exists anywhere under `src/app`. Verify in a debugger-style leaf before fixing.
- Nav: `AppShell.navigate` uses `router.push` with `pendingHref` state (8 s timeout) - reuse for a nav-pending indicator.
- Existing related specs: `specs/ux-ui-audit-v3` (B12 duplicate headers, A2 toolbar shifts), `specs/ui-shell-polish`, `specs/dabdoob-refresh`.

## Key pointers
- Pages: `src/app/*/page.tsx` → `src/features/*/components/*-page.tsx`
- Shell: `features/shared/components/shell/{AppShell,BootSplash,ui}.tsx`, `layout/SiteChrome.tsx`, `app/layout.tsx`
- UI kit: `features/shared/components/ui/{PageShell,PageStates,Button}.tsx`
- Samples: Home `cx-hub/components/overview-page.tsx`, Queue `cx-queue/components/queue-page.tsx`, Aging `cx-queue/components/aging-page.tsx`

Architect decision: see DECISION.md (Option A: PageShell slots + root loading.tsx + #app[data-booted] splash latch).
