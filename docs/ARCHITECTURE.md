# Architecture

## Request flow

```
browser request
  → src/proxy.ts          session gate (Supabase SSR cookies; redirects
                          sessionless non-/auth requests to /auth/login)
  → src/app/**            Next.js routes/pages (thin: parse, auth, call lib)
  → src/features/cx-*/     feature modules: {components, lib, jobs}
  → Supabase (Postgres/Auth) and Google Sheets (google-spreadsheet / googleapis)
```

`src/proxy.ts` is the edge proxy matcher for all non-API paths; API routes
under `src/app/api/` authenticate themselves (session, `CRON_SECRET` bearer,
or `MIGRATION_SECRET_KEY` for admin/migration endpoints).

## Feature modules (`src/features/`)

| Module            | Purpose                                                        |
|-------------------|----------------------------------------------------------------|
| `cx-hub`          | Home dashboard, My Day, ecosystem/overview pages               |
| `cx-quality`      | Quality metrics, QA engine, scorecards                          |
| `cx-queue`        | Ticket queue, TL queue, check-ins, heatmaps                     |
| `cx-people`       | Roster, one-on-ones, people management                          |
| `cx-operations`   | Operations views and jobs                                       |
| `cx-desk`         | Desk/mail-desk workflows, mail jobs                             |
| `cx-productivity` | Productivity engine (TPH, flags, quarterly reports, backfill)   |
| `shared`          | Cross-feature code: `platform/` (identity, mail), `jobs/`, `lib/`, `migration/`, `shell/`, `vendor/` (Freshdesk/Freshchat/Maqsam), `components/` |

## Cron jobs (`vercel.json`)

Vercel invokes `src/app/api/cron/*` routes with a `CRON_SECRET` bearer token.
12 unique paths are scheduled (`job-tph-hourly` has two entries per hour):

| Path                                   | Schedule                          |
|----------------------------------------|-----------------------------------|
| `/api/cron/job-data-tick`              | `0 5 * * *` (daily 05:00; Hobby plan caps at daily — intended */15 needs Pro) |
| `/api/cron/oo-reminders`               | `15 7 * * *` (daily 07:15; Hobby plan caps at daily — intended */15 needs Pro) |
| `/api/cron/task-reminders`             | `0 7 * * *` (daily 07:00)         |
| `/api/cron/meeting-reminders`          | `30 7 * * *` (daily 07:30)        |
| `/api/cron/missed-1on1-check`          | `30 19 * * *` (daily 19:30)       |
| `/api/cron/job-tph-hourly`             | `:05` and `:55` every hour         |
| `/api/cron/job-productivity-daily`     | `30 6 * * *` (daily 06:30)         |
| `/api/cron/job-tph-past-days`          | `0 5 * * *` (daily 05:00)          |
| `/api/cron/job-quarterly-report`       | `0 6 1 * *` (1st of month 06:00)   |
| `/api/cron/flag-detection`             | `30 6 * * *` (daily 06:30)         |
| `/api/cron/daily-layers`               | `45 6 * * *` (daily 06:45)         |
| `/api/cron/analytics-aggregation`      | `0 7 * * *` (daily 07:00)          |

Schedules are UTC. `src/app/api/cron/` also contains routes that are **not**
scheduled in `vercel.json` — they exist for manual/on-demand invocation or
legacy parity, e.g. `job-qa-engine`, `scorecard-nightly`,
`job-nightly-aggregates`, `job-tl-queue`.

pg_cron (Supabase) is **installed but not scheduled** — Vercel owns
scheduling; the pg_cron schedule draft in
`supabase/migrations/012_pg_cron_schedule.sql` is blocked pending env setup
and should not be applied.

## Integrations

- `src/app/api/integrations/freshchat` — Freshchat API (`FRESHCHAT_API_KEY`, `FRESHCHAT_DOMAIN`)
- `src/app/api/integrations/freshdesk` — Freshdesk API (`FRESHDESK_API_KEY`)
- `src/app/api/integrations/gmail`      — Gmail send/ingest (`GMAIL_API_*`, `GMAIL_READ_API_*`, `GMAIL_SEND_ENABLED`, `MAIL_API_*`)
- `src/app/api/integrations/maqsam`     — Maqsam API (`MAQSAM_API_KEY`, `MAQSAM_API_SECRET`, `MAQSAM_DOMAIN`)
- Google Sheets — service-account auth (`GOOGLE_SERVICE_ACCOUNT_EMAIL`, `GOOGLE_PRIVATE_KEY`, `GOOGLE_SHEET_ID`) via `google-spreadsheet` / `googleapis` in `src/features/shared/jobs/sheets.ts`, `src/features/shared/migration/engine.ts`, `src/features/cx-quality/lib/migrate.ts`, `src/features/cx-hub/lib/myday-google.ts` (calendar delegation via `GOOGLE_DELEGATED_USER` / `ASSISTANT_OWNER_EMAIL`)
- Supabase — `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_ANON_KEY` (client/proxy), `SUPABASE_SERVICE_ROLE_KEY` (server jobs/migration)

## Where code goes

- Routes/pages under `src/app` stay **thin**: auth check, input parsing, call into a feature `lib/` function, return JSON/JSX.
- Business logic, data access, and job implementations live in `src/features/<module>/{lib,jobs}/`.
- Anything used by two or more feature modules goes in `src/features/shared/` (`platform/`, `jobs/`, `lib/`, `vendor/`, `components/`).
- New cron behaviour: add the handler in the feature module's `jobs/`, expose a thin route in `src/app/api/cron/<name>/route.ts`, and schedule it in `vercel.json` only if it should run automatically.

## Module boundaries

### Dependency directions

```
app  →  features (cx-*/<module>)  →  shared
```

- `src/app` routes may import feature `lib/`/`jobs/` functions and shared modules.
- Features may import `shared/` and other features only via a documented public seam — prefer `shared/` for anything reused.
- `src/features/shared/` must **not** import `@/features/cx-*`. This is enforced
  by ESLint `no-restricted-imports` in `eslint.config.mjs`.
- Exception: `shared/jobs/env.ts` and `shared/jobs/mirrors.ts` are the
  composition layer — they intentionally wire pure cx-productivity engines to
  storage/mail. The rule is disabled for these two files; see their headers.

### Ownership

- `grid-slots.ts` lives in `cx-productivity/lib/tph/` — it has a single
  production consumer and is not shared.
- `shared/lib/fetch-json.ts` is the one cross-feature `fetchJson`. The local
  variants in `hub-shared`, `cx-queue/shared`, and `qa-shared` are intentional
  (client-component seams) — do not unify them.
- `import 'server-only'` marks server-only modules: `shared/{platform,jobs,
  vendor,migration}`, server modules in `shared/lib/`, and feature `lib`/`jobs`
  that touch secrets or Supabase service roles. Next fails the build if a
  client component reaches one. Two client-reachable exceptions stay unmarked:
  `cx-productivity/lib/prod-validation.ts` and `cx-queue/lib/heatmap-engine.ts`.

### Page structure

Routes stay thin: pages/components in `src/app` delegate to `<X>Page`
components under `src/features/<module>/components/`, which fetch via
feature `lib/` functions and render. No business logic in `app/`.

## Known debt (documented for later phases — do not fix here)

- ~345 raw `<button>` usages across the app — there is no shared `Button` component yet.
- Largest files: `src/features/cx-people/components/one-on-ones-page.tsx` (2735 lines), `src/features/cx-hub/components/ecosystem-page.tsx` (2660 lines), `src/features/cx-quality/lib/server.ts` (2297 lines).
