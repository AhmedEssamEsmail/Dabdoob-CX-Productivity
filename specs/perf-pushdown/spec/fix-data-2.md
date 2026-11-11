# fix-data-2: data-analyst round-2 DELTA findings (reports/data-2.md, 2026-11-12)
Source: `specs/perf-pushdown/reports/data-2.md`. The one open row (data-6, MED)
is blocking. TL sweep (2026-11-12): these are the LAST two raw `slot_date`
predicates on `queue_submissions` — every other site is either already
prefix-bounded (data2-01), a whole-table `readStore` (natural superset), or a
snapshot-table `eq` whose consumers compare raw `===` (different class, no
parity break — out of scope, same as data2-01's contract).

## data6-01: jobs.ts reminder read + server.ts checkin dedupe — prefix-superset bounds
Kind: mini
ID: data6-01
Parent: data-6
Owner: dev
Depends: none
Criteria: data-2.md data-6 (blocking)
Skills: none
Budget: files=4; actions=5; changed_lines=80; minutes=8

### Goal
The last two raw `slot_date` predicates on `queue_submissions` return a strict
superset of the rows their consumers match: a stored `'YYYY-MM-DDT…'`/`'YYYY-MM-DD …'`
row whose first 10 chars equal a requested ISO date is returned by Postgres
instead of being silently dropped — so a submitted check-in no longer reads
"missed" (false reminder popup+mail) and `submitQueueCheckin` updates the
existing row instead of appending a duplicate.

### Files
- Edit: `src/features/cx-queue/lib/jobs.ts` | the `.in('slot_date', dueDates)` read inside `dqRemindMissedCheckins_` (:291-293)
- Edit: `src/features/cx-queue/lib/server.ts` | the `.eq('slot_date', input.slot_date)` dedupe read inside `submitQueueCheckin` (:296-302)
- Edit: `tests/golden/reminders-off-dq.test.ts` | one regression case in the existing describe
- Edit: `tests/golden/queue-checkin.test.ts` | one non-oracle case for `submitQueueCheckin` (reuses `seedHub`; file already mocks supabase+auth)

### Context
- `src/features/shared/lib/queue-core.ts:94-108` | `dqSubmissionsFor_` normalizes `dqKeyPart_('slot_date', v).slice(0,10)` then matches ISO dateKeys — THIS is the consumer contract the jobs.ts read must be a superset of
- `src/features/cx-queue/lib/pages.ts:136-139` + `src/features/cx-queue/lib/server.ts:80-83` | the data2-01 bound shape already shipped: `gte: { slot_date: min }`, `lte: { slot_date: max + String.fromCharCode(0xfffd) }` — replicate it with the raw builder (`.gte`/`.lte`)
- `tests/golden/hub-fakes.ts:196-231,269` | the fake `db().from()` builder already supports `.gte`/`.lte`/`.order`/`.limit`/`.maybeSingle` — no fake changes needed
- `tests/golden/reminders-off-dq.test.ts:37-89` | `seed()`/`hubSetTables` harness: `queue_submissions` seeded per case; `CPS` is one due `14:00` checkpoint dated `2026-10-15`
- `tests/golden/queue-checkin.test.ts:103-119,262-288` | `seedHub` harness + the "updates in place" case to mirror — `submitQueueCheckin(body, actor)` is exported from `@/features/cx-queue/lib/server` and runs `assertWritable`/`configAll`/`checkinInput`, all satisfied by `seedHub()` (`view_as: []`, `checkin_slots` config, tl user)

### Contract
- jobs.ts: replace `.in('slot_date', dueDates)` with `.gte('slot_date', lo).lte('slot_date', hi + String.fromCharCode(0xfffd))` where `lo`/`hi` are the lexicographic min/max of `dueDates` (ISO strings; `due.length` guard at :290 guarantees non-empty). Keep `.select('*')`, the `subErr` handling and the in-memory `dqSubmissionsFor_` filter unchanged — PLAN rule "keep JS filter after every SQL predicate". Non-contiguous `dueDates` are fine: the min/max range is still a strict superset because `dqSubmissionsFor_` re-filters to the exact dateKeys.
- server.ts: replace `.eq('slot_date', input.slot_date)` with `.gte('slot_date', input.slot_date).lte('slot_date', input.slot_date + String.fromCharCode(0xfffd))`; add `.order('slot_date', { ascending: true })` before `.limit(1)` so a clean ISO row deterministically wins over a `'…T…'` sibling when both exist. Keep `.eq('slot', …)`, `.limit(1)`, `.maybeSingle()`, error propagation and the update/append branch unchanged.
- Strict superset only: zero behaviour change for clean ISO data. Extra-prefix rows are acceptable (consumers re-filter in memory).
- Out of scope: `queue_snapshots`/`agg_snapshots_today` `eq` reads (pages.ts:160, server.ts:78, aggregates.ts:378, jobs.ts:346 — raw `===` consumers, no parity break), whole-table `readStore` reads (server.ts:242, one-on-ones-page.ts:578), migration/backfill, remote writes, `dqSubmissionsFor_` itself, `updateRow`/`appendRow`.

### Actions
1. jobs.ts: compute `lo`/`hi` over `dueDates`; replace the `.in` call with the `.gte`/`.lte` prefix bound.
2. server.ts: replace the slot_date `.eq` with the `.gte`/`.lte` prefix bound + the `.order('slot_date', { ascending: true })` tie-break before `.limit(1)`.
3. reminders-off-dq.test.ts: add a case seeding `queue_submissions: [{ submission_id: 'qs_t1', slot_date: '2026-10-15T08:00', slot: '14:00', status: 'submitted', submitted_by: 'tl@dabdoob.com', submitted_at: '2026-10-15T10:50:00Z' }]` — after `dqRemindMissedCheckins_(NOW, CPS)` assert `hubDb.tables.popups` and `hubDb.tables.mail_log` are empty (the T-suffixed row counts as done, not missed). Set `reminders_enabled` config to `'true'` so a miss would provably mail.
4. queue-checkin.test.ts: add a non-oracle case — `seedHub({ submissions: [{ submission_id: 'qs_seedT', slot_date: '2026-10-15T08:00', slot: '14:00', status: 'submitted', submitted_by: 'tl@dabdoob.com', submitted_at: '…', queues_json: '[]' }] })` then `await submitQueueCheckin({ slot_date: '2026-10-15', slot: '14:00', status: 'submitted', queues_json: [{ queue: 'Ops QA Gift', agents: 5, status: 'On track' }] }, 'tl@dabdoob.com')` — assert `queue_submissions` still has exactly 1 row and `submission_id === 'qs_seedT'` (update path, not a duplicate append).
5. `npx vitest run tests/golden/reminders-off-dq.test.ts tests/golden/queue-checkin.test.ts` -> green; `npx tsc --noEmit` -> 0 errors (scoped run acceptable if full exceeds window; record which).

### Done when
- a stored `'YYYY-MM-DDT…'` submission suppresses the missed-check-in popup/mail for its checkpoint (test proves)
- `submitQueueCheckin` takes the update path on a T-suffixed stored row — no duplicate append (test proves)
- clean-ISO fixtures produce identical behaviour (existing cases in both files stay green)
- no `.in('slot_date'` or `.eq('slot_date'` remains on `queue_submissions` reads in src/ (TL verifies); tsc 0 errors

### Verify
- Run: `npx vitest run tests/golden/reminders-off-dq.test.ts tests/golden/queue-checkin.test.ts` -> green incl. the two new cases

### Handoff
With data6-01 green, every raw `slot_date` predicate on `queue_submissions` is
a prefix-superset bound; snapshot-table `eq` sites remain intentionally raw
(parallel consumer semantics). The remote `slot_date !~ '^\d{4}-\d{2}-\d{2}$'`
count stays NEEDS_APPROVAL (no MCP) — non-blocking; >0 would be a PM
data-cleanup item, not a parity break.
Write results/data6-01.md (<=10 lines); TL alone updates TRACKER.md.
