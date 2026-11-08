# Spec index: cleanup

PLAN: `../PLAN.md`. Owners: `dev` only (no DB work). Global constraint: **zero changes under `src/`** (PLAN #7) — including `src/app/legacy-apps.css` (stale generator comment stays; regenerates later). No commits.

| id | file | owner | depends | criteria | files touched | skills |
|----|------|-------|---------|----------|---------------|--------|
| S01 | 01-workspace-archive.md | dev | none | #1,#8 | KPIs root: 8 `*_deprecated`/`*Depricated` dirs, `nul`, `.devin\work` → `_archive\` | none |
| S02 | 02-root-docs-readme.md | dev | none | #2,#3,#8 | `docs\history\` + 2 root MDs (git mv), rewrite `README.md` | none |
| S03 | 03-scripts-reorg.md | dev | none | #2,#4,#8 | `scripts\` file moves into ops/parity/legacy/migration, rm `verify-db.ts`, `package.json` `migrate` path | none |
| S04 | 04-legacy-path-repoint.md | dev | S01,S03 | #4,#6,#8 | `scripts\parity\oracle.mjs`, `scripts\legacy\{legacy-extract,merge-app-css}.mjs`, 8 `tests\golden\*` imports | none |
| S05 | 05-docs-system.md | dev | S01,S02,S03 | #3 | create `docs\{ARCHITECTURE,REPO-LAYOUT,TESTING,DEPLOYMENT}.md` | none |
| S06 | 06-migration-scratch-tidy.md | dev | none | #5,#8 | `migration\README.md` (new), `migration\*.txt` → `migration\logs\` | none |
| S07 | 07-final-gates.md | dev | S01–S06 | #6,#8 | none — verify only | none |

Waves: W1 = S01,S02,S03,S06 (disjoint trees) · W2 = S04,S05 · W3 = S07.
Note: after S03 alone, `tsc`/`vitest` fail on the moved `oracle.mjs` import — expected; S04 restores green.
