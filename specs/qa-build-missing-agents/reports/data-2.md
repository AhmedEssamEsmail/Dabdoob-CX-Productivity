# data report - qa-build-missing-agents - round 2 (DELTA)
Verdict: PASS        (data-1 MED closed; data-2 LOW deferred by documented TL call)
Open: 0B/0H/0M/1L
Scope: prior open finding data-1 + FIX diff (server.ts:2210, pure.ts:321-328, new test). Live read-only SELECTs on prod (approved 2026-11-20); aggregates only.

## Reconciliation
| Metric | Sample | Expected | Actual | Delta | Tol |
|---|---|---|---|---|---|
| extraTaken key space | 17 distinct qa_queue.agent_name | all ⊆ roster.name (engine weekTaken key space) | 17/17 match (qqNamesNotInRoster=0) | 0 | 0 |
| Engine agent-key source | roster cols live | key = `fd_name \|\| name` | `fd_name` column does NOT exist on roster → always `name`; `freshdesk_name` only a byName alias to same rec | 0 | — |
| extraTaken → slot path | engine-live.ts:792-795, 685-688 | `weekTaken[k].Requested += n`, summed into `taken` | merge lands on same key space; `Requested` channel included in sum | 0 | — |
| Request/non-ticket rows this week | qa_queue live | none in W2026-11-15 window | 2 reqish rows total: qd 2026-11-13 (in_progress) + qd 2026-10-30 (done); both < weekStart → extraTaken = {} | 0 | — |
| Latest build outcome | qe_outcomes newest row | — | still the buggy 2026-11-20 14:49:55 run (r: ok4/cf3/min3/pool2/none2, k-sum=34); no post-fix build yet | pending | — |

## Findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | MED → CLOSED | server.ts:2210, pure.ts:328 | Was: extraTaken keyed by `qeCanonAgent_` (first+last) → phantom key, requests never consumed the 30-offer cap. Now: both copies key by `String(q.agent_name \|\| '').trim()` = roster.name = `QE_LOG_COL['Agent']` (engine-live.ts:552, 719) = pool `agent` (roster `name`, engine-live.ts:124). Join at engine-live.ts:792-795 now aligns. | done | dev |
| data-2 | LOW (deferred) | engine-live.ts:720 | `st !== 'passed'` still counts rows re-marked `expired` into weekTaken. Deferred per tl-2: parity presumed, 0 expired rows this week to check legacy intent; excluding them is a quota-policy change. Live check confirms latest week has 0 expired (34 pending only; expired exists only in old weeks W08-30..W09-20). | needs PM/user decision: exclude `st==='expired'` from weekTaken or keep parity | dev |

## Fix verification (delta diff)
- `server.ts:2205-2213` (`qaRequestedTaken_`) and `pure.ts:324-332` (`qaRequestedTakenFor_`): identical filters (`source==='request' || qaIsNonTicket_`, excludes waived/passed/pre-weekStart) and identical key expression — the fix is applied at both write/reads of the same logic.
- `tests/quality/qa-requested-taken-key.test.ts`: 3 tests — full-name key (asserts canon 'Abdelsamad Youssef' absent), waived/passed/pre-week/blank exclusions, trim. Fails on old code (canon key ≠ roster name). Regression criterion met.
- Gates per tl-2: tsc PASS; vitest 1501/1502 (sole failure pre-existing freeze-scan allowlist, unrelated); eslint errors all pre-existing, touched files clean.

## Not verified / assumptions
- No live build has run since the fix — the "six flagged agents get samples next build" prediction from data-1 remains pending (latest qe_outcomes row is still the buggy run).
- `qaRequestedTaken_` (server.ts) and `qaRequestedTakenFor_` (pure.ts) are two hand-synced copies — repo convention (same pattern as `qaStartedLogKeys_`); drift risk noted, not flagged.
- `reqish` approximation: `source='request' OR empty ticket_id`; actual `qaIsNonTicket_` rule not re-implemented in the probe.
