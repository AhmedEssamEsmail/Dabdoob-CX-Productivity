# debug report - qa-build-missing-agents - 1
Verdict: ROOT_CAUSE_FOUND
Repro: `npx vitest run tests/quality/qe-touch-scan-cap.test.ts` -> `AssertionError: expected 1000 to be 2500` (build saw only the PostgREST-capped newest page). Also proven live: replaying the engine's exact `fd_activities` query returns 1000 rows spanning only 2026-11-19 13:42..21:18 UTC, and the per-agent pair counts inside that subset equal the build's recorded `t` values **exactly**.

## Root cause
`src/features/cx-quality/lib/engine-live.ts:178-185` — `qeReadTouches_` issues a single `.limit(QE_MAX_TOUCH_ROWS = 60000)` query (order `ts_ms` desc). PostgREST `max-rows` silently truncates the response to 1000 rows, so the build scanned only the newest ~1000 of ~16,354 in-window activity rows. The legacy "chunked bottom-up scan" lost its chunking in the port; the repo's own `readAllPaged` (repo.ts:229) exists precisely for this hazard but isn't used here. Result: `touch.pairs` collapses → `byAgent` (fresh) collapses → agents get bogus `min`/`cf`/`none`/absent verdicts while eligible.

## qe_outcomes row (ran_at 2026-11-20 14:49:55, mode day, queued_date 2026-11-20)
m=3 (minTouches), cf=true, lb=3. All `w=0` (qe_queue_log had zero rows for W2026-11-15 at build time — first live build of the week; iso_week format matches, no canon mismatch; `qaImportQueue_` then imported all 34 queued rows to qa_queue — verified).

| agent | r | t | f | p | s/k | recorded reason vs truth (verified from fd_activities + tickets) |
|---|---|---|---|---|---|---|
| Abdelsamad Mohamed Abdelsamad Youssef | min | 24 | 1 | 1 | – | capped-subset pairs = 24 exactly; real window pairs = 56, fresh 4 (50 now-Closed) |
| Adel Sharif Shorhabil Ahmed | min | 25 | 1 | 1 | – | capped = 25 exactly; real pairs = 174, fresh 17 (Chats 6 + Inbound Calls 5 = cf-eligible) |
| Maria Mamdouh Youssif Hanna | cf | 33 | 4 | 4 | – | capped = 33 exactly; real pairs = 208, fresh 113 incl. **93 Waiting Address** — customer-facing, so 'cf' is an artifact |
| Eman Abdelhamid Ibrahim Mgahed Badran | cf | 30 | 6 | 6 | – | capped = 30 exactly; real pairs = 163, fresh 47 incl. 18 Inbound Calls + 16 Chats — 'cf' is an artifact |
| Yasser Anwar Othamn Eissa | min | 12 | 1 | 1 | – | capped = 12 exactly; real pairs = 189, fresh 70 (46 Chats + 15 Inbound Calls) |
| Shorouk Ehab Abdo Abdelrahman | none | 5 | 0 | 0 | – | capped = 5 exactly; real pairs = 130, fresh 44 (36 Chats + 4 Inbound Calls) |
| Shirin Abuagla Mustafa Hamadelnil | **absent from outcomes.a** | – | – | – | – | **Legitimate skip**: `User 501007345342` has 402 activity rows Nov 16–17 but **0 inside the draw window** (Nov 18 00:00 → Nov 21 00:00 Asia/Riyadh) — zero in-window touches |

Proof details: every in-window activity row for all 7 agents has `synced_at <= 2026-11-20T06:49:43Z` — present in the mirror 6 h before the build; the missing rows are lost to the 1000-row cap, not sync lag. `qe_builds` notes for the run: "245 excluded by status (ticket now: Closed 244…)" — that drop count is itself deflated by the same truncation.

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
| dbg-1 | HIGH | engine-live.ts:178-185 | Single `.limit(60000)` read of `fd_activities` truncated by PostgREST max-rows to 1000 newest rows; pair counts in outcomes match the capped subset exactly (24/25/33/30/12/5/0) vs true 56/174/208/163/189/130. | Page the read: keep `.gte/.lt('ts_ms',…).order('ts_ms', desc)` + secondary `id` desc for stable paging, loop `.range(from, from+999)` accumulating until a short page or `QE_MAX_TOUCH_ROWS` total (preserves newest-first cap semantics). | dev |
| dbg-2 | MED | engine-live.ts:587 via repo.ts:287-293 | `qeReadLog_` calls `readRows(qe_queue_log, {limit: 200000})` → takes the single-`.limit()` branch → silently capped at 1000 (oldest rows by id). Latent today (log ~34 rows); once the log exceeds 1000, `qePartitionLog_` misses recent rows → weekTaken/todayTaken/blocked under-count → re-offers and quota over-offer. | Drop the `limit` option (undefined) so `readRows` uses the `readAllPaged` path — semantics unchanged. | dev |

Regression test: `tests/quality/qe-touch-scan-cap.test.ts` — **failing now** (`expected 1000 to be 2500`); passes once `qeReadTouches_` paginates (mock honours `.range()` + enforces the 1000-row cap per response).
Siblings: `dqReadTail` (stores.ts:118) and other `.limit(1)` reads are small-n, not affected. No other single-shot large `.limit()` found in cx-quality.

## Fix-plan notes / risks
- After the fix, the pool will grow ~10-20× for busy agents: expect more `'ok'`, more `'channel'` short-picks; `qeSelectForAgent_`/`qeChooseWindow_` unchanged.
- Page-order stability: `ts_ms` has ties (same-ms activities) — add deterministic secondary order (`id`) or the boundary rows can duplicate/skip across pages.
- Shirin needs no fix: no in-window touches. Consider (optional, separate) emitting an outcome row for roster agents with zero touches so "absent" becomes an explicit reason.
- This also explains why the `Agents-by-week` grid's completed-audit counts (12/10/16…) coexist with `w=0`: those audits were completed on items queued by earlier imports, not this week's live log.
