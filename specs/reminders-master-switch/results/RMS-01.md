# RMS-01: reminders_enabled config default + remindersOn()
Status: done
Files: src/features/shared/platform/settings.ts (CONFIG_DEFAULTS key + remindersOn export), tests/platform/settings.test.ts (3 assertions)
Checks: `npx vitest run tests/platform/settings.test.ts` -> 10/10 pass
Notes: remindersOn uses pwOoOn_ truthiness pattern; resolves true for missing key.
Handoff: RMS-02..RMS-08 import remindersOn + bustConfigCache from settings.ts.
