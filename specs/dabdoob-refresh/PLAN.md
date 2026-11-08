# PLAN: dabdoob-refresh
Type: feature   Status: draft
Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Two-part change, already decided by the user — the mockups in `mockups/` are the
visual contract ("exactly like the mockup"), no open architecture decision:
1. **Rebrand**: every user-facing "CX Helm" / "CX Productivity" string becomes
   "Dabdoob CX" (rail, login, boot splash, document titles, `APPS` titles,
   email/notification templates and signatures). Code identifiers, `server:`
   legacy file names, docs, specs and `_archive` stay untouched.
2. **UI refresh**: apply the mockup design language to the real design system —
   shell rail (no list bullets, stable brand + "Operations console" sub, ⌘K
   search box, avatar user card, toasts off the rail), token/component reskin
   (warmer bg, card elevation, stat+delta chips, pills, worklist items,
   master–detail, agenda timeline, designed empty states), a real ⌘K page
   switcher, and page-level restructures on all major pages using the 10
   mockups as reference. BOTH light and dark themes.

## Success criteria
1. `grep -rn "CX Helm" src/` → 0 hits outside comments; `grep -rn "CX
   Productivity" src/` → hits only inside the APPS title "Dabdoob CX
   Productivity" (which contains the substring by design);
   `Dabdoob CX` appears in rail brand, login, `layout.tsx` title, `BootSplash`,
   `APPS` titles, mail sender name and email footers. Arabic `D()` variants
   updated where they existed.
2. `/auth/login` renders the mockup card design (brand mark, "Dabdoob CX",
   forgot-password row, footer strip) in light AND dark.
3. Rail: zero list bullets; "Dabdoob CX" brand never mutates per section;
   search box opens a working ⌘K/Ctrl+K palette (fuzzy filter of role-gated
   `PAGES`, arrow/Enter/Esc keyboard nav); toasts no longer overlap the rail.
4. Kit/tokens: stat cards with tone strips + delta chips, pill statuses,
   compact tables, mixbar/bar/spark viz, empty states — verifiable via the
   shot harness; density contract (`--cx-target` 36px fine / 44px coarse,
   row ≤36px, td ≈13px) still passes.
5. The 10 mockup pages (login, home/overview, my-day, queue, aging,
   audit-queue, status-validation, agents, tph, my-status) match their mockups
   within real data wiring; remaining pages receive the same patterns (page
   head + cards + pills/empty states) — none keep prose-wall descriptions.
6. All gates green: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`,
   `npm run test:e2e` (e2e updated for new strings/markup), harness re-shoot
   shows no readySel/pageerror failures.

## Scope / Non-goals
In: `src/app/*css`, `theme.css`, `cx-kit.css`, `src/app/styles/*`, shell
components (`AppShell`, `BootSplash`, `Popups`, `ViewAs`), `ui/` components,
page components across all feature areas, `registry.ts` `APPS` titles (banner
says do-not-hand-edit — rebrand overrides; edit titles only, not structure),
i18n dictionaries, email/notification templates, e2e specs asserting old
strings/markup, `mockups/` left as the reference.
Out: new npm deps (icons stay inline SVG — `NavIcon`/`NAV_ICONS`), font change
(keep IBM Plex Sans + Arabic), API/DB/data changes, dark accent redesign
beyond token mapping, docs/_archive/playwright-report/test-results rebrand,
functional changes to workflows (validation logic, scoring, cron).

## Risk flags (y/n)
arch n (decision = mockups) · db n · data n · auth n (login is visual only) ·
external-api n · ui Y · perf n · deps n · tests Y (e2e string/markup updates)
· docs n · deploy n
Review gates: QA always · Security: skip (no authz/RLS/user-input changes —
strings and CSS only; login posts to the same endpoint) · Data: skip ·
Performance: skip (CSS/markup only; flag re-evaluated if bundles grow) ·
UX/UI: run

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`
shots: `node .devin/work/shoot-new.mjs` (dev server must run; writes
`.devin/work/shots/redesign/` — reuse for before/after UX evidence)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden for agents: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/`
  before writing Next code; cite doc paths in shards.
- Accent/text contrast: separate fill vs text tokens; verify theme×accent
  pairings in real browsers, not per-selector fixes (project lesson).
- `src/features/shared/platform/options.ts` contains NUL bytes — git treats it
  binary; string edits still apply normally.
- Shell DOM/class names are a legacy-parity contract ("DOM … match the legacy
  bundle 1:1", AppShell comment) — refresh may CHANGE markup deliberately;
  prefer additive classes/new nodes, keep ids and aria hooks e2e uses
  (`#nav`, `.nav-link`, `.rail-*`, `aria-current`, `state-screen` on states).
- Mockups use static HTML; production must keep `D()` i18n + role gating
  (`pageAllowed`, `inApp`, `groupEntryLink`) and boot-driven badge data only
  where cheap — else omit counts.
- Verify `git diff HEAD` for foreign in-flight edits before staging.

## Research notes
- Mockup CSS contract: `mockups/assets/mock.css` — tokens (--bg #f2f5f7,
  --accent #0e7a5f/#0a5f4a, radii 6/10/14, shadows), `.shell/.rail/.nav-*`,
  `.stat[data-tone]`, `.pill`, `.tbl`, `.mixbar`, `.workitem`, `.ag-item`
  timeline, `.md` master–detail, `.login-*`, `.toast` bottom-right.
- Current tokens/components: `src/app/theme.css` (:root + dark + accents,
  density contract), `src/app/cx-kit.css` (:root .cls overrides at (0,2,0),
  `.state-screen` ~1115), `src/app/globals.css`, per-area `styles/*.css`.
- Shell: `src/features/shared/components/shell/AppShell.tsx` — rail-head/brand
  (L358-376), nav groups + bullets from `.nav ul/li` (L377-462), rail-foot
  who/collapse (L463-494); titles via `appTitle(ctxApp)` → `APPS` in
  `registry.ts` (L506); bullets = `list-style` never reset on `.nav ul`.
- Rebrand hits (~25 files): layout.tsx L8-9, login/page.tsx L47+L82,
  BootSplash L61-65, registry APPS L506, admin-page L203-210, ecosystem-page
  L2659, mail.ts L206 (`name: 'CX Helm'`), notify.ts L107, maildesk.ts L267,
  myday.ts L752, meetings.ts L497, one-on-one-reminders.ts L136,
  one-on-ones-page.ts L1104, reminders.ts L133/157/255/295/317,
  tasks.ts L327/635, jobs.ts L283.
- e2e specs asserting strings/markup: `e2e/*.spec.ts` (auth, my-status,
  responsive, status-validation) + `tests/` vitest UI tests.
- Palette: no existing component — new `shell/CommandPalette.tsx`; must use
  `PAGES`+`pageAllowed`/`inApp`+`D()`+`pageHref`+`navigate` (view transitions).

## Key pointers
- `mockups/pages/*.html` — per-page reference (01 login … 10 my-status)
- `src/features/shared/components/shell/AppShell.tsx:358-494` — rail DOM to reskin
- `src/features/shared/components/shell/registry.ts:506` — `APPS` titles → "Dabdoob CX*"
- `src/app/cx-kit.css:1115-1127` — `.state-screen` login block to replace
- `.devin/work/shots/redesign/` — before-screenshots + contract-report.json
