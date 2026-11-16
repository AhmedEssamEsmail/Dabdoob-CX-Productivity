# TRACKER: qa-active-toggle
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`;
the TL merges status/evidence. A package completes only after all children and
its integration checks pass. Keep completed/superseded rows during re-sharding.

Baseline dirty tree (round 2, pre-S03 dispatch): foreign streams present —
unify-roster-source (`roster.ts`, `engine.ts`, `mappings/hct.ts` deleted,
`tests/golden/*`, `dq-hct-active.test.ts`, migration drop_dead_v1_tables,
`verify-hct-parity.mts`), aging-stale-status reports, scripts/ops probes,
`tests/perf/qa-pushdown.test.ts` touched externally. Our prior assignment files
(server.ts, route.ts, qa-shared.tsx, quality-*.tsx, quality.css) already carry
S01/S02 edits — only NEW diff hunks at S03 line refs are assignment-local.
Foreign edits are never reverted.

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | spec/S01.md; children done + integration gates pass |
| S01-01 | mini/S01 | dev | none | 3/4/100/10 | PASS | verified | results/S01-01.md; vitest 6/6, tsc 0; diff +21 lines (roster export, import+2 helpers, new test) |
| S01-02 | mini/S01 | dev | S01-01 | 1/4/80/10 | PASS | verified | results/S01-02.md; tsc 0, qa-pushdown 17/17, eslint clean after attempt-2 prefer-const fix (const temp names + narrowed consts); deviation: `active='active'` default vs required param — benign (only route.ts/tests call it) |
| S01-03 | mini/S01 | dev | S01-02 | 1/4/40/8 | PASS | verified | results/S01-03.md; tsc 0, qa-pushdown 17/17; `active='active'` default (consistent w/ S01-02) |
| S01-04 | mini/S01 | dev | S01-03 | 1/3/25/6 | PASS | verified | results/S01-04.md; tsc 0, qa-pushdown 17/17; auditRows hoisted + narrowed |
| S01-05 | mini/S01 | dev | S01-04 | 2/4/35/8 | PASS | verified | results/S01-05.md; tsc 0; route a[3]/a[5] + P.* + DrillSection scope.active |
| S02 | package/- | - | S01-05 | n/a | not dispatchable | verified | spec/S02.md; children done + integration gates pass |
| S02-01 | mini/S02 | dev | S01-05 | 1/6/40/8 | PASS | verified | results/S02-01.md; tsc 0; NOTE file also carries foreign concurrent `+aw`/AgentWeeks edits (qa-agent-week-grid stream) — not ours, not reverted |
| S02-02 | mini/S02 | dev | S01-05 | 1/6/45/10 | PASS | verified | results/S02-02.md; tsc 0; act hash param + Seg + drill scope/key |
| S03 | package/- | - | S01-01 (done) | n/a | not dispatchable | verified | spec/S03.md; children done + integration gates pass |
| S03-01 | mini/S03 | dev | S01-01 (done) | 3/6/35/10 | PASS (structural+semantic) | verified | results/S03-01.md; tsc 0, audit-queue-memo 4/4; diff matches contract (allRaw/all, quotaWeeks post-filter, route a[1], P.queuePage 2-arg); result file moved from stray root results/ |
| S03-02 | mini/S03 | dev | S03-01 | 1/4/25/8 | PASS (structural+semantic) | verified | results/S03-02.md; +19/-1 in audit-queue-page.tsx; attempt-2 fix: actMode useState moved above useSe (react-hooks/immutability + TDZ); eslint 0, tsc 0 |
| ux3-01 | mini/fix-ux-3 | dev | ux2-01 (done) | 2/5/120/10 | PASS (structural+semantic) | verified | results/ux3-01.md; +~285 lines incl. tests across the 2 leaf files; y() gates -> pendingStart ConfirmInline, start(w) extracted, setFormDirty(false) removed, AuditEntry keyed l.queueId, mutual pending clearing; tsc 0, vitest 16/16, eslint 0 (TL re-run) |

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| 1 | typecheck | `npx tsc --noEmit` | PASS (exit 0; reports/gate-tsc.log empty) |
| 1 | unit | `npx vitest run` | 1374/1375 — 1 FAIL `tests/quality/qe-fd-cache.test.ts` PRE-EXISTING (fails on committed code; untouched import chain) — reports/gate-vitest.log |
| 1 | lint | `npx eslint .` | assignment files clean; remaining findings are foreign/pre-existing (scripts/ops probes, spec artifact cjs/mjs, admin-page.tsx warning) — reports/gate-eslint.log |
| 1 | build/e2e/security | `npm run build` / `test:e2e` / `test:security` | DEFERRED to PM gate — tree contains foreign in-flight stream (qa-agent-week-grid: analytics.ts, AgentWeeks block, tests/quality/qa-agent-weeks*, quality.css) so shared-build results would be unattributable |
| 2 | typecheck | `npx tsc --noEmit` | PASS (exit 0; logs/gate-tsc-r2.log; re-run by fix worker after reorder) |
| 2 | unit (targeted) | `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-pushdown.test.ts` | PASS 21/21 (logs/gate-vitest-r2.log) |
| 2 | lint (assignment files) | `npx eslint server.ts audit-queue-page.tsx qa-shared.tsx route.ts` | PASS exit 0 after attempt-2 fix (react-hooks/immutability on actMode TDZ) — logs/gate-eslint-r2*.log |
| 2 | full unit / build / e2e / security | `npx vitest run` etc. | DEFERRED to PM gate — foreign in-flight streams (unify-roster-source, qa-agent-week-grid) still dirty the tree |
| 3 (FIX qa2-01) | typecheck | `npx tsc --noEmit` | PASS (exit 0; run by fix worker) |
| 3 (FIX qa2-01) | unit (targeted) | `npx vitest run tests/perf/qa-queue-active.test.ts tests/perf/audit-queue-memo.test.tsx` | PASS 10/10 (run twice) |
| 3 (FIX qa2-01) | full unit / build / e2e / security | `npx vitest run` etc. | DEFERRED to PM gate — foreign in-flight streams still in tree |
| 4 (FIX ux2-01) | typecheck | `npx tsc --noEmit` | PASS (exit 0; logs/gate-tsc-r3.log) |
| 4 (FIX ux2-01) | unit (targeted) | `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` | PASS 14/14 (logs/gate-vitest-r3.log) |
| 4 (FIX ux2-01) | lint (assignment files) | worker-run `npx eslint` on 4 leaf files | PASS exit 0 (per results/ux2-01.md) |
| 4 (FIX ux2-01) | full unit / build / e2e / security | `npx vitest run` etc. | DEFERRED to PM gate — foreign in-flight streams still in tree |
| 5 (FIX ux3-01) | typecheck | `npx tsc --noEmit` | PASS (exit 0; logs/gate-tsc-r4.log) |
| 5 (FIX ux3-01) | unit (targeted) | `npx vitest run tests/perf/audit-queue-memo.test.tsx tests/perf/qa-queue-active.test.ts` | PASS 16/16 (logs/gate-vitest-r4.log) |
| 5 (FIX ux3-01) | lint (assignment file) | `npx eslint src/features/cx-quality/components/audit-queue-page.tsx` | PASS exit 0 (logs/gate-eslint-r4.log) |
| 5 (FIX ux3-01) | full unit / build / e2e / security | `npx vitest run` etc. | DEFERRED to PM gate — foreign in-flight streams still in tree |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| qa-2-1 (MED): no regression test for getQaQueuePage act filter / quotaWeeks post-filter / fail-open / qa-queue-active Seg | reports/qa-2.md | qa2-01 -> test-engineer (spec/fix-qa-2.md#qa2-01) | done | results/qa2-01.md; +tests/perf/qa-queue-active.test.ts (254 lines, 5 tests), audit-queue-memo.test.tsx +46/-1; vitest 10/10, tsc 0; scoped diff — no src/ edits |
| ux-6 (MED): qa-queue-active Seg onChange `p(null)` unconditionally unmounts open AuditForm (dirty answers lost; arrow-key = instant discard) | reports/ux-2.md | ux2-01 -> dev (spec/fix-ux-2.md#ux2-01) | done | results/ux2-01.md; +255/-20 across the 4 leaf files (AuditForm optional `onDirtyChange` + hoisted dirty memo, AuditEntry forwards, page `formDirty`/`pendingAct` + ConfirmInline gate, 3 new harness tests); tsc 0, vitest 14/14, eslint 0 |
| ux-7 (LOW): `aria-label="Show agents"` under-describes filter — rename "People to show" on 3 Segs | reports/ux-2.md | - | deferred | LOW per FIX rules |
| ux-8 (LOW): `actMode` resets on who-keyed remount; optional lift to AuditQueueRoute | reports/ux-2.md | - | deferred | LOW (log-only) per FIX rules |
| ux-9 (MED): `y()` start-audit bypasses dirty gate; `setFormDirty(false)` desyncs (unkeyed AuditEntry/AuditForm — stale answers persist, gate defeated) | reports/ux-3.md | ux3-01 -> dev (spec/fix-ux-3.md#ux3-01) | done | results/ux3-01.md; start-audit routed through shared ConfirmInline, AuditEntry keyed by queueId (clean remount, unmount cleanup resets formDirty), P.startAudit deferred to confirm; tsc 0, vitest 16/16, eslint 0 |
| ux-10 (LOW): pendingAct ConfirmInline dangles after submit/cancel unmounts form | reports/ux-3.md | - | deferred | LOW per FIX rules |
| ux-11 (LOW): ConfirmInline cancel doesn't restore focus to `qa-queue-active` radio (matches existing convention; log-only) | reports/ux-3.md | - | deferred | LOW per FIX rules |

## Blocked / needs user
- (none)

## Notes for PM
- Foreign concurrent stream (qa-agent-week-grid) edited `quality-analytics-page.tsx` (+aw AgentWeeks ~66 lines), `analytics.ts` (`agentWeeks` in `qaColumnTrend_`), `quality.css`, plus untracked `tests/quality/qa-agent-weeks*` — NOT reverted (not our scope).
- Deviation recorded: server getters' `active` param uses `= 'active'` default (contract: required). Safe: only route.ts + tests call them; tests fall back unfiltered (no dq_hct fixture).
- Pre-existing failure `tests/quality/qe-fd-cache.test.ts` ("logs cache failures to refresh_log") — unrelated to this feature; untouched files, deterministic on committed code.
