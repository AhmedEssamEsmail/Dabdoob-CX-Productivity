# S03-01: server-only foundation (decl + stub + vitest alias)
Kind: mini
ID: S03-01
Parent: S03
Owner: dev
Depends: none
Criteria: PLAN #3
Skills: none
Budget: files=3; actions=3; changed_lines=15; minutes=10

## Goal
Toolchain resolves `import 'server-only'` outside Next's webpack: an ambient
`declare module` for tsc, an empty stub aliased in vitest. No npm install —
`node_modules/server-only` does not exist; Next supplies its own compiled copy.

## Files
- Create: `src/types/server-only.d.ts` | `declare module 'server-only';`
- Create: `tests/stubs/server-only.ts` | `export {}` (empty module stub)
- Edit: `vitest.config.mjs` | `resolve.alias` — add `'server-only'` entry

## Context
- `vitest.config.mjs:5-8` | alias object to extend
- `tsconfig.json:24-28` | `paths` — do NOT add `server-only` here (Next's webpack
  `/^server-only$/` check must see the raw specifier; PLAN design note)
- `node_modules/next/dist/compiled/server-only/index.js` | Next's internal copy

## Contract
```ts
// src/types/server-only.d.ts
declare module 'server-only'
```
```ts
// tests/stubs/server-only.ts
export {}
```
```js
// vitest.config.mjs resolve.alias becomes:
alias: {
  '@': path.resolve(import.meta.dirname, 'src'),
  'server-only': path.resolve(import.meta.dirname, 'tests/stubs/server-only.ts'),
},
```
`src/types/` and `tests/stubs/` are new dirs — creating the files creates them.
Out of scope: marking any module (S03-02+); scripts/tsconfig.json (S03-32).

## Actions
1. Create `src/types/server-only.d.ts` with the ambient declaration.
2. Create `tests/stubs/server-only.ts` empty stub.
3. Add the `'server-only'` alias entry to `vitest.config.mjs` resolve.alias.

## Done when
- `import 'server-only'` typechecks and resolves under vitest; nothing else changed.

## Verify
- Run: `npx vitest run tests/jobs/grid-slots.test.ts` -> pass; `npx tsc --noEmit` -> clean

## Handoff
Foundation in place — S03-02..31 marking leaves may dispatch in parallel.
Write results/S03-01.md (<=10 lines); TL alone updates TRACKER.md.
