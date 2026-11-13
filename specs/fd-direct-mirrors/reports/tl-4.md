# tl-4 — FIX round for reports/data-1.md (fd-direct-mirrors)

Source report: `reports/data-1.md` (FAIL; 1B/2H/0M/2L). Fix spec authored:
`spec/fix-data-1.md` — preflight `check_shards.py` PASS on both leaves.

## Dispatched / completed
| Leaf | Finding | Owner | Files changed | Result |
|---|---|---|---|---|
| data1-01 | data-2 (HIGH) | data-engineer | `src/features/shared/jobs/mirrors.ts`, `tests/jobs/mirrors.test.ts` | done — `RETENTION_FLOOR_MS` (2026-09-01), windowed-walk `Math.max` clamp (:305), `consume` sub-floor skip (:279); covers `run-fd-mirror --write` + admin backfill. results/data1-01.md |
| data1-02 | data-3 (HIGH) | data-engineer | `src/features/shared/jobs/freshdesk.ts`, `specs/fd-direct-mirrors/PLAN.md` (D3), `tests/jobs/fd-ticket-floor.test.ts` (new) | done — exported `fdFloorCursor_` clamps any sub-floor/unparseable cursor to `2026-09-01T00:00:00Z` at `fdSyncLoop_` entry (:308); covers incremental −5min overlap + full-sync `freshdesk_full_sync_start`/`2000-01-01` fallbacks; PLAN D3 corrected. results/data1-02.md |

## Not dispatched
- **data-1 (BLOCKER)** — fix is pure approved ops, scripts already authored:
  `migration/reset-fd-activities.ts --write` then `migration/run-fd-mirror.ts
  --write`. **NEEDS_APPROVAL** (remote writes; not self-approved). Mandatory
  order: deploy data1-01 floor → reset --write → rebuild --write, before the
  first post-deploy `job-productivity-daily` cron run.
- **data-3 config write** — prod `v2_fd_inc_cursor = 2026-09-01T00:00:00Z`
  (repopulates subject/order_id on 56,014 retained tickets). NEEDS_APPROVAL;
  safe any time after data1-02 deploys.
- **data-4, data-5 (LOW)** — deferred per workflow.

## Gates (fix-data-1 integration)
`npx vitest run` on mirrors + fd-ticket-floor + fd-activity-export +
fd-activity-cells + backfill: **37/37 green**; `npx tsc --noEmit` clean;
`npx eslint` on 4 touched files clean. Logs: `reports/gate-fix-data1-*.log`.

## Reviewer DELTA scope
`mirrors.ts` (+floor const/clamp/skip), `freshdesk.ts` (+FD_TICKETS_FLOOR,
fdFloorCursor_, loop-entry clamp), `PLAN.md` D3 text, new
`tests/jobs/fd-ticket-floor.test.ts`, `tests/jobs/mirrors.test.ts` (+3 floor
tests). No shard asked for a reviewer/debugger role.
