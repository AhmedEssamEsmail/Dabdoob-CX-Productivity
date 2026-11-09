# sec report - google-signin - round 1 (FULL)

Verdict: PASS        (no BLOCKER/HIGH/MED; LOWs only, two carried from qa)
Open: 0 B / 0 H / 0 M / 4 L

Scope reviewed: `src/app/api/auth/google/route.ts`, `src/app/auth/callback/route.ts`,
`src/app/auth/login/page.tsx` (diff), `src/features/shared/platform/identity.ts` (diff),
`supabase/migrations/20261109123839_before_user_created_domain_gate.sql`,
`tests/auth/*`, `tests/platform/signin-verdict.test.ts`, `e2e/auth.spec.ts` (diff),
`docs/GOOGLE_SIGNIN_SETUP.md`. Context: `src/proxy.ts`, `lib/auth.ts`, `lib/supabase.ts`,
`platform/settings.ts` (configAll cache), `api/auth/login/route.ts`.

Verified (no finding):
- Gate uses verified `user.email` from `exchangeCodeForSession` (callback/route.ts:27), never
  `user_metadata`/`hd` (user-editable). `hd:'dabdoob.com'` (google/route.ts:10) is a Google
  UI hint only — correct per skill checklist.
- Fail-closed on every path: missing code, provider `error` param, exchange throw, exchange
  error, `!email`, `roleForEmail` throw (tl-2 fix), `role==='unknown'` — all `signOut()` +
  fixed `?error=auth|denied`. Even if `signOut()` failed, a residual session resolves
  `role:'unknown'` on every protected call (`currentUser`→`roleForEmail`), so it grants nothing.
- `?error=` never reflected: mapped to two fixed strings (login/page.tsx UrlErrorNotice);
  provider `error`/`error_description` not echoed. No `next`/`returnTo` → no open redirect.
- PKCE (supabase-js default) binds the code to the initiating browser via code_verifier cookie.
- `roleForEmail` extraction is verbatim — `currentUser` semantics unchanged; password path
  (`api/auth/login/route.ts`) untouched.
- Migration matches Supabase hook-hardening guidance: `security definer` (required for
  `before_user_created`), `set search_path=''`, EXECUTE revoked from public/anon/authenticated,
  granted only to `supabase_auth_admin` (lines 29-32). `like '%@dabdoob.com'` suffix match is
  not bypassable (`x@notdabdoob.com`, `a@dabdoob.com.evil`, subdomains all reject); empty
  email -> 403 (deny-by-default).
- Service-role key: `SUPABASE_SERVICE_ROLE_KEY` in a `'server-only'` module, never NEXT_PUBLIC.
- `.ilike('email', email)` wildcard broadening neutralized by exact-match `.find` (identity.ts:98-100).
- No secrets in code/tests/docs; runbook says never commit client creds and pins exact
  redirect URLs in the Supabase allow-list. No new deps/lockfile change -> npm audit N/A.
- Tests: all `roleForEmail` verdict branches + all callback branches covered except `!email`
  (qa-4, carried).

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| sec-1 | LOW | src/app/api/auth/google/route.ts:9 (also callback/route.ts:6,45) | `redirectTo`/redirect URLs derive from `req.url` Host; a spoofed Host yields an off-origin `redirect_to`, delivering the auth code to an attacker origin. Mitigated by Supabase allow-list pinning exact origins (runbook). | Pin origin from env (`SITE_URL`/`NEXT_PUBLIC_SITE_URL`) instead of `req.url`. (carried qa-3, deferred) | dev |
| sec-2 | LOW | src/app/api/auth/google/route.ts:4 | Login CSRF residual: a cross-site POST could try to plant an attacker-owned `code_verifier` cookie; with a harvested code the victim's callback signs in as the attacker (work attributed to attacker's session). Requires an insider roster member + a browser that still sets third-party response cookies — modern defaults block it. | Cheap hardening: reject kickoffs where `Sec-Fetch-Site` is `cross-site`/`same-site`-mismatched `Origin` in the POST handler. | dev |
| sec-3 | LOW | supabase/migrations/20261109123839_before_user_created_domain_gate.sql:15-16 | Comment claims "No email … allow" but code 403s empty email (fails LIKE). Deny-by-default is the safe behavior — comment misleads future edits. | Fix comment to match deny-by-default. (carried qa-2, deferred) | supabase-expert |
| sec-4 | LOW | specs/perf-remediation/TRACKER.md (staged) + `styles/quality.css`, `tests/ui/qa-strip-overflow.pw.ts`, `specs/ctl-strip-overflow/`, `specs/migration-remaining/` | Foreign changes staged/in-tree alongside this feature — risk of sweeping unrelated work into the auth commit. | Unstage/exclude foreign files before commit; needs user/PM action. (carried qa-5) | dev |

Not verified / assumptions:
- Real Google OAuth round-trip is untestable here (PLAN research note); cookie-set/clear on
  the redirect response assumes documented mutable-`cookies()` behavior in route handlers —
  same pattern as existing code.
- Migration NOT applied and Google/Supabase dashboard steps pending — NEEDS_APPROVAL stands;
  the hook is optional defense-in-depth, the app-side gate is primary.
- `configAll` caches `admin_emails`/`allowed_domain` ~5 min (settings.ts:151-167); admin
  removal propagates with that lag — pre-existing, identical for the password path.
- `signOut()` throwing inside a catch -> 500 + residual cookie; residual session still
  resolves `role:'unknown'` so nothing is granted — consistent with file's existing style,
  logged here not as a finding.
- `?error=denied` reveals denial only to the person who just authenticated as themselves —
  no third-party account enumeration.
