# results/data1-01 — qa-build-missing-agents

Status: DONE
Files: edited src/features/cx-quality/lib/server.ts (:2210 key line), src/features/cx-quality/lib/pure.ts (:321 doc + :328 key line); created tests/quality/qa-requested-taken-key.test.ts
Change: extraTaken now keyed by `String(q.agent_name || '').trim()` in both qaRequestedTaken_ and qaRequestedTakenFor_; all other clauses byte-identical.
Checks: `npx vitest run tests/quality/qa-requested-taken-key.test.ts` 3/3 pass; `npx vitest run tests/quality/` 12 files / 39 tests all pass; `npx tsc --noEmit` no output (clean).
Handoff: none.
