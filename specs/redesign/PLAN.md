# PLAN: redesign
Status: done (UI redesign; see final-verification.md for limits)   Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Replace the ported GAS look with a new design language across the whole app — tokens, every component class, every control, every page, both themes. Direction (CTO-chosen): **refined neutral** ops console (clean surfaces, hairline borders, one restrained accent, tight type hierarchy, no gradient wash), **denser** than today, eco3 map restyled to match. Dark mode + RTL + reduced-motion + touch targets stay intact.

## Success criteria
1. One authored design layer replaces the generated sheets for shared classes: new `src/app/theme.css` (or equivalent) defines the full token layer — neutral palette, one accent, type scale, radii, shadows, spacing, motion, status colors — for `light` AND `dark` (`html[data-theme]` + `prefers-color-scheme`) — plus every shared component class (`cx-*` contract reskinned in place). The 93KB verbatim legacy sheet is retired as the shared-token source; page-layout families (`md-`,`dq-`,`pv-`,`tph-`,`qa-`,`tlq-`) are migrated to the new tokens.
2. A real component library exists at `src/features/shared/components/ui/`: `Button` (primary/quiet/danger/small/icon), `Input`, `Select`, `Textarea`, `Field`, `Card`, `Section`, `Chip`/`StatusChip`, `Note`, `Seg`, `Toggle`, `Tabs`, `Table` primitives, `Modal`, `Toast`, `Skeleton`, `Empty` — documented in `docs/UI-SYSTEM.md` with a gallery state for each.
3. Raw controls eliminated: `grep -rn "<button" src --include="*.tsx"` outside `components/ui/` → 0 (or each survivor carries an eslint-waiver comment with reason); same audit for raw `<input|select|textarea>` outside Field/ui.
4. All ~40 routes render the new language; `shoot-new.mjs` captures every page in light+dark (+mobile for the 6 responsive-critical pages) under `.devin/work/shots/redesign/` — QA/UX review these.
5. Density contract: data-table rows ≤ 2.25rem, base data font ~0.8125rem, `--cx-target` 2.25rem on fine pointers and ≥ 2.75rem on coarse pointers — verified by computed-style checks in the shot harness.
6. One geometry: every button = `min-height: var(--cx-target)`, `border-radius: var(--cx-radius-control)`, 1px border, variant colors from tokens only — no hex literals in component code, no hardcoded font sizes outside the scale.
7. A11y: `focus-visible` ring on every interactive element, AA contrast (4.5:1 text, 3:1 UI) on chips/buttons/inputs in both themes, `prefers-reduced-motion` honored, RTL spot-check on 3 pages.
8. Gates green: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npx next build`, `npm run test:e2e` (auth, my-status, status-validation, responsive specs must still pass — DOM contract for tested elements preserved).
9. UX gate PASS plus QA PASS on all criteria.

## Scope / Non-goals
In: tokens, all shared component classes, the cx-*/md-*/dq-*/pv-*/tph-*/qa-*/tlq-*/pv-*/eco3- visual language, shell chrome (rail nav, topbar, ViewAs, BootSplash, toasts/popups, page heads, dividers), React ui/ library + site-wide codemod, density pass on every table/grid, dark+light themes, RTL.
Out: functional/API/data changes, new pages or routes, performance work (separate task), golden-test data behavior, legacy GAS app changes, `package.json` dependencies (no new UI libs without approval — none expected; pure CSS + React).

## Risk flags
db: n · auth: n (login page is restyled, auth logic untouched) · ui: y · external-api: n
Gates: QA (always) · Security: skip (visual/markup changes only; no authz, input handling, or API surface changes) · UX/UI: run

## Gates (commands, run from project root)
typecheck: `npx tsc --noEmit` · lint: `npx eslint .` · unit: `npx vitest run` · build: `npx next build` · e2e: `npm run test:e2e` · shots: `node .devin/work/shoot-new.mjs` (visual verification) · security: `npm run test:security` (regression sanity — DOM changes must not break it)

## Conventions (distilled from .devin/workflow.md)
- Forbidden: `package.json`/lockfile (no new deps), `.env*`, `cx-kpis-*.json`; Supabase migrations are out of scope entirely.
- Work dir `specs/redesign/`; reports in `specs/redesign/reports/`.
- Next.js 16 differs from training — read `node_modules/next/dist/docs/` before touching Next plumbing (CSS import, fonts); cite doc paths in shards.
- Parity rule relaxed for this task: the goal IS visual change. Preserve only *behaviour* — DOM hooks used by e2e/golden tests (roles, aria, data-app, test ids), route handlers, function names.
- `.devin/work/` is the shot harness (gitignored); generated CSS headers ("do not hand-edit") — the new authored layer is our own file, not an edit of the generated sheets.
- No commits — user will ask.

## Research notes
- `globals.css` (93KB/8 min lines) is the verbatim legacy sheet — tokens (`--paper/--surface/--ink/--line/--pine-2/--age-*/--radius-*/--target/--text-*`) + every shared class; header says regenerate from `.devin/work/legacy.css`. New authored layer supersedes it for shared tokens/classes.
- `legacy-apps.css` (generated, per-app `[data-app=*]` scopes) contains page-layout families to migrate, not delete blindly.
- Class inventory (live markup): `cx-btn` 118 + raw `<button>` 345, `cx-panel` 107, `cx-table/tablewrap` 65, `cx-input` 54, `cx-field` 57, `cx-chip` 20, `cx-seg` 17, `cx-toggle` 14; families: `md-*` (hub), `dq-*` (quality/queue), `pv-*`/`tph-*` (productivity), `qa-*`, `tlq-*`, `eco3-*`.
- Existing primitives to grow into the library: `src/features/shared/components/shell/ui.tsx` (Skeleton, Section, Chip, PageHead, LoadError).
- Shot harness: `.devin/work/shoot-new.mjs` + `shots/{legacy,new}/` with dom/styles captures — reuse for redesign verification; `rail-crop` precedent exists.
- `vercel.json` crons + `e2e/` specs enumerate the user-visible surface.
- Fonts already loaded: IBM Plex Sans + IBM Plex Sans Arabic (`--cx-font-ar`) — keep the family, modernize the scale/weights.

## Key pointers
- `src/app/globals.css:1-8` — verbatim legacy sheet to supersede.
- `src/app/legacy-apps.css` — generated app-scoped rules (migrate page families).
- `src/features/shared/components/shell/ui.tsx` — seed primitives.
- `src/features/shared/components/shell/AppShell.tsx`, `SiteChrome.tsx` — chrome to restyle (rail, topbar, ViewAs).
- `specs/redesign/` — this task's spec home.
- `.devin/work/shoot-new.mjs` — page-capture harness for visual verification.

## Final Verification
Latest authoritative record: `reports/final-verification.md`.
The notes below describe the earlier accent-only checkpoint and are superseded
by the final Docker-backed run: 85/85 E2E, 96/96 style cases, all local gates
pass, remaining LOWs closed. User approved committing/pushing a new branch.

- User approved one extra contrast sweep/review after UX round 3.
- Added semantic `--cx-accent-text` and centralized all seven accented text rules;
  primary fills/ink and non-text icon/border colors remain separate.
- Final scoped UX/QA PASS: `reports/ux-4.md`, `reports/qa-3.md`.
  Fix evidence, reproduced failure and real-browser measurements: `reports/accent-sweep.md`.
- Persistent local gate: `npx playwright test --config=tests/ui/playwright.config.ts`
  (90 cases across Chromium/Firefox/WebKit; no server, credentials or remote writes).
- Local typecheck/lint/unit/security/build pass. The live authenticated E2E
  suite and all-page screenshot harness were not rerun this round. The
  harness resets remote users and upserts roster rows; use an explicitly
  approved test project for a fresh pre-release run.
- Deferred LOWs remain tracked; local delta verification is not a claim of
  full-site WCAG conformance or all-engine live E2E success.

## Research addendum (spec-sharding pass)
- `shoot-new.mjs` (+`lib-shots.mjs`, `legacy-fixtures.mjs`) live in `KPIs\_archive\devin-work\`, not `.devin/work\` — S02 restores+adapts them (env path, playwright require, all-40-route list, `shots/redesign/`).
- `legacy-apps.css` re-declares the shared `cx-*`/rail/nav classes AND tokens per `[data-app]` — authored reskin rules need ≥(0,2,0) specificity (`:root .cls`) + later import order to win; `pv-*`/`tph-*` live unscoped in `globals.css`; `dq-head` is shared (PageHead), `tlq-*` does not exist, `fcr` page is unbuilt.
- Appearance UI offers 4 accents (`data-accent`) + `data-reduce-transparency`/`data-reduce-motion` — token layer must keep all working; e2e DOM hooks: `.pv-*`,`.cx-*`,`#nav`,`.toast`,`.cx-table`,`input[name/type]`,`button[type=submit]`,`radiogroup`, 'Menu' button.
