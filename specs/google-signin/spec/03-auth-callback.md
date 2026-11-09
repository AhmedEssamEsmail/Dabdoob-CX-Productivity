# S03: `GET /auth/callback` — exchange + domain/roster gate
Kind: mini
ID: S03
Parent: google-signin
Owner: dev
Depends: S01 (`roleForEmail` export)
Criteria: PLAN #2 (authorised user lands on `/` with session), #3 (denied user keeps no session), #5 (verified `email`, never `user_metadata`/`hd`)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=4; changed_lines=160; minutes=10

## Goal
OAuth redirect landing route: exchanges the PKCE code for a session, applies the
shared sign-in verdict to the verified email, and either redirects to `/`
(authorised) or revokes the session and redirects to `/auth/login?error=denied`.

## Files
- Create: `src/app/auth/callback/route.ts` | `GET` handler
- Create: `tests/auth/callback-route.test.ts` | four redirect branches

## Context
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` | REQUIRED read — Next 16 route-handler conventions
- `src/features/shared/lib/auth.ts:6-24` | `createAuthClient()` — reads the PKCE verifier cookie written by S02's `signInWithOAuth`; `setAll` persists the new session cookies
- `src/features/shared/platform/identity.ts` | `roleForEmail(email)` (S01) + `normEmail`
- `src/proxy.ts:30-38` | `/auth/*` is reachable unauthenticated; `/api/*` is excluded — `/auth/callback` fits the guard
- `src/app/api/auth/logout/route.ts` | `supabase.auth.signOut()` + `NextResponse.redirect` pattern

## Contract
`GET /auth/callback?code=...` ->
- provider `error` param or missing `code` -> redirect `/auth/login?error=auth`
- `exchangeCodeForSession` throws/returns error or no `data.user.email` -> `signOut()` + redirect `?error=auth`
- `roleForEmail(normEmail(email)).role === 'unknown'` -> `signOut()` + redirect `/auth/login?error=denied`
- otherwise -> redirect `/`
The only authorization input is the verified `data.user.email` from
`exchangeCodeForSession`. Never read `user_metadata`, `hd`, or the `email` claim
of an unexchanged request.
Out of scope: the trigger route, login page, role logic itself, `proxy.ts` edits (none needed), session refresh.

## Actions
1. Create the GET handler implementing the four branches in Contract order; build redirect targets with `new URL('/auth/login?error=...', request.url)`.
2. Denial path: `await supabase.auth.signOut()` before redirecting so the issued session is revoked (criterion #3).
3. Create the test: `vi.mock('@/features/shared/lib/auth')` (fake `exchangeCodeForSession`/`signOut` spies) and `vi.mock('@/features/shared/platform/identity', () => ({ roleForEmail: h.roleForEmail, normEmail: (e: unknown) => String(e || '').trim().toLowerCase() }))`; import `GET` and drive it with `new Request('http://localhost/auth/callback?code=x')`.
4. Assert all four branches: `?error=auth` on missing code; `signOut` + `?error=auth` on exchange failure; `signOut` + `?error=denied` on `unknown`; plain `/` and no `signOut` on a roster role.

## Done when
- All four redirect branches behave per Contract; `signOut` called on both failure paths.
- Tests green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/auth/callback-route.test.ts` -> pass.
- Run: `npx tsc --noEmit` -> clean.

## Handoff
Error params consumed by S04: `?error=auth` (flow failed) and `?error=denied`
(not authorised). Write results/S03.md (<=10 lines); TL alone updates TRACKER.md.
