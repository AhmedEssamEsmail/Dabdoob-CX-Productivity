# S02: OAuth trigger route `POST /api/auth/google`
Kind: mini
ID: S02
Parent: google-signin
Owner: dev
Depends: none
Criteria: PLAN #1 (button starts the Supabase OAuth flow)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=2; actions=3; changed_lines=120; minutes=8

## Goal
A thin route handler that starts Supabase Google OAuth server-side and returns
the consent URL for the browser to navigate to. Mirrors the `/api/auth/login`
shape so the login page can `fetch` it the same way.

## Files
- Create: `src/app/api/auth/google/route.ts` | `POST` handler
- Create: `tests/auth/google-route.test.ts` | url passthrough + error mapping

## Context
- `node_modules/next/dist/docs/01-app/01-getting-started/15-route-handlers.md` | REQUIRED read — Next 16 route-handler conventions (read before writing)
- `src/features/shared/lib/auth.ts:6-24` | `createAuthClient()` — cookie-aware server client; its `setAll` writes the PKCE code-verifier cookie (allowed in route handlers)
- `src/app/api/auth/login/route.ts` | existing POST JSON route shape to mirror
- PLAN research notes | `signInWithOAuth({ provider:'google', options:{ redirectTo, queryParams:{ hd:'dabdoob.com' } } })`; `hd` is a UI hint only, never authorization

## Contract
`POST /api/auth/google` (no body) -> `200 { url: string }` to navigate to, or
`400 { error: string }`. `redirectTo` must be `<request origin>/auth/callback`.
`/api/*` is outside the proxy matcher — reachable unauthenticated.
Out of scope: the callback route, the login page UI, GET handler, any session/role logic.

## Actions
1. Create the route: `const supabase = await createAuthClient()`; call `signInWithOAuth` with `redirectTo: new URL('/auth/callback', req.url).toString()` and `queryParams: { hd: 'dabdoob.com' }`; return `NextResponse.json({ url: data.url })` on success, `400 { error }` on `error` or missing `data.url`.
2. Create the test: `vi.mock('@/features/shared/lib/auth', ...)` returning a fake client whose `auth.signInWithOAuth` records args and yields canned `{ data: { url } , error }`; import `POST` and invoke with `new Request('http://localhost/api/auth/google', { method: 'POST' })`.
3. Assert: resolved JSON `url`; `options.redirectTo === 'http://localhost/auth/callback'`; `queryParams.hd === 'dabdoob.com'`; error result -> status 400.

## Done when
- Route returns the provider URL and the two contract fields above.
- Error path returns 400 JSON; tests green; `npx tsc --noEmit` clean.

## Verify
- Run: `npx vitest run tests/auth/google-route.test.ts` -> pass.
- Run: `npx tsc --noEmit` -> clean.

## Handoff
Endpoint consumed by S04: `POST /api/auth/google` -> `{ url }` | `{ error }`.
Write results/S02.md (<=10 lines); TL alone updates TRACKER.md.
