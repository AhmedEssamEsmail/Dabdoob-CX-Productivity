# S04-04: fd_activities parity check + gap-backfill CLI
Kind: mini
ID: S04-04
Parent: S04
Owner: data-engineer
Depends: none
Criteria: PLAN #3 (fd_activities verified complete vs 'Activities' tab or
gap-backfilled; 195,553 rows today)
Skills: none
Budget: files=1; actions=5; changed_lines=140; minutes=10

## Goal
Scratch CLI `migration/run-fd-mirror.ts`: `--check` (default, read-only)
reports 'Activities' tab row count vs `fd_activities` remote count + max
ts_ms; `--write` runs the ported `syncMirror(cfg,'fd_activities',{full:true})`
to close any gap — the sheet-backed fetch needs no vendor creds.

## Files
- Create: `migration/run-fd-mirror.ts` | one CLI script

## Context
- `src/features/shared/jobs/mirrors.ts:62-72,151-243` | fd_activities spec
  (fetch reads fd_activity_ss_id 'Activities' via fetchWorkbookTabs — sheet,
  not API) + syncMirror signature/result
- `src/features/shared/jobs/sheets.ts:80-123` | fetchWorkbookTabs (paged,
  handles ~195k rows)
- `src/features/shared/platform/settings.ts` | `configAll()` → Cfg for
  syncMirror (`fd_activity_ss_id`, `activity_local_tz`)
- `migration/migrate-all.ts:15-32` | env + supabase client pattern

## Contract
`--check`: fetchWorkbookTabs count of 'Activities' data rows vs
`select('id', {count:'exact', head:true})` on fd_activities + `max(ts_ms)`;
print the delta and verdict `parity` | `gap:<n>`. `--write`: build Supabase
client from env, `const cfg = await configAll()`, call
`syncMirror(cfg,'fd_activities',{full:true})`, print the MirrorSyncResult
(fetched/written/skipped/watermark/partial). `partial:true` means rerun to
resume — note it, don't loop. Both modes print a single summary line parseable
for the audit ledger.
Out of scope: editing mirrors.ts/settings; freshchat (S04-03); live `--write`
(PM gate); ts_ms backfill of older rows (watermark contract is mirrors.ts's).

## Actions
1. Create the script: env bootstrap, flag parse, imports.
2. `--check` path: tab count + remote count + max ts_ms + verdict line.
3. `--write` path: syncMirror full call + result print.
4. Run `--check` → `specs/migration-remaining/logs/fd-check.log`; record
   exit + counts in results.
5. If `--check` errors on creds, record it honestly (do not fake output).

## Done when
- `--check` prints tab-vs-remote counts + verdict from live data.
- `--write` path exists behind the flag (not executed by the leaf).

## Verify
- Run: `npx tsx migration/run-fd-mirror.ts --check > specs/migration-remaining/logs/fd-check.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/fd-check.log` -> exit=0, verdict line printed.

## Handoff
PM gate: `--write` only if verdict=gap; outcome to migration-run-2.md. Write
`results/S04-04.md`; TL updates TRACKER.md.
