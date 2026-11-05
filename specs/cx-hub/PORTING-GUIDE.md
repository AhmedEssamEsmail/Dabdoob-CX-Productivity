# Porting guide — every module shard follows this

The legacy GAS apps are the spec. **Parity, not improvement**: no redesign, no
simplification, no UX reinterpretation. A visible or behavioural difference is a
defect. When source is missing, the honest output is the legacy "Not built yet."
placeholder (`hs()`), never an invented page.

## Lay of the land

- Repo: `C:\Users\AHMED\KPIs\CX-Hub` (Next.js 16, App Router, `src/`, alias `@/` → `src/`).
- Legacy apps (siblings): `Command_Center_V2_deprecated` (hub), `Quality_deprecated`,
  `Productivity_Depricated`, `Queue_deprecated`, `People_deprecated`,
  `Operations_deprecated`, `Desk_deprecated`, `FCR_deprecated`.
- Decompiled bundles: `.devin/work/extract/<app>/` — `app.pretty.js` (whole bundle),
  `pages/<route>.js` (component only), `pages/<route>.closure.js` (component + all
  transitive deps, the file to port from), `pages.json` (route→symbol+deps),
  `registry.json`, `icons.json`, `app.css`. Regenerate: `node scripts/legacy-extract.mjs`.
- Feature layout: `src/features/{shared,cx-<module>}/{lib,components,jobs}`.
  Domain code lives in `features/cx-<mod>/lib`; routes/pages are thin.

## Server port (GAS .js → TypeScript lib)

- Keep legacy function names verbatim (`dqBuildAging_`, `pwTasksOut_`), trailing
  underscore included. Add a header comment naming the legacy file.
- Everything async at the I/O edge: sheet reads → `readRows`/`readStore`/`db()`
  (`features/shared/platform/{repo,stores}.ts`), config → `getConfig`/`dqSetting`/
  `configAll` (`platform/settings.ts`), cache → `cacheGet/Put` (`repo.ts`),
  locks → job runner (see `shared/jobs/env.ts`, `steps.ts`).
- Pure logic stays pure and verbatim — the oracle tests diff it against the
  legacy function field-for-field.
- Missing table = `[]`, exactly like a missing tab (`readStore().exists`).
  Never invent data or fall back to guesses.
- Roles/auth: `requireRole([...])`, `currentUser()`, `assertWritable()`,
  `pwDirectory()` (`platform/identity.ts`, `viewas.ts`). View-as write refusal
  is enforced in the data layer, not just routes.
- Cross-domain read helpers already ported: queue domain `features/cx-queue/lib`,
  scorecard/work helpers `cx-people/lib/scorecard`, `cx-people/lib/work-core.ts`,
  calendar `platform/calendar.ts`, popups `platform/popups.ts`,
  health/jobs `platform/health.ts`, stores `platform/stores.ts`, repo
  `platform/repo.ts`. **Reuse them; do not re-port.**

## API routes (`src/app/api/<module>/...`)

- Thin: auth gate → call lib → `NextResponse.json`. Look at
  `src/app/api/queue/health/route.ts`, `src/app/api/prod/flags/route.ts` for the
  shape (`fetchJson` on the client, error envelope `{ error }`).
- One route per legacy server call family; the page's `ce` object maps 1:1.

## Page port (bundle component → TSX)

- Port from `pages/<route>.closure.js`. `e("div", props)` → JSX;
  `f(...)`/component calls → `<X .../>`. Keep class names, copy, attribute
  order where readable (`class` stays `class` → `className` in JSX only where
  the existing ported pages do it — **check `src/app/status-validation/page.tsx`
  and `src/app/tph-grid/page.tsx` first; match their established conventions**).
- Shared widgets already exist in `features/shared/components/shell/ui.tsx`
  (PageHead, Section, Chip, LinesSkeleton, LoadError) + per-feature shared parts
  (e.g. `cx-productivity/components/pv-shared.tsx`). Create
  `features/cx-<mod>/components/<mod>-shared.tsx` for module-shared widgets.
- Server calls: legacy `oi("fn")` → a `ce`/`api` object of `fetchJson` calls to
  your API routes (see status-validation page). Data hook = `useSe`-style SWR
  helper in pv-shared or copy that pattern per module.
- Comment the symbol traceability: `/* verbatim port of the legacy Rg page
  (parts X/Y/Z) */` at the top, as existing pages do.
- `hash` links `#/path` are handled by HashShim; in-page links keep `#/path`
  literals exactly as legacy emits them.

## Testing

- **Golden oracle** (`tests/golden/`): `createOracle(FILES)` from
  `scripts/oracle.mjs` loads legacy `.js` verbatim in node:vm; bare filenames
  resolve across all `*_deprecated` dirs. Compare `callLegacy(fn,args,fx)` vs
  your port on fixtures — `expectSame`, `same`, `baseFixtures`,
  `sheetBook`/`openSpreadsheet` helpers in `tests/golden/helpers-oracle.ts`.
  Per-module: define your own `oracle()` with your app's file list (do NOT edit
  the shared `LEGACY_FILES` constant).
- **Unit/API tests**: `tests/api-fragments`, `tests/jobs`, `vitest` (no watch:
  `npx vitest run`).
- Gates before every commit: `npx tsc --noEmit` clean, `npx vitest run` green,
  `npx eslint` 0 errors.

## Forbidden / PM-owned

- Do **not** edit: `features/shared/components/shell/registry.ts` (`BUILT_ROUTES`
  — PM adds routes at review), `src/app/globals.css`, `vercel.json`,
  `specs/cx-hub/TRACKER.md`, `.env*`, `package.json` (no new deps without
  asking), other feature folders, `scripts/oracle.mjs`, `tests/golden/helpers-oracle.ts`.
- No secrets in code/commits. Legacy spreadsheet IDs are reference-only.
- No commit/push — the PM reviews diffs and commits.

## Report back (required)

1. What shipped (files, routes, functions) per sub-task.
2. What is stubbed and why (missing table, Google-dependent → flag for BLOCKED_TASKS).
3. Oracle/test coverage added; gate results (tsc/vitest/eslint).
4. Questions/blockers for the PM.
