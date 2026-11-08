# Deployment

## Platform

Vercel auto-deploys from the connected git branch; `vercel.json` defines the
cron schedules (see table below). Build is standard `next build`.

## Environment variables

Set these **names** in the Vercel project (values live in the Vercel
dashboard / `.env.local` locally — never commit them). Names gathered from
`src/`, `migration/`, `e2e/`, `scripts/`, and `docs/history/MIGRATION_READINESS.md`:

**Supabase**
- `NEXT_PUBLIC_SUPABASE_URL`
- `SUPABASE_ANON_KEY`
- `SUPABASE_SERVICE_ROLE_KEY`

**Google service account / Sheets**
- `GOOGLE_SERVICE_ACCOUNT_EMAIL`
- `GOOGLE_PRIVATE_KEY`
- `GOOGLE_PROJECT_ID` (per MIGRATION_READINESS)
- `GOOGLE_SHEET_ID`
- `GOOGLE_APPLICATION_CREDENTIALS` (local tooling only)
- `GOOGLE_DELEGATED_USER` / `ASSISTANT_OWNER_EMAIL` (calendar delegation)

**Integrations**
- `FRESHDESK_API_KEY` (+ `FRESHDESK_DOMAIN` per MIGRATION_READINESS)
- `FRESHCHAT_API_KEY`, `FRESHCHAT_DOMAIN`
- `MAQSAM_API_KEY`, `MAQSAM_API_SECRET`, `MAQSAM_DOMAIN`
- `GMAIL_API_URL`, `GMAIL_API_KEY`, `GMAIL_READ_API_URL`, `GMAIL_READ_API_KEY`, `GMAIL_SEND_ENABLED`, `MAIL_API_URL`, `MAIL_API_KEY`

**Auth / jobs / admin**
- `CRON_SECRET` — bearer token Vercel crons and integration routes check
- `MIGRATION_SECRET_KEY` — guards `/api/admin/migrate` and `admin-auth`

**E2E / local tooling**
- `E2E_USER_PASSWORD` — shared fixture-user password (e2e only)
- `LEGACY_DIR` — optional override for the golden-oracle legacy source dir

## Supabase

Schema lives in `supabase/migrations/` — **14 ordered files** applied in
sequence (`001_core_tables.sql` … `014_migration_hardening.sql`), including
`012_pg_cron_schedule.sql` for in-database scheduling. Manual setup steps
(SQL editor, RLS, seed config) are documented in `docs/DATABASE_SETUP.md`;
migration status/history context is in `docs/history/MIGRATION_READINESS.md`.

## Cron schedule (`vercel.json`)

| Path                                   | Schedule                          |
|----------------------------------------|-----------------------------------|
| `/api/cron/job-productivity-daily`     | `30 6 * * *`                       |
| `/api/cron/job-tph-past-days`          | `0 5 * * *`                        |
| `/api/cron/job-quarterly-report`       | `0 6 1 * *`                        |
| `/api/cron/flag-detection`             | `30 6 * * *`                       |
| `/api/cron/daily-layers`               | `45 6 * * *`                       |
| `/api/cron/analytics-aggregation`      | `0 7 * * *`                        |
| `/api/cron/job-tph-hourly`             | `:05` and `:55` every hour         |

Other `src/app/api/cron/*` routes (`job-qa-engine`, `task-reminders`,
`scorecard-nightly`, etc.) are **not** scheduled — invoke manually with the
`CRON_SECRET` bearer token if needed.

## Data migration (Google Sheets → Supabase)

`npm run migrate` runs `scripts/migration/run-migration.ts` (tsx), which uses
the Google service-account env vars plus `NEXT_PUBLIC_SUPABASE_URL` /
`SUPABASE_SERVICE_ROLE_KEY` to read the source sheet and write Supabase.
Requires the Google + Supabase env vars above; do not print or commit the
service-account key. Related commands: `migrate:local`, `migrate:validate`,
`migrate:dry-run` (repo-root `migration/` tooling, gitignored).
