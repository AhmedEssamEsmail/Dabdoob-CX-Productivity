# RMS-03 — gate oneOnOneAlerts on reminders_enabled
Status: done
Files: edited src/features/shared/platform/notify.ts (import + gate after `const now`); created tests/golden/reminders-off-alerts.test.ts
Checks: `npx vitest run tests/golden/reminders-off-alerts.test.ts` — 2/2 pass; `npx tsc --noEmit` — clean
Handoff: none; alerts poll gated, no downstream leaf depends on this file.
