# tl-5 — FIX round for reports/sec-1.md (round 5)

Input: `reports/sec-1.md` (FAIL; 1M/3L). Every row treated as blocking;
LOW rows routed to `deferred` per skill rule (pm flagged all blocking —
say the word and they can be re-dispatched as leaves).

## Disposition
| Finding | Sev | Disposition | Evidence |
|---|---|---|---|
| sec-1 | MED | FIXED via S09-01 (dev) + S09-02 (supabase-expert), serial | below |
| sec-2 | LOW | deferred | needs live-data confirm (sent_at precision / NULL-key probes) before touching |
| sec-3 | LOW | deferred | one-line sha1 fix queued for a later round |
| sec-4 | LOW | deferred + PM decision pending | real employee email hardcode also flagged by S06-01; added to Blocked/needs-user |

## Changed files (DELTA scope for re-review)
- `src/features/shared/migration/mappings/queue-quality.ts` — `dedupeKey_`
  helper (prefix + sha1 of '|'-joined `String(v ?? '')` cells, positional
  fallback only when ALL identity cells empty); sched_plan, QaAccessLog and
  refresh_log (log_id — same positional root cause, same upsertOn hazard)
  mints converted; comments/DECISIONS updated.
- `src/features/shared/migration/mappings/v1-ops-sched.ts` — ShiftPlan mint
  -> `'v1-mig-'+sha1(month|tl|date|shift|variant)`; comments updated.
- `tests/lib/migration-dedupe-key.test.ts` — NEW, 13 tests (stability across
  ctx.index, prefix, empty-fallback, fixed vector).
- `supabase/migrations/20261109130415_dedupe_uniques_logs_ops.sql` — §6
  qa_access_log backfill -> `'mig-'+extensions.digest(sha1)` of
  email|action|submitted_by|submitted_at; `IS NULL` guard + `'mig-'+id`
  all-empty fallback; `CREATE EXTENSION IF NOT EXISTS pgcrypto WITH SCHEMA
  extensions`.
- `supabase/migrations/20261109130633_dedupe_uniques_people_sched.sql` — §7
  sched_plan backfill -> same shape over
  month|tl_email|date|shift|variant.
- Parity PROVEN: `supabase db query` vs Node `createHash('sha1')` produced
  identical keys both sides; `supabase db lint` exit=0; migrations still
  idempotent (NULL guards, IF NOT EXISTS).

## Residuals (safe-direction, recorded for reviewer)
- `submitted_at` is timestamptz: `::text` is the canonical stored form; a
  non-canonical sheet-display string can't be recovered from the cast. A
  mismatched format makes a re-run treat the row as a NEW event (dup-insert),
  never a wrong-row UPDATE. sec-1's corruption vector is closed either way.
- All-empty identity rows: transform falls back `'mig-'+ctx.index`, backfill
  uses `'mig-'+id` — keys differ, again dup-insert only. sched_plan can't hit
  this (`require: tl_email,date`); qa_access_log could but rows are rare.
- v1 hashes raw `tl` cell (sheetToDb maps tl->tl_email) — same value.

## Integration gates (round 5) — all PASS
- `tsc --noEmit` exit=0 · `vitest run` 60 files/1161 tests (+13) · scoped
  `eslint` on the 3 touched files exit=0 · `migrate-all --dry` 101/110 read,
  only the 9 pre-existing tab-name READ FAILEDs · `validate.ts --md` 124
  tables / 98 mapped / db failed 0 · readonly proof 0 matches.
- Logs: `logs/tl5-*.log`.

## Still blocked / needs user
- NEEDS_APPROVAL: apply the (now hash-backfill) pending migrations
  20261109130415 + 20261109130633 before any live re-run of sched_plan /
  qa_access_log imports — plus the previously-listed pending applies/writes.
- NEEDS_USER: S06-11 Aug-2026 workbook share (unchanged).
- sec-4 deferred LOW pending PM confirmation of the employee-email constant.
