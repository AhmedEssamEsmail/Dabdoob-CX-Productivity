# tl-9 — FIX round for reports/data-3.md (qa-live-sheets-freeze)

Fix spec: `spec/fix-data-3.md` (3 mini leaves, preflight PASS). Routed: data-6
HIGH, data-7 MED, data-8 MED. data-9..12 LOW deferred per FIX-mode LOW rule
(noted below for PM re-route if wanted).

## Leaves (all done)

| Leaf | Finding | Owner | Files changed | Evidence |
|---|---|---|---|---|
| data3-01 | data-6 HIGH | dev | `src/features/cx-people/lib/scorecard-server.ts` (:569), `tests/platform/sc-daily-db.test.ts` | results/data3-01.md |
| data3-02 | data-7 MED | dev | `src/features/cx-people/lib/scorecard-server.ts` (:269-270 + docblock :227), `tests/platform/sc-daily-db.test.ts` | results/data3-02.md |
| data3-03 | data-8 MED | data-engineer | `src/features/cx-queue/lib/tlqueue.ts` (:592 export, :617-626), `tests/platform/tlq-io-paged.test.ts` (new) | results/data3-03.md |

## What changed (reviewer DELTA scope)

- **data-6**: `meta.fcr_dated = merged.fcrRows > 0` — boolean into
  `sc_months.fcr_dated BOOLEAN NOT NULL`; refresh no longer throws at
  `scMonthUpsert_` after sc_daily commit. New asserts pin `typeof boolean`
  both ways (stored verdicts → true, zero-FCR → false). Repo DDL relied on —
  remote `information_schema` check suggested by analyst NOT run (no remote
  access in leaf scope); `false`/`true` is valid under either BOOLEAN or TEXT
  drift, so the fix is safe regardless.
- **data-7**: audit predicate now `String(r.kind || 'audit') === 'audit' &&
  status !== 'voided' && status !== 'disputed'` — verbatim `qaRollupAudits_`
  semantics (raw status compare, `kind||'audit'` default). Disputed and
  empty-kind edge rows pinned in sc-daily-db.test.ts.
- **data-8**: in-scope (the `tlqIo_` factory is wave-2 code). `trackerRecords`
  → `readAllPaged('tracker_records', pk:'row_n', eq tracker_id)`;
  `ticketsSince` → `readAllPaged('tickets', columns FD_TICKET_HEADERS, gte
  created_at)`; `tlqIo_` exported for the new paging test. Golden unaffected
  (fake io injected). schedPlanRows `.in(months)` read left as-is — bounded by
  month list, not flagged.

## Integration gates (round 10)

- `npx tsc --noEmit` — PASS 0 errors (results/gate10-tsc.log)
- `npx eslint .` — PASS 0 errors; same 5 pre-existing warnings, untouched files (results/gate10-eslint.log)
- `npx vitest run` — 1465/1466; sole FAIL tests/quality/qe-fd-cache.test.ts,
  the known-external parallel-workstream failure tolerated since gate1
  (results/gate10-vitest.log)

## Deferred (LOW — needs PM decision to route)

- data-9: WA `date_only` ts never parses — needs a live remote sample of
  `tracker_records('wa_parcels').values.creation_date` before fixing.
- data-10: audit-only union rows carry unread audits cols — parity-preserving.
- data-11: 'Group Check' formula loss + unreachable '^exclu' country skip —
  spec-accepted residual.
- data-12: orphan-append ghosts all-zero-fcr stored rows — contract-mandated.

## Notes

- No leaf asked for a reviewer/debugger/architect profile — none ignored.
- Owner results: `specs/qa-live-sheets-freeze/results/data3-0{1,2,3}.md`.
