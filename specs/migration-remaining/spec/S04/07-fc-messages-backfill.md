# S04-07: fc_messages sheet→mirror backfill CLI
Kind: mini
ID: S04-07
Parent: S04
Owner: data-engineer
Depends: S01-01, S04-01
Criteria: PLAN #1 (fc_messages → migrated via raw mirror)
Skills: none
Budget: files=1; actions=5; changed_lines=160; minutes=10

## Goal
Scratch CLI `migration/backfill-fc-messages.ts` that reads the 'Freshchat
Detailed Msgs' workbook (`1ZxDxS…`) tabs listed in the source inventory and
upserts raw mirror rows into `fc_messages`. Default `--dry` is read-only;
`--write` upserts (approval-gated, PM runs it).

## Files
- Create: `migration/backfill-fc-messages.ts` | one CLI script

## Context
- `specs/migration-remaining/source-inventory.md` | fc_messages tab names +
  header row + which column carries a timestamp (S01-01 — required)
- `supabase/migrations/004_mirror_tables.sql:12-19` | mirror shape contract
  (dedupe_key/ts_ms/cols/synced_at)
- `src/features/shared/jobs/mirrors.ts:126-128` | dedupeKey sha1 convention
- `src/features/shared/jobs/sheets.ts:80-123` | fetchWorkbookTabs
- `migration/migrate-all.ts:15-32` | env + supabase client pattern

## Contract
Per tab named in the inventory (skip header-only/empty tabs, count them):
each data row → `cells` = the row verbatim (full width, do not slice unless
the inventory shows trailing empty padding — record the width used),
`dedupe_key = sha1('fc_messages|'+tab+'|'+JSON.stringify(cells))`,
`ts_ms` = parsed timestamp of the column the inventory flagged (else NULL —
nullable per S04-01's contract), `synced_at = now`. `--dry` prints
per-tab read/skipped/would-write; `--write` upserts batches of 500
`onConflict:'dedupe_key'`. Dedupe within the run via a Map on dedupe_key
(same pattern as mirrors.ts pending map — Postgres refuses duplicate conflict
keys in one batch).
Out of scope: committed files; ts parsing beyond the flagged column; live
`--write` (PM gate); the freshchat mirror (S04-03 — different table/tab).

## Actions
1. Create the script: env bootstrap, flag parse, imports.
2. Tab reads via fetchWorkbookTabs for the inventory's tab list.
3. Row→mirror-row mapping incl. dedupe Map + ts_ms parse/NULL.
4. `--dry` counts; `--write` batched upserts + written count.
5. Run `--dry` → `specs/migration-remaining/logs/fcmsg-dry.log`; record
   exit + counts in results.

## Done when
- `--dry` prints real per-tab counts from the live workbook.
- `--write` path exists behind the flag (not executed by the leaf).

## Verify
- Run: `npx tsx migration/backfill-fc-messages.ts > specs/migration-remaining/logs/fcmsg-dry.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/fcmsg-dry.log` -> exit=0, counts printed.

## Handoff
PM gate: `--write` populates fc_messages; counts to migration-run-2.md.
Write `results/S04-07.md`; TL updates TRACKER.md.
