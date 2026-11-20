# data3-01 — done

- Status: complete. `todays` select error now warns via `hbBeat('queue_snapshot','warn',...)` and skips the `dqRewrite_('agg_snapshots_today', ...)` call; success path byte-for-byte unchanged.
- Files: `src/features/cx-queue/lib/jobs.ts` (dqCheckinTick_ only: destructure `todaysErr`, warn, guard rewrite); `tests/golden/queue-checkin-auto.test.ts` (+1 regression test).
- Check: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 9/9 pass. New test fails pre-fix (rewrite deletes seeded `agg_snapshots_today` rows via `hubDb.missing.add('queue_snapshots')`).
- Out of scope honored: subErr, dqRemindMissedCheckins_, hub-fakes untouched.
- Handoff: none.
