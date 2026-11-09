# PLAN: google-signin
Type: feature   Status: spec
Date: 2026-11-09   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Add Google OAuth sign-in (Supabase Auth, @supabase/ssr already installed) alongside the
existing email/password login, restricted at sign-in to `@dabdoob.com` accounts that are
already authorised (active `roster` row or `config.admin_emails`). dabdoob.com is a Google
Workspace domain, so the Google OAuth client SHOULD be registered Internal (Google rejects
non-org accounts itself) — the app-side gate remains the primary enforcement.

## Decisions (from user)
1. Keep both auth paths: "Continue with Google" + existing email/password form stays.
2. dabdoob.com IS a Google Workspace domain → OAuth client can be Internal; `hd` available.
3. Gate strictness = domain + roster: sign-in itself is refused (session revoked) unless the
   Google email ends with `@dabdoob.com` AND is an active roster member or in admin_emails.

## Success criteria
1. Login page shows a "Continue with Google" button that starts the Supabase OAuth flow.
2. A @dabdoob.com Google user who is on the roster (or admin_emails) completes sign-in,
   gets a session cookie, and lands on `/` with their existing role (admin/tl/agent).
3. A Google user whose email is not @dabdoob.com, or who is not on the roster/admin_emails,
   ends the callback with NO usable session and lands on `/auth/login` with a denial message.
4. Email/password login keeps working exactly as today (no regression; e2e auth spec passes).
5. Domain enforcement is not based on `user_metadata`/`hd` claims (user-editable); it uses
   the verified `email` returned by `exchangeCodeForSession` + the existing roster/admin
   logic (same rules as `currentUser()` in `src/features/shared/platform/identity.ts`).
6. Setup steps for Google Cloud + Supabase dashboard are documented (runbook).

## Scope / Non-goals
In: Google OAuth trigger route, `/auth/callback` route handler with domain+roster gate,
login page button + error display, optional defense-in-depth `before_user_created` auth
hook migration (rejects non-@dabdoob.com signups at the identity layer), e2e/unit updates,
runbook doc.
Out: removing password auth, changing role/roster logic in identity.ts, onboarding flows
(admin still adds emails to roster — first Google sign-in auto-provisions auth.users),
deploy, commits.

## Risk flags (y/n)
arch n · db y (optional auth-hook migration file only) · data n · auth y · external-api y
(Google/Supabase dashboard) · ui y (login page) · perf n · deps n (no new deps) ·
tests y · docs y · deploy n
Review gates: QA (always) · Security: run (auth/external-api) · Data: skip ·
Performance: skip · UX/UI: run (login page change)

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`
e2e: `npm run test:e2e`  security: `npm run test:security`  build: `next build`

## Conventions (<=10 lines)
- Forbidden: package.json/lockfile, `.env*`, `cx-kpis-*.json`; no new deps.
- Next.js 16 differs from training data: read `node_modules/next/dist/docs/` guide for
  route handlers/proxy before writing; cite doc path in shards.
- Supabase MCP targets LIVE remote; agents write migration files only — applying needs
  user approval. Dashboard steps are manual-prerequisite docs, not agent tasks.
- Sessions/cookies: follow the existing `createAuthClient` + `src/proxy.ts` pattern.
- Heavy command output -> log file + bounded tail (skills/OUTPUT-BUDGET.md).
- Repo node_modules may be empty — `npm ci` before gates; Playwright lives in sibling repos.

## Research notes
- @supabase/ssr 0.12.7 + supabase-js 2.118 installed; session already cookie-based via
  `src/features/shared/lib/auth.ts` and `src/proxy.ts` (`getClaims()` guard; `/auth/*`
  and `/api/*` paths are reachable unauthenticated — `/auth/callback` fits).
- `signInWithOAuth({ provider:'google', options:{ redirectTo, queryParams:{ hd:'dabdoob.com' } } })`;
  `hd` is a Google UI hint only — NEVER an authorization input (user_metadata is
  user-editable per Supabase skill). Enforce on the verified `email` from
  `exchangeCodeForSession(code)` response, then `signOut()` on denial.
- Domain+roster verdict already implemented once in `currentUser()`
  (`src/features/shared/platform/identity.ts:77-111`): domain check -> admin_emails ->
  active roster row -> else `role:'unknown'`. Callback should reuse that decision or a
  shared predicate rather than duplicating the rules.
- Google OAuth cannot be exercised in real e2e; cover by mocking/stubbing the exchange
  or asserting the button + error-param UX; password path remains the e2e auth path.

## Manual prerequisites (documented in runbook shard, not code)
- Google Cloud: OAuth consent screen (Internal) + OAuth client ID/secret for the Workspace.
- Supabase dashboard: enable Google provider, set client creds, add callback redirect URL
  (`https://<project>.supabase.co/auth/v1/callback` + site redirect `/auth/callback`,
  prod + localhost).
- Optional: enable `before_user_created` auth hook pointing at the shipped function.

## Key pointers
- src/features/shared/lib/auth.ts — createAuthClient (cookie-aware server client)
- src/features/shared/lib/supabase.ts — service-role client for roster/admin lookups
- src/features/shared/platform/identity.ts:77 — currentUser: the domain+roster rules to reuse
- src/app/api/auth/login/route.ts — existing password path (keep)
- src/app/auth/login/page.tsx — add Google button + `?error=` display (Suspense for useSearchParams)
- src/proxy.ts — unauthenticated guard; `/auth/*` allowed, `/api/*` excluded from matcher
- e2e/auth.spec.ts, e2e/seed-users.mjs — current auth e2e assumptions
- docs/DATABASE_SETUP.md, docs/ARCHITECTURE.md — where auth setup is documented
