# TL report 1: reminders-master-switch (BUILD)

## Completed leaves (9/9)
- RMS-01 dev — `settings.ts` + `settings.test.ts`: `reminders_enabled` default + `remindersOn()`. Vitest 10/10.
- RMS-02 dev — `popups.ts` + `tests/golden/reminders-off-popups.test.ts`: raisePopup/pendingPopupsFor/popupsPoll gated. 2/2.
- RMS-03 dev — `notify.ts` + `reminders-off-alerts.test.ts`: oneOnOneAlerts `{now, alerts:[]}` while off. 2/2.
- RMS-04 dev — `one-on-one-reminders.ts` + `reminders-off-sendonce.test.ts`: pwSendOnce_ `skipped_off` dedupe row, no mail. 2/2.
- RMS-05 dev — `reminders.ts` + `reminders-off-missed.test.ts`: missed-esc sendMail ternary; marking untouched. 1/1.
- RMS-06 dev — `jobs.ts` + `reminders-off-dq.test.ts`: dqRemindMissedCheckins_ early return. 1/1.
- RMS-07 dev — `server.ts` + `reminders-off-qa.test.ts`: qaCtlReminders hbRun callback early `{skipped:'off'}`. 1/1.
- RMS-08 dev — `admin-page.tsx`: `Rb` Reminders block between `<Im/>` and Settings; toggle via `Ln.saveConfigSetting`. tsc clean.
- RMS-F01 test-engineer (fix leaf, `spec/fix-01-oracle-superset.md`) — `tests/golden/hub-admin.test.ts`: 3 oracle map comparisons now superset-tolerant (`expectConfigSuperset`); 8/8 pass.

## Changed files (leaf scope only)
src/features/shared/platform/{settings,popups,notify}.ts;
src/features/cx-people/lib/{one-on-one-reminders,reminders}.ts;
src/features/cx-queue/lib/jobs.ts; src/features/cx-quality/lib/server.ts;
src/features/cx-hub/components/admin-page.tsx;
tests/platform/settings.test.ts; tests/golden/hub-admin.test.ts;
tests/golden/reminders-off-{popups,alerts,sendonce,missed,dq,qa}.test.ts (new).
Actual churn well within budgets (largest single-file diff ~35 lines).

## Integration gates (round 2)
- `npx tsc --noEmit` PASS · `npx vitest run` PASS 1150/1150 (incl. security.spec 22) · scoped `npx eslint` 0 errors (8 pre-existing warnings outside leaf regions).
- `npx playwright test` FAIL 27/85 — all in auth/my-status/status-validation/responsive specs on `#nav`/`.cxp`/login selectors; no failure touches any leaf file. The tree contains concurrent in-flight redesign work (stylesheets, route.ts, qa-shared.tsx, fetch-json.ts, src/types/) — e2e ran against half-written sibling code and must be re-run after that work integrates.

## Blocked / needs-split
- None. No leaf returned RESHARD_NEEDED; no shard asked for a reviewer role.

## Handoff to PM
- Post-leaf PM step per index: one `git commit` of exactly the leaf Files lists (user requested single commit; no push). TL did not commit.
- Review gates QA + UX/UI are the PM's to run (PLAN: Security/Data/Perf skipped).
- e2e gate is red for foreign reasons — flag for PM decision (re-run post-redesign or accept scoped evidence).
