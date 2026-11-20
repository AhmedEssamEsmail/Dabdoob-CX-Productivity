# data2-01 — DONE

- snapKeys select now destructures `error` as `snapErr`; on error emits one `hbBeat('queue_snapshot','warn',...)` and skips the capture/auto-insert loop via `for (const cp of snapErr ? [] : cps)`. `todays` load, `dqRewrite_`, `dqRemindMissedCheckins_` unchanged.
- `hub-fakes.ts`: added `in() { return dead }` to the `dead` chain.
- New regression test "aborts capture and auto-insert when the snapKeys select fails" seeds frozen snapshots, `hubDb.missing.add('queue_snapshots')`; asserts captured===0, subs empty, frozen rows untouched.
- Files: `src/features/cx-queue/lib/jobs.ts`, `tests/golden/hub-fakes.ts`, `tests/golden/queue-checkin-auto.test.ts`.
- Verify: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 8/8 pass.
- Blockers: none. No git actions, no remote writes.
