# data1-02 — DONE

- Fix: `jobs.ts` `dqCheckinTick_` — the `subDone[cp.key]` guard now attempts `resolvePopups('queue_checkin_missed', cp.key, 'system:job')` in its own try/catch (warn-and-continue via `hbBeat`) before `continue`; post-insert resolve, `appendRow` args, `subDone` preload, `dqRemindMissedCheckins_` untouched.
- Test: `queue-checkin-auto.test.ts` +1 regression: seeded submission (`qs_human`) + unresolved `queue_checkin_missed` popup for CP_KEY -> tick leaves subs at 1 and sets popup `resolved_at`.
- Checks: `npx vitest run tests/golden/queue-checkin-auto.test.ts` -> 7/7 pass (log `logs/data1-02-vitest.log`). New test verified failing on pre-fix code (resolved_at null; `logs/data1-02-prefix.log`), passing after.
- Handoff: none; leaf complete.
