# S03: server-only boundary marking
Kind: package
ID: S03
Dispatch: NEVER

## Goal and contract
Every verified server-exclusive module carries `import 'server-only'` as its
first statement: `shared/platform/**`, `shared/jobs/**`, `shared/vendor/**`,
`shared/migration/**`, `shared/lib/{auth,supabase,admin-auth,api-error}.ts`, and
all feature `lib`/`jobs` modules that are not client-reachable.

Marked set = 89 files (listed in child leaves). Exclusions — client-reachable,
must stay UNMARKED: `cx-productivity/lib/prod-validation.ts` (pv-shared + moved
pages), `cx-queue/lib/heatmap-engine.ts` (`heatmap-page.tsx` imports it via
`../lib/heatmap-engine`), `shared/lib/{adapters,errors,fragments}.ts` (per PLAN),
all `*.test.ts`. `shared/lib/fetch-json.ts` (new, S01) is client code — unmarked.

Support: `src/types/server-only.d.ts` ambient decl (tsc), `tests/stubs/server-only.ts`
+ `vitest.config.mjs` alias (vitest), `scripts/tsconfig.json` (tsx paths shim —
the only src-reaching tsx script is `scripts/ops/probe-flags.ts`; `migration/*`
is self-contained). No npm install: Next maps `server-only` internally
(`node_modules/next/dist/compiled/server-only/`). Root tsconfig `paths` must NOT
map `server-only` (Next's `/^server-only$/` test must see the raw request).

## Children
Index: `S03/00-index.md`
- #3 -> S03-01 (foundation), S03-02..31 (marking, 3 files each), S03-32 (tsx shim), S03-33 (client probe)

## Completion
`tsc`, `vitest run`, tsx eval all resolve; `next build` green; throwaway client
probe proved the marker errors client-side, then reverted.
