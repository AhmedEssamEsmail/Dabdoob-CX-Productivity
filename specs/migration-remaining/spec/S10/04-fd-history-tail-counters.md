# S10-04: backfill-fd-history — split in_gap into left/right tails + future-date counter
Kind: mini
ID: S10-04
Parent: S10
Owner: data-engineer
Depends: none
Criteria: finding data-4 (reports/data-1.md) — MED
Skills: none
Budget: files=1; actions=4; changed_lines=60; minutes=8

## Goal
`in_gap` lumps both uncovered tails; the right tail admits rows with
`Performed At` up to 2028-07-10 — post-snapshot/future dates, likely corrupt
source values — and no per-tail or future-dated count exists in the evidence.
Quantify them before `--write`: split counters + flag future rows.

## Files
- Edit: `migration/backfill-fd-history.ts` | `inGap` ~71-74, the row loop + log lines ~130-156

## Context
- `migration/backfill-fd-history.ts:35-38,71-74` | MARGIN/FD_MIN/FD_MAX and
  `inGap` — left tail `[from-M, FD_MIN+M]`, right tail `[FD_MAX-M, to+M]`
- `migration/backfill-fd-history.ts:130-156` | per-sheet loop counters +
  `console.log` lines (`in_gap=`, `TOTAL:`)
- `specs/migration-remaining/decisions-coverage.md:18-27` | the verdict
  windows the tails come from (future dates up to 2028-07-10)

## Contract
- Per-sheet log gains `in_gap_left=` / `in_gap_right=` / `future=` (rows in
  the right tail with `ts > FD_MAX + MARGIN` — a SUBSET of in_gap_right, still
  written, just counted and flagged). TOTAL line gains the same three sums.
- Write behaviour unchanged: future-dated rows are still collected/upserted;
  this leaf only quantifies. No changes to dedupe, tz, or the pending-set
  logic.
Out of scope: other backfill/CLI files, decisions docs, --write path changes.

## Actions
1. Replace `inGap` with a side-aware check (e.g. `gapSide(ts,s): 'left' |
   'right' | null`) — same boundaries, MARGIN included.
2. Row loop: count `inGapLeft`/`inGapRight`/`future` (future = right-tail row
   with ts > FD_MAX + MARGIN) per sheet + totals.
3. Extend both `console.log` templates with the three new fields.
4. Run `--dry`; record the split + future counts in results.

## Done when
- `npx tsx migration/backfill-fd-history.ts --dry` exit=0; output shows
  `in_gap_left`/`in_gap_right`/`future` per sheet and in TOTAL.
- unique/would_write totals identical to prior dry evidence (fdhist-dry.log
  in_gap 500,973 = left+right sums).

## Verify
- Run: `npx tsx migration/backfill-fd-history.ts --dry > specs/migration-remaining/logs/s10-fdhist-dry.log 2>&1` -> exit=0; split counters logged

## Handoff
The `future=` count is the data-gate's quantified answer for the right-tail
risk; approval runbook references it before `--write`.
Write results/S10-04.md (<=10 lines); TL alone updates TRACKER.md.
