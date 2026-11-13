# data1-02 — DONE

- `src/features/shared/jobs/freshdesk.ts`: added `FD_TICKETS_FLOOR` + exported
  `fdFloorCursor_` (below-floor/unparseable/empty -> `2026-09-01T00:00:00Z`);
  `fdSyncLoop_` clamps `cursor` at entry — covers incremental (−5 min overlap)
  and full-sync `2000-01-01`/`freshdesk_full_sync_start` fallbacks.
- `specs/fd-direct-mirrors/PLAN.md` D3: reset target now `2026-09-01T00:00:00Z`,
  enforced by `fdFloorCursor_`.
- Created `tests/jobs/fd-ticket-floor.test.ts` (5 cases, all green).
- Checks: `npx vitest run tests/jobs/fd-ticket-floor.test.ts` 5/5 pass;
  `npx tsc --noEmit` clean (empty log).
- Handoff: prod `v2_fd_inc_cursor` reset stays NEEDS_APPROVAL; now safe even
  if a wrong sub-floor value is set.
