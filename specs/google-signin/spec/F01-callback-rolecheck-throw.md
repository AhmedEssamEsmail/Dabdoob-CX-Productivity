# F01: callback roleForEmail failure revokes session (qa-1)
Kind: mini
ID: F01
Parent: google-signin
Owner: dev
Depends: none
Criteria: PLAN #3 (denied/failed gate -> signOut + login error redirect)
Skills: none
Budget: files=2; actions=2; changed_lines=40; minutes=10

## Goal
`GET /auth/callback`: when `roleForEmail(email)` throws (roster/config DB
error), revoke the just-set session and redirect to login `?error=auth`.
No unhandled 500; no live session left for an unverified user.

## Files
- Edit: `src/app/auth/callback/route.ts` | wrap `roleForEmail` call (line 33) in try/catch like lines 20-25
- Edit: `tests/auth/callback-route.test.ts` | one new regression case for the throw path

## Context
- `src/app/auth/callback/route.ts:20-37` | existing try/catch + signOut +
  `loginRedirect` pattern to mirror
- `tests/auth/callback-route.test.ts:54-83` | mock/assert style for signOut
  + redirect location
- `src/features/shared/platform/identity.ts:99` | `roleForEmail` throws via
  `described()` on roster/config DB error
- `specs/google-signin/reports/qa-1.md` | finding qa-1 (MED, blocking)

## Contract
On `roleForEmail` throw: `await supabase.auth.signOut()` exactly once, then
`return loginRedirect(request, 'auth')` (error `auth`, NOT `denied`). All
other branches unchanged.
Out of scope: qa-3 redirectTo hardening, qa-4 missing-email test case,
the `denied` path semantics, any other file.

## Actions
1. In `route.ts`, wrap `const user = await roleForEmail(email)` in
   try/catch; on catch run `await supabase.auth.signOut()` then
   `return loginRedirect(request, 'auth')`. Keep the
   `user.role === 'unknown'` -> `denied` branch after it unchanged.
2. In `callback-route.test.ts`, add a case: exchange resolves with a valid
   email and `h.roleForEmail.mockRejectedValue(new Error('db down'))`;
   expect `h.signOut` called once and location
   `http://localhost/auth/login?error=auth`.

## Done when
- New test passes and would fail without the route change (throw path now
  signs out + redirects instead of propagating)
- All existing `callback-route.test.ts` cases still pass
- `npx tsc --noEmit` clean

## Verify
- Run: `npx vitest run tests/auth/callback-route.test.ts` -> all pass
  including the new throw case; `npx tsc --noEmit` -> exit 0.

## Handoff
Denied-flow guarantee now holds on transient DB failure; reviewer DELTA
scope = `route.ts` catch block + new test case.
Write results/F01.md (<=10 lines); TL alone updates TRACKER.md.
