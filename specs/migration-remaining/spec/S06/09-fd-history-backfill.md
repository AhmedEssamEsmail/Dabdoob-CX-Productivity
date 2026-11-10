# S06-09: New Tickets Daily gap-backfill CLI (bounded either/or)
Kind: mini
ID: S06-09
Parent: S06
Owner: data-engineer
Depends: S06-03
Criteria: PLAN #1, #3 (NTD sheets proven ⊆ fd_activities, or the gap lands)
Skills: none
Budget: files=1; actions=5; changed_lines=180; minutes=10

## Goal
Scratch CLI `migration/backfill-fd-history.ts`: `--dry` (default) reads each
NTD sheet whose S06-03 verdict is `gap:<from>,<to>` — chunked, fd_activities
shape + dedupe key — and prints would_write; `--write` upserts (PM-gated).
If BOTH verdicts are `subset`, the leaf records `rejected: ⊆ fd_activities`
and no write path is needed.

## Files
- Create: `migration/backfill-fd-history.ts` | one CLI script

## Context
- `specs/migration-remaining/decisions-coverage.md` | required: per-sheet
  verdict + gap range — do NOT re-derive
- `src/features/shared/jobs/mirrors.ts:62-72,151-243` | fd_activities row
  shape + ts_ms derivation (activity_local_tz MM-dd-yyyy) + dedupe key —
  replicate this exact mapping for NTD columns
- `src/features/shared/jobs/sheets.ts:80-123` | fetchWorkbookTabs paged reads
  (parameterized by spreadsheet id — reuse for the two NTD stores)
- `migration/backfill-fc-messages.ts` | sibling backfill CLI pattern
  (dry/write, upsert onConflict dedupe_key, summary line)

## Contract
Sheets (only those with a `gap:` verdict): touch_archive
`1qch1vaZP2xaiQQ3k0FFhWLGJ4gVL0i7Zx_vbX3jG_-A` and qa_engine_source
`1VtBT8kIIhK7PxKYJJQlnhxNtmz17ewhkWtpUt8jiB4s`, tab `New Tickets Daily`.
Read paged via fetchWorkbookTabs (huge sheets — never a single A:ZZ pull);
keep only rows whose parsed ts_ms falls inside the gap range (±1 day margin);
shape to fd_activities columns exactly as mirrors.ts derives them; dedupe on
the same key; `--dry` prints read/unique/would_write per sheet; `--write`
upserts `onConflict` the fd_activities dedupe key in 500 batches. A `subset`
verdict sheet is skipped with a log line — the script never scans a sheet
the decision doc proved covered.
Out of scope: editing mirrors.ts/sheets.ts; live `--write` (PM gate); the
'Activities' tab (S04-04 owns it).

## Actions
1. Read decisions-coverage.md; fix the per-sheet verdict/gap range.
2. Create the script: env bootstrap, flag parse, paged sheet read filtered to
   the gap window, fd_activities row mapping per mirrors.ts.
3. `--dry` summary lines + `--write` upsert path behind the flag.
4. Run `--dry` -> `specs/migration-remaining/logs/fdhist-dry.log`; or skip
   runs entirely when both verdicts are `subset` (record that instead).
5. Write `results/S06-09.md` (<=10 lines: dry counts or the subset finding).

## Done when
- `--dry` prints per-sheet would_write for every `gap:` sheet (or the file
  records both sheets proven `subset` — either outcome closes the flag).
- `--write` exists behind the flag, never executed by the leaf.

## Verify
- Run: `npx tsx migration/backfill-fd-history.ts --dry > specs/migration-remaining/logs/fdhist-dry.log 2>&1; echo "exit=$?"; tail -c 2000 specs/migration-remaining/logs/fdhist-dry.log` -> exit=0 (or documented subset skip).

## Handoff
PM gate: `--write` only for `gap:` sheets; counts to migration-run-2.md via
S06-12. Write `results/S06-09.md`; TL updates TRACKER.md.
