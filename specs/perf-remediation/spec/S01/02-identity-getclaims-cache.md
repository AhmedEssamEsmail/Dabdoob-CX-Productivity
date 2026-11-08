# S01-02: Server auth chain uses getClaims + per-request React cache()
Kind: mini
ID: S01-02
Parent: S01
Owner: dev
Depends: none
Criteria: PLAN #1 (identity.ts getUser x2 removed; realEmail/viewAsState/currentUser memoized per request)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=4; actions=6; changed_lines=250; minutes=10

## Goal
`realEmail()` (and therefore `actorEmail`/`currentEmail`/`currentUser`/
`requireRole`/`requireJobCaller`/`viewAsState`) performs local JWT
verification instead of remote `auth.getUser()`, and the three request-path
readers (`realEmail`, `viewAsState`, `currentUser`) are memoized per request
with React `cache()` so one request runs each at most once. `currentUser`'s
roster read is filtered server-side by email.

## Files
- Edit: `src/features/shared/lib/auth.ts` | `getUser()` -> getClaims (lines 26-30)
- Edit: `src/features/shared/platform/identity.ts` | `realEmail` (32-42), `currentUser` roster read (88-91), cache() wrapping
- Edit: `src/features/shared/platform/viewas.ts` | wrap exported `viewAsState` in `cache()` (65-77)
- Edit: `src/features/shared/lib/auth.test.ts` | mocks/asserts for getClaims shape

## Context
- `src/features/shared/lib/auth.ts:26-36` | getUser/requireAuth pair to convert
- `src/features/shared/platform/identity.ts:32-42,78-111` | realEmail + currentUser (roster select('*'))
- `src/features/shared/platform/viewas.ts:65-77` | viewAsState (already has VA_MEMO; cache() adds per-request dedupe, keep VA_MEMO)
- `node_modules/next/dist/docs/01-app/02-guides/caching-without-cache-components.md` | React cache() semantics in this Next version — read first, cite in results
- `src/features/shared/lib/auth.test.ts` | existing mock shape (mocks createAuthClient + auth.getUser)

## Contract
- `auth.getClaims()` returns `{ data: { claims } | null }`; the caller email comes from `claims.email`. A claims object with no email => `''` from realEmail (cron/no-session path preserved).
- Export names/signatures unchanged: `getUser`, `requireAuth`, `realEmail`, `currentEmail`, `currentUser`, `requireRole`, `viewAsState`, `assertWritable`. `getUser()` may return a claims-derived `{ email }`-shaped object or keep returning `User | null` only if getClaims can supply it — otherwise narrow its contract minimally and update its callers/tests accordingly.
- Apply `cache()` from `react` to the exported `realEmail` (identity.ts), `currentUser` (identity.ts), `viewAsState` (viewas.ts) so repeat calls in one request share one result. `viewAsState(fresh)` keeps working (cache keys on args); do not remove VA_MEMO.
- `currentUser` roster read: `db().from('roster').select('*').ilike('email', email)` then keep the existing in-memory `normEmail` match/active logic (covers case variants; a `lower(email)` index lands separately in S07-02).
- `requireRole` stays implemented in identity.ts (golden tests mock shared/lib/auth — see the comment at identity.ts:115-120).
Out of scope: proxy.ts (S01-01), any `.from()` call-site client swap (S08), viewas.ts logic beyond the cache() wrap.

## Actions
1. auth.ts: convert `getUser()`/`requireAuth()` to `auth.getClaims()` (no remote call); keep error semantics (unauthenticated -> 'Unauthorized').
2. identity.ts: `realEmail` reads `claims.email` via getClaims (same try/catch -> '' contract).
3. identity.ts: wrap `realEmail` and `currentUser` in React `cache()`.
4. identity.ts: currentUser roster query -> `.ilike('email', email)` server filter (keep find-by-normEmail fallback logic).
5. viewas.ts: wrap exported `viewAsState` in `cache()`.
6. auth.test.ts: update createAuthClient mock to `auth.getClaims` returning claims; add/adjust cases: signed-in email, no session -> null/'' , requireAuth throws Unauthorized.

## Done when
- `getUser(` appears only as our exported helper name; no `.auth.getUser()` calls remain in src/features/shared/lib/auth.ts or platform/identity.ts.
- `cache(` wraps realEmail, currentUser, viewAsState.
- Roster read in currentUser carries `.ilike('email', ...)`.
- `npx vitest run src/features/shared/lib/auth.test.ts` green.

## Verify
- Run: `npx vitest run src/features/shared/lib/auth.test.ts` -> all pass.

## Handoff
`currentEmail()`/`viewAsState()` are now per-request memoized — S05-01 relies
on calling `currentEmail()` once per tick. Write results/S01-02.md (<=10 lines); TL alone updates TRACKER.md.
