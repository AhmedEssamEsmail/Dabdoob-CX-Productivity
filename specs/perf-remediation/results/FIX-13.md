# FIX-13 results

Status: DONE — data-5 composite-key collision fixed.
Files: src/features/shared/jobs/env.ts:292 (keyOf -> JSON.stringify(keys.map(k => r[k] ?? null))); tests/jobs/helpers.ts:58 (mirrored); tests/jobs/tph-jobs.test.ts (+regression: ('ab','c') vs ('a','bc') both survive via upsert/upsertIn).
Checks: `npx vitest run tests/jobs/tph-jobs.test.ts` -> 7/7 green; `npx tsc --noEmit` -> 0 errors. Logs: logs/FIX-13-{vitest,tsc}.log.
Notes: regression would fail under join('') (second row overwrites first); upsert/upsertIn called with year=null per JobEnv signature.
Blockers/handoff: none.
