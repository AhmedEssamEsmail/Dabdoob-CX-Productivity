# data report - perf-pushdown - round 3 (DELTA)

Verdict: PASS — data-6 verified fixed on both sites; prefix-bound contract now
covers every `queue_submissions` read feeding a normalized consumer.

Open: 0B / 0H / 0M / 0L
Closed: data-6 (jobs.ts + server.ts)

## Reconciliation

- Independent re-run of the two touched test files: `npx vitest run
  tests/golden/reminders-off-dq.test.ts tests/golden/queue-checkin.test.ts` ->
  **42/42 pass**, 2 files, exit=0 (log `logs/data3-gate-vitest.log`). The two
  new T-suffix cases are among them. Tolerance: byte-parity vs oracle.
- `jobs.ts:291-299` (`dqRemindMissedCheckins_`): bound `[min(dueDates),
  max(dueDates)+'\ufffd']`. Any stored `r` with `r.slice(0,10) = d ∈ dueDates`
  satisfies `r >= d >= lo` and `r <= d+'\ufffd' <= hi+'\ufffd'` -> SQL keeps
  every JS-matching row; `dqSubmissionsFor_` (queue-core.ts:103-107, text ->
  `String.slice(0,10)`, `dqNormCell_` rewrites `Date` objects only,
  adapters.ts:376-382) drops between-date rows — a strict superset, same
  contract as data2-01.
- `server.ts:296-304` (`submitQueueCheckin`): `gte(d)`/`lte(d+'\ufffd')` +
  `eq(slot)` selects exactly the strings whose `slice(0,10) = d` (normal-text
  suffixes); `order(slot_date asc).limit(1)` makes the clean ISO row win —
  `'d'` is a prefix of `'d…'`, so it sorts first and matches old `.eq`
  behaviour when a clean row exists. `maybeSingle()` after `limit(1)` is safe.
- Tests prove the KPI effect: T-suffixed stored row => no false missed-check-in
  popup/mail (reminders-off-dq.test.ts:90-103); resubmit updates the variant
  row in place, keeps `submission_id` `qs_seedT`, no duplicate append
  (queue-checkin.test.ts:357-390). The update also rewrites stored `slot_date`
  to clean ISO (`input.slot_date` is normalized at server.ts:268) — heals the
  variant on resubmit.

## Findings

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| — | — | — | None. Repo sweep: all remaining raw `slot_date` `eq` predicates sit on
  `queue_snapshots`/`agg_snapshots_today` (jobs.ts:352, server.ts:78,
  pages.ts:160, aggregates.ts:378) whose consumers compare raw `===`
  (index.ts:161) — intentional per the data2-01 contract. | — | — |

## Not verified / assumptions

- Remote `slot_date` format counts still unrun (no MCP; NEEDS_APPROVAL
  stands). Non-blocking: the bound is a safe superset whether or not variant
  rows exist; findings were correctness-of-parity, not prevalence.
- Bound caveat inherited from data2-01: a suffix beginning with a
  supplementary-plane char (`>U+FFFF`, e.g. `'YYYY-MM-DD<emoji>'`) would
  normalize-match but fall outside `lte(d+'\ufffd')`. Same accepted limit at
  all 6 bound sites; no realistic `slot_date` producer emits it.
- Degenerate double-variant duplicates (`'dT08:00'` + `'dT09:00'` for one
  slot): `limit(1)` updates only the lexicographically first; both still count
  as submitted. Requires corrupt state the writers don't produce; not a
  regression vs the old `.eq` (which missed all variants and appended).
- DELTA scope: only the 4 files in tl-5 re-verified; full-suite 1298/1298 and
  tsc 0-errors taken from tl-5 gates, not re-run here.
