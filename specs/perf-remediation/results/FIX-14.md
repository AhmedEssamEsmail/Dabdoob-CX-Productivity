# FIX-14 result
Status: DONE
Files: src/features/shared/platform/popups.ts (cache key now `POPUPS_POLL_KEY + normEmail(email)`); tests/golden/reminders-off-popups.test.ts (mixed-case regression test, cacheGet/cacheClear/resolvePopups wired).
Checks: `npx vitest run tests/golden/reminders-off-popups.test.ts` 4/4 green; `npx tsc --noEmit` exit 0.
Notes: test asserts cache hit under lowercase key then null after resolvePopups; write path reuses `key` so it normalizes automatically.
Blocker: none. Handoff: none.
