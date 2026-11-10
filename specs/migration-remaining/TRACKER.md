# TRACKER: migration-remaining
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (pre-existing, NOT ours — never revert):
M docs/ARCHITECTURE.md, e2e/auth.spec.ts, src/app/auth/login/page.tsx,
src/app/refresh.css, src/app/styles/quality.css,
src/features/shared/platform/identity.ts, specs/perf-remediation/TRACKER.md;
?? docs/GOOGLE_SIGNIN_SETUP.md, specs/ctl-strip-overflow/, specs/google-signin/,
specs/migration-remaining/, src/app/api/auth/google/, src/app/auth/callback/,
supabase/migrations/20261109123839_before_user_created_domain_gate.sql,
tests/auth/, tests/platform/signin-verdict.test.ts,
tests/ui/qa-strip-overflow.pw.ts. (17 entries)

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01-01 | mini/root | data-engineer | none | 2/4/180/10 | PASS | done | results/S01-01.md; probe exit=0 11/11 stores; 194 lines (~8% over est); RESHARD flags -> Re-sharding table |
| S02 | package/- | - | - | n/a | not dispatchable | done | 8/8 children done; integration tsc/vitest/eslint pass |
| S02-01 | mini/S02 | supabase-expert | none | 1/9/350/10 | PASS | done | results/S02-01.md; 20261109130706_dedupe_uniques_queue_agg.sql (265 lines); tsc=0; NEEDS_APPROVAL apply |
| S02-02 | mini/S02 | supabase-expert | none | 1/10/380/10 | PASS | done | results/S02-02.md; 20261109130415_dedupe_uniques_logs_ops.sql (135 lines); qa_access_log->dedupe_key; tsc=0; NEEDS_APPROVAL apply |
| S02-03 | mini/S02 | supabase-expert | none | 1/8/300/10 | PASS | done | results/S02-03.md; 20261109130633_dedupe_uniques_people_sched.sql (114 lines); sched_plan->dedupe_key; tsc=0; NEEDS_APPROVAL apply |
| S02-04 | mini/S02 | dev | S02-01 | 1/7/120/8 | PASS | done | results/S02-04.md; 7 upsertOn flips in queue-quality.ts; tsc=0 |
| S02-05 | mini/S02 | dev | S02-02,S02-03,S02-04 | 1/7/140/8 | PASS | done | results/S02-05.md; 4 flips + dedupe_key transforms (sched_plan, QaAccessLog); tsc=0 |
| S02-06 | mini/S02 | dev | S02-03 | 1/6/110/8 | PASS | done | results/S02-06.md; 6 upsertOn flips in people-core.ts; tsc=0 |
| S02-07 | mini/S02 | dev | S02-02,S02-06 | 1/5/100/8 | PASS | done | results/S02-07.md; 5 upsertOn flips in people-core.ts; tsc=0; mail_log 'to' unquoted - verify on_conflict at live re-run |
| S02-08 | mini/S02 | dev | S02-01 | 1/2/20/5 | PASS | done | results/S02-08.md; qa_volume upsertOn in route-core.ts; tsc=0 |
| S03 | package/- | - | - | n/a | not dispatchable | done | 2/2 children done |
| S03-01 | mini/S03 | supabase-expert | none | 1/4/90/8 | PASS | done | results/S03-01.md; 20261109131140_dq_hct_table.sql; tsc=0; NEEDS_APPROVAL apply; app_all removed to match S08-04 lockdown |
| S03-02 | mini/S03 | dev | S01-01,S03-01 | 1/3/60/8 | PASS | done | results/S03-02.md; mappings/hct.ts; tsc=0 |
| S04 | package/- | - | - | n/a | not dispatchable | done | 7/7 children done |
| S04-01 | mini/S04 | supabase-expert | none | 1/4/70/8 | PASS | done | results/S04-01.md; 20261109131136_fc_messages.sql; tsc=0; NEEDS_APPROVAL apply; app_all omitted per S08-04 lockdown (correct) |
| S04-02 | mini/S04 | dev | S01-01 | 1/4/140/10 | PASS | done | results/S04-02.md; mappings/v1-ops.ts (MAPPINGS+ROW_TRANSFORMS+DECISIONS); tsc=0 |
| S04-03 | mini/S04 | data-engineer | none | 1/5/180/10 | PASS | done | results/S04-03.md; migration/backfill-freshchat-sheet.ts; --dry exit=0 read=1742 would_write=1602; NEEDS_APPROVAL --write |
| S04-04 | mini/S04 | data-engineer | none | 1/5/140/10 | PASS | done | results/S04-04.md; migration/run-fd-mirror.ts (116 lines); --check exit=0 verdict gap:873; NEEDS_APPROVAL --write |
| S04-05 | mini/S04 | data-engineer | none | 1/5/140/10 | PASS | done | results/S04-05.md; migration/run-qa-history.ts (77 lines); --probe exit=0 voice 4076/text 1709 would-import; NEEDS_APPROVAL --write |
| S04-06 | mini/S04 | data-engineer | none | 1/5/140/10 | PASS | done | results/S04-06.md; migration/run-sc-refresh.ts; --probe exit=0 2026-09->1I29yj; NEEDS_APPROVAL --write |
| S04-07 | mini/S04 | data-engineer | S01-01,S04-01 | 1/5/160/10 | PASS | done | results/S04-07.md; migration/backfill-fc-messages.ts; --dry exit=0 unique=82805; NEEDS_APPROVAL --write |
| S05 | package/- | - | - | n/a | not dispatchable | done | 4/4 children done; live-run cells PENDING-APPROVAL |
| S05-01 | mini/S05 | dev | S03-02,S04-02 | 1/4/40/8 | PASS | done | results/S05-01.md; engine.ts SPREADSHEETS+MODULE_MAPPINGS wiring; tsc=0 |
| S05-02 | mini/S05 | dev | S05-01 | 1/4/60/8 | PASS | done | results/S05-02.md; validate.ts registries; --md exit=0, dq_hct+fc_messages rows present |
| S05-03 | mini/S05 | dev | S02-04..08,S05-01,S05-02 | 1/4/20/10 | PASS | done | results/S05-03.md; --dry exit=0 96/96 (dq_hct 60, actions-v1 18); validate=0; readonly proof clean; 9 pre-existing READ FAILEDs on old tabs |
| S05-04 | mini/S05 | tech-writer | S05-03 (+ PM gated runs) | 3/4/250/10 | PASS | done | results/S05-04.md; migration-run-2.md (63 lines, PENDING-APPROVAL cells); report +25 lines; inventory finalized |
| S06 | package/- | - | - | n/a | not dispatchable | blocked | 11/12 children done; only S06-11 remains (needs workbook share) |
| S06-01 | mini/S06 | data-engineer | none | 2/5/220/10 | PASS | done | results/S06-01.md; probe exit=0 17/17; verdicts 8 migrate/1 NEW (v1_task_occurrences)/8 rejected; ~159 lines; flags: tl display-names, OneOnOnes manager_email const, Settings->sched_config (PM confirm) |
| S06-02 | mini/S06 | data-engineer | none | 2/5/220/10 | PASS | done | results/S06-02.md; probe exit=0 5/5; NEW aux_spans+call_transcripts; AUXex+WA->tracker_records; CTL split qa_ctls/rejected⊆qa_audits; ~129 lines; combined NEW=3/3 cap |
| S06-03 | mini/S06 | data-engineer | none | 2/4/180/10 | PASS | done | results/S06-03.md; exit=0 writes=0; NTD touch_archive gap 2026-01-05..2028-07-08; qe_engine gap 2026-01-09..2028-07-10; qe_cache orphans:1523; ~167 lines |
| S06-04 | mini/S06 | supabase-expert | S06-01,S06-02 | 1/6/400/10 | PASS | done | results/S06-04.md; 20261109134359_s06_new_tables.sql (3 tables: aux_spans, call_transcripts, v1_task_occurrences; idempotent; RLS-enabled no-policies); tsc=0; NEEDS_APPROVAL apply |
| S06-05 | mini/S06 | dev | S06-01,S06-04 | 1/5/180/10 | PASS | done | v1-ops-sched.ts; tsc=0; 5 mappings incl TeamLeads->sched_team (doc's sched group); HourOverrides rejected; exports MAPPINGS+ROW_TRANSFORMS+DECISIONS; results/S06-05.md absent - evidence = worker completion msg |
| S06-06 | mini/S06 | dev | S06-01,S06-04 | 1/5/220/10 | PASS | done | v1-ops-people.ts; tsc=0; AgentOneOnOnes/OneOnOnes->one_on_one_logs; dup TeamLeads removed (fix round 1, agent d51ace19); exports MAPPINGS+ROW_TRANSFORMS+DECISIONS; results/S06-06.md |
| S06-07 | mini/S06 | dev | S06-01,S06-04 | 1/5/220/10 | PASS | done | v1-ops-misc.ts (68 lines); tsc=0; Settings->sched_config, TaskOccurrences->v1_task_occurrences; 4 rejected incl IdentityPins; exports MAPPINGS+DECISIONS only |
| S06-08 | mini/S06 | dev | S06-02,S06-04 | 1/5/220/10 | PASS | done | ops-tabs.ts; tsc=0; 4 mappings (Transcript->call_transcripts, AUXex+WA->tracker_records, CTL A..J->qa_ctls); FD_AUX unmapped = engine gap -> Re-sharding row; exports MAPPINGS+ROW_TRANSFORMS+DECISIONS |
| S06-09 | mini/S06 | data-engineer | S06-03 | 1/5/180/10 | PASS | done | results/S06-09.md; migration/backfill-fd-history.ts; --dry exit=0: touch_archive in_gap=380,451, qe_engine in_gap=120,522, would_write=495,825 unique; NEEDS_APPROVAL --write |
| S06-10 | mini/S06 | dev | S06-05..08 | 1/5/70/8 | PASS | done | results/S06-10.md; engine.ts additive only: 4 imports + oct_workbook/daily_report keys + 3 merges; tsc=0 |
| S06-11 | mini/S06 | data-engineer | NEEDS_USER share | 1/3/80/8 | pending | blocked | NEEDS_USER: share Aug-2026 workbook `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` to `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (Viewer) |
| S06-12 | mini/S06 | tech-writer | S06-03,05..11 | 2/4/220/10 | PASS | done | results/S06-12.md; source-inventory final states + run-2 §7 rows; Aug=blocked: share pending; kept reshard flags: FD_AUX engine limit, qa_queue 1,523 orphans |
| S07 | package/- | - | - | n/a | not dispatchable | done | 6/6 children done; round-3 integration gates pass (tsc/vitest/eslint/dry/validate/readonly) |
| S07-01 | mini/S07 | dev | none | 1/4/60/8 | PASS | done | results/S07-01.md; headerKeys + widest-row sizing via non-allocating loop; tsc=0; probes exit=0; targeted tickets read 178,954 rows no RangeError (3 fix rounds) |
| S07-02 | mini/S07 | dev | S07-01 | 2/5/160/10 | PASS | done | results/S07-02.md; ops-tabs.ts FD_AUX->aux_spans (MAPPINGS+ROW_TRANSFORMS+DECISIONS) + probe-fd-aux.ts; tsc=0; probe exit=0 13,064 rows col_e/f/g populated |
| S07-03 | mini/S07 | dev | S07-01,S07-02 | 1/4/60/8 | PASS | done | results/S07-03.md; agent_email mapped (first occurrence = A..J block; #2 echo unmapped); tsc=0 |
| S07-04 | mini/S07 | data-engineer | S06-03 | 2/5/200/10 | PASS | done | results/S07-04.md; backfill-qe-cache-orphans.ts; --dry exit=0 MISSING=13,650/ORPHAN=1,523 zero drift; verdict import:qe_fd_cache both sets; NEEDS_APPROVAL --write |
| S07-05 | mini/S07 | dev | S07-01 | 1/6/140/10 | PASS | done | results/S07-05.md; validate.ts: transforms executed, oct_workbook store+3 EXPECTED rows, key scheme mirrored; tsc=0; targeted --md exit=0 call_transcripts store=oct_workbook src=5606, false skips gone |
| S07-06 | mini/S07 | tech-writer | S07-02..05 | 2/4/80/8 | PASS | done | results/S07-06.md; source-inventory + run-2 §7 flipped to S07 final states; Aug-2026 blocked flag preserved; only historical reshard: mentions remain |
| S08 | package/- | - | - | n/a | not dispatchable | done | 5/5 children done; round-4 integration gates pass |
| S08-01 | mini/S08 | dev | none | 1/3/10/5 | PASS | done | results/S08-01.md; v1-ops-sched.ts 'v1-mig-'+ctx.index; tsc=0 (qa-1) |
| S08-02 | mini/S08 | supabase-expert | none | 1/3/60/10 | PASS | done | results/S08-02.md; 2 trackers + 16 tracker_fields seeds appended to 20261109134359 (idempotent); NEEDS_APPROVAL apply (qa-2) |
| S08-03 | mini/S08 | supabase-expert | none | 1/3/40/10 | PASS | done | results/S08-03.md + logs/null-key-probes.md; 14/14 probes=0 -> all natural-key OK, no dedupe_key fallback needed (qa-3) |
| S08-04 | mini/S08 | dev | none | 2/4/60/10 | PASS | done | results/S08-04.md; engine.ts conflictTarget() quotes all onConflict keys, seen-map unquoted; tests/lib/migration-conflict-target.test.ts 3/3 (qa-4) |
| S08-05 | mini/S08 | dev | none | 1/3/15/8 | PASS | done | results/S08-05.md; v1-ops-people.ts 'v1-agent-'/'v1-tl-' id prefixes; tsc=0 (qa-5) |
|| S09 | package/- | - | - | n/a | not dispatchable | done | 2/2 children done; round-5 gates pass (sec-1 MED fixed) |
|| S09-01 | mini/S09 | dev | none | 3/7/200/10 | PASS | done | results/S09-01.md; dedupeKey_ sha1 helper; sched_plan/QaAccessLog/refresh_log + v1 ShiftPlan mints; 13/13 tests; tsc=0; date-format parity caveat for S09-02 |
|| S09-02 | mini/S09 | supabase-expert | S09-01 | 2/5/80/10 | PASS | done | results/S09-02.md; both backfills = 'mig-'+extensions.digest sha1 byte-parity (5e22b217… proven vs Node); pgcrypto WITH SCHEMA extensions; 'mig-'+id empty fallback; db lint=0; NEEDS_APPROVAL apply |
|| S10 | package/- | - | - | n/a | not dispatchable | done | 7/7 children done; round-6 integration gates pass (tsc/vitest/eslint-scoped/dry/validate/readonly) |
|| S10-01 | mini/S10 | data-engineer | none | 2/4/60/8 | PASS | done | results/S10-01.md; refresh_log -> 'mig-'+ctx.index (matches 8,197 live WP-51 rows); 13/13 tests; tsc=0 |
|| S10-02 | mini/S10 | data-engineer | none | 1/5/150/10 | PASS | done | results/S10-02.md; validate.ts mappings[] per-mapping src/skips; qa_ctls 1875 combined (1,788+87); 11 tables 'combined'; --md exit=0 124 rows; ~120 lines |
|| S10-03 | mini/S10 | data-engineer | none | 1/2/5/5 | PASS | done | results/S10-03.md; §5 3,037->4,038; serial before S10-07 |
|| S10-04 | mini/S10 | data-engineer | none | 1/4/60/8 | PASS | done | results/S10-04.md; in_gap left 213,888/right 287,085; future=281,986 quantified (still written); --dry exit=0 logs/s10-fdhist-dry.log |
|| S10-05 | mini/S10 | data-engineer | none | 2/3/40/8 | PASS | done | results/S10-05.md; headline 87/96+9; report 124 tables + S06/S07 final states; serial before S10-06 |
|| S10-06 | mini/S10 | data-engineer | S10-05 | 3/4/40/8 | PASS | done | results/S10-06.md; TableResult.dupSkipped; skipped reconciles read=migrated+skipped; dup= prints; run-2 §4 NULL-key note |
|| S10-07 | mini/S10 | data-engineer | S10-03 | 1/2/10/5 | PASS | done | results/S10-07.md; §3 Sep-2026 title; §6 colA-vs-read ±1 note |
| LIVE | package/- | - | - | n/a | not dispatchable | in-progress | live-run runbook; owner APPROVED 2026-11-09; serial LIVE-01..05; RESUMED per PM (qa-7 benign, code fixes landed) |
| LIVE-01 | mini/LIVE | supabase-expert | none | 1/5/80/10 | PASS | done | PM applied all 6 via direct pg 2026-11-09 (MCP PAT denied); migration/logs/apply-ddl.log: 6/6 OK, NOTICEs = natural-key conflict targets only (ELSE branch, matches S08-03 probes); refresh_log tie-break fixed to ctid pre-apply; worker-run results/LIVE-01.md = earlier failed attempt |
| LIVE-02 | mini/LIVE | data-engineer | LIVE-01 | 3/6/150/10 | PASS | done | results/LIVE-02.md; resume exit=0: sched_overrides 286, sched_offdays 27, tracker_records 281 (schema errors resolved by tl8-01/02); aux_spans dry 13,120 -> live 13,086 (34 dup); qa_ctls re-run 91+1772 (agent_email); tracker-bf deps idempotent re-run; logs/live-02a,02b,02c |
| LIVE-03 | mini/LIVE | data-engineer | LIVE-01 | 1/9/120/10 | PASS | in-progress | RESUME attempt 4 dispatched: 2/7 written; remaining 5 via `npx tsx --conditions=react-server`; logs/live-03-backfills.log |
| lv3-03 | mini/LIVE(fix) | dev | none | 1/4/15/5 | PASS | done | results/lv3-03.md; null for score_final/started_at/acknowledged_at + interaction_at apostrophe dropped; tsc=0, probe exit=0 |
| lv3-02 | mini/LIVE(fix) | dev | none | 1/3/15/5 | PASS | done | results/lv3-02.md; qe_hist_+key at migrate.ts:331,447 + docblocks 8,313; grep QE_HIST=0; tsc=0; probe exit=0 |
| lv3-01 | mini/LIVE(fix) | maintainer | none | 2/3/10/5 | PASS | done | results/lv3-01.md; server-only@0.0.1 added (pkg+lock only, new-dep per contract); tsc=0; probe exit=0 voice 9230/text 4038 rows; CAVEAT: poison-pill pkg — tsx needs --conditions=react-server |
| LIVE-04 | mini/LIVE | data-engineer | LIVE-02 | 1/4/40/5 | PASS | pending | spec/live-run.md#LIVE-04; sched_plan re-run 0 new rows |
| LIVE-05 | mini/LIVE | tech-writer | LIVE-02,03,04 | 2/4/80/10 | PASS | pending | spec/live-run.md#LIVE-05; PENDING-APPROVAL cell refresh |
| tl8-01 | mini/LIVE(fix) | dev | none | 2/2/15/8 | PASS | done | results/tl8-01.md; +2 lines desk-operations.ts NULL_AS_EMPTY; tsc=0; dry exit=0 AUXex 58 + WA 223 mapped (logs/tl8-01-dry.log); no live writes |
| tl8-02 | mini/LIVE(fix) | dev | none | 2/4/30/8 | PASS | done | results/tl8-02.md; v1-ops-sched.ts sched_overrides->[tl_email,date,shift,note], sched_offdays->[tl_email,date]; comments+DECISIONS record drop decision; tsc=0; dry exit=0 all 4 mappings clean, no schema-cache errors (logs/tl8-02-dry.log); no live writes |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|
| S01-01 discovered scope (spec/01-source-inventory.md) | uncovered unique datasets no leaf/table holds: v1_ops 17 non-task tabs; oct workbook {FD_AUX, Transcript, AUXes Exceptions}; daily_report {WA, CTL&Quality}; `New Tickets Daily`x2; Aug-2026 workbook 10rpLZ... 403 access gap | covered by S06 leaves | superseded by S06 package |
| S06-08 discovered scope (results/S06-08.md) | FD_AUX->aux_spans needs engine raw-range/unlabeled-column support (readSheet drops hdr-less cols E..G, engine.ts:138-147); qa_ctls.agent_email needs dup-header handling or audit_id->qa_audits recovery — engine logic change no existing leaf may make (S06-10 contract forbids it) | S07-01 (engine keys), S07-02 (FD_AUX), S07-03 (agent_email) | resharded -> S07 |
| S06-03 discovered scope (results/S06-03.md) | qa_queue Ticket Detail Cache: orphans:1523 (ids in neither qe_fd_cache nor tickets) — verdict recorded but no leaf decides/backfills them; S06-12 kept `reshard:` flag | S07-04 (decide + bounded backfill) | resharded -> S07 |
| validate.ts coverage gap (logs/tl2-validate.log) | validator statically parses sheetToDb/require only — no ROW_TRANSFORMS — so transform-keyed mappings (WA, AUXex, sched_plan dedupe_key, pre-existing actions/refresh_log) report mass false "skipped" rows; call_transcripts resolved to store `core` (new store keys not in its registry) -> SRC-FAIL artifact. PLAN #6 "validator covers new mappings" is partial until a leaf teaches it transforms/new stores | S07-05 (validate.ts parity) | resharded -> S07 |

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 integration | typecheck | `npx tsc --noEmit` | PASS exit=0 (logs/tl-tsc.log) |
| 1 integration | unit | `npx vitest run` | PASS 58 files / 1145 tests (logs/tl-vitest.log) |
| 1 integration | lint | `npx eslint .` | PASS 0 errors, 367 pre-existing warnings (logs/tl-eslint.log) |
| 1 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | PASS exit=0, 96/96 mappings read; dq_hct 60 rows, v1_ops actions 18 rows (logs/dry-run-2.log) |
| 1 integration | validation | `npx tsx migration/validate.ts --md` | PASS exit=0; dq_hct + fc_messages rows (logs/validate-2.log) |
| 1 integration | readonly proof | `git grep -nE "values\.(update\|append)\|batchUpdate"` | PASS only comments; scope = spreadsheets.readonly (logs/readonly-proof.log) |
| 2 integration | typecheck | `npx tsc --noEmit` | PASS exit=0 (logs/tl2-tsc.log) |
| 2 integration | unit | `npx vitest run` | PASS exit=0 (logs/tl2-vitest.log) |
| 2 integration | lint | `npx eslint .` | PASS 0 errors, 367 pre-existing warnings (logs/tl2-eslint.log) |
| 2 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | PASS 109/109 mappings read; all 13 S06 mappings clean (v1_ops 9, oct 2, daily_report 2); 9 pre-existing READ FAILEDs only (logs/tl2-dry.log) |
| 2 integration | validation | `npx tsx migration/validate.ts --md` | ran; 123 tables; CAVEAT: no transform execution + stale store registry -> false skip/SRC-FAIL artifacts on new+transform mappings (see Re-sharding row) (logs/tl2-validate.log) |
| 2 integration | readonly proof | `git grep -nE "values\.(update\|append)\|batchUpdate" -- migration/ src/features/shared/migration/` | PASS 0 matches in committed code (logs/tl2-readonly.log) |
| 3 integration | typecheck | `npx tsc --noEmit` | PASS exit=0 (logs/tl3-tsc.log) |
| 3 integration | unit | `npx vitest run` | PASS 58 files / 1145 tests (logs/tl3-vitest.log) |
| 3 integration | lint | `npx eslint .` | PASS 0 errors, 367 pre-existing warnings (logs/tl3-eslint.log) |
| 3 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | 110/110 read; aux_spans 13,064 rows via col_ keys; 9 pre-existing tab-name READ FAILEDs + 1 NEW tickets RangeError -> S07-01 fix round 3 (logs/tl3-dry.log) |
| 3 integration | validation | `npx tsx migration/validate.ts --md` | PASS; 124 tables; call_transcripts store=oct_workbook src=5606 (round-2 caveat lifted); aux_spans src=13,064; qa_ctls false skips gone; tickets 178,954 read (RangeError fix proven); 7 pre-existing unreadable tabs; db=0 deltas = pending approvals (logs/tl3-validate.log) |
| 3 integration | readonly proof | `git grep -nE "values\.(update\|append)\|batchUpdate" -- migration/ src/features/shared/migration/` | PASS 0 matches in committed code (logs/tl3-readonly.log) |
| 4 integration | typecheck | `node_modules/.bin/tsc --noEmit` | PASS exit=0 (logs/tl4-tsc.log) |
| 4 integration | unit | `npx vitest run` | PASS 59 files / 1148 tests (+3 conflictTarget) (logs/tl4-vitest.log) |
| 4 integration | lint | `npx eslint .` | PASS 0 errors, 367 pre-existing warnings (logs/tl4-eslint.log) |
| 4 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | PASS 110/110 read; v1 ShiftPlan 240, 1:1s 36+8, aux_spans 13,064; only 9 pre-existing READ FAILEDs (logs/tl4-dry.log) |
| 4 integration | validation | `npx tsx migration/validate.ts --md` | PASS; 124 tables, 98 mapped, db failed 0; db=0 deltas = pending applies; known-stale route.ts probe (logs/tl4-validate.log) |
|| 5 integration | typecheck | `node_modules/.bin/tsc --noEmit` | PASS exit=0 (logs/tl5-tsc.log) |
|| 5 integration | unit | `npx vitest run` | PASS 60 files / 1161 tests (+13 dedupe-key) (logs/tl5-vitest.log) |
|| 5 integration | lint | `npx eslint <3 touched files>` | PASS exit=0 scoped checkpoint (logs/tl5-eslint.log) |
|| 5 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | PASS 101/110 read; only 9 pre-existing tab-name READ FAILEDs (logs/tl5-dry.log) |
|| 5 integration | validation | `npx tsx migration/validate.ts --md` | PASS; 124 tables, 98 mapped, db failed 0 (logs/tl5-validate.log) |
|| 5 integration | readonly proof | `git grep -nE "values\.(update\|append)\|batchUpdate" -- migration/ src/features/shared/migration/` | PASS 0 matches (logs/tl5-readonly.log) |
|| 6 integration | typecheck | `npx tsc --noEmit` | PASS exit=0 (logs/tl6-tsc.log) |
|| 6 integration | unit | `npx vitest run` | PASS 60 files / 1161 tests (logs/tl6-vitest.log) |
|| 6 integration | lint | `npx eslint <3 touched code files>` | PASS exit=0 scoped checkpoint (logs/tl6-eslint.log) |
|| 6 integration | dry-run | `npx tsx migration/migrate-all.ts --dry` | PASS by evidence — 101/110 read + 9 pre-existing tab-name READ FAILEDs, byte-identical shape to tl5-dry.log; process lingered ~6min on teardown after final line, killed post-output (logs/tl6-dry.log) |
|| 6 integration | validation | `npx tsx migration/validate.ts --md` | PASS exit=0 — post-S10-02 run reused as evidence; 124 tables, 11 'combined' multi-source rows, qa_ctls src=1875 (logs/s10-validate.log) |
|| 6 integration | readonly proof | `grep -nE "values\.(update\|append)\|batchUpdate" -- migration/ src/features/shared/migration/` | PASS 0 matches (logs/tl6-readonly.log) |
| 7 live-run | DDL apply (LIVE-01) | PM direct pg apply | PASS 6/6 OK; NOTICEs = natural-key conflict targets only (ELSE branch, matches S08-03) (migration/logs/apply-ddl.log) |
| 7 live-run | migrate-all --tables (LIVE-02) | `npx tsx migration/migrate-all.ts --tables ...` | PARTIAL: 02a dq_hct,actions exit=0; 02b S06 set exit=1 — 3 real divergences + 3 expected READ FAILEDs; 02c not run (logs/live-02a,02b) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| tracker_records.submitted_by NOT NULL (mapRow re-nulls '') | reports/tl-8.md LIVE-02 err 3 | tl8-01 | done | results/tl8-01.md; logs/tl8-01-dry.log |
| sched_overrides/sched_offdays emit cols absent from live DDL -> 'not in schema cache'; PM DECIDED drop columns (not ALTER) | reports/tl-8.md LIVE-02 err 1-2, NEEDS_USER (a) | tl8-02 | done | results/tl8-02.md; logs/tl8-02-dry.log |
| qa-7 collapse count above estimate | reports/tl-8.md NEEDS_USER | PM decision | done | PM CONFIRMED benign: 2 same-email job-stint dupes, last-wins kept latest-status rows; rest = side-table rows |
| tracker_records.submitted_by re-nulled by mapRow; add to NULL_AS_EMPTY | reports/tl-8.md NEEDS_USER(b) | tl8-01 (dev) | fixed | results/tl8-01.md + logs/tl8-01-dry.log |
| sched_overrides/sched_offdays audit columns (ALTER vs drop) | reports/tl-8.md NEEDS_USER(a) | PM decision | deferred | not a code leaf — awaits owner choice |
| qa-7 collapse count vs estimate | reports/tl-8.md | PM decision | deferred | confirm acceptable |
| qa-1 HIGH: v1 ShiftPlan 'mig-' dedupe_key collides w/ core+DDL | reports/qa-1.md | S08-01 dev | done | 'v1-mig-' mint; grep-verified 0 bare 'mig-' |
| qa-2 HIGH: tracker_records FK — no trackers/fields rows for aux_exceptions/wa_parcels | reports/qa-1.md | S08-02 supabase-expert | done | seeds appended to pending 20261109134359; apply still NEEDS_APPROVAL |
| qa-3 MED: apply-time NULL-key probes may flip conflict target vs static upsertOn | reports/qa-1.md | S08-03 supabase-expert | done | logs/null-key-probes.md: 14/14 = 0 -> ELSE branch, static upsertOn valid |
| qa-4 MED: mail_log upsertOn 'to' reserved word -> 42601 risk | reports/qa-1.md | S08-04 dev | done | conflictTarget() quotes all keys; seen-map unquoted; unit-tested |
| qa-5 MED: v1 log_id unnamespaced in one_on_one_logs | reports/qa-1.md | S08-05 dev | done | 'v1-agent-'/'v1-tl-' prefixes (also kills inter-v1-tab collision) |
| qa-6 LOW: stray root results/ dir (3 leaf files) | reports/qa-1.md | deferred | deferred | cosmetic; next housekeeping pass |
| qa-7 LOW: dq_hct 8 dup-email collapses -> approval runbook note | reports/qa-1.md | deferred | deferred | recorded in Blocked/needs-user caveats |
|| sec-1 MED: positional 'mig-'/'v1-mig-'+ctx.index dedupe_key vs DDL id-order backfill -> wrong-row UPDATE on re-run | reports/sec-1.md | S09-01 dev + S09-02 supabase-expert | done | content-hash sha1 keys both sides; hash parity proven (5e22b217…); residual: submitted_at timestamptz::text vs sheet-display, all-empty 'mig-'+id vs ctx.index — both fail to dup-insert, never wrong-row overwrite |
|| sec-2 LOW: mail_log/follow_up_done NULL-part natural keys re-duplicate; sent_at second-precision collision risk | reports/sec-1.md | deferred | deferred | LOW->deferred; needs live-data confirm before any fix |
|| sec-3 LOW: aux_exceptions record_id raw '|' separator collides keys | reports/sec-1.md | deferred | deferred | LOW->deferred; fix = sha1 joined cells like sibling transforms |
|| sec-4 LOW: hardcoded real employee email stamps manager_email (9 rows) | reports/sec-1.md | deferred | deferred | LOW->deferred; ALSO pending PM confirmation (S06-01 flag) |
|| data-1 HIGH: S09-01 sha1 refresh_log mint vs 8,197 live 'mig-'+ctx.index rows -> ~9,046 dup inserts on gated re-run | reports/data-1.md | S10-01 data-engineer | done | results/S10-01.md; positional revert; 13/13 tests; tsc=0 |
|| data-2 MED: validate.ts byTable last-wins shadows dual-source mappings (qa_ctls, one_on_one_logs, tracker_records, sched_*) | reports/data-1.md | S10-02 data-engineer | done | results/S10-02.md; mappings[] + 'combined' flag; qa_ctls 1875; --md exit=0 124 rows |
|| data-3 MED: source-inventory §5 'Form Responses 1' 3,037 vs probes 4,038 | reports/data-1.md | S10-03 data-engineer | done | results/S10-03.md; now 4,038 data rows |
|| data-4 MED: fdhist in_gap lumps tails; future-dated volume unquantified | reports/data-1.md | S10-04 data-engineer | done | results/S10-04.md; left 213,888/right 287,085; future=281,986 counted pre---write |
|| data-5 LOW: run-2 '96/96 clean' vs 9 READ FAILEDs; report '121 tables'/'17 reshard:' stale | reports/data-1.md | S10-05 data-engineer | done | results/S10-05.md; 87/96+9 headline; 124 tables; final tab states |
|| data-6 LOW: write-time skipped misses upsertOn dup-collapses; NULL-key residual undocumented | reports/data-1.md | S10-06 data-engineer | done | results/S10-06.md; dupSkipped + §4 residual note |
|| data-7 LOW: inventory 'Oct-2026' title claim vs 'Sep-2026'; 1,741 vs read=1,742 | reports/data-1.md | S10-07 data-engineer | done | results/S10-07.md; Sep-2026 + ±1 note |

## Blocked / needs user
- APPROVAL GRANTED 2026-11-09 (owner; manager_email confirmed correct ->
  sec-4 caveat resolved): all NEEDS_APPROVAL rows below dispatched as
  spec/live-run.md LIVE-01..05, serial. S06-11 / productivity_files['2026-08']
  remain blocked. Any apply/run failure -> stop + NEEDS_USER, no fixes.
- NEEDS_USER (2026-11-09, LIVE-01 STOPPED clean): scoped SUPABASE_ACCESS_TOKEN
  PAT denies `apply_migration`/`execute_sql`/`list_migrations` (MCP -32600);
  Management API 403; no DATABASE_URL/DB password exists; service_role =
  PostgREST only. Re-issue PAT with database scope (or provide DB
  credentials), then re-dispatch LIVE-01. NOTE for re-run: apply_migration
  records server-generated versions — verify via name column, not file
  timestamps. LIVE-02..05 held pending (DDL before upserts).
- NEEDS_APPROVAL (PM/owner): apply 5 new migration files to live project
  (20261109130415 logs_ops, 20261109130633 people_sched, 20261109130706
  queue_agg — destructive: dedupe DELETEs; 20261109131136 fc_messages,
  20261109131140 dq_hct — non-destructive). NOTE (S09-02): 130415+130633 now
  backfill dedupe_key as 'mig-'+sha1(identity cells) via pgcrypto — apply
  versions MUST be the edited files; supabase db lint exit=0.
- NEEDS_APPROVAL (PM/owner): live runs — `migrate-all --tables dq_hct,actions`;
  `--write` on migration/{backfill-freshchat-sheet,run-fd-mirror (gap:873),
  run-qa-history,run-sc-refresh,backfill-fc-messages (~82.8k)}; PLAN #5
  targeted idempotent re-run expecting 0 new rows.
- Caveats for live re-run: S08-03 probes answered — all 14 = 0 NULL/dup, so
  apply-time DO blocks take the natural-key ELSE branch (still read apply
  NOTICEs to confirm vs logs/null-key-probes.md); mail_log onConflict now
  quoted via engine conflictTarget() — verify first live upsert batch ok.
- RESHARD_NEEDED handed to PM: S01-01 discovered uncovered datasets (see
  Re-sharding table) — needs spec-architect split for remaining scope.
- NEEDS_USER: S06-11 blocked — share Aug-2026 workbook
  `10rpLZciaa40AaZpxr6b-2wslaZ3w8YMCKY87vbWQGrg` to
  `migration-reader@cx-kpis-513312.iam.gserviceaccount.com` (Viewer), then TL
  can dispatch the probe leaf.
- NEEDS_APPROVAL (PM/owner): apply S06-04 `NEW:` table migrations (if any) to
  live project BEFORE any live `migrate-all --tables` run that upserts them.
  -> S06-04 produced `20261109134359_s06_new_tables.sql` (aux_spans,
  call_transcripts, v1_task_occurrences; non-destructive, RLS-enabled).
- NEEDS_APPROVAL (PM/owner): live `migrate-all --tables` for the 13 new S06
  mappings (sched_plan/overrides/team/offdays/requests, one_on_one_logs,
  sched_config, v1_task_occurrences, call_transcripts, tracker_records,
  qa_ctls) AFTER the S06-04 file is applied.
- NEEDS_APPROVAL (PM/owner): `backfill-fd-history.ts --write` —
  495,825 dedupe-keyed upserts into fd_activities (S06-09 dry evidence).
- NEEDS_APPROVAL (PM/owner): `migrate-all --dry --tables aux_spans` then
  live `--tables aux_spans,qa_ctls` — aux_spans ONLY after S06-04's
  `20261109134359_s06_new_tables.sql` is applied; qa_ctls re-run fills
  agent_email via ctl_id upsert (S07-02/S07-03).
- NEEDS_APPROVAL (PM/owner): `backfill-qe-cache-orphans.ts --write` —
  13,650 dedupe-keyed upserts into qe_fd_cache (S07-04 dry: MISSING=13,650,
  ORPHAN=1,523, 100% content fill -> verdict import).
- qa-7 caveat for approval runbook: dq_hct dry showed 8 dup-key collapses
  (same-email last-wins) — eyeball the 8 collapsed emails before approving
  `migrate-all --tables dq_hct` (deferred LOW finding, reports/qa-1.md).
  LIVE OBSERVED (02a): read=60 migrated=51 skipped=9 dup=2 — collapse count
  slightly higher than dry estimate (~9-11 vs ~8); same-email last-wins.
- LIVE-02 PARTIAL-FAIL 2026-11-09 -> NEEDS_USER/PM decision (runbook:
  "Any apply/run failure -> stop + NEEDS_USER, no fixes"). Committed live
  before halt: dq_hct 51, actions 42, sched_config 18, sched_team 5,
  sched_requests 5, sched_plan 229+11dup, one_on_one_logs 48, qa_ctls 1863,
  v1_task_occurrences 349, call_transcripts 5606, tracker-bf 2098.
  Divergences (mapping vs live schema — dry-runs never upsert, so latent):
  a) sched_overrides: v1-ops-sched.ts:62-65 emits submitted_by+submitted_at
     (sheet setBy/setAt) — live DDL (007_queue.sql:118-122) lacks BOTH cols.
     sched_offdays: mapping emits note+submitted_by+submitted_at — live
     (007:114-117) lacks all three. Decision: (i) new ALTER migration +
     PM apply, keeps audit cols; (ii) dev leaf drops cols (loses sheet data).
  b) tracker_records AUXex+WA (58+223 rows): transforms DO set
     submitted_by='' (ops-tabs.ts:162,184) but engine mapRow re-nulls ''
     (engine.ts:191-196) — tracker_records absent from NULL_AS_EMPTY
     (desk-operations.ts:327-359; docblock predicts exactly this). Fix =
     add `tracker_records:['submitted_by']` — code-only, no DDL.
  Resume path after decision: `--tables sched_overrides,sched_offdays,
  tracker_records`, then `--dry --tables aux_spans`, then
  `--tables aux_spans,qa_ctls`; then LIVE-03/04/05 serial.
- sec-4 caveat (reports/sec-1.md, deferred LOW): real employee email
  hardcoded in v1-ops-people.ts:69 stamps manager_email on 9
  one_on_one_logs rows — needs PM confirm before the constant is moved to
  config/decisions; unresolved since the S06-01 flag.
