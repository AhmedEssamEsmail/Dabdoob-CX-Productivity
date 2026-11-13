# tl-5 — fd-direct-mirrors OPS round (APPROVALS #4 + #5)
Scope: approved remote production writes only. Spec: spec/ops-1.md (2 mini
leaves, check_shards.py PASS both). No source edits; no git ops.

## Executed
| Leaf | Grant | Status | Evidence |
|---|---|---|---|
| ops1-02 | #5 `v2_fd_inc_cursor` | DONE | results/ops1-02.md — key was ABSENT (incremental sync had been skipping `run runFreshdeskFullSync first`); inserted `2026-09-01T00:00:00Z`, read-back exact, `updated_by=system:ops`, Target=uugeyulccyytvgcabzzx verified x3. Next `job-data-tick` (~15 min pg_cron) re-fetches FD ticket updates Sep-1-forward → repopulates `tickets.subject`/`order_id` on the 56,014 retained rows. Safe pre/post-deploy: value = the `fdFloorCursor_` floor. |
| ops1-01 | #4b/#4c reset+rebuild pair | BLOCKED | `FRESHDESK_API_KEY` absent from `.env.local` (and `.env.production`/`.env.pulled` are Vercel-Sensitive-redacted — WP-34 audit). `run-fd-mirror.ts --write` → `syncMirror` → `fdApiKey_()` throws before any fetch. Did NOT run the wipe: wiping without the rebuild leaves prod fd_activities empty until a deployed cron rebuilds it. |

## NEEDS_USER
Paste the real `FRESHDESK_API_KEY` into `C:\Users\AHMED\KPIs\CX-Hub\.env.local`
(Vercel env var is Sensitive — `vercel env pull` returns it redacted). Then a
fresh background TL/worker runs ops1-01 as-authored (leaf preflighted, ready).

## Timing risk for PM (vercel.json + route audit, ~15:00 UTC 2026-11-13)
- `job-productivity-daily` @ **06:30 UTC** is the ONLY scheduled fd_activities
  writer (`syncAllMirrors`, productivity.ts:326). Hard deadline for the
  wipe+rebuild AND for the data1 floor-code deploy: if prod still runs
  pre-floor code when that cron fires, it reinserts sub-floor/corrupt rows.
  Deploy state of data1-01/02 = separate approval — PM to confirm.
- Fallback if the key can't be pasted in time: run `reset --write` alone and
  let the deployed 06:30 UTC cron rebuild via its Vercel-env key — viable
  ONLY if the deployed build already carries floor+API writer; ~15h empty
  table otherwise. Needs explicit PM/user go-ahead (deviates from approved
  script order).
- `job-tph-hourly` (:05/:55) + dashboards only READ fd_activities — they show
  empty data during the wipe→rebuild gap and self-heal after rebuild.
- `job-data-tick` (~every 15 min, pg_cron per megaplan audit) now has a live
  cursor — expect a multi-tick Sep-1→now ticket catch-up starting next run;
  watch `refresh_log`/config cursor advance.

## Deferred/unactioned
- Reviewer shards: none requested/runnable (TL never spawns reviewers).
- data-4, data-5, qa-4, qa-5 LOWs remain deferred per workflow.
