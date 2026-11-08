# 07-final-gates   (shard id: S07)
Owner: dev     Depends: S01,S02,S03,S04,S05,S06     Criteria: PLAN #6, #8
Skills: none     (owner invokes these first, nothing else)

## Goal
Prove all gates green and every move preserved content. Verify-only shard — no file edits. Run from `C:\Users\AHMED\KPIs\CX-Hub`.

## Files
Edit/create ONLY: none
Read-only context: `..\PLAN.md` success criteria
Forbidden: any file edit — failures route back to the owning shard

## Steps
1. `npx tsc --noEmit` → 0 errors.
2. `npx eslint .` → 0 errors.
3. `npx vitest run` → all pass (golden oracle resolves `../_archive/legacy-apps` — proves S01+S04 chain).
4. `npx next build` → success.
5. Layout assertions:
   - `Get-ChildItem -Name 'C:\Users\AHMED\KPIs'` = `CX-Hub`, `_archive`, `.devin` only
   - `Get-ChildItem -Name -File 'C:\Users\AHMED\KPIs\CX-Hub'` — no `IMPLEMENTATION_TRACKER.md`, `MIGRATION_READINESS.md`, `verify-db.ts`; root `*.md` = `AGENTS.md`, `README.md`
   - `Get-ChildItem -Name -File scripts` = empty (dirs only)
   - `Test-Path 'C:\Users\AHMED\KPIs\CX-Hub\src\proxy.ts'` = True (not moved)
6. Content preservation: `git status --porcelain` — every moved tracked file shows `R` (rename detected ⇒ content identical); additions only = `docs/*.md`, `migration/README.md` untracked is expected (gitignored). Investigate any `D`+`??` pair that isn't an expected rename.
7. `git status` → confirm zero modified/added/deleted paths under `src/` (PLAN #7).

## Done when
- All 4 gate commands exit 0
- All step-5 assertions true; `git status` shows only expected renames + docs adds; no `src/` changes
- Report the four gate outputs + `git status --porcelain` summary back to the PM
