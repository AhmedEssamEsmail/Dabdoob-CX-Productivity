# tl-7 — fd-direct-mirrors OPS round 3 (ops1-03, grant #6)

Scope: resume-mode `run-fd-mirror` on production to close the Oct-2→now gap.
Worker: fresh background data-engineer (b7588439). TL verification: read-only
remote SELECTs, `Target:` = dabdoob-cx-productivity (uugeyulccyytvgcabzzx)
confirmed on every call. Script edit only (gitignored `migration/`); no source
edits, no git ops, no reviewers spawned.

## Executed 2026-11-13 ~15:5x–16:1x UTC
| Step | Result | Evidence |
|---|---|---|
| Preflight | PASS | FRESHDESK_API_KEY / SERVICE_ROLE / URL=uugeyulccyytvgcabzzx present (names only) |
| `--resume` flag added | DONE | `migration/run-fd-mirror.ts` +~21 ln: `resume()` → `syncMirror(cfg,TABLE,{})` (non-full), dispatch `RESUME?resume():WRITE?write():check()`; `--write` untouched |
| Resume runs | DONE-WITH-GAP | #1 exit 0 `fetched=62,291 written=62,265 partial=true` (Oct-2→Oct-25); #2/#3 walked Oct-25→Nov-12 then exit 1 — deterministic `ticket_activities export 2026-11-13 → HTTP 404` (FD hasn't published today's export; 4th run skipped). `full=false` every run (logs/ops1-03-resume.log) |

## TL verification (prod, ~16:2x UTC) — independent re-run of leaf queries
- n = **183,410** · max_pa = **2026-11-12 21:10:40Z** · future_dated = **0** ·
  performed_at≡ts_ms mismatches = **0** (full-table aggregate).
- `mirror_state_fd_activities` = `{last_ts_ms:1794528000000}` = Nov-13 00:00Z,
  last_sync_at 16:09Z — incremental cut resumes at Nov-12 00:00 (−24h overlap).
- Count vs task estimate: expected ~156k (66,212 + ~90k); actual gap was
  ~117k rows (~2.9k/day vs ~2.1k/day estimate) — internally consistent
  (66,212 + 117,198 = 183,410), not an anomaly.

## Residual gap & notes for PM
- **Residual = today's window only.** Freshdesk 404s the same-day export until
  it publishes (pre-existing mirrors.ts constraint — "a failing day fails the
  window", mirrors.ts:109). No invocation today can close it; the deployed
  incremental cron resumes at Nov-13 00:00 cut and fills Nov-13 once FD
  publishes. Each cron run will log that same-day 404 meanwhile — benign
  (prior windows already upserted+saved), but worth a future hardening leaf
  (tolerate last-window 404) if PM wants quiet logs.
- ops1-01's Done-when (Sep-1→today coverage) is now effectively satisfied via
  ops1-03; its row stays `blocked` as historical record — superseded, not
  re-run. ops-1 package effectively complete for all granted actions.

## Status
ops1-03 = **done** (done-when met via documented-residual clause). TRACKER
updated. Grant #6 consumed; nothing beyond it executed. No NEEDS_APPROVAL
outstanding from this leaf.
