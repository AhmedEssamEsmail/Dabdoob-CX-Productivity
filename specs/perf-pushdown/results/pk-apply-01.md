# pk-apply-01 — DONE
Status: done. Files: src/features/shared/platform/repo.ts (PK_OVERRIDES exported + 6 entries), src/features/shared/platform/stores.ts (dqReadTail pk-aware), tests/perf/read-all-paged.test.ts (+4 tests).
Overrides added per docs/perf/pk-drift-evidence.md: prod_intervals->interval_key, prod_flag_log->log_id, prod_flag_analytics/fcr_daily->[date,agent_email], fcr_weekly->[week,agent_email], fcr_monthly->[month,agent_email]. qa_forms/freshchat/fd_activities/maqsam_calls keep default `id` (verified by test). No override for queue_status_submissions — table absent (rename to queue_submissions is a PM/user call; stale call site cx-people/one-on-ones-page.ts:578).
dqReadTail: resolves `PK_OVERRIDES[name] ?? 'id'`; composite pk orders by ALL key columns desc (deterministic total order -> true tail of n; contract's first-column option noted, chose all-columns for determinism). Return shape unchanged.
Checks: `npx vitest run tests/perf/read-all-paged.test.ts tests/perf/dq-live-cache.test.ts` -> 16/16 pass; `npx tsc --noEmit` -> exit 0.
Handoff: needs-ALTER: none. queue_status_submissions escalation -> PM. Re-run p19-04 profile for /audit-queue.
