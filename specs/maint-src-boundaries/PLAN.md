# PLAN: maint-src-boundaries
Type: maintenance   Status: draft
Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Address the seven validated maintainability concerns in `src/` — misplaced shared helpers, inverted shared→feature dependencies, missing server/client boundary protection, unsafe QA dispatcher typing, thick route pages, fixture-only tests — and document the resulting boundaries. Targeted cleanup only: preserve behavior, URLs, authorization, response shapes, legacy presentation, and golden-oracle parity.

## Success criteria
1. `fetchJson` (the `RequestInit`/`no-store`/`{error}`-envelope variant) lives in one framework-independent shared module; all cross-feature consumers (cx-desk ×4, cx-operations ×1) import it from there; `pv-shared.tsx` no longer exports it. Request, caching, and error behavior byte-identical.
2. `grid-slots.ts` lives inside `cx-productivity` (its only production consumer, `cx-productivity/jobs/backfill.ts`, plus `tests/jobs/grid-slots.test.ts` updated); exported names unchanged. `env.ts`/`mirrors.ts` stay in `shared/jobs` with the composition-layer dependency direction documented.
3. `import 'server-only'` marks the server-exclusive modules (verified non-client-reachable): `shared/platform/**`, `shared/jobs/**`, `shared/vendor/**`, `shared/migration/**`, `shared/lib/{auth,supabase,admin-auth,api-error}.ts`, feature `lib`/`jobs` modules confirmed server-only (e.g. `cx-quality/lib/server.ts`). `tsc`, `vitest run`, and `tsx` scripts all still resolve (`server-only.d.ts` decl, vitest alias stub, scripts tsconfig/paths shim or documented flag workaround). `next build` passes; a throwaway client-component probe proves the marker still errors client-side (then reverted).
4. `src/app/api/qa/[action]/route.ts` has zero `as never` casts: object params typed `Record<string, unknown>` (server fns take `input: Row`), special params typed via `Parameters<>`; URLs, methods, args parsing, and authz unchanged. Client `P` payload params in `qa-shared.tsx` typed `Record<string, unknown>` where justified.
5. `src/app/{tph-grid,status-validation,my-status,productivity-analytics}/page.tsx` are thin routes over `cx-productivity/components/{tph-grid,status-validation,my-status,productivity-analytics}-page.tsx`; `src/app/admin/{config,roster}/page.tsx` thin over `cx-hub/components/admin-{config,roster}-page.tsx`. `/tph` re-export keeps working; `'use client'` on components, CSS imports stay in routes in original order.
6. Fixture-only suites replaced: `shared/lib/auth.test.ts` exercises real `createAuthClient`/`getUser`/`requireAuth`/`getViewAsUser` with mocked `@supabase/ssr`/`next/headers`/`./supabase`; `src/app/api/__tests__/` holds a real QA-dispatcher route test (allowed action + positional args, unknown→404, malformed body→`args=[]`, thrown error→`apiError` status map, GET `?args=`/`?argN=` parsing); `tests/security/security.spec.ts` exercises real authz (requireRole denial→403 via `apiError`, view-as write refusal, Unauthorized→401). `npm run test:integration` still runs (dir kept).
7. `docs/ARCHITECTURE.md` documents actual ownership + permitted directions; an eslint `no-restricted-imports` override guards `src/features/shared/**` against new `@/features/cx-*` imports except the two sanctioned composition files — only if it lints clean against current code.

## Scope / Non-goals
In: the seven items above, `docs/{ARCHITECTURE,TESTING}.md` touch-ups, `vitest.config.mjs` alias, `scripts/` tsconfig shim if needed.
Out: unifying the four different `fetchJson` variants (different signatures/errors — intentional); moving `env.ts`/`mirrors.ts` (intentional composition layer); moving pure engine helpers out of cx-productivity (domain logic, breaks golden-test import paths); barrels/index.ts; dependency installs (`server-only` npm pkg — Next handles it internally and its `default` export throws under plain node, so it would break vitest/tsx anyway); CSS moves; registry catch-all; commits/deploys/remote DB.

