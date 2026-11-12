# results/data1-02
Status: done.
Files: adapters.ts (pwDirectory_), jobs.ts (dqActiveTlEmails_), roster.ts (wasActive, mgrActive, people map), myday.ts (asTlFollowUps_ predicate), created tests/platform/roster-active.test.ts.
All five sites now use `X.active !== false && String(X.active).toLowerCase() !== 'false'` (NULL = active); isTrue_ untouched.
Verify: 6 vitest files, 105 tests pass; `npx tsc --noEmit` exit 0.
Handoff: NULL semantics uniform; data1-03 NOT NULL migration now purely defensive.
