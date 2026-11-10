# TL report 2 — migration-remaining, package S06 (reshard leftovers)

Mode: BUILD. Scope: S06 package only (S01–S05 already done). Tracker:
`specs/migration-remaining/TRACKER.md` (full per-leaf evidence).

## Outcome

**11/12 S06 leaves done; S06-11 blocked on NEEDS_USER (workbook share).**
Package stays `blocked` until the share lands.

## Dispatched (waves)

- Wave 1 (parallel, data-engineer): S06-01/02/03 — three read-only probes +
  decision docs. Done. Verdicts: v1_ops 8 migrate/1 NEW/8 rejected; ops tabs
  2 NEW (aux_spans, call_transcripts)/2 tracker_records/CTL split; coverage =
  2 NTD gaps + qe_cache orphans:1523.
- Wave 2 (parallel): S06-04 supabase-expert (one idempotent migration,
  3 NEW tables, 69 lines) + S06-09 data-engineer (fd-history backfill CLI;
  --dry would_write=495,825). Done.
- Wave 3 (parallel dev): S06-05/06/07/08 mapping modules. Done after one fix:
  TL scope check caught duplicate `v1_ops:TeamLeads->sched_team` in
  v1-ops-people.ts (decision doc groups it under S06-05) — fresh fix agent
  removed mapping+transform, kept DECISIONS pointer. tsc=0.
- Wave 4: S06-10 engine wiring (sole engine.ts writer; additive: 4 imports,
  2 SPREADSHEETS keys, 3 merges; +13/-3). Done.
- Wave 5: S06-12 tech-writer docs closeout (final states + run-2 §7 rows;
  Aug store recorded `blocked: share pending`). Done.

## Changed files (scoped, all new unless noted)

- `supabase/migrations/20261109134359_s06_new_tables.sql` (69)
- `src/features/shared/migration/mappings/{v1-ops-sched(189),v1-ops-people(79),v1-ops-misc(68),ops-tabs(183)}.ts`
- `src/features/shared/migration/engine.ts` +13/-3 (additive only — verified diff)
- `migration/{probe-v1-tabs,probe-ops-tabs,probe-coverage-gaps,backfill-fd-history}.ts` (scratch, gitignored)
- `specs/migration-remaining/{decisions-v1-ops,decisions-ops-tabs,decisions-coverage}.md`, `source-inventory.md` edits,
  `specs/megaplan/audits/migration-run-2.md` §7 append

## Integration gates (round 2, after all writers finished)

- `npx tsc --noEmit` PASS exit=0 · `npx vitest run` PASS exit=0 ·
  `npx eslint .` PASS 0 errors (367 pre-existing warnings, same baseline)
- `migrate-all --dry` PASS: 109/109 mappings read; all 13 S06 mappings clean
  (v1_ops: ShiftPlan 240, ShiftOverrides 126, TeamLeads 5, TLOffDays 19,
  ShiftRequests 5, AgentOneOnOnes 36, OneOnOnes 8, Settings 16,
  TaskOccurrences 352; oct: Transcript 5606, AUXex 58; daily_report: WA 223,
  CTL&Quality 1788). Only the 9 pre-existing READ FAILEDs on old tabs.
- Readonly proof PASS: 0 `values.update|append|batchUpdate` in committed code.
- `validate.ts --md` ran (123 tables) with CAVEAT — see needs-split below.

## needs-split (handed to PM via TRACKER Re-sharding table)

1. FD_AUX->aux_spans + qa_ctls.agent_email: engine lacks raw-range/unlabeled-
   column and duplicate-header support; no leaf may change engine logic.
2. qa_queue orphans:1523 — verdict recorded, no decide/backfill leaf exists.
3. validate.ts gap: no ROW_TRANSFORMS execution + stale store registry
   (call_transcripts resolved to `core`); skip counts for transform-keyed
   mappings are false positives (known-good actions/refresh_log show same).

## Blocked / needs user

- S06-11 `blocked`: NEEDS_USER — share Aug-2026 workbook
  `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` to
  `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (Viewer).
- NEEDS_APPROVAL: apply `20261109134359_s06_new_tables.sql` BEFORE live runs;
  live `migrate-all --tables` for the 13 new mappings; `backfill-fd-history
  --write` (495,825 upserts); productivity_files `2026-08` config + sc-refresh.
- PM-confirm flags in DECISIONS: OneOnOnes manager_email constant;
  Settings->sched_config (not live `config`).

No reviewer/debugger shards spawned (PM owns gates). No gate FAILs.
