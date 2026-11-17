# data3-03 — DONE

- Files: `src/features/cx-queue/lib/tlqueue.ts` (tlqIo_ exported; trackerRecords + ticketsSince -> readAllPaged), `tests/platform/tlq-io-paged.test.ts` (new).
- tracker_records pages `pk:'row_n'` + `eq tracker_id`; tickets pages `columns=FD_TICKET_HEADERS` + `gte created_at`. No `db().from()` for either table remains.
- Checks: `npx vitest run tests/platform/tlq-io-paged.test.ts tests/golden/queue-tlqueue.test.ts` -> 51/51 pass; `npx tsc --noEmit` exit 0 (results/data3-03-tsc.log empty).
- Blockers/handoff: none. No remote/real-source runs.
