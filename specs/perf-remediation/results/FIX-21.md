# FIX-21 result
Status: done
Files: src/features/shared/platform/repo.ts (signature -> JSON.stringify(Object.keys(patch).sort())); tests/platform/repo.test.ts (+1 collision regression test)
Checks: `npx vitest run tests/platform/repo.test.ts` 17/17 pass; `npx tsc --noEmit` 0 errors
Notes: test uses patch keys {a,bc} vs {ab,c} whose join('') collides; expects 2 upserts (fails on old signature by construction)
Blockers/Handoff: none
