# CX-Hub

## What CX-Hub is

CX-Hub is an internal CX KPI platform — a Next.js 16 (App Router) + Supabase
port of the 8 legacy Google Apps Script apps (now archived in
`../_archive/legacy-apps/`). Feature modules live in `src/features/cx-*`.

## Quickstart

```bash
npm install
```

Configure `.env.local` (Supabase URL, keys, etc.) per
[`docs/DATABASE_SETUP.md`](docs/DATABASE_SETUP.md).

```bash
npm run dev
```

Open http://localhost:3000.

## Commands

| Command                    | Description                                        |
|----------------------------|----------------------------------------------------|
| `npm run dev`              | Start the Next.js dev server                       |
| `npm run build`            | Production build                                   |
| `npm run lint`             | Run ESLint                                         |
| `npm run test:unit`        | Unit tests (`vitest`)                              |
| `npm run test:integration` | API route integration tests                        |
| `npm run test:e2e`         | End-to-end tests (Playwright)                      |
| `npm run test:e2e:seed`    | Seed E2E fixture users (see `e2e/README.md`)       |
| `npm run test:e2e:ui`      | Playwright UI mode                                 |
| `npm run test:performance` | Performance tests (`tests/performance`)            |
| `npm run test:security`    | Security tests (`tests/security`)                  |
| `npm run migrate`          | Run migration                                      |
| `npm run migrate:local`    | Run local migration                                |
| `npm run migrate:validate` | Validate migrations                                |
| `npm run migrate:dry-run`  | Dry-run migration                                  |

## Docs

- [ARCHITECTURE](docs/ARCHITECTURE.md)
- [REPO-LAYOUT](docs/REPO-LAYOUT.md)
- [TESTING](docs/TESTING.md)
- [DEPLOYMENT](docs/DEPLOYMENT.md)
- [DATABASE_SETUP](docs/DATABASE_SETUP.md)
- [docs/history](docs/history/)
