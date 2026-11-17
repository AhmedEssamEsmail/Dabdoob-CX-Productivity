# data report - qa-live-sheets-freeze - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/2L

Reconciliation (delta: verify data-1/2/3 fixes per reports/tl-5.md):
- data-1 FIXED — dbbook.ts:129 `L = Number.isFinite(handling) ? handling*1440 : hmsToSec_(r.duration)/60`. End-to-end fixture: `handling=String(90/86400)` (fractional days) -> L=1.5 min asserted at grid cell (dbbook.test.ts:118) AND through prefetchWorkbook->openSpreadsheet->getRange(2,12) (env-dbbook.test.ts:120). Fallback live: `handling:undefined` + `duration:'0:02:00'` -> L=2 (test:127). Units now match prod engine.ts:312 `handlingMin:Number(r[5])||0` and tphCallMinutesFromRows_ (`j*86400000`). Blank `''` handling -> `Number('')=0` -> L=0: sheet-era parity (engine `||0`), tph's own end-start fallback on D..J cells unaffected.
- data-2 FIXED — env.ts:462-477: any real tab error -> `books[key]` = first stored Error -> openSpreadsheet throws (:447); regression test: Maqsam ok + Freshchat 'boom' -> open throws (env-dbbook.test.ts:123-129). missing_store still -> [] header-only via missingOk_ (dbbook.ts:102-109; test:224-229). Error-stored books refetch on retry (have=[] -> all tabs missing). Deliberate: later tab failure clobbers earlier good cells = sheet-era whole-book fail parity.
- data-3/sec-5 FIXED — roster.ts:321-326: snapshot Map keyed on `dqCleanEmail_(rec.email)` before 500-slice upserts; cleaned email is the upserted `email`. Collision test: 'DUP@dabdoob.com ' vs 'dup@dabdoob.com' -> 1 row, last-wins 'Dup Last', per-batch keys unique (dq-hct-snapshot.test.ts:113-131). Same-batch ON CONFLICT throw now impossible.
- Gates (tl-5): tsc 0, eslint 0, vitest 1449/1450 — sole fail qe-fd-cache known-external, unchanged since round 1, no delta file in its import graph.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-4 | LOW | src/features/shared/jobs/mirrors.ts:9-11 | Deferred docstring still names sheet tabs; SPECS use vendor APIs. Doc-only, zero numeric impact — deferral acceptable. | Update doc block to name API sources. | data-engineer |
| data-5 | LOW | src/features/shared/jobs/env.ts:323 | `tabErrors?` left in books entry type; never assigned after fix (errors now stored AS the entry). Dead type field. | Drop `tabErrors?` from the union member. | dev |

Not verified / assumptions:
- Prod DB still not queried remotely; units claim rests on vendor-apis.ts:53 storage + engine/tph consumers agreeing.
- NULL `handling` (legacy rows) -> L=0, same as `''` blank parity — engine's `||0` made these indistinguishable in sheet era too.
- `hmsToSec_` fallback only fires on non-numeric handling (undefined/garbage), not `''`; spec'd fix implemented literally and parity holds.
