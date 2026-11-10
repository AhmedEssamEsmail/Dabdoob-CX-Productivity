# S04-05: QA history import CLI (voice+text response sheets)
Kind: mini
ID: S04-05
Parent: S04
Owner: data-engineer
Depends: none
Criteria: PLAN #4 (QA_HIST_SOURCES → QA audit history via the ported import)
Skills: none
Budget: files=1; actions=5; changed_lines=140; minutes=10

## Goal
Scratch CLI `migration/run-qa-history.ts`: `--probe` (default, read-only)
counts would-import rows per QA_HIST_SOURCES sheet using the pure
`qaHistoryRows_`; `--write` calls the ported `qaImportHistory_` (idempotent —
deterministic audit ids, cursor-resumable) — approval-gated, PM runs it.

## Files
- Create: `migration/run-qa-history.ts` | one CLI script

## Context
- `src/features/cx-quality/lib/migrate.ts:148-153,205-309,317+` |
  QA_HIST_SOURCES ids, pure qaHistoryRows_ (head,rows,ctx), paged reader
  qaFirstSheetRows_, writer qaImportHistory_
- `migration/migrate-all.ts:15-32` | env + supabase client pattern
- `src/features/shared/platform/identity.ts` | `normEmail`/directory helpers
  if ctx.people needs them — read only what the import path requires
- PLAN research: `cx-quality/lib/migrate.ts` holds the verbatim engine —
  prefer the ported import over a raw mirror

## Contract
`--probe` per key in {voice,text}: paged-read the first sheet (reuse the
qaFirstSheetRows_ page loop or fetchWorkbookTabs), split head/rows, build ctx
{key, since: qeLocal_(2026,5,1) or the qa_history_since default, people:
roster rows for name→email matching (read `roster` via supabase, minimal
{email,name}), managerOf: ()=>null}, call `qaHistoryRows_`, print
would-import/skipped/unmatched-count. `--write`: `qaImportHistory_('migration',{})`
and print its returned summary verbatim (one summary line). No new env vars,
no writes to sheets, no edits to cx-quality.
Out of scope: editing the ported import; secret handling (leave qa_history_secret
config untouched); live `--write` (PM gate).

## Actions
1. Create the script: env bootstrap, flag parse, supabase client.
2. Sheet paged read + head/rows split per key.
3. ctx build (people from `roster` table; since default).
4. `--probe` pure-count path; `--write` qaImportHistory_ call + summary print.
5. Run `--probe` → `specs/migration-remaining/logs/qa-probe.log`; record
   exit + counts in results.

## Done when
- `--probe` prints per-sheet would-import/skipped/unmatched from live data.
- `--write` path exists behind the flag (not executed by the leaf).

## Verify
- Run: `npx tsx migration/run-qa-history.ts --probe > specs/migration-remaining/logs/qa-probe.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/qa-probe.log` -> exit=0, counts printed.

## Handoff
PM gate: `--write` imports to qa_audits; counts to migration-run-2.md.
Write `results/S04-05.md`; TL updates TRACKER.md.
