# tl-4: FIX round — reports/data-1.md (2026-11-12)

All 5 blocking findings routed via `spec/fix-data-1.md` (6 leaves; data-1 split
into two independent root causes). All leaves done, integration green.

## Changed files (DELTA scope for reviewer)

| Leaf | Finding | Files changed | Evidence |
|---|---|---|---|
| data1-01 | data-1 (Xa) | `src/features/cx-productivity/components/tph-grid-views.tsx` | deps `[d,missingMap]` -> `[missingMap, d.off, d.channels, d.activities]` + eslint-disable comment (We reads only those fields); tph-grid-memo 7/7 |
| data1-02 | data-1 (audit-queue) | `src/features/cx-quality/components/audit-queue-page.tsx` | sort memos dep on destructured `apply` fns, not the re-created `f`/`g` objects; audit-queue-memo 4/4 |
| data2-01 | data-2 | `aggregates.ts`, `server.ts`, `pages.ts` (x2), `tests/perf/hub-aggregates.test.ts` | 4 `queue_submissions` reads feeding `dqSubmissionsFor_` widened to `gte min`/`lte max+'\ufffd'` prefix-superset; T-suffixed fixture row now reaches check-in slots; strict superset, no shared-infra change |
| data3-01 | data-3 | `src/features/cx-queue/lib/jobs.ts`, `tests/jobs/queue-tickets-read.test.ts` | `cacheRemove('live|'+table)` (best-effort) after `delErr` check — covers empty-rows branch too; regression test green |
| data4-01 | data-4 | `src/features/shared/jobs/env.ts`, `tests/perf/fallback-log.test.ts` | `dedupeRows_` last-wins per key tuple feeds upsert + delete + insert; test proves deduped rows on both paths |
| data5-01 | data-5 | `src/features/shared/platform/repo.ts`, `tests/platform/repo.test.ts` | `updateRows` batch select -> chunked (500-key) `readAllPaged`; >pageSize regression case green |

## Integration gates (round 8)

- `npx vitest run` (full): **PASS 1296/1296**, 86 files — the 5 red memo tests
  are green; +4 new regression cases. Log: `logs/data1-gate-vitest.log`.
- `npx eslint` (12 touched files): **PASS 0 errors / 0 warnings** (1 new
  exhaustive-deps warning fixed via documented disable). Log:
  `logs/data1-gate-eslint.log`.
- `npx tsc --noEmit`: 0 errors (worker-run on data2-01, data5-01 scopes).
- data-1 HIGH reproduced before dispatch: `logs/data1-failures.log` (5/11
  fail -> all green).

## Blocked / needs user

- OPEN: remote read-only `slot_date` format counts (3 tables) — no MCP;
  NEEDS_APPROVAL. Non-blocking: data2-01's bound is a strict superset so it is
  correct with or without the count; a positive count in snapshot tables would
  be a separate data-cleanup item (consumers compare raw — no parity break).

## Notes

- No reviewer agents spawned (PM runs gates). One follow-up agent dispatched
  for the new eslint warning on data1-01's own diff.
