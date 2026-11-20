# TL report 1 — auto-checkins (BUILD)

## Leaves
- AC-01 (dev, mini): **verified** after 2 attempts.
  - Attempt 1: implemented jobs.ts + new test file; returned SCOPE_REQUEST —
    `tests/golden/hub-fakes.ts` mkQuery lacked `.not()`, so `dqRewrite_`'s
    `delete().not('id','is',null)` (jobs.ts:72) threw in all 4 new cases.
  - Attempt 2 (fresh background dev): approved one-file scope expansion — added
    `not(col,op,val)` to hub-fakes (real negation for is/eq, passthrough else).

## Changed files (shard scope, ~172 lines vs 350 budget)
- M `src/features/cx-queue/lib/jobs.ts` (+40): `resolvePopups` import,
  `dqAutoCheckinQueues_` helper, lazy `subDone` read, insert-only
  `appendRow(..., 'system:job')` + `resolvePopups('queue_checkin_missed', cp.key)`
  in `dqCheckinTick_`. Matches leaf contract exactly.
- M `tests/golden/hub-fakes.ts` (+15): `.not()` support in mkQuery + stub.
- ?? `tests/golden/queue-checkin-auto.test.ts` (117 lines, 4 cases).
- `specs/auto-checkins/results/AC-01.md` — DONE.

## Gates (see TRACKER gate log)
- Targeted vitest (3 golden files): **46/46 PASS**.
- `npx tsc --noEmit`: **clean**.
- Full `npx vitest run`: 1528/1530; the 2 failures are **pre-existing, unrelated**:
  `tests/freeze/sheets-freeze-scan.test.ts` (committed `scripts/ops/qa-*.ts`
  offenders — never touched by this shard) and `tests/css/table-center-align.test.ts`
  (`.qa-whylist` — baseline-dirty `quality.css`, other in-flight spec). Flag to PM.

## Blocked / needs-split
- None. No review-gate requests in spec. PLAN review gates (QA always; Data after
  AC-01) are PM-run.
