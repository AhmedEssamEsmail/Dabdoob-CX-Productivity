# S04-03: freshchat sheet→mirror backfill CLI
Kind: mini
ID: S04-03
Parent: S04
Owner: data-engineer
Depends: none
Criteria: PLAN #3 (freshchat holds 'Freshchat' tab history; 0 rows today)
Skills: none
Budget: files=1; actions=5; changed_lines=180; minutes=10

## Goal
Scratch CLI `migration/backfill-freshchat-sheet.ts` that reads the
'Freshchat' tab of `daily_report_ss_id` through the sheets seam and upserts
mirror rows into `freshchat` — the history the API-only mirror fetch can't
pull without FRESHCHAT_* creds (B3). Default mode is read-only `--dry`;
`--write` performs the upserts (approval-gated, PM runs it).

## Files
- Create: `migration/backfill-freshchat-sheet.ts` | one CLI script

## Context
- `src/features/shared/jobs/mirrors.ts:86-106,126-128,199-210` | freshchat
  ts_ms logic + dedupeKey sha1 + {dedupe_key,ts_ms,cols,synced_at} row shape —
  replicate verbatim, do NOT call the API fetch
- `src/features/shared/jobs/sheets.ts:80-123` | `fetchWorkbookTabs(id,['Freshchat'])`
- `supabase/migrations/004_mirror_tables.sql:30-37` | freshchat table shape
- `migration/migrate-all.ts:15-32` | env loading + supabase client pattern;
  `'server-only'` imports are fine under tsx (WP-51 precedent)

## Contract
Script flow: load `.env.local` → read `daily_report_ss_id` config value
(fallback literal `1Ll5BxooiYJhKooIr88p_g-ePRo9WI9lvLkWDXdju7V4`) →
`fetchWorkbookTabs` 'Freshchat' → per data row `cells = r.slice(0,7)`;
`ts_ms` = `tphClock_(data_tz).ms(cells[3]) ?? tphClock_(data_tz).ms(cells[0])`,
fallback the `-\d{12,14}$` epoch suffix of cells[2] (mirrors.ts:94-103);
skip + count rows with no ts. `dedupe_key = sha1('freshchat|'+JSON.stringify(cells))`.
`--dry` prints read/skipped/would-write counts (default); `--write` upserts in
batches of 500 `onConflict: 'dedupe_key'` and prints written count. `data_tz`
from config or `'Africa/Cairo'` fallback constant with a comment. Paced reads
are unnecessary (one tab) — reuse fetchWorkbookTabs as-is.
Out of scope: editing mirrors.ts or any committed file; API pulls; live
`--write` run (PM gate); other daily_report tabs.

## Actions
1. Create the script: imports (googleapis-free — fetchWorkbookTabs + supabase
   client + node:crypto + tphClock_), env bootstrap, `--dry`/`--write` flag
   parse.
2. Implement tab read + row→{dedupe_key,ts_ms,cols,synced_at} per the mirror
   contract.
3. `--dry` count path (always runs; logs counts).
4. `--write` batched upsert path.
5. Run `--dry` → `specs/migration-remaining/logs/fc-dry.log`; record exit +
   counts in results.

## Done when
- Script compiles and `--dry` prints real counts from the live tab.
- `--write` path exists behind the flag (not executed by the leaf).

## Verify
- Run: `npx tsx migration/backfill-freshchat-sheet.ts > specs/migration-remaining/logs/fc-dry.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/fc-dry.log` -> exit=0, counts>0.

## Handoff
PM approval gate: `--write` run populates freshchat; counts land in
migration-run-2.md. Write `results/S04-03.md`; TL updates TRACKER.md.
