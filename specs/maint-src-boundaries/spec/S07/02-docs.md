# S07-02: document module boundaries + tsx flag workaround
Kind: mini
ID: S07-02
Parent: S07
Owner: tech-writer
Depends: S02-02, S03-32, S03-33, S07-01
Criteria: PLAN #7 (+#2 composition direction)
Skills: none
Budget: files=2; actions=2; changed_lines=60; minutes=10

## Goal
`docs/ARCHITECTURE.md` documents actual ownership + permitted dependency
directions; `docs/TESTING.md` notes the tsx `--tsconfig` workaround. Last shard —
describes the shipped end state.

## Files
- Edit: `docs/ARCHITECTURE.md` | new "Module boundaries" section after "Where code goes" (:61-66)
- Edit: `docs/TESTING.md` | short note in the unit-test section (:5-18)

## Context
- `docs/ARCHITECTURE.md:61-66` | insertion point ("Where code goes" section)
- `docs/TESTING.md:5-18` | insertion point for the tsx/vitest resolution note
- `eslint.config.mjs` | the guard to mention (S07-01)
- `scripts/tsconfig.json` | the tsx shim (S03-32)

## Contract
ARCHITECTURE.md — add ~40 lines covering, in the repo's own terse doc style:
- Dependency directions: `app` → `features` → `shared`; shared must NOT import
  `cx-*` (eslint `no-restricted-imports`) EXCEPT the composition files
  `shared/jobs/{env,mirrors}.ts` which intentionally wire pure cx-productivity
  engines to storage/mail — documented in their headers.
- Ownership: `grid-slots.ts` lives in `cx-productivity/lib/tph/` (single prod
  consumer); `shared/lib/fetch-json.ts` is the one cross-feature fetchJson —
  the variants in `hub-shared`, `cx-queue/shared`, `qa-shared` are intentional
  and must not be unified.
- Server-only: `import 'server-only'` marks shared/{platform,jobs,vendor,
  migration}, shared/lib server modules, and feature lib/jobs — enforced by
  Next at build; client-reachable exceptions `cx-productivity/lib/
  prod-validation.ts` and `cx-queue/lib/heatmap-engine.ts` stay unmarked.
- Page structure: routes stay thin (`<X>Page` components in feature components/).
TESTING.md — ~10 lines: vitest aliases `server-only` to `tests/stubs/`; tsx
scripts importing marked modules need `npx tsx --tsconfig scripts/tsconfig.json`.
Out of scope: rewriting existing sections, README, other docs.

## Actions
1. ARCHITECTURE.md: add the Module boundaries section above.
2. TESTING.md: add the vitest/tsx resolution note.

## Done when
- Both sections present, accurate to the shipped layout; `npx eslint .` unaffected.

## Verify
- Run: `npx eslint .` -> clean

## Handoff
PLAN #7 complete: boundaries documented and guarded.
Write results/S07-02.md (<=10 lines); TL alone updates TRACKER.md.
