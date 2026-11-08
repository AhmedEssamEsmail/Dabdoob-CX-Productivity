# S03-33: throwaway client probe proves the server-only boundary
Kind: mini
ID: S03-33
Parent: S03
Owner: dev
Depends: S01-05, S02-02, S03-02..S03-31, S04, S05-01..S05-06
Criteria: PLAN #3 (client probe)
Skills: C:\Users\AHMED\AppData\Roaming\devin\cli\plugins\cache\github.com_CognitionAI_devin-marketplace_plugins_vercel-1238b024\0.0.0-unversioned\skills\nextjs\SKILL.md
Budget: files=1; actions=3; changed_lines=15; minutes=10

## Goal
A temporary 'use client' page importing a marked module makes `next build` fail
with the server-only client-boundary error; after deleting it the build is green.
Build runs are external wait — active work is the probe file plus two commands.

## Files
- Create: `src/app/svonly-probe/page.tsx` | temporary probe — created, verified failing, then deleted inside this leaf

## Context
- `node_modules/next/dist/docs/01-app/02-guides/data-security.md` | server-only semantics
- `node_modules/next/dist/compiled/server-only/empty.js` | the throwing module Next maps client-side
- `src/features/shared/lib/supabase.ts` | marked import target (S03-12)

## Contract
Probe page: `'use client'` + `import '@/features/shared/lib/supabase'` + trivial
`export default function P() { return null }`. Delete the whole `svonly-probe`
dir after the failing build is captured.
Out of scope: every other file; the tsx shim (S03-32); any real page.

## Actions
1. Create the probe page exactly as above.
2. Run `npx next build` -> must FAIL with the server-only client-boundary error
   on `svonly-probe` (record the error text; an unrelated env-var failure =
   report as inconclusive, do not fake evidence).
3. Delete `src/app/svonly-probe/`; rerun `npx next build` -> passes.

## Done when
- Probe build failed on the server-only marker; dir removed; build green after.

## Verify
- Run: `npx next build` -> succeeds after probe removal (report env-var caveat if hit)

## Handoff
Boundary enforcement evidence for PLAN #3 (recorded in results file).
Write results/S03-33.md (<=10 lines); TL alone updates TRACKER.md.
