# PLAN: next-security-upgrade
Type: maintenance   Status: draft
Date: 2026-11-19   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Synchronize the installed Next.js runtime and matching ESLint config with the manifest/lockfile target and current stable release, 16.4.6, removing the stale 16.4.3 installation that triggered the security-upgrade warning. Validate the application without changing application code or unrelated dependencies.

## Success criteria
1. `npm ci` completes successfully and `npm ls next eslint-config-next --depth=0` reports both packages at 16.4.6 with no `invalid` marker.
2. `package.json` and `package-lock.json` remain unchanged because both already target 16.4.6; no canary or unrelated dependency is installed.
3. Production build, typecheck, unit, security, and route/browser gates pass; lint remains no worse than the documented pre-existing baseline.
4. Post-sync audit confirms no Next.js advisory; unrelated development-only minimatch findings are recorded but not expanded into this task.

## Scope / Non-goals
In: clean lockfile synchronization; installed-version verification; build and regression gates; audit/review evidence.
Out: Next.js canary releases; React or other dependency upgrades; application/source changes unless a demonstrated 16.4.6 compatibility break requires a re-shard; unrelated minimatch advisory remediation; commit, push, or deployment.

## Risk flags (y/n)
arch n · db n · data n · auth n · external-api n · ui n · perf n · deps y · tests n · docs n · deploy n
Review gates: QA run · Security run (dependency upgrade) · Data skip (no data changes) · Performance skip (no performance-sensitive source changes) · UX/UI skip (no UI source changes; browser regression gate still runs)
Budgets (perf flag): n/a

## Gate commands (run from project root)
sync: `npm ci`
versions: `npm ls next eslint-config-next --depth=0`
typecheck: `npx tsc --noEmit`  lint: `npx eslint .`  unit: `npx vitest run`  e2e: `npm run test:e2e`  security: `npm run test:security`  build: `npm run build`
audit: `npm audit --json` (inspect Next.js entries; existing unrelated minimatch development-chain findings are baseline)

## Conventions (<=10 lines: workflow.md + relevant lessons)
- User approved this Next.js upgrade only; no new or unrelated dependencies and no canary channel.
- `package.json`/lockfile are maintainer-only and should remain byte-identical unless new evidence requires PM escalation.
- Never read or edit `.env*`; no remote DB, commit, push, or deployment.
- Read the installed `node_modules/next/dist/docs/` guide before any Next.js source edit; none is expected.
- Stale `node_modules` is a known repo condition: run `npm ci` before gates.
- PM owns any manual dev server; Playwright may self-manage its configured webServer.
- Redirect heavy install/build/test output to `specs/next-security-upgrade/logs/`; read bounded tails only.
- Preserve unrelated `specs/unified-page-format/logs/`; do not stage or delete it.

## Research notes
- npm `latest` dist-tag is 16.4.6; canary is 16.5.0-canary.55 and is intentionally rejected.
- `package.json` and `package-lock.json` already pin Next.js and eslint-config-next 16.4.6.
- `npm ls` before sync reports installed Next.js/eslint-config-next 16.4.3 as invalid against the 16.4.6 manifest.
- Initial `npm audit --json` reports no Next.js vulnerability; seven moderate development-chain findings derive from minimatch and are out of scope.

## Key pointers
- `package.json:23-51` - Next.js and matching ESLint dependency targets plus gate scripts.
- `package-lock.json:4822-4826,6981-6985` - locked 16.4.6 package artifacts.
- `next.config.ts:1-28` - configuration exercised by the production build; no planned edit.
- `playwright.config.ts` - self-managed browser-test webServer configuration.
- `specs/unified-page-format/RESUME.md` - completed predecessor task whose installed-runtime warning prompted this maintenance.
