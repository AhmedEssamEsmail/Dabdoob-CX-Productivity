# RMS-F02: raisePopup off-gate scoped to reminder kinds
Status: done
Files: src/features/shared/platform/popups.ts (REMINDER_POPUP_KINDS gate), tests/golden/reminders-off-popups.test.ts
Checks: npx vitest run tests/golden/reminders-off-popups.test.ts -> 3/3 pass; npx tsc --noEmit -> clean
Contract: while off, missed_1on1/qa_ctl_due skip; other kinds dedupe+append; reads still []
Handoff: queue_checkin_missed rows writable while off (RMS-F03 relies on this). No blockers.
