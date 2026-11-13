# perf report - fd-direct-mirrors - round 1 (FULL)

Verdict: **PASS**
Open: 0B/0H/0M/2L

## Measurements

| Metric | Before (cols jsonb) | After (typed cols + adapter) | Budget | Method |
|---|---|---|---|---|
| Adapter CPU/row | `r.cols` passthrough (~0) | fd 251ns, maqsam 214ns, freshchat 376ns | typical query <100ms | node bench, 200k rows, verbatim logic replica (`perf-bench-mirror-cells.js`, node v24.14.1) |
| Adapter CPU at QE cap | ~0 | ~15ms (60,000 rows × 251ns) | <100ms | same bench × QE_MAX_TOUCH_ROWS=60000 (engine-live.ts:56) |
| Wire bytes/row, fd_activities | ~170B (`{ts_ms,dedupe_key,cols:[..]}`) | ~314B (typed select) — **+84.7%** | n/a (informative) | JSON.stringify on representative row |
| Worst-case response (tphActivityTail_, 50k cap) | ~8.5MB | ~15.7MB | none set | rows × measured bytes |
| Index coverage, all reader predicates | idx_*_ts(ts_ms) | same — unchanged, still serves every `gte/lt ts_ms` | index on filter col | migration DDL read |
| Client bundle | 0 | **0** — `mirror-cells.ts:6` is `import 'server-only'`; all 5 importers server-side (route + server-only libs) | no route JS growth | import-graph grep |
| New-col indexes | — | `idx_fd_activities_ticket`, `idx_maqsam_calls_agent`, `idx_freshchat_conv` (migrations …150305/:19, …150304/:18,:28) | — | DDL read |

Volume context (TRACKER/measured ops): fd_activities 66,212 rows rebuilt (Sep-1→Oct-1; Oct-2→now gap pending), maqsam 42,413, freshchat 1,753, tickets 56,014, qe_fd_cache ~25k.

## Findings

| ID | Sev | file:line | Issue + measured evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| perf-1 | LOW | `src/features/cx-queue/lib/jobs.ts:179` | `buildInflowAggregates_` freshchat read has **no `ts_ms` filter and no limit** — full seq scan + whole-table wire transfer every daily run. Pre-existing pattern (was `.select('cols')` unfiltered); the typed 8-col select widens each row. Table is 1,753 rows today (sub-ms scan) but grows unbounded — no retention job exists (PLAN excludes one; purge was one-shot). The maqsam leg two lines below (:185) already filters `.gte('ts_ms', sinceMs)`. | Add `.gte('ts_ms', sinceMs)` (sinceMs is already computed at :175) to match the maqsam leg. `readStore('freshchat')` at :136 is the same unbounded shape — consider `readStoreFiltered(name,{gte:{ts_ms:…}})` if the queue row only needs recent chats. | dev |
| perf-2 | LOW | `supabase/migrations/20261112150305_fd_activities_columns.sql:19`, `20261112150304_maqsam_freshchat_columns.sql:18,28` | Three new indexes (`idx_fd_activities_ticket`, `idx_maqsam_calls_agent`, `idx_freshchat_conv`) are **unused by every reader in this spec**: all mirror reads filter `ts_ms` (served by pre-existing `idx_*_ts`); `qeReadTicketDetail_` `.in('ticket_id')` hits `tickets` (unique index exists — remote_reconcile:155), not `fd_activities`. Cost = write amplification on every upsert batch (~2k rows/day — trivial). Keep if wanted for admin/debug lookups; otherwise drop to save write cost. | Either keep deliberately (document) or add `DROP INDEX` to a follow-up migration. | supabase-expert |

## Not measured / assumptions

- **No live DB access in this env** (no MCP): EXPLAIN ANALYZE not run. Index coverage asserted from DDL + predicate audit: every changed reader filters on `ts_ms` (indexes exist since `20261101175759_mirror_tables.sql:19,28,37`) except the perf-1 unfiltered freshchat reads.
- Per-window `fdActivityRosterNames_` query (mirrors.ts:96 inside `spec.fetch`, one per 1-day window): ~1 small round-trip/window (~31 on rebuild); `fdGroups_` is 6h-cached (freshdesk.ts:84). Not worth a finding.
- `api/tph/touches/route.ts:30-34`: `gte ts_ms` + `limit 20000` with no `ORDER BY` — pre-existing (diff shows no order clause before either). Index range scan serves it.
- `jobs.ts:190` maps `c[7]` on a 7-cell array (out-of-bounds → `undefined`) — identical on the old `r.cols` (7 cells, vendor-apis.ts:53). Pre-existing dead read, unchanged; correctness smell, not perf.
- `qe_fd_cache` 30-day prune `delete().lt('cached_at',…)` (engine-live.ts:316): `cached_at` unindexed → seq scan of ~25k rows once per QE build (<5ms) — acceptable.
- `readAllPaged` orders by PK `id` while filtering `ts_ms` (tlqueue.ts:611-622): planner uses `idx_*_ts` + in-memory sort of the windowed set — fine at current volumes (≤ ~66k rows).
- Golden suites unchanged (TRACKER gate-final 121/121) — cell parity asserted by tests, out of perf scope.
