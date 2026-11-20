# PLAN: nav-scroll-top
Type: bugfix   Status: done
Date: 2026-11-20   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Symptom: opening pages from the nav bar lands the viewport ~halfway down the page instead of at the top — happens on most routes.
Expected: every nav-bar (in-app route) navigation lands at scrollY = 0, unless the URL carries an explicit in-page hash anchor.
Repro hints: open a long page (e.g. /overview or /agents), scroll down, click a different nav-rail link — the destination renders scrolled partway, matching or near the prior scroll depth. Check ALL routes reachable from the nav rail, not just one.
Affected area: shared shell (AppShell/SiteChrome), route-change scroll handling, page-mount scrollIntoView/focus calls.

## Success criteria
1. Navigating via the nav bar to ANY registry route lands at the top of the page (window scrollY === 0 after paint), verified in a real browser at desktop and mobile widths on a representative set spanning each feature area (hub, people, quality, queue, operations, productivity) — spot-check >=6 routes plus every rail entry enumerated.
2. No regression: in-page anchor links (e.g. #up-next jump, tabs, dialog focus) still work; deep links with a hash still land on their anchor.
3. `npx tsc --noEmit` and `npx eslint <changed files>` pass.

## Scope / Non-goals
In: scroll restoration on client-side route change; mount-time scroll/focus side effects that pull the viewport down; one shared fix if a single root cause exists.
Out: redesign of nav, scroll-inside-panel behaviour (sticky sidebars/dialogs are fine), browser back/forward scroll restoration semantics beyond making top-on-nav correct.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui y · perf n · deps n · tests n · docs n · deploy n
Review gates: QA (always) · Security: skip (no auth/input/db) · Data: skip · Performance: skip · UX/UI: run (ui flag)

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  build: `npx next build`

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Next.js 16 differs from training data — check `node_modules/next/dist/docs/` for scroll/navigation APIs before writing router code.
- Forbidden: package.json/lockfile, `.env*`, `cx-kpis-*.json`.
- Leaf results under `specs/nav-scroll-top/results/`, never repo-root `results/`.
- Working tree holds foreign in-flight edits (M src/features/cx-quality/lib/engine-live.ts, untracked results/ + specs/ + tests files) — do NOT touch or stage them.
- `> nul` creates a literal `nul` file under Git Bash — use `> /dev/null`.
- Playwright is not a repo dep; e2e uses repo config `npm run test:e2e` — for quick manual scroll checks a sibling project's playwright may exist (~/WFM/node_modules).

## Research notes
- App Router navigations scroll to top by default unless `scroll: false`; a mounted scrollIntoView/focus or an anchor-matching element id can pull the viewport after navigation.

## Key pointers
- src/features/shared/components/shell/AppShell.tsx:122-140,507-714 - shell, `#main` (tabIndex=-1), nav rail, focus() calls at :263-264
- src/features/shared/components/layout/SiteChrome.tsx:29-49 - alternate chrome, `#main`
- src/features/shared/lib/use-search-param-state.ts:7-35 - `router.push(url, { scroll: false })` on param change — could pin scroll during/after nav
- src/features/shared/components/shell/HashShim.tsx - hash-route rewriting on mount
- src/features/cx-hub/components/hub-shared.tsx:60-73 - Om(): scrollIntoView({block:'center'}) on #up-next
- src/features/cx-quality/components/audit-queue-page.tsx:129-131,318-320 - mount-time scrollIntoView/focus
- src/app/cx-kit.css:1208 - `.main` padding/context (window-level scroll, no inner scroller)
