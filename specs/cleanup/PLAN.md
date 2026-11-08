# PLAN: cleanup
Status: draft   Date: 2026-11-08   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Phase 1 of the post-handover overhaul (CTO-directed): clean up the workspace and repo — archive legacy GAS apps, consolidate loose docs/scripts, and build a real documentation system (architecture, layout, testing, deployment). No behaviour changes; the full UI redesign and the performance audit are separate follow-up tasks.

## Success criteria
1. `C:\Users\AHMED\KPIs\` root contains only `CX-Hub\`, `_archive\`, `.devin\`: all 8 legacy app dirs (`Command_Center_V2_deprecated`, `Desk_deprecated`, `FCR_deprecated`, `Operations_deprecated`, `People_deprecated`, `Productivity_Depricated`, `Quality_deprecated`, `Queue_deprecated`) moved under `_archive/legacy-apps/`; the 0-byte `nul` file removed; `KPIs\.devin\work\` (13M stale scratch; the live harness already exists at `CX-Hub\.devin\work\`, 204 files) moved to `_archive/devin-work/`.
2. CX-Hub repo root holds no loose doc or script files: `IMPLEMENTATION_TRACKER.md` and `MIGRATION_READINESS.md` → `docs/history/`; `verify-db.ts` + duplicate `scripts/verify-db.js` consolidated into one canonical script under `scripts/ops/`; `README.md` rewritten as the real project entry point (what CX-Hub is, quickstart, test/build commands, links into docs/).
3. `docs/` becomes the doc system: `ARCHITECTURE.md` (system design: request flow proxy → app routes → features → Supabase, feature-module map, cron jobs, external integrations, where code goes), `REPO-LAYOUT.md`, `TESTING.md`, `DEPLOYMENT.md` (env vars, Vercel, Supabase migrations, crons); `DATABASE_SETUP.md` stays; handover MDs in `docs/history/`.
4. `scripts/` reorganized: every file lives in `ops/`, `parity/`, or a new purposeful subdir (e.g. `scripts/migration/` for `run-migration.{ts,sh,bat}`); `package.json` script paths updated to match — **path edits only, no dependency changes** (pre-approved by CTO this task).
5. `migration/` (gitignored local scratch) gets a `README.md` marking it local-only tooling; its `*.txt` logs moved under `migration/logs/`.
6. Gates green after every move: `npx tsc --noEmit`, `npx eslint .`, `npx vitest run`, `npx next build`.
7. Zero changes under `src/` (feature layout already correct; `src/proxy.ts` is the Next 16 proxy convention — do not move).
8. All moves preserve content (verify with `diff -r`/`git status` where tracked); gitignored scratch moves need no diff but must not lose files (count check before/after).

## Scope / Non-goals
In: workspace-root archive, repo file reorganization, docs system, scripts consolidation, `package.json` script-path updates, migration/ tidy.
Out: UI/UX redesign (345 raw `<button>`s, design system — next task), performance audit, component splitting (largest files documented in ARCHITECTURE.md as known debt), any `src/` changes, dependency changes, remote DB changes, deletion of any legacy code.

## Risk flags
db: n · auth: n · ui: n · external-api: n
Gates: QA (always) · Security: skip (no auth/input/API changes — file moves + docs only) · UX/UI: skip (no UI changes)

## Gates (commands, run from project root)
typecheck: `npx tsc --noEmit` · lint: `npx eslint .` · unit: `npx vitest run` · build: `npx next build` · e2e: skip (no UI/route changes) · security: skip (no auth/RLS changes)

## Conventions (distilled from .devin/workflow.md)
- Forbidden: `package.json` dependency sections/lockfile (script-path edits allowed this task only), `.env*`, `cx-kpis-*.json`.
- Specs live in `specs/<slug>/`; user docs in `docs/`; work artifacts in `.devin/` (gitignored).
- Next.js 16 differs from training data — read `node_modules/next/dist/docs/` before writing Next code (none expected this task).
- Gitignored (local-only, never committed): `/migration/`, `.devin/`, `*.tsbuildinfo`, `playwright-report/`, `test-results/`, `cx-kpis-*.json`.
- No commits — user did not ask.

## Research notes
- `KPIs/.devin/work/` (13M) is a stale duplicate of the harness at `CX-Hub/.devin/work/` (15M, extract/desk+fcr, shots) → archive the root copy, keep the repo-local one.
- `verify-db.ts` (root, 1.4K) vs `scripts/verify-db.js` — inspect both, keep the canonical one in `scripts/ops/`.
- `package.json` scripts `migrate`, `migrate:local`, `migrate:validate`, `migrate:dry-run` point into `scripts/` and gitignored `migration/` — path updates must keep all four working.
- `src/app/` routes must stay (Next.js constraint); `src/proxy.ts` is the Next 16 middleware successor — do not move.
- Known debt for later phases (document in ARCHITECTURE.md, do not fix now): 345 raw `<button>`s with no shared Button component; largest files `one-on-ones-page.tsx` 2735, `ecosystem-page.tsx` 2660, `cx-quality/lib/server.ts` 2297 lines.

## Key pointers
- `specs/cx-hub/00-repo-restructure.md` — the feature layout was already done; this task is hygiene + docs.
- `.gitignore` — authoritative ignore list (drives what stays vs archives).
- `e2e/README.md` — e2e conventions to cite in TESTING.md.
- `vercel.json` — cron schedule source for DEPLOYMENT.md.
- `supabase/migrations/` — 14 ordered migration files for DEPLOYMENT.md.
