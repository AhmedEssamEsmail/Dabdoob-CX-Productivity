# qa report - migration-remaining - round 1 (FULL)

Verdict: FAIL
Open: 0B/2H/3M/2L

## Checks run
- `npx tsc --noEmit` -> exit=0
- `npx vitest run` -> exit=0, 58 files / 1145 tests pass
- `npx eslint .` -> exit=0, 0 errors / 367 warnings (pre-existing baseline, per tl-2/3)
- `npx tsx migration/validate.ts --md` -> ran to completion (SUMMARY emitted; 124 tables, mapped 98). dq_hct db=0 src=60 = migration not yet applied (expected). `sched_overrides` 3 dup (tl_email,date) collapses, `v1_task_occurrences` 3 dup ids, `aux_spans` 38 identical-row collapses — all consistent with keyed upsert semantics. Validator's "route.ts MAPPINGS literal could not be parsed" is a stale probe; route mappings live in `mappings/route-core.ts` inside the 110-file inventory.
- `migrate-all --dry` -> not re-run by QA (full remote sweep, minutes + quota); verified `logs/tl3-dry.log` tail instead: 110/110 mappings read incl. all new ones (dq_hct 60, actions 18, v1 sched/people/config, v1_task_occurrences 352, call_transcripts 5,606, tracker_records 58+223, qa_ctls 1,788, aux_spans 13,064); only the 9 pre-existing READ FAILEDs.
- Read-only proof (PLAN #7), run by QA: `grep -rnE "values\.(update|append)|batchUpdate" migration/ src/features/shared/migration/` -> 0 non-comment matches; every auth path uses `spreadsheets.readonly` scope.

## Criteria coverage
1. DONE — `source-inventory.md` assigns a final state + evidence to all 11 stores (Aug-2026 workbook is 403/not-readable, recorded `blocked: share pending`, NEEDS_USER — does not violate the readable-set rule).
2. STAGED — dq_hct DDL + `hct.ts` verified against the real adapter contract (roster.ts:46-48 consumes name,email,position,department,section,manager,status,lwd,hiringDate,fdId,fdName,maqsamName — PLAN's hct_role/hct_tl_email note was stale). Dry read 60 (7 require-skips = blank email/name). Live write PENDING-APPROVAL.
3. STAGED — freshchat dry 1,602 unique; fd_activities gap=873; backfill CLIs dry-verified; writes gated.
4. STAGED — actions 18 dry; sc probe resolved 2026-09 workbook; QA hist probe 4,076+1,709 would-import; writes gated.
5. STAGED — 23/23 hazard tables have DDL dedupe+UNIQUE and `upsertOn` flips (verified file-by-file vs PLAN ledger); targeted 0-new-rows re-run PENDING apply. BUT see qa-1/qa-3/qa-4 which can corrupt or fail that re-run.
6. DONE — validator covers 124 tables incl. new ones; `migration-report.md` run-2 section + `audits/migration-run-2.md` written with honest PENDING-APPROVAL cells.
7. DONE — verified clean by QA (above).

| ID | Sev | file:line | Issue + evidence | Exact fix | Owner |
|---|---|---|---|---|---|
| qa-1 | HIGH | mappings/v1-ops-sched.ts:138 + queue-quality.ts:557 + 20261109130633:105-111 | `dedupe_key` namespace collision on shared `sched_plan`: v1 ShiftPlan transform mints `'mig-'+ctx.index`, identical to the core sched_plan transform AND the DDL backfill (`'mig-'+(rn-1)`). Live v1 upserts will ON-CONFLICT-overwrite core sched_plan rows — silent data loss on the approval-gated run. | Mint a disjoint key for the v1 source (e.g. `'v1-mig-'+ctx.index`, or sha1 of natural cells). | dev |
| qa-2 | HIGH | mappings/ops-tabs.ts:51,60 vs supabase/migrations/20261109134359_s06_new_tables.sql | `tracker_records.tracker_id` has `REFERENCES trackers(tracker_id)` (009_operations.sql:54); no `trackers`/`tracker_fields` rows exist for `aux_exceptions`/`wa_parcels` anywhere — mapping comments claim "S06-04 seeds" but the migration contains zero INSERTs. Live upsert (281 rows) fails 23503 on first batch. | Add `INSERT INTO trackers ... ON CONFLICT DO NOTHING` + tracker_fields seed rows for both tracker_ids to the pending migration (or a new file) before live `--tables` runs. | supabase-expert |
| qa-3 | MED | 20261109130706_dedupe_uniques_queue_agg.sql (DO blocks) vs queue-quality.ts / route-core.ts upsertOn | Apply-time NULL-key probes can flip conflict target to `dedupe_key`, but mappings' `upsertOn` are statically the natural keys — if any of the 8 tables holds NULL key rows remotely, live upsert errors 42P10 (TRACKER lists it as caveat only; no pre-apply probe recorded). | Run the per-table `WHERE <key> IS NULL` probes before apply; for any fallback table add the dedupe_key column + `mig-` transform + upsertOn flip first. | supabase-expert |
| qa-4 | MED | mappings/people-core.ts:247 + engine.ts:246-259 | `mail_log` upsertOn `'sent_at,to,subject'`: `to` is a Postgres reserved word — PostgREST interpolates onConflict verbatim, likely 42601 at live upsert. Quoting `"to"` in the mapping string breaks the engine seen-map (`r['"to"']` → undefined). | Pass quoted identifiers to `onConflict` while splitting the seen-map on unquoted keys (engine fix), or verify PostgREST resolves bare `to` before the run. | dev |
| qa-5 | MED | mappings/v1-ops-people.ts:27-52 | Both v1 1:1 tabs map `log_id<-id` unnamespaced into `one_on_one_logs` (PK log_id, core mapping same table). A v1 id equal to a core log_id — or shared across the two v1 tabs — upsert-overwrites the existing row. Same hazard the `v1-` prefix solved for actions.action_id. | Prefix v1 log_ids in a transform (`'v1-'+id`) for both AgentOneOnOnes and OneOnOnes. | dev |
| qa-6 | LOW | `results/` (repo root) | Stray root-level `results/` dir holds 3 leaf result files (S06-05, S06-10, S07-05) outside the spec tree. | Move into `specs/migration-remaining/results/` and delete the root dir. | dev |
| qa-7 | LOW | validate log / hct.ts | dq_hct dry shows 8 dup-key collapses of 60 read rows (same-email last-wins) — surface in the approval runbook so the live write is knowingly lossy on dup emails. | Eyeball the 8 collapsed emails before approving `migrate-all --tables dq_hct`. | data-engineer |

## Not verified / assumptions
- Remote NULL-key probes (qa-3) can only be answered at apply time; NOTICE lines must be read before the upsertOn flip is trusted.
- Whether v1 `id`/`'mig-'` namespaces actually collide with live rows is unverifiable pre-apply; qa-1/qa-5 are structural collisions independent of data.
- `headerKeys` first-occurrence semantics changed for duplicate headers vs the previous last-wins read across all 94 legacy mappings — round-3 dry+validate show no new failures; residual risk noted.
- Baseline dirty tree contains other specs' work (`src/app/refresh.css`, `specs/perf-remediation/TRACKER.md`, `specs/google-signin/logs/`) — out of shard scope, not audited.
- `migration/` scratch (incl. `dbg2.ts`, probe/backfill CLIs) is gitignored per convention — not part of the committed surface.
- All live writes/DDL applies are approval-gated by PLAN design; criteria 2-5 close only after those runs — the qa-1..qa-5 fixes must land BEFORE approval is exercised.