## Concern revalidation (evidence → verdict)
1. fetchJson: CONFIRMED. 4 variants exist w/ different contracts: `pv-shared.tsx:60` (RequestInit), `hub-shared.tsx:69` (RequestInit but `String(r.status)` error text), `cx-queue/shared.tsx:87` (body-POST + FetchError), `qa-shared.tsx:50` (always-POST + `j.error` on 200). Only pv-shared's is imported cross-feature (cx-desk kb-tracker/kpi-logs/mail-desk/tl-performance, cx-operations trackers-page). Move verbatim; do NOT merge variants.
2. Ownership: CONFIRMED for grid-slots (shared location, single prod consumer). env.ts/mirrors.ts = INTENTIONAL: `shared/jobs` is the composition layer wiring pure engines (`prodToday_`, `tphClock_`, `tphBuild*`) to storage/mail; moving them forces worse cross-feature imports. NO file-level runtime cycles (cx-productivity/lib never imports shared/jobs) — only reciprocal folder-level deps. `shared/migration/mappings/queue-quality.ts` cx-quality hit is a comment, not an import.
3. Server-only: CONFIRMED absent, NO active leak — zero `import 'server-only'` today; no `'use client'` file imports `shared/lib|platform|jobs|vendor|migration`. Client-reachable libs to EXCLUDE: `cx-productivity/lib/prod-validation.ts` (via pv-shared + moved pages), `shared/lib/adapters.ts`, `shared/lib/errors.ts` (pure rules). `next/dist/docs/01-app/02-guides/data-security.md:245` — Next handles `server-only` internally (webpack alias `node_modules/next/dist/build/webpack-config.js:1117-1171`); no npm install.
4. QA typing: CONFIRMED. `route.ts` uses `(a[0] || {}) as never` ×12; server fns take `input: Row` (`server.ts` local `type Row = Record<string, unknown>`) or plain strings/`unknown`. Client `P` uses `(t: any)` — call sites pass object literals, compatible with `Record<string, unknown>`.
5. Thin routes: CONFIRMED. Thick client pages: tph-grid 1998, status-validation 487, productivity-analytics 290, admin/roster 284, my-status 226, admin/config 138 lines vs 7-line convention (`queue/page.tsx`). `tph/page.tsx` does `export { default } from '../tph-grid/page'` — preserve. `admin/*` are non-registry standalone pages; owning feature = cx-hub.
6. Tests: CONFIRMED. `shared/lib/auth.test.ts` (81 lines) and `src/app/api/__tests__/integration.test.ts` (431 lines) import ZERO production code — assert on local literals only. `tests/security/security.spec.ts` same anti-pattern (local literals, no imports). Model to copy: `tests/jobs/routes.test.ts` (real route handlers + mocked seams).
7. Docs/rules: ARCHITECTURE.md lacks the dependency-direction section; eslint has no boundary rules. Document first; add the narrow `no-restricted-imports` override only because it guards the demonstrated `shared→cx-*` regression class.

