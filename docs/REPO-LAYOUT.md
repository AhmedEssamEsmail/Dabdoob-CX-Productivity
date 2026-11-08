# Repository Layout

## Workspace root (`KPIs/`)

```
KPIs/
├── CX-Hub/                    this repo (Next.js app)
├── _archive/
│   ├── legacy-apps/           8 archived legacy app directories
│   └── devin-work/            archived devin workflow artifacts
└── .devin/                    devin workflow config (gitignored)
```

## Repo tree (`CX-Hub/`)

```
CX-Hub/
├── src/
│   ├── proxy.ts               session gate (Supabase SSR)
│   ├── app/                   Next.js App Router: pages + api/ routes
│   │   └── api/               route groups: admin, auth, cron, desk, fcr,
│   │                          hub, integrations, kpi, people, prod, qa,
│   │                          quality, queue, tl, tph, trackers, ...
│   └── features/              domain modules (see ARCHITECTURE.md)
│       ├── cx-hub/  cx-quality/  cx-queue/  cx-people/
│       ├── cx-operations/  cx-desk/  cx-productivity/  shared/
├── docs/                      this documentation system
│   ├── ARCHITECTURE.md  REPO-LAYOUT.md  TESTING.md  DEPLOYMENT.md
│   ├── DATABASE_SETUP.md      (Supabase SQL setup — kept as-is)
│   └── history/               IMPLEMENTATION_TRACKER.md, MIGRATION_READINESS.md
├── scripts/
│   ├── ops/                   ops probes/verification (probe-db, verify-db, ...)
│   ├── parity/                legacy↔port oracle harness (oracle.mjs, diff, fixtures)
│   ├── legacy/                legacy extract/CSS merge helpers
│   └── migration/             run-migration.{ts,sh,bat} entrypoint
├── tests/
│   ├── golden/                oracle equivalence tests (legacy GAS verbatim)
│   ├── performance/           performance tests
│   ├── security/              security tests
│   └── {api-fragments,jobs,lib,platform}/
├── e2e/                       Playwright specs + seed-users.mjs + README.md
├── supabase/migrations/       14 ordered SQL migrations (001–014)
├── migration/                 repo-root scratch migration tooling (gitignored)
├── specs/                     cleanup/migration specs and trackers
├── public/                    static assets
├── package.json  vercel.json  playwright.config.ts  vitest.config.mjs
└── tsconfig.json  next.config.ts  eslint.config.mjs
```

## Gitignored paths (never commit)

| Path / pattern            | Why                                  |
|---------------------------|--------------------------------------|
| `migration/`              | repo-root scratch tooling only       |
| `.devin/`                 | devin workflow artifacts             |
| `*.tsbuildinfo`           | TypeScript incremental build info    |
| `playwright-report/`      | Playwright HTML report               |
| `test-results/`           | Playwright test output               |
| `cx-kpis-*.json`          | Google service-account key files     |
| `*.iam.gserviceaccount.com.json`, `service-account*.json` | SA keys |
| `.env*`                   | environment secrets                  |
| `node_modules/`, `.next/`, `out/`, `build/`, `coverage/` | standard build/deps |
