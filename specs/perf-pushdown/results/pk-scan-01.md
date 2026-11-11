# pk-scan-01 — remote PK evidence for escalated drift tables

Status: DONE. `docs/perf/pk-drift-evidence.md` written — verdict per all 11 escalated names.
Method: SELECT-only `BEGIN READ ONLY` via direct-pg pooler (approved S01-01 class; `db query --remote` now 403s on saved login). No DDL/DML.
Verdicts needing override: prod_intervals→interval_key (remote pkey — uniqueness confirmed), prod_flag_log→log_id, prod_flag_analytics/fcr_daily→[date,agent_email], fcr_weekly→[week,agent_email], fcr_monthly→[month,agent_email].
Already fine (bigint `id` pkey, default path): qa_forms, freshchat, fd_activities, maqsam_calls.
Absent: queue_status_submissions — stale name at cx-people/one-on-ones-page.ts:578; probable rename→queue_submissions (pk id). PM/user call needed.
needs-ALTER: none. Handoff: pk-apply-01 consumes verdicts; dqReadTail must resolve via PK_OVERRIDES (id-safe only on the 4 bigint tables).
Checks: `type docs\perf\pk-drift-evidence.md` → 11 verdict rows.
