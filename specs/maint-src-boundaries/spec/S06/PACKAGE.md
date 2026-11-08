# S06: fixture-only suites replaced with real tests
Kind: package
ID: S06
Dispatch: NEVER

## Goal and contract
Three suites that assert on local literals only are replaced with tests that
exercise real production code behind mocked seams — same pattern as
`tests/jobs/routes.test.ts` (vi.mock the seams, import the real module).
- `shared/lib/auth.test.ts`: real `createAuthClient`/`getUser`/`requireAuth`/
  `getViewAsUser` with mocked `@supabase/ssr`, `next/headers`, `./supabase`.
- `src/app/api/__tests__/integration.test.ts`: rewritten in place as a real QA
  dispatcher route test (`npm run test:integration` keeps working — dir kept).
- `tests/security/security.spec.ts`: real authz — `requireRole` denial -> 403 via
  `apiError`, view-as write refusal -> 403, `Unauthorized` -> 401 — with mocked
  auth/repo/settings seams and the real `viewAsResetCaches` hook.

## Children
Index: `S06/00-index.md`
- #6 -> S06-01 (auth.test.ts), S06-02 (QA dispatcher), S06-03 (security.spec)

## Completion
All three files import production code; `npx vitest run` green on each.
