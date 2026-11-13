# data report - fd-direct-mirrors - round 2 (DELTA)
Verdict: FAIL        (data-1 BLOCKER remains open — but it is an approval-gated ops pair, not a code defect; zero open engineering findings)
Open: 1B/0H/0M/2L

Reconciliation: code-path verification only this round (no prod writes/queries — prod state unchanged pending data-1 ops). Floor clamp re-verified by reading the sole write path: mirrors upsert exists only inside `syncMirror.consume` (mirrors.ts:292) and tickets upsert only inside `fdSyncLoop_` (freshdesk.ts:283,336); every caller funnels through the new clamps. Unit evidence: 3 floor tests (mirrors.test.ts:283-303) + 5 cursor tests (fd-ticket-floor.test.ts) — 37/37 vitest green, tsc clean (gate-fix-data1-*.log).

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-1 | BLOCKER | prod `fd_activities`; `migration/reset-fd-activities.ts`, `migration/run-fd-mirror.ts` | UNCHANGED — 274,882 corrupt `ts_ms`/`performed_at` rows still live; fix is the already-authored ops pair (reset → rebuild), NEEDS_APPROVAL. Both scripts exist; reset wipes rows + `mirror_state_fd_activities`, rebuild now runs under the deployed floor. tl-4 order stands: deploy floor → `reset --write` → `run-fd-mirror --write`, before first post-deploy `job-productivity-daily` cron. | Execute ops pair (user approval required) | data-engineer |
| data-4 | LOW | `src/features/shared/jobs/vendor-apis.ts:204-209` | Unchanged — numeric `activity.group` miss persists `group_name=''`; deferred per workflow. | (deferred) ticket `group_name` fallback at write time | data-engineer |
| data-5 | LOW | `migration/run-fd-mirror.ts:56-90` | Unchanged — `--check` parity model still sheet-shaped; misleading post-cutover. | (deferred) recompute via `fdActivityToCells_` or count/freshness probe | data-engineer |

## Verified fixed (data-1 findings closed)
- **data-2 (HIGH) via data1-01** — `RETENTION_FLOOR_MS = 2026-09-01T00:00:00Z` (mirrors.ts:46). Windowed walk `w = Math.max(months[0]|cut, FLOOR)` (:305) clamps both full-sync `months[0]<2026-09` and any sub-floor incremental cut; `consume` row-level `ts < FLOOR → skipped++` (:279-282) covers non-windowed freshchat and stray sub-floor rows inside a fetched window. Coverage confirmed: `run-fd-mirror.ts --write` → `syncMirror(full:true)` (:105); admin backfill → `syncAllMirrors({full:true, monthsBack: monthCount+1})` (backfill.ts:124-128, `from` 2026-07-01 → months[0]='2026-07' → clamped); daily cron same path. Tests prove fd first fetch = `2026-09-01` (monthsBack=4 from Oct) and maqsam `sinceMs` = floor (monthsBack=6).
- **data-3 (HIGH) via data1-02** — `FD_TICKETS_FLOOR` (:35) + exported `fdFloorCursor_` (:42-44): below-floor, empty/unparseable (`NaN >= x` → false), and `2000-01-01` fallback all → `2026-09-01T00:00:00Z`. Applied once at `fdSyncLoop_` entry (:308) — the single funnel for incremental (:394, incl. −5 min overlap that dips a floor-value cursor below) and `runFreshdeskFullSync` (:417, covering prod `freshdesk_full_sync_start`=2026-04-20). Forward-only cursor guard (:340-343) untouched. `PLAN.md` D3 (:56-59) corrected to `2026-09-01T00:00:00Z`, noting `fdFloorCursor_` enforcement — code is now safe even if the config op is late or wrong.

## Not verified / assumptions
- data-1 ops unexecuted; wrongly-purged Sep–Nov rows recoverable only via the rebuild.
- D3 config write (`v2_fd_inc_cursor = 2026-09-01T00:00:00Z`, repopulates subject/order_id on 56,014 retained tickets) still NEEDS_APPROVAL; safe any time post-deploy.
- `'2026-09-01'` literal duplicated in mirrors.ts:46/freshdesk.ts:35 is a fixed historical constant (one-shot purge date) — no drift risk.
- `git status` shows the fix files uncommitted (`M`/`??`) — consistent with the data1-01/02 edits; no foreign in-flight edits observed in the touched regions; nothing reverted (read-only audit).
