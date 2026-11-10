# LIVE-03 — seven --write backfills: BLOCKED at script 3/7 (resume attempt 3; stop-on-failure honored)

- Ran from project root as `npx tsx --conditions=react-server <script> --write`; output appended to `logs/live-03-backfills.log`.
- 1/7 `backfill-freshchat-sheet --write`: exit=0 — written=1753 (prior run; NOT re-run).
- 2/7 `run-fd-mirror --write`: exit=0 — `fd-write fetched=210166 written=210143 skipped=0` (prior run; NOT re-run).
- 3/7 `run-qa-history --write`: **exit=1**, verbatim error:
  `Fatal: DescribedError: invalid input syntax for type numeric: ""` (errors.ts:193 <- migrate.ts:353 qa_audits upsert <- run-qa-history.ts:73).
- Prior blockers resolved: lv3-01 server-only installed; lv3-02 lowercased `qe_hist_` cursor key (migrate.ts:331) — the config-key fatal is gone; the run reached the upsert.
- Root cause (read-only): migrate.ts:279 emits `score_final: ''` and `started_at: ''`; qa_audits cols are `numeric` / `timestamptz` (20261105172048_quality.sql:80-81). Empty string is invalid for both — needs `null` instead. Partial first-chunk qa_audits rows are upsert-keyed `onConflict: audit_id` — a fixed re-run reconciles idempotently.
- 4–7 `run-sc-refresh`, `backfill-fc-messages`, `backfill-fd-history`, `backfill-qe-cache-orphans`: NOT run — contract stop. `validate.ts --md` not run.
- NEEDS_USER: fix migrate.ts:279 empty-string numerics/timestamps (`''` -> `null`) — requires a code-edit leaf; then resume sequence from 3/7.
