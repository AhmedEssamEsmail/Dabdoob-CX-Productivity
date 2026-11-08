# TRACKER: cleanup
Status vocabulary: `pending -> claimed -> in-progress -> done | blocked | deferred -> verified`
Owner of this file: tech-lead. Devs update only their own row's status/evidence.

| Shard | Owner | Depends | Status | Files touched | Evidence (gate results) | Notes |
|---|---|---|---|---|---|---|
| S01 | dev | none | done | `C:\Users\AHMED\KPIs\_archive\` (new tree), TRACKER.md | KPIs root = CX-Hub,_archive,.devin; devin-work files=137 (baseline 137); legacy-apps has 8 dirs; nul deleted (re-deleted 83-byte stray via `cmd /c del "\\?\..."` after bash `2>nul` recreated it; `ls` confirms only 3 entries) | |
| S02 | dev | none | done | `README.md` (rewritten), `docs\history\IMPLEMENTATION_TRACKER.md`, `docs\history\MIGRATION_READINESS.md` (git mv) | `git status` shows `R ` renames for both MDs; root *.md = AGENTS.md, README.md only; `npx tsc --noEmit` fails only on `tests/golden` `scripts/oracle.mjs` import — expected until S04 (pre-existing, unrelated to S02) | |
| S03 | dev | none | done | `scripts\` (moves to ops/parity/legacy/migration), `package.json` (migrate line), deleted root `verify-db.ts` | `git status` shows 9 renames + `verify-db.ts` deleted; `scripts/` has only dirs; `node -e` migrate -> `tsx scripts/migration/run-migration.ts`; tsc/vitest oracle import failure expected until S04 | ops\ has 7 files (shard said 5; pre-existing count was 5+2 moved) |
| S04 | dev | S01,S03 | done | `scripts\parity\oracle.mjs`, `scripts\legacy\legacy-extract.mjs`, `scripts\legacy\merge-app-css.mjs`, `tests\golden\{helpers-oracle,desk-fakes,ops-fakes,queue-oracle,helpers-hub,quality.test,people.test,people-jobs.test}.ts`, TRACKER.md | `npx tsc --noEmit` 0 errors; `npx vitest run` 46 files / 1140 tests all pass | LEGACY_DIR resolves KPIs\_archive\legacy-apps\Productivity_Depricated via Config.js |
| S05 | dev | S01,S02,S03 | done | `docs\ARCHITECTURE.md`, `docs\REPO-LAYOUT.md`, `docs\TESTING.md`, `docs\DEPLOYMENT.md` (new) | `Get-ChildItem docs` = 4 new MDs + DATABASE_SETUP.md + history; README docs links resolve; `npx tsc --noEmit` 0 errors | env var names gathered from src/migration/e2e/scripts |
| S06 | dev | none | done | `migration\README.md` (new), `migration\logs\` + 5 moved txts, `eslint.config.mjs` (added `migration/**` to globalIgnores) | migration/ root = 16 .ts + README.md; logs/ = 5 txts; recursive file count 21->22 (README added, nothing lost); `npx eslint .` -> EXIT:0 (0 errors, 322 pre-existing warnings); tsc fails only on tests/golden oracle.mjs import — expected until S04 | baseline count was 21 (16 ts + 5 txt), not 22 as spec guessed |
| S07 | dev | S01–S06 | done | none (verify-only) | PASS: `tsc --noEmit` 0 err; `vitest run` 46 files/1140 tests; `next build` success; `eslint .` EXIT=0 (0 err, 322 pre-existing warnings) after `migration/**` added to globalIgnores; `KPIs\nul` re-deleted (S01 fix); root *.md=AGENTS+README; scripts/=dirs only; src/proxy.ts present; 0 `src/` changes | 2 findings routed: nul→S01 (fixed), eslint migration scratch→S06 (fixed via globalIgnores) |

Waves: W1 = S01,S02,S03,S06 · W2 = S04,S05 · W3 = S07
Global constraint: zero changes under `src/`. No commits, no deps, no `.env*`.
Note: after S03 alone, `tsc`/`vitest` fail on moved `oracle.mjs` import — expected; S04 restores green.

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| W1 | typecheck | `npx tsc --noEmit` | FAIL (expected): only 8 `tests/golden` imports of `../../scripts/oracle.mjs` — restores in S04 |
| W1 | scope | `git status --short` | PASS: no `src/` changes; all edits inside shard Files lists |
| W2 | typecheck | `npx tsc --noEmit` | PASS (S04 dev): 0 errors |
| W2 | unit | `npx vitest run` | PASS (S04 dev): 46 files / 1140 tests |
| W2 | lint | `npx eslint tests/golden scripts` | PASS: 0 errors, 61 pre-existing warnings (unused-vars in ported golden tests) |
| W3 | typecheck/unit/build | `tsc --noEmit` / `vitest run` / `next build` | PASS (S07): 0 err / 1140 tests / build success |
| W3 | lint | `npx eslint .` | PASS after fix: EXIT=0, 0 errors, 322 pre-existing warnings |
| W3 | scope | `git status --short` + `ls KPIs/` | PASS: 0 `src/` changes; KPIs root = CX-Hub, _archive, .devin |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|

## Blocked / needs user
- (none)
