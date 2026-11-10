# qa report - migration-remaining - round 2 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/1L

## Checks run (re-run by QA this round)
- `npx tsc --noEmit` -> exit=0
- `npx vitest run` -> exit=0, 59 files / 1148 tests pass (incl. new migration-conflict-target 3/3)
- `npx eslint` on the 4 changed code files -> exit=0, zero warnings
- `migrate-all --dry` / validator: not re-run (remote sweeps; unchanged mapping surface since round-1 dry pass per tl-4 logs)

## Round-1 findings verification
| ID | Sev | Status | Evidence |
|---|---|---|---|
| qa-1 | HIGH | FIXED | v1-ops-sched.ts:138 now mints `'v1-mig-'+ctx.index`; core transform stays `'mig-'+ctx.index` (queue-quality.ts:557,562) and DDL backfill `'mig-'||(rn-1)` (20261109130633:106) — namespaces disjoint, no overwrite path. |
| qa-2 | HIGH | FIXED | 20261109134359_s06_new_tables.sql:77-106 adds 2 `trackers` + 16 `tracker_fields` rows for `aux_exceptions`/`wa_parcels`. Column lists verified verbatim against 009_operations.sql:8-48 schema; trackers INSERT precedes tracker_fields (FK order); `ON CONFLICT` guards make it re-runnable. |
| qa-3 | MED | FIXED | logs/null-key-probes.md: 14/14 probes return 0 NULL/dup — matches all 8 probes in 20261109130706 + all 6 in 20261109130415. Every DO block takes the natural-key ELSE branch; static upsertOn stays valid. |
| qa-4 | MED | FIXED | engine.ts `conflictTarget()` emits `"sent_at","to","subject"` (PostgREST-safe); seen-map (engine.ts:253-256) still splits raw `upsertOn` for `r[k]` — consistent, verified no mapping uses `', '` spacing (116 upsertOn sites). Test `tests/lib/migration-conflict-target.test.ts` 3/3, would fail without the fix. |
| qa-5 | MED | FIXED | v1-ops-people.ts:62,68 prefix `'v1-agent-'+id` / `'v1-tl-'+id` — disjoint from core log_ids and from each other. |
| qa-6 | LOW | OPEN (deferred) | Root `results/` still holds S06-05/S06-10/S07-05.md; housekeeping only, non-blocking. |
| qa-7 | LOW | FIXED | TRACKER.md:155-156 records the dq_hct 8 dup-email collapse caveat in the approval runbook. |

## Open findings
| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-2-1 | LOW | `results/` (repo root) | Carry-over qa-6: stray root-level result files outside spec tree. | Move into `specs/migration-remaining/results/` during housekeeping. | dev |

## Regression / scope on changed files
- engine.ts delta since round 1 is limited to `conflictTarget` + its single use site; earlier-round hunks (headerKeys, readSheet width, mapping imports) were audited in round 1.
- Seed block is idempotent and schema-conformant; no new dependencies, no debug leftovers, no scope creep in the FIX round.
- Live-write gating unchanged: all applies/writes remain NEEDS_APPROVAL; S06-11 workbook share remains NEEDS_USER.

## Not verified / assumptions
- PostgREST's acceptance of quoted `onConflict` identifiers is asserted by tl-4 reasoning + unit tests; first live upsert is still the true proof (approval-gated).
- Probe counts were captured 2026-11-09 (null-key-probes.md); a pre-apply re-check is cheap insurance if remote data drifts before approval.
