# S03-32: tsx paths shim for scripts/
Kind: mini
ID: S03-32
Parent: S03
Owner: dev
Depends: S03-01
Criteria: PLAN #3 (tsx resolution)
Skills: none
Budget: files=1; actions=2; changed_lines=15; minutes=8

## Goal
Give tsx a paths shim so `scripts/ops/probe-flags.ts` keeps resolving marked
modules under `tsx --tsconfig`. (The client-side probe is S03-33.)

## Files
- Create: `scripts/tsconfig.json` | whole file, kept

## Context
- `scripts/ops/probe-flags.ts:1-4` | only tsx script reaching marked modules (dotenv + buildJobEnv + productivity)
- `tests/stubs/server-only.ts` | the stub to map (S03-01)
- `tsconfig.json:24-28` | root paths — must NOT gain a `server-only` mapping (Next's webpack test needs the raw specifier)

## Contract
`scripts/tsconfig.json` exactly:
```json
{
  "extends": "../tsconfig.json",
  "compilerOptions": {
    "paths": { "@/*": ["../src/*"], "server-only": ["../tests/stubs/server-only.ts"] }
  },
  "include": ["./**/*.ts", "../src/**/*.ts"]
}
```
Out of scope: package.json scripts (forbidden); the client probe (S03-33); marking files.

## Actions
1. Create `scripts/tsconfig.json` exactly as above.
2. Run `npx tsx --tsconfig scripts/tsconfig.json -e "import 'server-only'"` -> exits 0.

## Done when
- File created verbatim; the tsx eval resolves `server-only` with exit 0.

## Verify
- Run: `npx tsx --tsconfig scripts/tsconfig.json -e "import 'server-only'"` -> exits 0

## Handoff
`tsx --tsconfig scripts/tsconfig.json` is the documented workaround for tsx
scripts under `scripts/` (S07-02 writes it into docs/TESTING.md).
Write results/S03-32.md (<=10 lines); TL alone updates TRACKER.md.
