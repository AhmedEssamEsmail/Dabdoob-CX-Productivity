# tl-3 — S07 round-2 reshard package (BUILD)

Scope: package S07 only (reshard rows 1–3). All 6 leaves done; round-3
integration gates pass. S06-11 remains blocked (unchanged NEEDS_USER).

## Leaves

| Leaf | Owner | Outcome | Evidence |
|---|---|---|---|
| S07-01 | dev | engine `headerKeys` + widest-row sizing | results/S07-01.md; tsc=0; key probe + tickets read 178,954 rows, logs s07-01-keys/s07-01-readsheet |
| S07-02 | dev | FD_AUX -> aux_spans (MAPPINGS/TRANSFORMS/DECISIONS + probe) | results/S07-02.md; probe 13,064 rows col_e/f/g populated, logs/s07-02-fdaux.log |
| S07-03 | dev | qa_ctls.agent_email mapped (first occurrence; `#2` echo unmapped) | results/S07-03.md; tsc=0, logs/s07-03-tsc.log |
| S07-04 | data-engineer | qe orphans verdict + `backfill-qe-cache-orphans.ts` | results/S07-04.md; --dry exit=0 MISSING=13,650 ORPHAN=1,523 (0 drift); verdict import:qe_fd_cache; logs/s07-04-qe-orphans.log |
| S07-05 | dev | validate.ts parity (transforms run, oct_workbook store, key scheme) | results/S07-05.md; targeted --md exit=0, logs/s07-05-validate.log |
| S07-06 | tech-writer | docs final-state flip | results/S07-06.md; source-inventory.md + migration-run-2.md §7 |

## Changed files (this round)

- `src/features/shared/migration/engine.ts` — headerKeys export, readSheet
  keys off widest row (S07-01, 3 fix rounds: pad header; RangeError loop)
- `src/features/shared/migration/mappings/ops-tabs.ts` — FD_AUX mapping +
  transform + decisions; qa_ctls agent_email column/sheetToDb (S07-02/03)
- `migration/validate.ts` — transform execution, oct_workbook store +
  3 EXPECTED rows, valuesToObjects key scheme (S07-05)
- `migration/backfill-qe-cache-orphans.ts` (new), `migration/probe-fd-aux.ts`
  (new scratch probe)
- `specs/migration-remaining/decisions-coverage.md` §3 verdict;
  `source-inventory.md`, `specs/megaplan/audits/migration-run-2.md` §7

## Incidents / fix rounds

1. S07-02 SCOPE_REQUEST: Sheets trims trailing blank header cells -> col_e/f/g
   never emitted. Fixed in S07-01 (pad header input to widest row).
2. Integration dry-run caught `Math.max(...rows.map())` stack overflow on the
   178,954-row tickets tab -> S07-01 fix round 3 (non-allocating loop). Proven
   by targeted readSheet (178,954 rows) and round-3 validate run.

## Integration gates (round 3) — logs/tl3-*.log

- tsc --noEmit: exit=0 · vitest: 58 files/1145 tests · eslint: 0 errors
  (367 pre-existing warnings, baseline unchanged)
- migrate-all --dry: 110/110 mappings read; aux_spans 13,064 rows;
  READ FAILEDs = 9 pre-existing unparseable tab names only
- validate --md: 124 tables; call_transcripts store=oct_workbook src=5,606
  (round-2 SRC-FAIL artifact gone); qa_ctls false skips gone; aux_spans
  src=13,064; 38 dup dedupe_keys = real identical rows (upsert-safe);
  db=0 deltas on new tables = pending migration apply, expected
- readonly proof: 0 Sheets-write calls in committed code

## Handed to PM (not shard work)

- NEEDS_APPROVAL: `migrate-all --dry --tables aux_spans`, then live
  `--tables aux_spans,qa_ctls` — aux_spans only after S06-04's
  `20261109134359_s06_new_tables.sql` is applied.
- NEEDS_APPROVAL: `backfill-qe-cache-orphans.ts --write` (13,650 upserts).
- S06-11 still blocked: NEEDS_USER share Aug-2026 workbook
  `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` to the migration-reader SA.
- All earlier approval gates from tl-2 stand (see TRACKER "Blocked / needs user").
- No shard requested forbidden roles; no RESHARD_NEEDED returned.
