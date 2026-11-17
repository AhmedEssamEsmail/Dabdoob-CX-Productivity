# tl-7 — wave-2 build (literal freeze) complete

Index: `spec/10-index-wave2.md`. All 13 wave-2 leaves built + 1 fix leaf.
Wave-1 rows untouched. TRACKER.md updated (rows W2-*, gate log round 8).

## Completed leaves
| Leaf | Evidence |
|---|---|
| W2-SC-01 | results/W2-SC-01.md — scDailyRowsDb_ + 3 tests |
| W2-SC-02 | results/W2-SC-02.md — DB rebuild, scMergeFcr_ preserve, sheet readers/gates deleted (attempt 2; attempt 1 died after docstring-only edit) |
| W2-SC-03 | results/W2-SC-03.md — addBehaviourCase + op:add_behaviour, 23505->duplicate |
| W2-SC-04 | results/W2-SC-04.md — source box config-only + behaviour form |
| W2-HM-01 | results/W2-HM-01.md — 5 DB tab grids, db_mirrors provenance, regression retired |
| W2-HM-01-fix1 | results/W2-HM-01-fix1.md — viewas-sweep.test.ts:55,286 -> buildHeatmapFromSource (cross-file fallout, TL-routed fix) |
| W2-HM-02 | agent exited silently, no results file — TL-verified: RegTable/priorRegression/ss-id gone, AdminBuild matches contract, eslint 0 |
| W2-TLQ-01 | results/W2-TLQ-01.md — fc_messages/ol_sheet_id/io.book deleted; golden 49/49 |
| W2-ADM-01 | results/W2-ADM-01.md — peek -> DB mirror cells, slice<=500 (sec-2 closed) |
| W2-ADM-02 | results/W2-ADM-02.md — source-health -> data-feeds probes |
| W2-ADM-03 | results/W2-ADM-03.md — engine deferred flags off; list-sheets 410 (sec-3 route half) |
| W2-FIX-01 | results/W2-FIX-01.md — mirrors.ts docblock vendor-API (data-4 closed) |
| W2-FIX-02 | results/W2-FIX-02.md — reconcile: catch(()=>[]) removed, .in() chunked @100 — only the pre-approved region of user-owned migrate.ts |
| W2-STRICT-01 | results/W2-STRICT-01.md — deferred removed from SheetReadGateOpts/src; log-then-throw; EXPECTED shrunk; seed flag consumed |

## Changed files (leaf scope — all within declared Files)
src/features/cx-people/lib/scorecard-server.ts, src/features/cx-people/components/agents-page.tsx,
src/app/api/people/scorecard/route.ts, src/app/api/cron/scorecard-nightly/route.ts,
src/features/cx-queue/lib/heatmap.ts, src/features/cx-queue/components/heatmap-page.tsx,
src/app/api/queue/heatmap/route.ts, src/features/cx-queue/lib/tlqueue.ts,
src/app/api/admin/mirrors/route.ts, src/app/api/admin/source-health/route.ts,
src/app/api/admin/list-sheets/route.ts, src/features/shared/migration/engine.ts,
src/features/shared/lib/sheets-freeze.ts, src/features/shared/jobs/mirrors.ts (docblock),
src/features/cx-quality/lib/migrate.ts (qaReconcileQueueLog_ body only),
scripts/ops/seed-prod-assumptions.ts,
tests: +platform/{sc-daily-db,hm-db-source,sc-behaviour}.test.ts; M golden/{queue-tlqueue,viewas-sweep}.test.ts, lib/sheets-freeze.test.ts, freeze/sheets-freeze-scan.test.ts.

Foreign dirty file (NOT ours): specs/e2e-contract-green/logs/dev-server.log.

## Integration gates (round 8, final)
- tsc --noEmit: PASS 0 errors (results/gate8-tsc.log)
- eslint .: PASS 0 errors, 5 pre-existing warnings (results/gate8-eslint.log)
- vitest run: 1461/1462 — sole FAIL tests/quality/qe-fd-cache.test.ts (known-external tolerated) (results/gate8-vitest.log)

## Post-build state
Freeze is strict: live sheet reads = qa_audits allowlist, manual-HCT Sheet1,
caller-scoped Activities. `[SHEETS_FREEZE_VIOLATION]` = ops signal. sc_behaviour
append-only via admin form; stored FCR verdicts survive rebuilds; cx-quality/**
untouched except the pre-approved reconcile region.

Blocked: none. needs-split: none. No review-gate shards requested.
