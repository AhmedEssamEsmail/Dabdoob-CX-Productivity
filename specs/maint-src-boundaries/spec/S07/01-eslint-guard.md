# S07-01: eslint no-restricted-imports guard for shared/**
Kind: mini
ID: S07-01
Parent: S07
Owner: dev
Depends: S02-02
Criteria: PLAN #7
Skills: none
Budget: files=1; actions=2; changed_lines=25; minutes=10

## Goal
`eslint.config.mjs` blocks new `@/features/cx-*` imports inside
`src/features/shared/**` — except the two sanctioned composition files —
guarding the demonstrated shared→feature regression class. Land only if it
lints clean against current code.

## Files
- Edit: `eslint.config.mjs` | append two config objects inside `defineConfig([...])`, before `globalIgnores` order is irrelevant — append after the spreads

## Context
- `eslint.config.mjs:5-23` | flat config; add entries inside defineConfig array
- `src/features/shared/jobs/env.ts:41-43`, `src/features/shared/jobs/mirrors.ts:22-23` | the only remaining cx-* imports inside shared/ (sanctioned; grid-slots gone after S02-02)

## Contract
```js
{
  files: ['src/features/shared/**/*.{ts,tsx}'],
  rules: {
    'no-restricted-imports': ['error', {
      patterns: [{
        group: ['@/features/cx-*'],
        message: 'features/shared must not import feature modules (composition exceptions: jobs/env.ts, jobs/mirrors.ts)',
      }],
    }],
  },
},
{
  files: ['src/features/shared/jobs/env.ts', 'src/features/shared/jobs/mirrors.ts'],
  rules: { 'no-restricted-imports': 'off' },
},
```
Out of scope: package.json (forbidden), other rules, fixing pre-existing lint.

## Actions
1. Add the two config objects exactly as above.
2. Run `npx eslint .` — must exit clean (0 errors). If NEW violations appear
   beyond the two exempted files, stop: report `RESHARD_NEEDED: S07-01` with the
   offending files; do not add extra exemptions or weaken the rule.

## Done when
- Guard active; `npx eslint .` passes with zero no-restricted-imports violations.

## Verify
- Run: `npx eslint .` -> clean

## Handoff
Boundary enforced at lint time; S07-02 documents it in ARCHITECTURE.md.
Write results/S07-01.md (<=10 lines); TL alone updates TRACKER.md.
