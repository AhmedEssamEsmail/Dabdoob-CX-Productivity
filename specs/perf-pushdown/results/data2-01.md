# data2-01: queue_submissions slot_date prefix-superset bound — DONE

- Bound form: gte `min` + lte `max + U+FFFD` (no stores.ts change; `slot_date` is text, `idx_queue_submissions_slot_date` covers the range).
- Edited: aggregates.ts:170-173 (`[pulseTo]`), server.ts:80-83 (`today`), pages.ts:136-139 + 240 (`[yesterday,today]` contiguous). Snapshot eq reads, jobs.ts:292, whole-table readStore calls untouched per contract; JS `dqSubmissionsFor_` filter kept.
- Strict superset: every stored `'YYYY-MM-DD<suffix>'` inside the requested contiguous set is returned; `'dd/mm/yyyy'` rows still correctly dropped (consumer drops them too).
- Test: `slot_date: '2026-05-06T08:00'` fixture row now reaches `dqSubmissionsFor_` — 13:00 slot `done`/`tl@dabdoob.com` + checkin-help `who` asserted; narrow() mirrors the bound; `in`/`eq` assertions -> `gte`/`lte`.
- Checks: `npx vitest run tests/perf/hub-aggregates.test.ts tests/golden/queue-checkin.test.ts` -> 42/42 green; +hub-overview +stores-filter 16/16; `npx tsc --noEmit` -> 0 errors.
- Remote count `slot_date !~ '^\d{4}-\d{2}-\d{2}$'` NOT run — no MCP tools available; remote SELECTs need approval anyway. Superset bound is safe either way.
- NEEDS_APPROVAL: run read-only count on `queue_submissions`/`queue_snapshots`/`agg_snapshots_today` for non-ISO slot_date; >0 -> PM data-cleanup item (no parity break).
