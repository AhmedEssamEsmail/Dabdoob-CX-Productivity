# PLAN: fd-direct-mirrors
Type: data   Status: spec
Date: 2026-11-12   Project root: C:\Users\AHMED\KPIs\CX-Hub

## Goal
Cut `fd_activities` over from the Google Sheet mirror to the Freshdesk
`export/ticket_activities` API; normalize all three mirror tables
(`fd_activities`, `maqsam_calls`, `freshchat`) into typed columns and **drop
`cols` jsonb at the end**; extend `tickets` with `subject`/`order_id` so the QE
detail path is complete and `qe_fd_cache` gets a real populate path; retire the
user-deleted `fc_messages` table cleanly; purge all pre-2026-09-01 history from
`fd_activities`, `maqsam_calls`, `freshchat`, and `tickets`.

## Success criteria
1. `syncMirror('fd_activities')` fetches `/api/v2/export/ticket_activities` per
   day — zero Sheets-API reads for that table; day-granular watermark;
   re-runs idempotent on `dedupe_key`.
2. All three mirrors carry typed columns; every reader (`tlqueue.ts`,
   `engine-live.ts`, `jobs.ts`, `tph/run.ts`, `api/tph/touches`) produces
   identical cell arrays through the adapter — golden `tph`, `queue-tlqueue`,
   `productivity` suites pass unchanged.
3. `tickets.subject`/`order_id` exist, are mapped in `fdTicketToRow_`, and
   `qeReadTicketDetail_` returns real values (no `''` stubs); `qe_fd_cache`
   is populated during the QE build with a 30-day prune.
4. `cols` jsonb and all `cols`/`dedupe_key`-select reader code removed from
   the three mirrors (`grep cols` clean outside adapter/tests history);
   `DROP COLUMN cols` applied via new migration.
5. Pre-2026-09-01 rows purged from `fd_activities`, `maqsam_calls`,
   `freshchat` (`ts_ms`), and `tickets` (`updated_at`) via approved script;
   deleted counts logged.
6. `fc_messages`: drop migration authored; tooling/docs references removed;
   `tlqReadTexting_` sheet path (`fc_messages_ss_id`) untouched.
7. Gates: `npx tsc --noEmit` clean, `npx vitest run` green, `npx eslint` clean
   on touched files.

## Scope / Non-goals
In: mirror schema+writers+readers, FD activity export port, tickets/QE detail,
fc_messages retirement, pre-Sep-2026 purge.
Out: Freshchat conversations→fc_messages port (still B3-gated);
`qeFdFillMissingDetail_` FD-API fallback (superseded — `tickets` is source);
dropping `ts_ms`/`dedupe_key`/`synced_at` (kept); any scheduled retention job
(one-shot purge only); `maqsam_calls`/`freshchat` source changes (stay API).

## Risk flags (y/n)
arch n (design decided below) · db y · data y · auth n · external-api y
· ui n · perf y · deps n · tests n (existing golden suites are the gate)
· docs n (header edits inside code leaves)
Review gates: QA (always) · Security: run (db + external-api) · Data: run ·
Performance: run (reader select/adapter regression) · UX/UI: skip (no UI)

## Decisions (PM; veto = NEEDS_USER)
- D1 `qe_fd_cache` stays a live table, populated from `tickets` inside
  `qeReadTicketDetail_` (honors migrated 25k rows + user's sync ask).
- D2 Transition = **dual-write** typed cols + `cols` until backfill+reader
  cutover, then drop `cols` (user request, this plan — not deferred).
- D3 `subject`/`order_id` into `tickets`: port skipped them as PII-adjacent;
  they were in the legacy sheet anyway. Existing rows repopulate by resetting
  `v2_fd_inc_cursor` to `2026-09-01T00:00:00Z` (approved config op at
  release; no shard), enforced in code by `fdFloorCursor_`.
- D4 Purge key: mirrors `ts_ms < 2026-09-01T00:00:00Z`; `tickets.updated_at`
  (last-activity age, not creation — open old tickets untouched since Aug are
  purged per request). `qe_fd_cache` untouched.
- D5 Adapter emits display-equivalent cells: `*_at` timestamptz → ISO instant
  strings — the reader clocks (`tphClock_`, `dqParseTs_`) already parse the
  ISO cells vendor-apis emits today.
- D6 `fc_messages_ss_id`/`fc_messages_tab`/`fc_messages_tz` config keys and
  `health.ts:63` heartbeat stay — they drive the **sheet** reader
  (`tlqReadTexting_`), unrelated to the dropped table.

## Gate commands (run from project root)
typecheck: `npx tsc --noEmit`  lint: `npx eslint <touched>`  unit: `npx vitest run`
golden: `npx vitest run tests/golden`  build: `npx next build`

## Conventions
- Schema changes ship only as new timestamped migrations; never edit applied
  files; remote apply is user-approved only (AGENTS.md).
- Keep `*_verbatim` ported function names/comments style; mirror writers go in
  `src/features/shared/jobs/`, readers behind `readStore`/`readAllPaged`.
- Destructive prod runs (purge, backfill `--write`) are NEEDS_APPROVAL scripts
  under gitignored `migration/`, default `--dry`.

## Research notes
- FD export API is async: `GET /api/v2/export/ticket_activities?created_at=D`
  → returns `{url}` → poll/download JSON `{activities_data:[]}`
  (docs/Reference_Code.gs:168-269). Filter `performer_type==='user'`;
  `new_ticket`/`status` activities map to sheet cols 4-6.
- Sheet `Activities` cols: 0 Performed At, 1 Ticket ID, 2 Performer Name,
  3 Performer Type, 4 Activity Type, 5 Field Changed, 6 New Value,
  7 Old Value, 8 Group (engine-live.ts:142-144); cell 9 unread.
- OPEN: whether the export payload carries old-value/group — S03-02 research;
  fallback: resolve group at write time from `tickets` (current-group, not
  activity-time — acceptable drift noted).
- Existing FD client plumbing to reuse: `fdGet_` auth/429-retry,
  `FD_STATUS_NAMES`, `fdGroups_`, config `freshdesk_domain`
  (src/features/shared/jobs/freshdesk.ts).

## Key pointers
- `src/features/shared/jobs/mirrors.ts` — SPECS/consume/watermark (:59-241)
- `src/features/shared/jobs/vendor-apis.ts` — API→7-cell mappers (:37-108)
- `src/features/shared/jobs/freshdesk.ts` — FD client + ticket sync (:52-361)
- Readers to cut: `tlqueue.ts:610-613,338,353-362` · `engine-live.ts:172-251`
  · `jobs.ts:135,178-184` · `tph/run.ts:44-54,114-116,170-172`
  · `api/tph/touches/route.ts:29-35`
- DDL: `supabase/migrations/20261101175759_mirror_tables.sql` (shape),
  `20261106202513_migration_hardening.sql:194-199` (qe_fd_cache),
  `20261109131136_fc_messages.sql` (table to drop)
