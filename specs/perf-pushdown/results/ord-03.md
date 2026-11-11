# ord-03 — digest line ordering (pwTasksOut_ actions)
Status: done — people-jobs.test.ts 14/14 green (was 1 failed at :549).
Files: src/features/cx-people/lib/work-core.ts only (reminders.ts untouched — fix belongs at the actions read).
Fix: pwTaskContext_ now stable-sorts ctx.actions by the store's implicit serial `id`
(hub-fakes.ts:48-55 assigns id = sheet append index; real actions rows have no id
column, so Number.isFinite guard makes it a no-op in prod — pk-asc read order kept).
Chosen site/key recorded per contract: work-core.ts:94-101, key = implicit serial id
= legacy sheet/insertion order; no business column reproduces it (verified: no
monotonic column on actions; oracle output dumped = fixture order T-OD,T-TODAY,
T-NOSTART,T-NOUPD,T-HALF,T-PM).
Checks: `npx vitest run tests/golden/people-jobs.test.ts` -> 14 passed;
`npx tsc --noEmit` -> no errors in edited file; 2 PRE-EXISTING errors in
src/features/cx-queue/lib/pages.ts:46,299 (missing rosterRows_) — outside this leaf.
Handoff: none for ord-03; TL may want a leaf for the pages.ts tsc errors.
