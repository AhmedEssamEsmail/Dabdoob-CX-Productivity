# S09-01 remote cron evidence (read-only, 2026-11-16 ~20:2x UTC)

Verify path: `npx supabase db query --remote --read-only` (injected scoped token;
saved login 403s on the Management query endpoint — `env -u` variant recorded
for the apply step). Every response header confirmed:
`Target: project dabdoob-cx-productivity (uugeyulccyytvgcabzzx) · production`.

## cron.job snapshot (`WHERE jobname LIKE 'cxh-%' ORDER BY jobname`)

| jobname | schedule | active |
|---|---|---|
| cxh-job-data-tick | `*/15 * * * *` | true |
| cxh-job-data-tick-health | `7-59/15 * * *` | true |

Supplementary (command shape, booleans only — no secrets printed):
`cxh-job-data-tick` command = 237 chars, uses `net.http_get`, does NOT use
`current_setting`, no settings guard → live row embeds literal URL/secret
(predates 20261108231643's DO-block; that migration shows `remote:""` in
`migration list` — never pushed). `cxh-job-data-tick-health` = 720 chars,
has the RAISE guard, no `current_setting` needed (reads net._http_response).
Recent `cron.job_run_details`: both jobs `succeeded` every 15 min
(latest observed 20:22 health / 20:15 tick UTC).

## app.settings GUC probe (values never printed)

```
url_set=false, secret_set=false
SELECT current_setting('app.settings.app_url', true) IS NOT NULL,
       current_setting('app.settings.cron_secret', true) IS NOT NULL;
```

Neither GUC is visible to a `postgres` session; `pg_db_role_setting` holds no
`app.settings.app_url`/`cron_secret` entry (only `app.settings.jwt_exp=3600`
at database `postgres`); `pg_settings` has zero `app.settings.*` rows.
=> Apply MUST be preceded/accompanied by the ALTER DATABASE provisioning
documented in the migration header, or every new job fails loudly by design.

## vercel.json side of the scope rule

None of the five candidate paths appear in `vercel.json` crons
(`job-qa-engine`, `job-nightly-aggregates`, `job-tl-queue`,
`scorecard-nightly`, `/api/desk/job/mail`) — verified 2026-11-16.

## Per-candidate verdict (uncovered = no vercel entry AND no cron.job row)

| candidate | schedule | verdict |
|---|---|---|
| cxh-job-qa-engine | `30 7 * * *` GET | SCHEDULED (uncovered) |
| cxh-job-nightly-aggregates | `30 6 * * *` GET | SCHEDULED (uncovered) |
| cxh-job-tl-queue | `15 * * * *` GET | SCHEDULED (uncovered) |
| cxh-scorecard-nightly | `30 6 * * *` GET | SCHEDULED (uncovered) |
| cxh-mail-desk | `*/15 * * * *` POST `/api/desk/job/mail` | SCHEDULED (uncovered) |

Skipped as already-covered: none. Out of scope untouched: cxh-job-data-tick,
cxh-job-data-tick-health (still active, literal-command row left as-is).
