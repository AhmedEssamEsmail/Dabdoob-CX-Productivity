# fix-sec-4: dq_hct snapshot email filter
Status: done. src/features/cx-hub/lib/roster.ts (~L320): dqSyncRoster_ snapshot now normalizes email via dqCleanEmail_ and drops blank/NULL emails before the onConflict:'email' upsert.
Checks: `npx tsc --noEmit` clean; vitest tests/platform/dq-hct-snapshot.test.ts + tests/golden/hub-people-holidays.test.ts -> 24/24 pass.
Handoff: remote dq_hct cleanup (existing NULL-email dup rows) remains pending user apply per fix-sec-1.md note.
