# S06-01: auth.test.ts exercises the real auth helpers
Kind: mini
ID: S06-01
Parent: S06
Owner: test-engineer
Depends: S03-01
Criteria: PLAN #6
Skills: none
Budget: files=1; actions=2; changed_lines=140; minutes=10

## Goal
Rewrite `src/features/shared/lib/auth.test.ts` (81 lines of literal assertions)
to test the real `createAuthClient`/`getUser`/`requireAuth`/`getViewAsUser` with
mocked `@supabase/ssr`, `next/headers`, and `@/features/shared/lib/supabase`.

## Files
- Edit: `src/features/shared/lib/auth.test.ts` | full rewrite in place

## Context
- `src/features/shared/lib/auth.ts:5-65` | the real module under test (createAuthClient cookie adapter, getUser, requireAuth 'Unauthorized', getViewAsUser view_as query, requireRole re-export)
- `tests/jobs/routes.test.ts:8-17` | vi.hoisted + vi.mock seam pattern to copy
- `vitest.config.mjs` | env provides NEXT_PUBLIC_SUPABASE_URL/SUPABASE_ANON_KEY already

## Contract
`vi.mock('next/headers', ...)` -> `cookies()` returns `{ getAll: () => [], set: vi.fn() }`.
`vi.mock('@supabase/ssr', ...)` -> `createServerClient` captured via vi.hoisted spy,
returns `{ auth: { getUser: h.getUser } }`.
`vi.mock('@/features/shared/lib/supabase', ...)` -> `createClient` returns a
chainable query stub ending at `.single()` per hoisted `h.viewAsRow`.
Cases: createAuthClient passes env URL/anon key + cookie adapter fns; getUser
returns user/null; requireAuth returns user, throws 'Unauthorized' when null;
getViewAsUser returns target_email on a 'start' row, null otherwise.
requireRole is a re-export — assert the export exists, do not retest internals.
Out of scope: auth.ts edits, other suites.

## Actions
1. Rewrite the file with the mocked-seam suite above.
2. Run it green.

## Done when
- File imports the real auth module (no literal-only assertions); suite passes.

## Verify
- Run: `npx vitest run src/features/shared/lib/auth.test.ts` -> all tests pass

## Handoff
none. Write results/S06-01.md (<=10 lines); TL alone updates TRACKER.md.
