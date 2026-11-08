# 02-root-docs-readme   (shard id: S02)
Owner: dev     Depends: none     Criteria: PLAN #2, #3 (handover MDs)
Skills: none     (owner invokes these first, nothing else)

## Goal
Move the two loose handover MDs to `docs/history/` and rewrite `README.md` as the real project entry point. All commands run from `C:\Users\AHMED\KPIs\CX-Hub`.

## Files
Edit/create ONLY: `docs\history\IMPLEMENTATION_TRACKER.md`, `docs\history\MIGRATION_READINESS.md` (git mv from root), `README.md` (rewrite)
Read-only context: `package.json` (script names), `docs\DATABASE_SETUP.md`, `e2e\README.md`
Forbidden: everything else, `src\`, manifests/lockfiles, `.env*`

## Steps
1. `New-Item -ItemType Directory -Force docs\history`
2. `git mv IMPLEMENTATION_TRACKER.md docs/history/IMPLEMENTATION_TRACKER.md` — then same for `MIGRATION_READINESS.md`.
3. Rewrite `README.md` fully (current content is the create-next-app boilerplate). Sections:
   - **What CX-Hub is**: internal CX KPI platform — Next.js 16 App Router + Supabase port of the 8 legacy Google Apps Script apps (now in `../_archive/legacy-apps/`); feature modules live in `src/features/cx-*`.
   - **Quickstart**: `npm install`; configure `.env.local` per `docs/DATABASE_SETUP.md`; `npm run dev` → http://localhost:3000.
   - **Commands** table from `package.json` scripts: dev, build, lint, test:unit (`vitest`), test:integration, test:e2e (+seed/ui), test:performance, test:security, migrate, migrate:local, migrate:validate, migrate:dry-run.
   - **Docs**: links to `docs/ARCHITECTURE.md`, `docs/REPO-LAYOUT.md`, `docs/TESTING.md`, `docs/DEPLOYMENT.md`, `docs/DATABASE_SETUP.md`, `docs/history/` (these land via S05 — links are stable regardless of completion order).
   - No boilerplate Next.js/Vercel marketing text.
4. `git status --porcelain` → shows `R ` renames for both MDs (content preserved).

## Done when
- Repo root holds no loose docs: `Get-ChildItem -Name -File` at root shows only `AGENTS.md`, `README.md` among `*.md` (plus config files)
- `docs\history\` contains both MDs; `git status` shows renames not delete+add
- Verify: `npx tsc --noEmit` -> still clean (README/MD moves can't break it; run once)
