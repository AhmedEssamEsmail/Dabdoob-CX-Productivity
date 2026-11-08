# TL report 2: reminders-master-switch (FIX round 1, source: reports/qa-1.md)

## Routed findings
- qa-1 MED -> RMS-F03 + RMS-F04 (dev). Resolved per updated PLAN #4/#6:
  - `src/features/cx-queue/lib/jobs.ts`: `dqRemindMissedCheckins_` writes the
    `queue_checkin_missed` dedupe popup unconditionally; only `sendMail` is
    gated. Re-enable can no longer fire a trailing-window check-in late.
  - `src/features/cx-quality/lib/server.ts`: `qaCtlReminders` skips the
    `qa_ctl_due` backfill + `qa_ctl_reminder` emails while off but still marks
    `reminded_date` via the existing tx; returns `{skipped:'off'}`.
- qa-2 MED -> RMS-F02 (dev). `src/features/shared/platform/popups.ts`:
  `raisePopup` now skips only `REMINDER_POPUP_KINDS` (`missed_1on1`,
  `qa_ctl_due`) while off; event kinds and `queue_checkin_missed` still
  dedupe+append; `pendingPopupsFor`/`popupsPoll` keep hiding everything
  (resurface on re-enable). Matches updated PLAN #3.
- qa-3 LOW (admin `Rb` flash) and qa-4 LOW (no component test for the block):
  deferred per FIX rules; qa-4 may be covered by the pending UX/UI gate.

## Changed files (fix scope only)
`popups.ts`, `jobs.ts`, `server.ts` (+13/-5 total) and the three
`tests/golden/reminders-off-{popups,dq,qa}.test.ts` files updated to the new
contracts. All inside leaf Files lists; no stray edits (two result files were
written to project-root `results/` — relocated, dir removed).

## Gates (round 3)
- `npx tsc --noEmit` PASS · `npx vitest run` PASS 1152/1152 (53 files) ·
  scoped `npx eslint` 0 errors (3 pre-existing server.ts warnings, outside diffs).
- e2e not re-run: still red for foreign in-flight redesign work; no fix file
  implicated. Re-run after redesign integrates.

## Handoff to PM
- DELTA scope for re-review: the 6 files above + TRACKER Review findings table.
- Pending: PM's single `git commit` step; UX/UI gate; e2e decision.
