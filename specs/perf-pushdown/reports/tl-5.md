# tl-5 — FIX round for reports/data-2.md (data-6 MED)

## Scope
One blocking finding routed: **data-6** — the last two raw `slot_date`
predicates on `queue_submissions` (miss-by-SQL vs `dqSubmissionsFor_`'s
`slice(0,10)` normalisation). Fix leaf: `spec/fix-data-2.md#data6-01` (dev).

## TL repo-wide slot_date sweep (task requirement)
Every `slot_date` predicate site in `src/` classified:
- `queue_submissions` reads feeding `dqSubmissionsFor_`: 4 fixed in data2-01,
  2 fixed here — **zero raw predicates remain**.
- Whole-table `readStore` reads (server.ts:242, one-on-ones-page.ts:578): no
  predicate, natural superset — clean.
- Snapshot tables `queue_snapshots`/`agg_snapshots_today` (aggregates.ts:378,
  jobs.ts:352, pages.ts:160, server.ts:78): `eq` retained intentionally —
  consumers compare raw `===` (index.ts:161); a variant row fails both sides
  identically, so no parity break (data2-01 contract, confirmed by data-2.md).

## Changed files (+76/-5, TL-verified diff)
- `src/features/cx-queue/lib/jobs.ts` — `.in('slot_date', dueDates)` ->
  `gte(lo)/lte(hi+'\ufffd')` min/max bound in `dqRemindMissedCheckins_`.
- `src/features/cx-queue/lib/server.ts` — dedupe `.eq` -> `gte/lte` prefix
  bound + `.order('slot_date', asc)` tie-break (clean ISO row wins) in
  `submitQueueCheckin`.
- `tests/golden/reminders-off-dq.test.ts` — T-suffixed row => no false
  missed-check-in popup/mail.
- `tests/golden/queue-checkin.test.ts` — T-suffixed stored row takes update
  path; `submission_id` kept, no duplicate append.

## Gates
- `npx vitest run` (full): **1298/1298**, 86 files — `logs/data6-gate-vitest.log`.
- `npx tsc --noEmit` (full, worker-run): **0 errors**.

## Status / handoff to PM
- data-6 **done**; data-2 report round-2 queue is empty (0 open findings).
- Standing NEEDS_APPROVAL unchanged: remote read-only `slot_date` format
  counts (3 tables) — no MCP; non-blocking, superset bound is safe either way.
- No reviewers run/spawned per rules; DELTA scope for the data-analyst re-run:
  the 4 files above.
