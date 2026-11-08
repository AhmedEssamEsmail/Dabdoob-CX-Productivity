# RMS-02 — popups gate on reminders_enabled
Status: DONE
Files: src/features/shared/platform/popups.ts (import + 3 early returns), tests/golden/reminders-off-popups.test.ts (new)
Checks: `npx vitest run tests/golden/reminders-off-popups.test.ts` 2/2 pass; `npx tsc --noEmit` clean
Off: raisePopup -> {skipped:'off'} before assertWritable/dedupe; pendingPopupsFor -> []; popupsPoll -> {popups:[]} before count query, no cache write. On: unchanged.
Handoff: popups write path centrally gated; RMS-05 can rely on raisePopup skipping while off.
