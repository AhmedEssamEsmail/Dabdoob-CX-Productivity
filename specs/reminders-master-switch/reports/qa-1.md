# qa report - reminders-master-switch - round 1 (FULL)

Verdict: FAIL
Open: 0B/0H/2M/2L

Checks run:
- `npx tsc --noEmit` -> clean, 0 errors
- `npx eslint` (scoped: 16 leaf files) -> 0 errors, 8 warnings, all pre-existing (unused eslint-disable at admin-page.tsx:324-360, unused vars at server.ts:321/349/390 — none inside leaf diffs)
- `npx vitest run` -> 1150/1150 pass (53 files)
- `npx vitest run tests/security` -> 22/22 pass
- e2e: not re-run (TL ran `npx playwright test`: 27/85 fail on `#nav`/`.cxp`/login selectors in auth/my-status/status-validation/responsive specs — all foreign to leaf files, caused by concurrent in-flight redesign work in the tree; no e2e spec covers the Admin page anyway)

Criteria coverage: C1 configRows/ALL_SETTINGS + settings.test.ts OK (parseConfigValue yields boolean; saveConfigValue validates against default kind, works without existing row). C2 Rb block wired to Ln.saveConfigSetting (admin+assertWritable path) — code verified, no automated UI evidence (qa-4). C3-C5 verified by reminders-off-* tests (real hub-fakes DB, off+on arms, dedupe rows asserted). C6 partially verified — see qa-1. C7 verified by gates above.

| ID | Sev | file:line | Issue + evidence (<=2 lines) | Exact fix | Owner |
|----|-----|-----------|------------------------------|-----------|-------|
| qa-1 | MED | src/features/cx-queue/lib/jobs.ts:247-250, src/features/cx-quality/lib/server.ts:2124-2155 | Criterion 6 deviation: whole-job gates write no dedupe, so on re-enable a check-in missed in the trailing 12h window fires popup+mail late, and CTLs that came due while off send their daily reminder (reminded_date untouched). Bounded but retroactive; reminders-off-dq.test.ts encodes this as intended. | Either accept as intended resume (PM call) or while off mark `reminded_date`/write the popup dedupe row so suppressed items never fire. | dev |
| qa-2 | MED | src/features/shared/platform/popups.ts:64 | raisePopup is gated wholesale: notification-kind popups raised while off (qa_ctl_confirm, qa_dispute_escalated, escalation_1on1) are permanently dropped, never shown even after re-enable. Conformant to criterion 3's letter but in tension with the notifications-vs-reminders non-goal. | Confirm intent; if notifications must survive, gate `pendingPopupsFor`/reads only (defer, not drop) or skip gate for non-reminder kinds. | dev |
| qa-3 | LOW | src/features/cx-hub/components/admin-page.tsx:375 | Rb defaults `on = true` while `rows` is null, so the block flashes "Reminders are on" + an active "Turn off" before getConfigRows resolves. | Render nothing (or disabled button) until `rows` is set. | dev |
| qa-4 | LOW | src/features/cx-hub/components/admin-page.tsx:372-404 | No automated evidence for criterion 2: no component test for the Reminders block and no e2e spec covers Admin; verification is code inspection + tsc only. | Add a component/golden test asserting the block renders current state and calls saveConfigSetting, or rely on the pending UX/UI gate. | test-engineer |

Not verified / assumptions:
- e2e gate red for foreign reasons per TL report; leaf files are not implicated by any failure pattern. Re-run after the concurrent redesign work integrates.
- View-as ordering: raisePopup's gate runs before assertWritable, so a view-as write attempt while off returns `{skipped:'off'}` instead of refusing — harmless, consistent with cheap-gate-first.
- Config cache: all tests bust cache between flips; production relies on the existing 5-min cache + bustConfigCache on write — a flip can take up to 5 min to reach other server processes' cached reads (pre-existing platform behaviour).
- Scope check clean: all diffs inside the TL changed-files list; no debug leftovers, TODOs, or new deps; hub-admin.test.ts superset helper is documented and still per-key strict on oracle keys.
