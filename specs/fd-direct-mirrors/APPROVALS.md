# APPROVALS: fd-direct-mirrors

Granted by user via PM, 2026-11-12, during BUILD continuation. Each grant is
one-shot for the named action only; anything beyond it is a new NEEDS_APPROVAL.

1. APPROVED — Apply the 4 pending migrations to remote production NOW via CLI:
   - `20261112150304` (maqsam_calls + freshchat typed cols)
   - `20261112150305` (fd_activities typed cols)
   - `20261112150724` (tickets subject/order_id)
   - `20261112150725` (drop fc_messages)
   Method: `npx supabase db push --remote` (or MCP apply_migration + repair per
   project lessons). Verify `Target:` = production before executing.

2. APPROVED — S05-01 purge script `--write` on production.
   Dry-run counts: fd_activities=301,053 · maqsam_calls=73,690 · freshchat=0 ·
   tickets=120,602 (pre-2026-09-01 rows; mirrors by ts_ms, tickets by updated_at).

3. APPROVED — S05-02 backfill script `--write` on production, once migrations
   (1) and purge (2) are complete and dry-run verifies clean.

Ordering chain still holds: migrations → purge → backfill → S04 reader cutover
→ S05-03 → S05-04 (drop cols = new migration, merge-to-main path; its remote
apply is NOT covered here).

CLI caveats: project linked to production `uugeyulccyytvgcabzzx`; always
`--remote` and check `Target:`; if `SUPABASE_ACCESS_TOKEN` 403s, retry with
`env -u SUPABASE_ACCESS_TOKEN`; bursts of remote calls can 403-cooldown —
batch and retry.

---

## Round 2 grants (data-1 BLOCKER fix) — approved 2026-11-12

4. APPROVED — fd_activities rebuild sequence on production, in order:
   a. floor code in effect for the running scripts (local working tree has it;
      deployed-app cron ordering per data-2.md note — before first post-deploy
      cron),
   b. `npx tsx migration/reset-fd-activities.ts --write` — wipes all
      fd_activities rows + resets its watermark,
   c. `npx tsx migration/run-fd-mirror.ts --write` — API-direct rebuild with
      correct DD/MM parsing + Sep-1 retention floor.

5. APPROVED — set `v2_fd_inc_cursor = 2026-09-01T00:00:00Z` on production
   (corrected D3; repopulates tickets.subject/order_id Sep-1-forward only).

## Round 3 grants — approved 2026-11-12

6. APPROVED — resume-mode `run-fd-mirror` invocation on production to close the
   Oct-2→now gap (~90k rows). Continues from the Oct-2 watermark; the `--write`
   full-mode treadmill is superseded by this grant.

7. APPROVED — deploy to production BEFORE 06:30 UTC 2026-11-13: commit ONLY
   this spec's files (exclude TRACKER-baseline foreign files and gitignored
   migration/ ops scripts), push to main → Vercel production build (poll to
   READY/ERROR per workflow). Merge auto-applies migration 20261113115521
   (drop cols) — consistent with plan; cols are all NULL post-cutover.
