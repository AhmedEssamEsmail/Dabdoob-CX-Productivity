# S01-01: proxy.ts verifies the session JWT locally via auth.getClaims()
Kind: mini
ID: S01-01
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1 (proxy.ts getUser() remote call eliminated)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=1; actions=2; changed_lines=40; minutes=5

## Goal
`src/proxy.ts` stops calling `supabase.auth.getUser()` (remote round-trip on
every page request) and uses `supabase.auth.getClaims()` — a local JWT
signature/expiry verification with no network call.

## Files
- Edit: `src/proxy.ts` | the `proxy()` auth check, lines 26-32

## Context
- `src/proxy.ts:26-32` | current getUser + redirect block
- `node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md` | Next 16 proxy conventions — read first, cite in results
- `node_modules/next/dist/docs/01-app/02-guides/authentication.md` | auth/session guidance for this Next version
- PLAN research: `@supabase/ssr ^0.12.7 supports auth.getClaims() (local JWT verify) — Supabase-recommended for proxy/API authz`

## Contract
- Signed-in check becomes presence of claims (e.g. `data.claims?.sub`), not a `user` object.
- Cookie plumbing (`getAll`/`setAll` on request + response) is unchanged — do not touch it.
- Matcher config unchanged; `/auth` paths still bypass the redirect.
- Do NOT add React `cache()` here — proxy is not a per-request React scope.
Out of scope: identity.ts, auth.ts, any route file, session-expiry policy.

## Actions
1. Replace the `supabase.auth.getUser()` destructure with `auth.getClaims()`; treat a missing `claims`/`sub` as unauthenticated and keep the existing `/auth/login` redirect semantics.
2. Update the surrounding comment/typing so no `user` object is referenced (`getClaims` returns claims, not a User).

## Done when
- `auth.getUser(` appears nowhere in `src/proxy.ts`; `getClaims(` does.
- Unauthenticated requests still redirect to `/auth/login`; `/auth/*` still bypasses.
- `npx tsc --noEmit` clean for this file.

## Verify
- Run: `npx tsc --noEmit` -> no errors (full gate run by PM; file must contribute none).

## Handoff
Downstream leaves assume proxy issues zero remote auth calls/request.
Write results/S01-01.md (<=10 lines); TL alone updates TRACKER.md.
