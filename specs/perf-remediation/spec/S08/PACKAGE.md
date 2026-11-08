# S08: Service-role server client + RLS lockdown
Kind: package
ID: S08
Dispatch: NEVER

## Goal and contract
PLAN criterion #8: server `db()`/clients use `SUPABASE_SERVICE_ROLE_KEY`
(already in env per PLAN conventions), and every public app table denies
`public`/`anon`/`authenticated` access — the `app_all` `using(true)`
policies are dropped so RLS-enabled tables deny by default. The browser
anon key stays for Auth ONLY (verified in PLAN: zero client-side PostgREST
table queries). Design: `db()` becomes a lazy singleton on the service key
(PLAN convention: never create env-dependent clients at module top level —
today's `export const supabase` at supabase.ts:7 violates this and is fixed
in the same leaf). Every `createAuthClient().from(...)` table call-site is
swapped to `db()` — the anon-JWT client would be denied post-lockdown.
`createAuthClient` itself keeps the anon key (cookie-session JWT verify via
getClaims — S01). Sequencing: code swaps land before the lockdown
migration is even written; remote apply stays user-approved.
Non-goals: per-user RLS (rejected in PLAN), pg policies beyond dropping
app_all, anon-key rotation.

## Children
Index: `S08/00-index.md`
- service-role client core: S08-01 | tph lib call sites: S08-02 |
  API route call sites: S08-03 | app_all drop migration: S08-04

## Completion
All children done; `npm run test:security` green is the PM gate confirming
deny-all + working app flows.