## Risk flags (y/n)
arch n (prescriptive bounded cleanup; design settled below) · db n · data n · auth y · external-api n · ui n (mechanical moves; rendered DOM unchanged — UX gate skipped) · perf n · deps n (no manifest edits) · tests y · docs y · deploy n
Review gates: QA (always) · Security: run (authz-adjacent changes: dispatcher, view-as/auth tests, server-only boundary) · Data: skip · Performance: skip · UX/UI: skip (no visual change; moves verified by build + existing e2e spec presence)
Budgets: n/a

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e` (needs seeded live env — DO NOT run without approval; report as not-run)  security: `npm run test:security`  build: `npx next build` (env-vars caveat — lessons; run and report)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- Forbidden for agents: `package.json`/lockfile, `.env*`, `cx-kpis-*.json`, `shared/components/shell/registry.ts` (PM-owned), `src/app/globals.css`, `vercel.json`, `tests/golden/helpers-oracle.ts`, `scripts/oracle.mjs`.
- Next 16: read `node_modules/next/dist/docs/` before framework changes (server-only: `02-guides/data-security.md`; components: `01-getting-started/05-server-and-client-components.md`).
- Legacy parity: keep ported names incl. trailing `_`; verbatim presentation (`specs/cx-hub/PORTING-GUIDE.md`); thin routes = auth→lib→JSON (`api/queue/health/route.ts` shape).
- Module-scope code must not call env-var-dependent APIs at import (Vercel preview builds lack env).
- Supabase MCP targets live remote — migrations/queries need user approval; none needed here.

## Design notes (settled by PM; spec-architect sharding only)
- fetchJson target: `src/features/shared/lib/fetch-json.ts` (framework-independent, unmarked). Consumers updated in place; pv-shared drops the export (no re-export shim).
- grid-slots target: `src/features/cx-productivity/lib/tph/grid-slots.ts` (pure derivation beside the tph engine it uses).
- server-only support files: `src/types/server-only.d.ts` (`declare module 'server-only';`), `tests/stubs/server-only.ts` (empty), `vitest.config.mjs` `resolve.alias` entry, `scripts/tsconfig.json` (extends root, re-declares `"@/*": ["../src/*"]` + `"server-only"` → local empty stub) IF tsx resolves per-file tsconfig — else document `tsx --tsconfig scripts/tsconfig.json`; if neither works, shrink the marked set to modules outside the scripts' transitive graph and document.
- Dispatcher: `as never` → `as Record<string, unknown>` (or `Parameters<typeof qa.fn>[0]` where the signature differs); keep `HANDLERS`, `run`, both exports' parsing.
- Page moves are cut-paste + `'use client'` + `import '@/app/styles/*.css'` staying in the route file; component keeps `export default` or named `<X>Page` per the module's convention; `/tph` re-export unchanged.
- tsconfig `paths` must NOT map `server-only` in the ROOT tsconfig — Next's webpack test (`/^server-only$/`) + compiled-alias mechanism must see the raw request to keep client-boundary enforcement.

## Key pointers
- `src/features/cx-productivity/components/pv-shared.tsx:58-65` — fetchJson to extract
- `src/features/shared/jobs/{env.ts:41-49,mirrors.ts:22-23,grid-slots.ts:22-23}` — composition-layer imports; `grid-slots.ts` whole file to move
- `src/app/api/qa/[action]/route.ts:11-53` — `as never` casts; `src/features/cx-quality/components/qa-shared.tsx:50-63,68+` — client seam
- `src/app/{tph-grid,status-validation,my-status,productivity-analytics}/page.tsx`, `src/app/admin/{config,roster}/page.tsx` — pages to relocate
- `src/features/shared/lib/auth.test.ts`, `src/app/api/__tests__/integration.test.ts`, `tests/security/security.spec.ts` — fixture-only suites; `tests/jobs/routes.test.ts` — model to copy
- `docs/ARCHITECTURE.md`, `eslint.config.mjs`, `vitest.config.mjs`, `tsconfig.json` — boundaries, rules, shims

## Spec-architect research addendum (2026-11-08, verified locally)
- `cx-queue/lib/heatmap-engine.ts` IS client-reachable (`heatmap-page.tsx` imports `../lib/heatmap-engine`) — excluded from the marked set alongside `prod-validation.ts`. Marked set = 89 files → 30 three-file marking leaves (S03-02..31).
- `node_modules/server-only` absent (Next vendors `next/dist/compiled/server-only`): vitest alias + `declare module` + tsx paths shim all required. Only `scripts/ops/probe-flags.ts` reaches marked modules under tsx; `migration/*.ts` is self-contained (no `@/` imports).
- `eslint.config.mjs` guard lints clean only after the grid-slots move: afterwards exactly two `@/features/cx-*` imports remain inside `shared/` (`jobs/env.ts`, `jobs/mirrors.ts`) — the sanctioned composition files.
