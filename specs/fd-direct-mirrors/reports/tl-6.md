# tl-6 — fd-direct-mirrors OPS continuation (ops1-01, grants #4b/#4c)
Scope: the two approved commands only. Worker: fresh background data-engineer
(b213a67e). TL verification queries: read-only remote SELECTs, Target=prod
(uugeyulccyytvgcabzzx) confirmed every call. No source edits; no git ops.

## Executed 2026-11-13 ~15:08–15:17 UTC
| Step | Result | Evidence |
|---|---|---|
| `reset-fd-activities.ts --write` | DONE | exit 0; `before=404915 deleted=404915 remaining=0 watermark_present=false`; refresh_log `fd_activities_reset` status=ok 404915→0 finished 15:11:02 (logs/ops1-01-reset.log) |
| `run-fd-mirror.ts --write` | PARTIAL | exit 0 ×2 (run 2 provably identical — `--write`→`full:true`→`cut=-Infinity`→walk restarts at Sep-1 floor, mirrors.ts:242-244,305); `fetched=66231 written=66212 skipped=8 watermark=2026-10-02 partial=true` — stopped at 240s SYNC_BUDGET (logs/ops1-01-rebuild.log) |

## TL verification (prod, 15:2x UTC)
- `future_dated` (performed_at > now()+1d) = **0** — data-1 corruption eliminated.
- n=**66,212**; min_pa=2026-09-01 01:15:39Z (floor held); max_pa=2026-10-01 20:37:51Z.
- Date-parse spot-check: `performed_at` ≡ `to_timestamp(ts_ms/1000)` 3/3 exact.
  `cols` is NULL on all API-era rows (S05-03) — cols->>0 comparison N/A.
- config `mirror_state_fd_activities` = `{"last_ts_ms":1790899200000}` = Oct-2,
  `last_sync_at` 15:16:42Z — re-seeded; incremental resumes `cut=last_ts_ms-OVERLAP`.

## Gap & timing risk for PM (deadline: job-productivity-daily 06:30 UTC)
- **Gap:** Oct-2 → Nov-13 (~42d, est. ~90k rows at ~2.1k/day) unfilled.
  Dashboards/tph-hourly show good Sep-1→Oct-1 data + hole after Oct-2; not empty.
- **Path A (no new approval):** deployed incremental cron closes it — each run is
  also 240s-budget-capped (~31d/run observed) → likely needs **2 daily ticks**
  (~Nov-15) for full parity. REQUIRES deployed build to carry S03-03 API writer +
  data1-01 floor **before 06:30 UTC** — a stale build resumes sheet ingest at the
  Oct-2 watermark and reinserts MM/DD-corrupt rows. Deploy state = PM to confirm.
- **Path B (faster):** fresh NEEDS_APPROVAL for a local non-full/incremental
  invocation (e.g. `--resume` runner calling `syncMirror` without `full:true`)
  — closes the gap in ~2 capped runs now. Grant #4c covered the literal
  `--write` command only; I did not exceed it.
- ops1-02 consequence: `job-data-tick` is repopulating tickets from the
  `2026-09-01` cursor — unaffected, running as intended.

## Status
ops1-01 = **blocked** (approved commands ran; Done-when `partial=false` and
Sep-1→today coverage unmet, not closable within grant #4c). ops-1 package stays
open. TRACKER updated. No reviewer shards requested/runnable (TL never spawns
reviewers). NEEDS_APPROVAL items above.
