# S01: Auth chain — local JWT verify + per-request memoization
Kind: package
ID: S01
Dispatch: NEVER

## Goal and contract
PLAN criterion #1: eliminate remote `auth.getUser()` calls from the request
path. `src/proxy.ts` and the server-side auth chain
(`shared/lib/auth.ts`, `platform/identity.ts`) use `auth.getClaims()`
(local JWT verify, @supabase/ssr ^0.12.7 — PLAN research). `realEmail`,
`viewAsState`, `currentUser` are memoized per request with React `cache()`.
`currentUser`'s roster read filters by email server-side.
Invariants: exported names/signatures unchanged (`getUser`, `requireAuth`,
`realEmail`, `currentEmail`, `currentUser`, `requireRole`, `viewAsState`);
unauthenticated requests still redirect to `/auth/login` (proxy) or throw
'Unauthorized' (request path); cron/no-session still yields `realEmail()===''`.
Non-goals: session-expiry policy, region checks (PLAN non-goals).

## Children
Index: `S01/00-index.md`
- PLAN #1 proxy getUser -> getClaims: S01-01
- PLAN #1 auth.ts/identity.ts getClaims + cache() + roster filter: S01-02

## Completion
Both leaves done; `/api/bootstrap` warm latency improvement is verified by
the PM's post-deploy perf gate, not inside these leaves.
