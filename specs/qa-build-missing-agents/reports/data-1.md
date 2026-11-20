# data report - qa-build-missing-agents - round 1 (FULL)
Verdict: FAIL        (1 MED open — latent quota-key mismatch, unrelated to the paging diff itself)
Open: 0B/0H/1M/1L
Scope: does the paging fix restore correct per-agent touch counts + weekTaken (20/week) accounting. Live read-only SELECTs run against prod (approved 2026-11-20); aggregates only.

## Definitions (in force, config `qa_engine_settings` + defaults)
- Quota: auditsPerWeek=20, auditsPerDay=4, offerMultiplier=1.5 → offer cap = 30 offers/week, 6 offers/day. minTouches=3, requireCustomerFacing=true, weekStartsOn=0 (Sun), lookbackDays=3. Draw window verified: 2026-11-18 00:00 → 2026-11-21 00:00 Asia/Riyadh.
- weekTaken[agent][channel] = qe_queue_log rows with iso_week===weekKey && state!=='passed' (includes expired) + extraTaken (qa_queue request/non-ticket since weekStart). Slots = min(offerPerDay, offerPerWeek − taken) − todayTaken.

## Reconciliation (recomputed live vs recorded outcome row 2026-11-20 14:49:55)
| Metric | Sample | Expected (recomputed) | Recorded | Delta | Tol |
|---|---|---|---|---|---|
| Per-agent touch pairs in window | 6 flagged agents | 56/174/208/163/189/130 (from 5,841 in-window fd_activities, distinct ticket\|agent) | t=24/25/33/30/12/5 | recorded = 1000-row-capped subset exactly | 0 |
| weekTaken W2026-11-15 | all agents | {Aya 6, Elhassan 5, Kareem 6, Omar 6, Rawda 5, Reem 6} from 34 pending log rows | w=0 for all at build time | 0 (log had no W2026-11-15 rows pre-build) | 0 |
| Fix coverage, touches | fd_activities window | 5,841 rows > 1,000 cap → single-shot read truncated; `.range()` loop now pages all 6 pages | — | fixed | — |
| Fix coverage, log | qe_queue_log | now **1,034 rows > 1,000 cap**; the 34 current-week rows are the tail by id (up to 4921) | old `limit:200000` read would return oldest 1,000 and silently drop this week's rows → weekTaken=0 + unblocked re-offers | prevented by dbg-2 fix | — |
| Under-quota slot math | 6 flagged agents | taken=0 → slots=min(6, 30−0)=6/day; all 6 have fresh≥3 + cf channels in true data → expect r∈{ok,channel,pool}, k>0 next build | got r=min/cf/none | explained fully by truncation | — |
| Shirin (fd_id …5342) | in-window pairs | 0 (verified: performer absent from all 765 in-window performers) | absent from outcomes | 0 — legitimate skip | 0 |

## Findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED | server.ts:2210 + engine-live.ts:719-723,792-795 | `qaRequestedTaken_` keys extraTaken by `qeCanonAgent_(agent_name)` = first+last name ('Abdelsamad Mohamed'), but weekTaken/pool keys are full roster names ('Abdelsamad Mohamed Abdelsamad Youssef'). Requested items land on a phantom key, are never subtracted from slots → agents with requests get **over**-offered past the 30-offer week cap; the phantom key is also invisible in outcomes. Latent today: 0 request/non-ticket qa_queue rows since 2026-11-15. | Key extraTaken by the same spelling weekTaken uses (raw queue agent name), or canonize both `QE_LOG_COL['Agent']`/pool `agent` and the qa_queue key consistently at the join point. | dev |
| data-2 | LOW | engine-live.ts:710-724 | Rows re-marked `state='expired'` still count into weekTaken (`st!=='passed'`): an unaudited expired offer consumes the weekly cap, and with reofferExpired the same ticket can be re-offered and burn another slot. Parity-presumed; no expired rows exist this week to check against legacy intent. | Verify vs legacy: if expired offers shouldn't consume quota, exclude `st==='expired'` in the weekTaken block. | dev |

## Fix verification (the asked question)
- `qeReadTouches_` (engine-live.ts:178-194): `.range(from,to)` pages, order `ts_ms desc, id desc`, stops on short page or QE_MAX_TOUCH_ROWS=60,000; break test uses page width (`to-from+1`) — correct. Preserves newest-first cap semantics; deterministic tie-break. Restores true per-agent `t`/`pairs` → correct `f`, `byAgent`, min/cf verdicts → under-quota agents qualify.
- `qeReadLog_` (engine-live.ts:596): no-limit readRows → readAllPaged (`id` asc, dup `.order('id')` verified harmless live). Prevents weekTaken/todayTaken/blocked under-count now that log >1,000.
- Net: the six flagged agents each have 30−0 offer slots and qualifying fresh tickets; the next build should emit samples for them. Shirin remains legitimately absent.

## Not verified / assumptions
- Live re-build not run (read-only approval). Next build's outcomes should show t≈recomputed pairs (window rolls forward, so exact values shift) and r='ok'/k>0 for the six agents.
- "20/week" is the audit target; the engine's offer cap is 30/week by design (offerMultiplier) — weekTaken counts offers, not completed audits.
- qa_queue hold 34 imported rows (all ticket audits); no request items exist to exercise extraTaken.
