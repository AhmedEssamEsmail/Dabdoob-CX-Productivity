# Spec index: qa-live-sheets-freeze (Wave 1)
Kind: index
Size gate: PASS

| ID | Kind | Spec path | Owner | Depends | Criteria/finding | Budget (files/actions/lines/min) |
|---|---|---|---|---|---|---|
| S01 | package | S01.md | - | none | #1 freeze guard + grandfather logs | not dispatchable |
| S02 | package | S02.md | - | none | #1/#6 dbbook synthesizers | not dispatchable |
| S03 | package | S03.md | - | S01-02, S02 | #1/#6 env.ts rewire | not dispatchable |
| S07 | package | S07.md | - | S01-03 | #2 #3 dq_hct + manual gate | not dispatchable |
| S08 | package | S08.md | - | none | #4 qa-engine DB-only route | not dispatchable |
| S09 | package | S09.md | - | none | #5(amended) scoped pg_cron | not dispatchable |
| S11 | package | S11.md | - | none | Amend.3: aux_spans recreate + prod_assumptions seed/control | not dispatchable |

RESHARD 2026-11-16 (reports/tl-1.md): S02-01 superseded -> S02-03 (context deduped 6->5, same scope); S02-02 context also deduped to 5, now depends S02-03; S03-01 unchanged, still waits S02. DONE leaves preserved: S01-01..04, S07-01..02, S08-01, S09-01.

Wave 2 (deferred, NOT spec'd): scorecard/heatmap/tlqueue de-sheeting, FCR source, FD_AUX upstream, freshchat pairs, admin readers S10, guard strict-mode flip.

Ready work: S02-03, S11-01, S11-02 dispatchable now (max 3 workers); S02-02 waits S02-03; S03-01 waits the S02 package.
Deviation noted: `deferred` flag also applied to env.ts prefetchWorkbook (interim until S03 — otherwise prod jobs 500), src/app/api/admin/source-health/route.ts and src/app/api/admin/mirrors/route.ts peek (admin diagnostics stay alive with violation logs until wave-2 S10). cx-quality/lib/server.ts:383 fetchWorkbookTabs is user-owned, gets no flag -> SheetsFreezeError (dead path while qa_engine_live=TRUE; hand-back).
NEEDS_USER: none blocking — prior items resolved by spec: prod_assumptions seed = S11-02 (exempt read explicitly approved), aux_spans recreate = S11-01 (~13k history loss accepted per Amendment 3). PM-gated (pre-approved, verify Target: + `env -u SUPABASE_ACCESS_TOKEN`): remote `supabase db push` of pending migrations + `app.settings.app_url`/`cron_secret` provisioning before/with pg_cron apply.
Size gate evidence: 13 dispatchable leaves + 1 superseded stub; every leaf <=2 files, <=7 actions, <=450 est. lines, <=10 min, <=5 context pointers; manual review vs LIMITS.md — PASS.
