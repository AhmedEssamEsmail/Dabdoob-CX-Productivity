# FIX-03: Delete test-only `getUser`/`requireAuth` stubs from lib/auth.ts
Kind: mini
ID: FIX-03
Parent: -
Owner: dev
Depends: none
Criteria: qa-1 finding qa-3
Skills: none
Budget: files=3; actions=3; changed_lines=60; minutes=6

## Goal
Remove the mis-typed test-only helpers `getUser()`/`requireAuth()` from
`src/features/shared/lib/auth.ts` — they return a stub `{ email }` that
silently drops id/metadata vs the real `User` type. No production code
imports them (verified: only auth.test.ts + the hub-fakes mock).

## Files
- Edit: `src/features/shared/lib/auth.ts` | delete the two functions (lines 26-37)
- Edit: `src/features/shared/lib/auth.test.ts` | delete the `getUser`/`requireAuth` describe blocks + their imports (lines ~51-52, ~93-118)
- Edit: `tests/golden/hub-fakes.ts` | remove `getUser`/`requireAuth` from `authModule()` (~lines 275-287) and update the stale mention in the doc comment (~line 266)

## Context
- `src/features/shared/lib/auth.ts:26-37` | the stubs; `createAuthClient`, `requireRole` re-export and `getViewAsUser` MUST stay.
- `tests/golden/hub-fakes.ts:247-260` | `fakeAuthClient().auth.getUser` mocks the SUPABASE CLIENT's getUser — keep it; only the module-level exports go.
- `tests/security/security.spec.ts:27` | also a client-level `auth.getUser` mock — untouched.

## Contract
- `createAuthClient`, `requireRole` (re-export), `getViewAsUser` remain exported and unchanged in behaviour.
- No other test or src file may import `getUser`/`requireAuth` from
  `@/features/shared/lib/auth` afterwards.
Out of scope: `getViewAsUser`, `requireRole`, `createAuthClient` refactors;
security.spec.ts; anything outside the 3 listed files.

## Actions
1. Delete `getUser` + `requireAuth` from lib/auth.ts.
2. Remove their describes/imports from auth.test.ts.
3. Remove them from hub-fakes authModule() + fix its comment.

## Done when
- `npx tsc --noEmit` clean; `npx vitest run src/features/shared/lib/auth.test.ts` passes.
- `grep "getUser\|requireAuth" src/` finds no lib/auth imports of the deleted names.

## Verify
- Run: `npx vitest run src/features/shared/lib/auth.test.ts tests/golden/hub-fakes.ts` + `npx tsc --noEmit` -> 0.

## Handoff
none. Write results/FIX-03.md (<=10 lines); TL alone updates TRACKER.md.
