# 03-scripts-reorg   (shard id: S03)
Owner: dev     Depends: none     Criteria: PLAN #2 (verify-db), #4
Skills: none     (owner invokes these first, nothing else)

## Goal
Every file under `scripts/` lives in a purposeful subdir — `ops/`, `parity/`, `legacy/`, `migration/` — verify-db consolidated, `package.json` `migrate` path updated. Moves only here; content/path fixes are S04. Run from `C:\Users\AHMED\KPIs\CX-Hub`.

## Files
Edit/create ONLY: `scripts\` (moves), `package.json` (one line), delete root `verify-db.ts`
Read-only context: `scripts\verify-db.js` vs `verify-db.ts` (canonical = the `.js`: loads `.env.local` via dotenv, prints sample row, catches errors; the `.ts` twin lacks dotenv), PLAN #4
Forbidden: `package.json` dependency sections/lockfile, `.env*`, `src\`, any other file

## Steps
1. `New-Item -ItemType Directory -Force scripts\migration, scripts\legacy` (`ops\`, `parity\` exist).
2. `git mv` each (preserves history):
   - `scripts\run-migration.ts`, `scripts\run-migration.sh`, `scripts\run-migration.bat` → `scripts\migration\`
   - `scripts\oracle.mjs` → `scripts\parity\oracle.mjs`
   - `scripts\qa_copy_check.py` → `scripts\parity\qa_copy_check.py`
   - `scripts\legacy-extract.mjs`, `scripts\merge-app-css.mjs` → `scripts\legacy\`
   - `scripts\check-sheet-access.mts`, `scripts\verify-db.js` → `scripts\ops\`
3. `git rm verify-db.ts` (root duplicate; canonical now `scripts\ops\verify-db.js`).
4. `package.json` line 18 → `"migrate": "tsx scripts/migration/run-migration.ts"`. Nothing else in the file changes. `migrate:local|validate|dry-run` still point at gitignored `migration\` — untouched.
5. Update stale self-path comments only inside moved files: `scripts\migration\run-migration.ts:7` (`npx tsx scripts/run-migration.ts` → `scripts/migration/run-migration.ts`), `scripts\ops\check-sheet-access.mts:10` (`scripts/check-sheet-access.mts` → `scripts/ops/check-sheet-access.mts`), `scripts\legacy\merge-app-css.mjs:8` (`node scripts/merge-app-css.mjs` → `scripts/legacy/merge-app-css.mjs`). Do NOT edit path constants (`HERE`/`ROOT`/`WORKSPACE`/`LEGACY_DIR`) — S04 owns that.
6. Do NOT touch `eslint.config.mjs` (`scripts/**/*.js` still covers moved `.js`; bare `verify-db.js` ignore is harmless).

## Done when
- `Get-ChildItem -Name -File scripts\` returns nothing (only dirs: `ops`, `parity`, `legacy`, `migration`); `ops\` has 3 old + 2 new files, `parity\` 7+2, `migration\` 3, `legacy\` 2
- `git status` shows renames; `verify-db.ts` deleted; `node -e "console.log(require('./package.json').scripts.migrate)"` -> `tsx scripts/migration/run-migration.ts`
- Expected state after this shard: `npx tsc --noEmit` / `npx vitest run` FAIL on unresolved `../../scripts/oracle.mjs` imports — S04 fixes; do not attempt edits outside listed files
