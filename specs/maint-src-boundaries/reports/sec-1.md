# sec report - maint-src-boundaries - round 1 (FULL)
Verdict: PASS
Open: 0/0/0/1

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| sec-1 | LOW | vitest.config.mjs:8, scripts/tsconfig.json:4 | `server-only` is aliased to an empty stub in vitest/tsx, so a future client-boundary regression would pass unit tests and scripts silently; only `next build` catches it. | Keep `npx next build` as a mandatory gate (already is); optionally add a CI lint asserting no `'use client'` file transitively imports `shared/{lib,platform,jobs,vendor,migration}`. | dev |

## What was reviewed
- `src/app/api/qa/[action]/route.ts:16-47` — diff is cast-only (`as never` → `Record<string,unknown>`/`Parameters<>`); handler table, arg parsing (POST body `{args}`/bare-array/malformed→`[]`, GET `?args=`/`?argN=`), 404, and `apiError` mapping unchanged. Authz remains inside `cx-quality/lib/server.ts` (`requireRole`/`requireJobCaller`, server.ts:18,75) — unchanged.
- `import 'server-only'` added to 78 server modules incl. `shared/lib/{auth,supabase,admin-auth,api-error}.ts` and `shared/{platform,jobs,vendor,migration}/**` — hardening: modules reading server env (supabase.ts:4-5) and identity/view-as can no longer be bundled client-side. Probe evidence in tl-3 (build rejected a client import; probe reverted). No client-reachable module was marked (`build` PASS; `prod-validation.ts`, `adapters.ts`, `errors.ts`, `heatmap-engine.ts` excluded).
- `shared/lib/fetch-json.ts` — verbatim move of the pv-shared `fetchJson` (RequestInit/no-store/error-envelope variant); unmarked is correct (client-safe pure fetch, no secrets). 5 consumers re-pointed; no re-export shim.
- `grid-slots.ts` → `cx-productivity/lib/tph/` — pure derivation move; prod consumer + test re-pointed; no logic change.
- Page moves: `admin/{config,roster}`, `tph-grid`, `status-validation`, `my-status`, `productivity-analytics` → feature components keep `'use client'`; routes thin; `/tph` re-export intact; no page-level auth existed before or after (API routes enforce).
- Tests: `auth.test.ts`, `tests/security/security.spec.ts`, `src/app/api/__tests__/integration.test.ts` now exercise real `createAuthClient`/`requireAuth`/`getViewAsUser`/`requireRole`/`assertWritable`/dispatcher with mocked seams — improved authz coverage (401/403/VIEW_AS_READONLY paths). Placeholder env values only; no secrets.
- `eslint.config.mjs:23-45` — `no-restricted-imports` blocks `@/features/cx-*` inside `shared/**` with a two-file composition exemption (env.ts, mirrors.ts); lints clean.

## Not verified / assumptions
- QA dispatcher GET can invoke mutating actions via query string, and `apiError` echoes `err.message` to clients — pre-existing legacy-parity design, unchanged by this diff (out of scope).
- e2e suite not run (needs seeded live env); reliance on tsc/vitest/eslint/build + new real tests.
- `docs/`, CSS, and `specs/redesign/` changes in the tree belong to other tasks — reviewed only where they intersect this diff (no security impact found).
