# data1-01: Sep-1 retention floor in the mirror sync — DONE

Files: src/features/shared/jobs/mirrors.ts (floor const, walk clamp, consume skip); tests/jobs/mirrors.test.ts (3 floor tests).
- `RETENTION_FLOOR_MS = 2026-09-01T00:00:00Z`; windowed `w` clamped via `Math.max`; `consume` counts sub-floor `ts` as skipped.
Checks: `npx vitest run tests/jobs/mirrors.test.ts` — 13/13 green (log: results/data1-01-vitest.log); `npx tsc --noEmit` — clean (results/data1-01-tsc.log).
Floor tests fail pre-fix (fdCalls[0] would be '2026-07-01'; maqsam sinceMs May-1; freshchat written=2).
Handoff: after deploy, approved `run-fd-mirror.ts --write` rebuild (data-1 ops, NEEDS_APPROVAL) cannot re-import purged Jun–Aug rows.
