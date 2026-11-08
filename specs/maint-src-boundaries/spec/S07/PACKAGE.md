# S07: boundaries documented + eslint guard
Kind: package
ID: S07
Dispatch: NEVER

## Goal and contract
`docs/ARCHITECTURE.md` gains a module-boundaries section documenting actual
ownership + permitted dependency directions (features → shared OK; shared →
features FORBIDDEN except the composition files `shared/jobs/{env,mirrors}.ts`;
server-only marked set + client-reachable exceptions; grid-slots in
cx-productivity; the four intentional fetchJson variants). An eslint
`no-restricted-imports` override guards `src/features/shared/**` against new
`@/features/cx-*` imports — landed only because it lints clean (after S02-02 the
only remaining cx-* imports inside shared/ are the two sanctioned files).
`docs/TESTING.md` gains the `tsx --tsconfig scripts/tsconfig.json` note.

## Children
Index: `S07/00-index.md`
- #7 -> S07-01 (eslint guard), S07-02 (docs, last leaf)

## Completion
`npx eslint .` clean with the guard active; docs match the shipped layout.
