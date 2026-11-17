# data1-01 — DONE
- Status: done; L now decimal minutes end-to-end.
- Files: src/features/shared/jobs/dbbook.ts (hmsToSec_ helper, *1440 + 'H:MM:SS' fallback, doc comment), tests/jobs/dbbook.test.ts, tests/jobs/env-dbbook.test.ts (fixtures = String(90/86400); fallback duration '0:02:00').
- Check: `npx vitest run tests/jobs/dbbook.test.ts tests/jobs/env-dbbook.test.ts` -> 19/19 pass.
- Handoff: hmsToSec_ private to dbbook; env.ts/roster.ts untouched (data1-02/03).
