# data report - fd-direct-mirrors - round 3 (DELTA)
Verdict: PASS        (data-1 BLOCKER verified closed on prod; only deferred LOWs remain)
Open: 0B/0H/0M/3L

Reconciliation: independent re-run of tl-7's leaf queries on prod (pooler, `uugeyulccyytvgcabzzx`, read-only, ~16:2x UTC same day as the fix). `fd_activities`: n=**183,410** (exact match tl-7), distinct `dedupe_key`=183,410 (0 dup), `min(performed_at)`=2026-09-01 01:15 (≥ floor), `max`=2026-11-12 21:10 ✓, `future_ts`=0, `future_pa`=0, `performed_at<>to_timestamp(ts_ms/1000)`=**0** (invariant holds full-table), `ts_ms<2026-09-01`=0, NULL ts=0. Monthly: Sep 63,123 + Oct 83,641 + Nov 36,646 = 183,410 (~2.9k/day, matches tl-7 estimate). `tickets`: n=56,014, `updated_at<2026-09-01`=0, min=Sep-1 (purge holds). `config`: `mirror_state_fd_activities.last_ts_ms`=1794528000000=Nov-13 00:00Z ✓, `v2_fd_inc_cursor`=`2026-09-01T00:00:00Z` (D3 op landed). Delta vs tl-7: **0 on every measure**; tolerance exact for counts.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|---|---|---|---|---|---|
| data-4 | LOW | `src/features/shared/jobs/vendor-apis.ts:204-209` | Unchanged — numeric `activity.group` miss persists `group_name=''`; prod shows 271/56,014 tickets empty group_name (consistent, small). | (deferred) ticket `group_name` fallback at write time | data-engineer |
| data-5 | LOW | `migration/run-fd-mirror.ts:56-90` | Unchanged — `--check` parity model still sheet-shaped; misleading post-cutover. | (deferred) recompute via `fdActivityToCells_` or count/freshness probe | data-engineer |
| data-6 | LOW | `src/features/shared/jobs/mirrors.ts:109` | Same-day FD export 404 fails the window — each cron logs a benign 404 until FD publishes (documented tl-7 residual; Nov-13 rows fill post-publish). | (deferred, optional) tolerate last-window 404 in `syncMirror` | data-engineer |

## Verified fixed
- **data-1 (BLOCKER) — CLOSED on prod.** Wipe+rebuild executed (grant #6 / tl-7): 404,915 corrupt rows gone → 183,410 API-rebuilt rows Sep-1→Nov-12. All three corruption symptoms independently re-verified absent: (a) 0 future-dated rows (was 274,882 dated Dec-2026→Jul-2028); (b) `performed_at≡ts_ms` 0 mismatches; (c) floor holds — `ts_ms<2026-09-01`=0 and min_pa=Sep-1 01:15. Wrongly-purged real Sep–Nov rows recovered: 146,764 Sep+Oct rows now present. 0 duplicate `dedupe_key` (the qa-1 re-key / pre-cron dup risk did not materialize). Residual = today's window only (FD 404s unpublished same-day export — pre-existing mirrors.ts:109 constraint, cron fills post-publish; logged as data-6).
- **D3 config op also landed**: `v2_fd_inc_cursor`=`2026-09-01T00:00:00Z` (was pending NEEDS_APPROVAL in data-2). Cursor still reads Sep-1 → forward-only guard proves the incremental ticket sync has not consumed it yet; `subject`/`order_id` still empty on all 56,014 tickets — expected to fill on the next incremental cron (re-fetch `updated_since` Sep-1 → re-upsert mapped fields). `freshdesk_full_sync_start` remains 2026-04-20 but is now unreachable-dangerous: `fdFloorCursor_` clamps it at `fdSyncLoop_` entry regardless.

## Not verified / assumptions
- `subject`/`order_id` repopulation is pending-cron, not confirmed — if still empty after the next ticket incremental runs, escalate to HIGH (would mean the write path drops the fields).
- Nov-13 `fd_activities` coverage unverifiable until FD publishes today's export; watermark sits at the Nov-13 cut as designed.
- No source files changed this round (ops only; `run-fd-mirror.ts` +~21 ln `--resume` is in gitignored `migration/`); DELTA code re-audit = nothing new, prod-state verification only.
