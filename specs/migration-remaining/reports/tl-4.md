# tl-4 report — migration-remaining — FIX round 4 (qa-1 findings)

Verdict: all blocking findings fixed; LOW findings deferred. Gates pass.

## Findings routed (reports/qa-1.md)
| Finding | Leaf | Owner | Status | Fix |
|---|---|---|---|---|
| qa-1 HIGH | S08-01 | dev | done | `'mig-'` -> `'v1-mig-'+ctx.index` in v1-ops-sched.ts transform + docs |
| qa-2 HIGH | S08-02 | supabase-expert | done | 2 `trackers` + 16 `tracker_fields` seed rows appended to pending `20261109134359_s06_new_tables.sql`, `ON CONFLICT DO NOTHING`, storage_mode `external` |
| qa-3 MED | S08-03 | supabase-expert | done | all 14 `-- probe:` SELECTs run read-only on remote: every NULL-count=0, no dup groups -> DO blocks take natural-key ELSE branch; verdicts in `logs/null-key-probes.md` |
| qa-4 MED | S08-04 | dev | done | engine `conflictTarget()` double-quotes every onConflict identifier; seen-map keeps raw keys; `tests/lib/migration-conflict-target.test.ts` 3/3 |
| qa-5 MED | S08-05 | dev | done | `'v1-agent-'+id` / `'v1-tl-'+id` prefixes in both v1-ops-people transforms (also kills inter-v1-tab collision); DECISIONS updated |
| qa-6 LOW | — | — | deferred | stray root `results/` dir; cosmetic housekeeping |
| qa-7 LOW | — | — | deferred | dq_hct 8 dup-email collapses recorded in TRACKER approval caveats |

## Changed files (DELTA for re-review)
- `src/features/shared/migration/mappings/v1-ops-sched.ts` (dedupe namespace)
- `src/features/shared/migration/mappings/v1-ops-people.ts` (log_id prefixes)
- `src/features/shared/migration/engine.ts` (conflictTarget helper + use)
- `supabase/migrations/20261109134359_s06_new_tables.sql` (seed block appended)
- `tests/lib/migration-conflict-target.test.ts` (new, 3 tests)
- `specs/migration-remaining/logs/null-key-probes.md` (probe evidence)
- `specs/migration-remaining/{spec/S08/*, results/S08-0*.md, logs/tl4-*.log, TRACKER.md}`
- Removed stray worker artifact `nul` (repo root, 0 bytes, created this session)

## Integration gates (round 4 — logs/tl4-*.log)
- `tsc --noEmit` exit=0; `vitest run` 59 files/1148 tests PASS; `eslint .` 0 errors (367 baseline warnings)
- `migrate-all --dry`: 110/110 mappings read; only the 9 pre-existing READ FAILEDs; all v1/oct/daily_report rows read (sched_plan 240, 1:1s 36+8, aux_spans 13,064)
- `validate --md`: 124 tables, 98 mapped, db failed 0; new-table db=0 = pending applies; known-stale route.ts probe; dq_hct 8 dup-email + aux_spans 38 dup collapses consistent with keyed-upsert semantics

## Still gated (unchanged NEEDS_APPROVAL / NEEDS_USER)
- Apply 6 pending migration files incl. updated 20261109134359 (now tables+seeds)
- All live `--write`/`--tables` runs (see TRACKER "Blocked / needs user")
- S06-11 Aug-2026 workbook share
- qa-6/qa-7 deferred to housekeeping / approval runbook
