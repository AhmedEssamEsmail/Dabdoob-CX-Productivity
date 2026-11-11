# lint-unused-vars L2 — status: done

Fixed all 20 `@typescript-eslint/no-unused-vars` warnings in the 3 assigned files.

## Files changed
- src/features/cx-quality/lib/analytics.ts — dropped unused `QA_ANSWERS` import.
- src/features/cx-quality/lib/pure.ts — dropped unused `Cfg` type import; pruned unused core imports (qaRound1_, qaBool_, qaFinalScore_, qaParse_, qaLostQuestions_, qaNeedsCtl_, qaRollupAudits_, qaEmailList_, qaCanCloseCtl_, qaCtlVisibleTo_, qaItemId_, qaAuditHasMarkdown_, qaSetting_, QA_CHOICES) and engine import `qeWeekKeyFor_`.
- src/features/cx-quality/lib/server.ts — removed dead private fns `qaQueueCtx_`, `qeSetLogField_` (+ now-orphaned `QaQueueCtx` type import); removed unused `const S = await qeSettings_()` in qePassAndReplace_.

## Checks
- `npx eslint` (3 files): 0 warnings, exit 0.
- `npx tsc --noEmit`: exit 0.
- `npx vitest run tests/golden/quality.test.ts`: 64/64 passed.

No exported API changed; no eslint-disable added; unrelated WIP untouched.
