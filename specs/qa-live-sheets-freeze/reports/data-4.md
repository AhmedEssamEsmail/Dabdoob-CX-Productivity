# data report - qa-live-sheets-freeze - round 4 (DELTA)

Verdict: PASS        (FAIL if any BLOCKER/HIGH/MED open)
Open: 0B/0H/0M/1L

DELTA scope: prior open data-3 findings + tl-9 changed files
(`scorecard-server.ts` :227-270/:568-569, `tlqueue.ts` :592/:617-626,
`tests/platform/sc-daily-db.test.ts`, `tests/platform/tlq-io-paged.test.ts` new).

Reconciliation (code-level vs canonical semantics; no remote DB access):

- **data-6 (HIGH) — CLOSED.** `meta.fcr_dated = merged.fcrRows > 0`
  (scorecard-server.ts:569) writes a real boolean through `scMonthUpsert_`'s
  verbatim `{...meta}` upsert (:473-476) into `sc_months.fcr_dated BOOLEAN NOT
  NULL`; the error path copies `prev.fcr_dated` which is already a DB boolean.
  Tests pin `toBe(true)`/`toBe(false)` + `typeof boolean`
  (sc-daily-db.test.ts:294-308). `behaviour_found = 1` still coerces via boolin.
- **data-7 (MED) — CLOSED.** Audit predicate (:269-270) is now verbatim
  `qaRollupAudits_` (core.ts:264): `String(r.kind || 'audit') === 'audit' &&
  status !== 'voided' && status !== 'disputed'` — empty-kind rows count,
  disputed rows excluded; docblock (:227-230) updated to match. Tests pin
  disputed-skip and kind-''-counts (sc-daily-db.test.ts:145-154).
- **data-8 (MED) — CLOSED with LOW residual (data-13).** `trackerRecords`
  → `readAllPaged('tracker_records', {pk:'row_n', eq tracker_id})` (:617-621);
  `ticketsSince` → `readAllPaged('tickets', {columns: FD_TICKET_HEADERS.join(','),
  gte created_at since})` (:622-626). FD_TICKET_HEADERS (index.ts:52-57) is a
  subset of the tickets DDL columns (20261106151132:153-162) minus `id` —
  PostgREST orders on unselected `id` fine, identity PK is unique. Test
  asserts both calls go through the pager and never `db().from()` unpaged
  (tlq-io-paged.test.ts:59-77). Pager itself is PK-ordered `.range` until a
  short page (repo.ts:199-217) — the 1000-row silent truncation is gone.
- data-9/10/11/12 LOW — unchanged, still open per tl-9 deferral (LOW routing
  is a PM decision; none regress).

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-13 | LOW | src/features/cx-queue/lib/tlqueue.ts:619 | `pk:'row_n'` is not the tracker_records PK — actual PK is (tracker_id, record_id), and `row_n` uniqueness is only indexed, not constrained (20261105172348:60-62). With `eq tracker_id` the order is unique in practice (row_n preserves sheet ordering), but a duplicate row_n inside one tracker + >1000 rows lets `.range` paging skip/dup rows — same silent-loss class as data-8. Not currently triggered (tracker_records 2376 rows total across all trackers; OL subset <<1000). | `pk: ['row_n', 'record_id']` — keeps sheet order with a deterministic tiebreak; readAllPaged already accepts string[] (repo.ts:201). | data-engineer |

Not verified / assumptions:
- Remote `sc_months.fcr_dated` type still unconfirmed (data-3 note) — boolean literal is valid under either BOOLEAN or TEXT drift, so the fix is safe regardless; the `information_schema` check remains a nice-to-have.
- `qa_audits.status` vocab — 'disputed' assumed a literal status value per canonical; if disputes instead live in qa_disputes with status untouched, the added predicate is a no-op (harmless).
- tl-9 gates (tsc 0 errors, eslint 0 errors, vitest 1465/1466 with the known-external qe-fd-cache failure) taken from the FIX report, not re-run.
- `schedPlanRows` `.in('month', months)` read left unpaged — bounded by month list (<=2), accepted.
