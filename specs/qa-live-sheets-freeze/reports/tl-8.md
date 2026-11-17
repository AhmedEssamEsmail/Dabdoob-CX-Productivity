# tl-8 — FIX round for reports/qa-5.md (qa-live-sheets-freeze)

Fix spec: `spec/fix-qa-5.md` — 4 findings routed as 5 mini leaves (LOW qa-5-4
split 6+5 for the 10-file cap). All done, gate9 green.

## Completed leaves (DELTA scope for the reviewer)

| Leaf | Finding | Files changed | Evidence |
|---|---|---|---|
| qa5-01 | qa-5-1 BLOCKER | `src/features/cx-people/lib/scorecard-server.ts` (scDailyRowsDb_: `columns` projection `id,date,email,layer,agent_name,inbound_target,inbound_achieved,texting_target,texting_achieved,wa_target,wa_achieved` + snake reads at :295-299); `tests/platform/sc-daily-db.test.ts` (layer() + overrides to real snake shape) | results/qa5-01.md; vitest 6/6; fixtures now mirror the live table so a camel-read regression fails |
| qa5-02 | qa-5-2 HIGH | `src/features/cx-queue/lib/heatmap.ts` (hmSourceCells_ :601-614: `tickets` + `tracker_records` via `readAllPaged`, pk `id`/`row_n`); `tests/platform/hm-db-source.test.ts` (mock records `pk`, assertions moved dbCalls->pagedCalls) | results/qa5-02.md; vitest 3/3; grids cell-identical |
| qa5-03 | qa-5-3 MED | `src/features/cx-queue/lib/heatmap.ts` (buildHeatmapFromSource :641-645: hoisted `cells`, pushes 'Bot flag unavailable in the freshchat mirror — bot-only chats are included.' when Freshchat grid has rows); `tests/platform/hm-db-source.test.ts` (new case) | results/qa5-03.md; `buildHeatmapFromRawTabs_` byte-untouched — golden parity kept, 51/51 |
| qa5-04 | qa-5-4 LOW | moved 6 files `results/W2-{SC-02,SC-03,SC-04,ADM-01,ADM-02,ADM-03}.md` -> `specs/qa-live-sheets-freeze/results/` | results/qa5-04.md |
| qa5-05 | qa-5-4 LOW | moved 5 files `results/W2-{FIX-01,FIX-02,HM-01,HM-01-fix1,STRICT-01}.md` -> `specs/qa-live-sheets-freeze/results/` | results/qa5-05.md; `git status --porcelain results/` clean |

## Integration gates (round 9)
- `npx tsc --noEmit` — PASS, 0 errors (`results/gate9-tsc.log`)
- `npx eslint .` — PASS, 0 errors; same 5 pre-existing warnings on untouched files (`results/gate9-eslint.log`)
- `npx vitest run` — 1462/1463; sole FAIL `tests/quality/qe-fd-cache.test.ts`, the same known-external user-owned failure tolerated in gates 1-8 and noted by qa-5 itself (`results/gate9-vitest.log`); +1 test vs gate8 = the new qa5-03 case

## Notes for the PM / next reviewer
- qa-5 "Not verified" context stands: the identical camel-vs-snake trap pre-exists in `src/features/cx-people/lib/kpi/server.ts:134-138` and `src/features/cx-hub/lib/aggregates.ts:145-153` — explicitly out of scope per the report; recommend a follow-up spec.
- Same for tlqueue `trackerRecords`/`ticketsSince` unpaged reads (pre-existing, unchanged).
- Live-verification caveat unchanged: column claims verified against env.ts write maps + prod/analytics precedent, not the remote.
- No reviewer/debugger/architect roles were requested or spawned; nothing needed user approval (no remote DB, no deps, no env).
- Deliverable status: all qa-5 rows closed; spec ready for the PM's re-review.
