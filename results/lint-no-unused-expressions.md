# lint-no-unused-expressions — DONE

- Files: tests/golden/legacy/hm-engine.js (32 sites), src/features/cx-queue/lib/heatmap-engine.ts (2), src/features/cx-quality/components/qa-shared.tsx (2). Total 36 warnings fixed.
- Method: `cond && f()` / statement ternaries / comma sequences -> `if`/`else` and sequential statements; every side effect preserved verbatim (golden port).
- Checks: `npx eslint` on the 3 files -> 0 `no-unused-expressions` warnings (15 unrelated warnings remain: no-unused-vars, local rules — out of scope). `npx vitest run tests/golden/queue-heatmap.test.ts` -> 47/47 pass.
- Note: task estimated ~90 warnings; actual rule count in these files was 36 (eslint-verified).
- Rollback copies: /tmp/cx-fix-backup/{hm-engine.js,heatmap-engine.ts,qa-shared.tsx}. No other files touched; no git ops.
