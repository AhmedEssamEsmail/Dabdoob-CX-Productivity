# sec report - perf-remediation - round 1 (FULL)

Verdict: FAIL
Open: 0 BLOCKER / 0 HIGH / 1 MED / 2 LOW

Scope: commit `ba9a688` (whole spec BUILD) + working-tree FIX-round diff + new
migration `20261108231643_job_data_tick_pg_cron.sql`. Deep-read: all auth/identity/
viewas/proxy paths, `lib/supabase.ts` service-role swap, every API route diff,
migrations, `layout.tsx` __CC_BOOT__ emission, `shared-cache.ts`, `env.ts`,
queue/quality/tph libs, repo/stores, notify/popups, components, `vercel.json`.

What is GOOD (verified, no finding):
- Service-role key lives only in `server-only` `lib/supabase.ts` lazy singleton;
  never `NEXT_PUBLIC_*`; no client-component `.from(` call sites — anon key is
  Auth-only, matching the RLS-lockdown model (PLAN #8).
- Every route switched `createAuthClient()` -> `db()` retains code-level authz
  (`requireRole`, `requireAdminCaller`, `flagInScope`, `currentEmail`); no route
  ever relied on RLS (`app_all` was `using(true)`), so no authz regression.
- `__CC_BOOT__` correctly escapes `<` -> `<` before inlining
  (`layout.tsx`) — no `</script>` breakout; `null` fallback on auth error.
- `getClaims` local JWT verify in proxy/identity; roster `active` flag still
  checked per request in `currentUser`, so deactivation denies access even with
  a cached JWT.
- Migrations: `app_cache` has RLS on + zero policies (deny-all, service-role only);
  lockdown drops `app_all` by enumeration, re-affirms RLS; dedupe survivor rules
  documented; pg_cron job has no secrets in file, loud failure on missing config,
  idempotent unschedule guard.
- All PostgREST filters use parameterized `.eq/.in/.gte/.is` on literal column
  names; `tphLoadStore_` date param regex-gated; `oneOnOneAlertsSeen` writes only
  the caller's own keys; `ilike('email', …)` exact-`.find()` prevents wrong-row
  selection.
- No secrets/keys in any diff; `.env*`, lockfile, package.json untouched
  (deps flag n — no `npm audit` needed).

| ID | Sev | file:line | Attack scenario (1-2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| sec-1 | MED | src/app/api/cron/job-data-tick/route.ts:13 | `cronOk` returns `true` when `process.env.CRON_SECRET` is unset: any internet caller can GET/POST `/api/cron/job-data-tick`, triggering Freshdesk delta sync + queue/aging rebuilds (unauthenticated state-changing job run; response JSON leaks job stats). Spec promotes this route to the pg_net-invoked endpoint, so a single missing env var leaves an open state-mutating surface. Same fail-open exists on sibling `job-*` routes — pre-existing convention, flagged here because this route is now the scheduled remote target and only its docstring was touched this round. | `if (!secret) return false` (prod) — or `return process.env.NODE_ENV !== 'production' && !secret`; prefer fail-closed + 503 'CRON_SECRET not configured'. Apply the same guard to the other `cronOk` copies. | dev |
| sec-2 | LOW | src/features/shared/platform/repo.ts:~215-240 | Batched `updateRows` upserts the full `current` row merged with the patch; a concurrent writer's change to an unpatched column between the `select('*').in(...)` and the `upsert` is silently reverted (lost-update — old path wrote patch-only). | Upsert `{[keyField]: u.key, ...data}` (key + patch only) so PostgREST updates only the supplied columns on conflict; keep the constraint-error fallback. | dev |
| sec-3 | LOW | supabase/migrations/20261108231643_job_data_tick_pg_cron.sql:49-53 | `net.http_get` is fire-and-forget: the PERFORM succeeds when the request is queued, so a rotated/mismatched `cron_secret` (401) or 500 shows the run as 'succeeded' in `cron.job_run_details` — silent scheduler outage. | Optionally add a follow-up `cron` step or periodic check asserting recent `net._http_response.status = 200`; at minimum document the check in ARCHITECTURE.md runbook. | supabase-expert |

Not verified / assumptions:
- RLS lockdown drops `app_all` by name plus `cmd='ALL' AND qual='true'` policies;
  a hypothetical per-command permissive policy (e.g. `FOR SELECT USING (true)`
  under another name) or non-`'true'` qual text would survive — remote state not
  readable from here; the migration's own verify queries (0 policies expected)
  are the check. Apply order in TRACKER is correct (service-role deploy first).
- `getClaims` verifies JWT signature/expiry locally only: a revoked/deleted
  Supabase session's access token stays valid until expiry. Residual risk is
  small because `currentUser` re-checks roster `active` + domain per request;
  documented as a user action in PLAN non-goals.
- `app.settings.cron_secret` (ALTER DATABASE) is readable by anyone with SQL
  access — acceptable (same trust domain); file itself carries no literals.
- `npm run test:e2e` not run (PM gate); remote apply of all 6 migrations is
  NEEDS_APPROVAL — findings assume the documented ordering is followed.
- `.qa-tmp/` stray dir at repo root (carried from qa-1) — housekeeping only.
</content>
</invoke>
