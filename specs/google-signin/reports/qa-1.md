# qa report - google-signin - round 1 (FULL)

Verdict: FAIL        (one MED open; all gates green)
Open: 0 B / 0 H / 1 M / 4 L

Checks run (all from project root, logs deleted after capture):
- `npx tsc --noEmit` -> exit 0, clean.
- `npx eslint .` -> exit 0, **0 errors** / 367 warnings (pre-existing; new files add 1 same-style `no-unused-vars` warning).
- `npx vitest run` -> exit 0, **1144/1144** incl. new `tests/auth/*` + `tests/platform/signin-verdict.test.ts`.
- `npm run test:security` -> exit 0, 4/4 (existing authz suite; no OAuth-specific security tests).
- `npx next build` -> success ("Compiled successfully", TS finished, 156/156 static; `/auth/callback` registered dynamic).
- `npm run test:e2e` -> **110 passed / 10 skipped / 0 failed (2.1m)**; new Google specs ran on all 5 projects incl. password-path regression.

Criteria coverage:
1. Button + OAuth kickoff — `page.tsx:185` + `POST /api/auth/google`; e2e asserts visibility + POST fired. OK.
2. Authorized → session + `/` + role — `callback/route.ts:21-39`; exchange sets cookies (route-handler `cookieStore.set` pattern), `roleForEmail` reuses `currentUser` verdict. Unit-tested; real Google leg unverifiable by design (PLAN research note). OK.
3. Denied → `signOut()` + `/auth/login?error=denied` — `route.ts:33-36`; unit + e2e banner test. OK.
4. Password path unchanged — `handleLogin` untouched; e2e auth spec green. OK.
5. Verified `email` (not `user_metadata`/`hd`) — `route.ts:27`; `hd` only passed as UI hint `google/route.ts:10`. OK.
6. Runbook — `docs/GOOGLE_SIGNIN_SETUP.md` covers Google Cloud, dashboard URLs, hook, smoke check. OK.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|----|-----|-----------|------------------|-----------|-------|
| qa-1 | MED | src/app/auth/callback/route.ts:33 | `await roleForEmail(email)` can throw (roster/config DB error → `described()` at identity.ts:99). Result: unhandled 500, `signOut()` skipped, session cookie already set — denied-flow guarantee (criterion 3) not met on transient DB failure. | Wrap in try/catch → `await supabase.auth.signOut(); return loginRedirect(request,'auth')`, matching lines 20-25 pattern. | dev |
| qa-2 | LOW | supabase/migrations/20261109123839_before_user_created_domain_gate.sql:15-16 | Comment says "No email … allow" but code returns 403 for empty email (fails LIKE). Deny-by-default is safer; comment misleads. | Fix comment (or add `email = '' or` if allow intended). | supabase-expert |
| qa-3 | LOW | src/app/api/auth/google/route.ts:9 | `redirectTo` built from `req.url` (Host-header reflection); a spoofed Host yields off-origin `redirect_to`. Mitigated by Supabase allowlist (runbook pins exact URLs) — harden anyway. | Prefer fixed origin: env site URL or `request.nextUrl.origin` equivalent constant. | dev |
| qa-4 | LOW | tests/auth/callback-route.test.ts | `error:null` + missing `data.user.email` branch (`route.ts:28` `!email`) untested; other branches covered. | Add case: `{data:{user:{}},error:null}` → signOut + `?error=auth`. | test-engineer |
| qa-5 | LOW | specs/perf-remediation/TRACKER.md (staged) | Foreign staged change + `styles/quality.css`, `tests/ui/qa-strip-overflow.pw.ts` (ctl-strip-overflow) sit in tree; TRACKER.md not in TL's list — risk of sweeping into this feature's commit. | Unstage/exclude foreign files before commit. | dev |

Not verified / assumptions:
- Real Google OAuth round-trip impossible in this env (PLAN research note); cookie-set on redirect assumes documented Next.js mutable-`cookies()` behavior in route handlers — same pattern as existing code.
- Migration NOT applied (NEEDS_APPROVAL) and dashboard setup pending — hook is optional defense-in-depth; app gate is primary.
- e2e `[WebServer] Date.now() prerender` noise is pre-existing RootLayout issue, unrelated.
- 10 e2e skips are data-dependent (same count as TL).
