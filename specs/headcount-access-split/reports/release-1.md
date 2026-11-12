# release report - headcount-access-split - 1 (DEPLOY-adjacent, production)

Verdict: FAIL (blocked — no writes performed)
Deployment: n/a (no app deploy in scope)   Previous good: n/a
APPROVED: yes (2026-11-12) for remote writes to uugeyulccyytvgcabzzx — approval could not be exercised; zero remote writes happened.

## Step 1 — apply migration 20261112142701_headcount_access_split.sql → BLOCKED

- `env -u SUPABASE_ACCESS_TOKEN npx supabase migration list --remote` (CLI 3.1.0):
  `Target: project dabdoob-cx-productivity (uugeyulccyytvgcabzzx) · production` — correct target.
  Fails at "Initialising login role…" with `DbConfigLoginRoleStatusError` 403
  ("account does not have the necessary privileges"). Retried 3× over ~12 min
  with escalating pauses (cooldown hypothesis per .devin/lessons.md:17) — identical 403.
- Root cause (stable, not cooldown): stored `supabase login` identity sees only org
  `minooalsrtyrlhioicyp` ("Dabdoob": CX-Management-DB, Ticketing_System);
  `supabase/.temp/linked-project.json` shows this project's org is
  `vpuijfisgbfilvtdactp` — outside the login identity's membership. Management-API
  login-role minting is therefore unreachable. `projects list`/`orgs list` succeed → token itself valid.
- No fallback creds: no `DATABASE_URL`/`SUPABASE_DB_PASSWORD` in any `.env*` (names checked);
  pooler `aws-1-eu-central-1.pooler.supabase.com` needs a password not present on this machine.
  IDE-injected `SUPABASE_ACCESS_TOKEN` is absent this session (scoped-PAT path unavailable).
- Remote state verified via service-role REST (JWT ref=uugeyulccyytvgcabzzx from `.env.local`,
  read-only probes): `dq_hct.code`, `roster.gender`, `refresh_log.submitted_by` all
  → 400 `42703 column does not exist`. Migration is NOT applied remotely.
- **Other pending migrations exist (not ours)** — `git status` shows 4 untracked files with
  later timestamps: 20261112150304_maqsam_freshchat_columns, 20261112150305_fd_activities_columns,
  20261112150724_tickets_subject_order_id, 20261112150725_drop_fc_messages. Per task rule this is
  a STOP condition for `db push`; a single-file apply would still need `--password`/direct SQL creds.

## Step 2 — live backfill `scripts/ops/backfill-hct-headcount.mts` → BLOCKED (transitive)

- Script upserts dq_hct `code`/`gender`/`"contactNumber"`/`position` then `dqSyncRoster_()` writes
  roster `gender`/`mobile`/`hr_id`/`employment_status` — every one of those columns is absent
  remotely (probes above). Running now would 400 the upsert and throw in roster sync.
- Also note: `.env.pulled`/`.env.production` `SUPABASE_SERVICE_ROLE_KEY`/`SUPABASE_ANON_KEY`
  are masked placeholders (~11 chars, `[SE…`); `.env.local` holds the only real JWTs. Live run
  needs env exported from `.env.local` (dotenv does not override preset vars).

## Remediation (needs user — cannot proceed autonomously)

1. Re-auth CLI with an identity in org vpuijfisgbfilvtdactp (`supabase login`), or provide the
   DB password for `--remote --password` single-file apply, or merge the migration file to `main`
   for the GitHub-integration auto-apply.
2. After columns exist remotely, run step 2 with `.env.local` env, then verify counts.

Steps: probes → done; migration apply → blocked; backfill → not run
Smoke: n/a   Logs: 403 login-role ×3 (miglist*.log), REST 42703 probes
Rollback: n/a (nothing applied)   Needs approval: credentials/re-auth (above), not a scope approval
