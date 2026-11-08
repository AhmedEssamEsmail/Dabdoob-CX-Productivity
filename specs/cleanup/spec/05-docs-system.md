# 05-docs-system   (shard id: S05)
Owner: dev     Depends: S01,S02,S03     Criteria: PLAN #3
Skills: none     (owner invokes these first, nothing else)

## Goal
Create the four core docs under `docs/` so `docs/` becomes the documentation system. Run from `C:\Users\AHMED\KPIs\CX-Hub`.

## Files
Create ONLY: `docs\ARCHITECTURE.md`, `docs\REPO-LAYOUT.md`, `docs\TESTING.md`, `docs\DEPLOYMENT.md`
Read-only context: `vercel.json` (crons), `src\features\` + `src\app\api\` (dir listing), `supabase\migrations\` (14 files), `e2e\README.md`, `docs\DATABASE_SETUP.md`, `docs\history\MIGRATION_READINESS.md`, `package.json`, `.gitignore`, PLAN research notes
Forbidden: `docs\DATABASE_SETUP.md` (stays as-is), `src\`, everything else

## Steps
1. `docs\ARCHITECTURE.md`: request flow (`src/proxy.ts` session gate → `src/app` routes → `src/features/cx-*/{components,lib,jobs}` → Supabase/Google Sheets); feature-module table (`cx-hub`, `cx-quality`, `cx-queue`, `cx-people`, `cx-operations`, `cx-desk`, `cx-productivity`, `shared`); cron table from `vercel.json` (7 unique paths; `job-tph-hourly` runs :05+:55 every hour) — note `src/app/api/cron/` routes NOT scheduled in `vercel.json` (e.g. `job-qa-engine`, `task-reminders`, `scorecard-nightly`); integrations (`/api/integrations/{freshchat,freshdesk,gmail,maqsam}`, Google Sheets via `google-spreadsheet`); "where code goes" rules (routes thin → feature `lib/`, shared in `features/shared`); **Known debt** section: 345 raw `<button>`s (no shared Button), largest files `one-on-ones-page.tsx` 2735 / `ecosystem-page.tsx` 2660 / `cx-quality/lib/server.ts` 2297 lines — documented for later phases, do not fix.
2. `docs\REPO-LAYOUT.md`: workspace tree (`KPIs/{CX-Hub,_archive/legacy-apps(8 dirs),_archive/devin-work,.devin}`) then repo tree: `src/{app,features,proxy.ts}`, `docs/{*,history/}`, `scripts/{ops,parity,legacy,migration}`, `tests/{golden,performance,security}`, `e2e/`, `supabase/migrations/`, `specs/`, `public/`; mark gitignored: `migration/`, `.devin/`, `*.tsbuildinfo`, `playwright-report/`, `test-results/`, `cx-kpis-*.json`, `.env*`.
3. `docs\TESTING.md`: `npx vitest run` = unit + golden oracle tests (`tests/golden/` runs legacy GAS verbatim in `scripts/parity/oracle.mjs` vs ports); `npm run test:integration` (`src/app/api/__tests__`); `npm run test:performance`; `npm run test:security`; e2e — cite `e2e/README.md` verbatim-style: `npm run test:e2e:seed` then `npx playwright test`.
4. `docs\DEPLOYMENT.md`: Vercel auto-deploy; env vars — list NAMES ONLY, gathered by `Select-String -Path src\**\*.ts* -Pattern 'process\.env\.[A-Z_]+' -AllMatches` plus `migration/`, `e2e/`, `docs/history/MIGRATION_READINESS.md` (Supabase URL/keys, Google SA email/key/project/sheet, `E2E_USER_PASSWORD`, `CRON_SECRET` if present); Supabase: 14 ordered files in `supabase/migrations/`, setup per `docs/DATABASE_SETUP.md`; crons table (same `vercel.json` data); data-migration endpoint via `npm run migrate` → `scripts/migration/run-migration.ts` (do not print the key).

## Done when
- `Get-ChildItem -Name docs\` = `ARCHITECTURE.md`, `DATABASE_SETUP.md`, `DEPLOYMENT.md`, `REPO-LAYOUT.md`, `TESTING.md`, `history`
- All `docs/` links in `README.md` resolve; no `src/` file changed
- Verify: `npx eslint docs` not applicable — verify `npx tsc --noEmit` still 0 errors (docs-only change)
