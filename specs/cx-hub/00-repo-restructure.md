# Shard 00 — Repo restructure to CX-Hub + feature layout

> Status: **blocked** — renaming `C:\Users\AHMED\KPIs\Dabdoob-CX-Productivity` → `C:\Users\AHMED\KPIs\CX-Hub` failed in-session with `EPERM`/`Access denied` (mv, cmd `ren`, PowerShell `Rename-Item`, `fs.rename` all refused; a stale Playwright test-server was killed, no remaining handle found — likely sandbox/workspace-root protection or an invisible IDE handle).

## Tasks

1. **Rename the directory** `Dabdoob-CX-Productivity` → `CX-Hub`.
   - Manual action may be required from the owner (close IDE/workspace handles, then rename), or retry at a new session start.
   - After rename: `.vercel/project.json` stays valid (project linked by `projectId`, not path; Vercel project name `dabdoob-cx-productivity` can be renamed in the dashboard later — cosmetic).
   - Fix the stale path mention in `specs/legacy-parity/02-gap-analysis.md` and any absolute paths in `.devin/` / scripts.
2. **Move existing code into features** (mechanical `git mv` + import rewrites, `tsc` must stay green):

   | From | To |
   |---|---|
   | `src/lib/prod`, `src/lib/tph`, `src/lib/prod-access.ts`, `src/lib/prod-validation.ts`, `src/lib/jobs/productivity.ts`, `src/lib/jobs/tph.ts`, `src/lib/jobs/quarterly.ts`, `src/components/prod` | `src/features/cx-productivity/{lib,components,jobs}` |
   | `src/lib/kpi`, `src/lib/scorecard` | staged to `src/features/cx-people/lib` (KpiPayout/Scorecard are people-domain; kpi_*_log reads are cx-desk) |
   | `src/lib/queue` | `src/features/cx-queue/lib` |
   | `src/lib/platform`, `src/lib/shell`, `src/lib/vendor`, `src/lib/jobs/{env,csv,steps,mirrors,sheets,grid-slots,vendor-apis,backfill}.ts` | `src/features/shared/{platform,shell,vendor,jobs}` |
   | `src/components/shell`, `src/components/layout` | `src/features/shared/components` |
   | `src/lib/auth.ts`, `admin-auth.ts`, `api-error.ts`, `errors.ts`, `fragments.ts`, `supabase.ts` | `src/features/shared/lib` |
   | `src/app/*` routes | **stay** (Next.js constraint); handlers become thin imports from features |

   Rename rule: productivity feature files keep their names; update `@/` imports via codemod (paths only, no logic edits).
3. Update `package.json` `name` → `cx-hub`; `AGENTS.md`/`README.md` title references; spec paths `Dabdoob-CX-Productivity` → `CX-Hub` where written.
4. Commit as its own unit: `chore: restructure repo into CX-Hub feature layout` (no behaviour change — all existing tests must pass unchanged).

## Gates

- `npx tsc --noEmit` clean, `vitest run` green, `npx next build` succeeds, dev server boots.
- `git log` shows a single move commit with only path changes.

## Depends on

- Owner/system-level rename (task 1). Tasks 2–4 can proceed in parallel with a pending rename — feature folders work under either root name.
