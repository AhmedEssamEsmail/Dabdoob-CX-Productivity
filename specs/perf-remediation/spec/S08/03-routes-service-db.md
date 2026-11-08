# S08-03: API routes stop doing PostgREST on the anon auth client
Kind: mini
ID: S08-03
Parent: S08
Owner: dev
Depends: S08-01
Criteria: PLAN #8 (no server table reads via the anon-key auth client — route layer)
Skills: none
Budget: files=8; actions=8; changed_lines=60; minutes=8

## Goal
The eight API routes that call `createAuthClient()` for `.from(...)` table
access switch to `db()`. `requireRole` imports/usage are unchanged
(the auth client stays for auth-only work).

## Files
- Edit: `src/app/api/tph/touches/route.ts` | auth client at ~:26
- Edit: `src/app/api/prod/my-page/route.ts` | ~:35
- Edit: `src/app/api/prod/flags/route.ts` | ~:54
- Edit: `src/app/api/prod/flags/[flagId]/route.ts` | ~:24
- Edit: `src/app/api/prod/flags/[flagId]/decide/route.ts` | ~:57
- Edit: `src/app/api/prod/analytics/route.ts` | ~:21
- Edit: `src/app/api/admin/mirrors/route.ts` | ~:74
- Edit: `src/app/api/admin/source-health/route.ts` | ~:90

## Context
- `src/features/shared/platform/repo.ts:24-26` | `db()` service client
- Each file: `import { createAuthClient ... }` at top; `const supabase = await createAuthClient()` then `.from(...)` — only the client expression changes
- `src/app/api/auth/login|logout/route.ts` also call createAuthClient — those are AUTH calls (signOut etc.), NOT table access: do NOT touch them

## Contract
- `const supabase = await createAuthClient()` -> `db()` usage per site (keep variable name or inline — minimal diff).
- Remove `createAuthClient` from import lists ONLY where it's now unused; `requireRole` imports stay.
- No query/filter/response edits. Routes keep their existing role gates (authz stays in code — the service client bypasses RLS by design).
Out of scope: lib files (S08-01/02), auth login/logout routes, page.ts.

## Actions
1. `api/tph/touches/route.ts`: swap the table-access client to `db()`, prune dead imports.
2. `api/prod/my-page/route.ts`: same swap.
3. `api/prod/flags/route.ts`: same swap.
4. `api/prod/flags/[flagId]/route.ts`: same swap.
5. `api/prod/flags/[flagId]/decide/route.ts`: same swap.
6. `api/prod/analytics/route.ts`: same swap.
7. `api/admin/mirrors/route.ts`: same swap.
8. `api/admin/source-health/route.ts`: same swap.

## Done when
- `createAuthClient().*from\(` pattern is gone from all eight routes; grep `createAuthClient` in src/app/api shows only auth-only callers (login/logout, source-health's remaining auth use if any — verify and report).
- `npx tsc --noEmit` clean; `npx vitest run tests/api-fragments` green.

## Verify
- Run: `npx vitest run tests/api-fragments` -> all pass.

## Handoff
Clears the route layer for S08-04. Record any route where createAuthClient
remains for non-table reasons in results/S08-03.md (<=10 lines); TL alone
updates TRACKER.md.
