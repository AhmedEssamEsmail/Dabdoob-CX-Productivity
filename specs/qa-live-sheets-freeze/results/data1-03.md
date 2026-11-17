# data1-03 — dq_hct snapshot dedupe on cleaned email
Status: DONE
Files: src/features/cx-hub/lib/roster.ts (snap via Map keyed on dqCleanEmail_, last wins); tests/platform/dq-hct-snapshot.test.ts (clean-collision case)
Checks: `npx vitest run tests/platform/dq-hct-snapshot.test.ts` -> 7/7 pass
Handoff: closes data-3 + sec-5; remote dq_hct dup-row cleanup remains PM/deploy handoff.
