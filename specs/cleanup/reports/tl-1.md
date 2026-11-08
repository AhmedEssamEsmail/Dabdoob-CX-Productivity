# TL report 1 — cleanup BUILD

## Status
All 7 shards done. 3 waves: W1 (S01,S02,S03,S06) → W2 (S04,S05) → W3 (S07 verify). 0 blocked, 0 deferred.

## Gates (final, from project root)
- `npx tsc --noEmit` — PASS, 0 errors
- `npx vitest run` — PASS, 46 files / 1140 tests
- `npx next build` — PASS
- `npx eslint .` — PASS, exit 0 (0 errors; 322 pre-existing warnings)
- Scope: `git status --short` — 0 changes under `src/`; all edits within shard Files lists

## Changed files
- KPIs root (outside repo): `_archive/legacy-apps/` (8 legacy dirs), `_archive/devin-work/` (137 files), `nul` deleted
- `README.md` rewritten; `IMPLEMENTATION_TRACKER.md`, `MIGRATION_READINESS.md` → `docs/history/` (git mv)
- `scripts/` → `ops/`, `parity/`, `legacy/`, `migration/` (9 git renames); root `verify-db.ts` deleted
- `package.json` — `migrate` script path only (pre-approved)
- `scripts/parity/oracle.mjs`, `scripts/legacy/{legacy-extract,merge-app-css}.mjs` — path constants repointed
- 8 `tests/golden/*.ts` — import repoints to `scripts/parity/oracle.mjs`
- `docs/{ARCHITECTURE,REPO-LAYOUT,TESTING,DEPLOYMENT}.md` — new
- `migration/README.md` — new; `migration/logs/` — 5 txts moved (gitignored)
- `eslint.config.mjs` — `migration/**` added to `globalIgnores` (fix, see below)

## Fix cycles (S07 findings → owners)
1. `KPIs/nul` (83 bytes) reappeared after S01 deletion — bash `2>nul` on Windows creates a real file. S01 resumed, re-deleted via `cmd /c del "\\?\..."`. Verified gone.
2. `eslint .` — 13 errors, all pre-existing in gitignored `migration/*.ts` scratch. S06 resumed, added `migration/**` to `globalIgnores` (consistent with `.devin/**`; dir is tsconfig-excluded local tooling). No `.ts` files edited.

## Open issues / notes for PM
- 322 eslint warnings remain (pre-existing, mostly unused-vars in `tests/golden` + `src/`); not in scope.
- `scripts/ops/` holds 7 files vs shard's expected 5 (pre-existing count was already 5; +2 moved) — cosmetic spec drift, no action.
- Spec asked for no qa/security/ux shards; none spawned — PM runs review gates.
- QA gate recommended per PLAN (always). Security/UX skipped per PLAN risk flags.

## Report path
`specs/cleanup/reports/tl-1.md` · tracker: `specs/cleanup/TRACKER.md`
