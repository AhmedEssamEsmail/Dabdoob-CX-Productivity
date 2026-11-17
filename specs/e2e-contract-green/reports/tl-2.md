# tl report - e2e-contract-green - round 2 (FIX of reports/qa-1.md)

## Scope
QA round 1 FAIL -> 1 HIGH (qa-1), 1 LOW (qa-2, deferred). One leaf dispatched.

## Leaves
| Leaf | Finding | Owner | Status | Files changed |
|---|---|---|---|---|
| qa1-01 | qa-1 HIGH: /my-day contract fired real mutating POST /api/hub/my-day | test-engineer | done | `e2e/routes.ts` (+7: QUIRKS['/my-day'].skipToolbar, /kb-tracker precedent), `specs/ux-ui-audit-v3/results/page-contract-baseline.md` (skip + unverified x-stability notes) |

- Preflight: `check_shards.py spec/fix-qa-1.md#qa1-01` PASS; semantic within LIMITS (2 files / 3 actions / ~15 lines).
- Worker result: `results/qa1-01.md`. Diff confirmed scoped; ~17 changed lines.
- qa-2 LOW (foreign qe-fd-cache unit failure, files unmodified in tree) -> deferred per FIX rules; not this spec.

## Gates
- g4: `npx playwright test e2e/page-contract.spec.ts --project=chromium -g "my-day contract"` (logs/qa1-tl-pw.log) -> **2/2 pass** @375+@1024 with `toolbar-skip` annotations; primary click bypassed so no POST /api/hub/my-day can fire. Worker also ran it (exit 0) + `tsc --noEmit` clean.
- Chosen fix = QUIRKS skip per PM/QA primary option; the POST-stub alternative not needed.

## Trade-off recorded
Skipping the click makes /my-day toolbar x-stability unverifiable; the S03
`md-book-btn` min-inline-size reserve remains as best-effort. Documented in the
baseline (env-quirk note + finding rows) and routes.ts comment.

## Blocked / needs user
- NEEDS_USER: the earlier S07 verify run booked a real "Focus time" event in the
  owner's Google Calendar. No in-app/API delete exists — user must remove it
  manually in Google Calendar.

## DELTA for reviewer
`e2e/routes.ts` QUIRKS block; `page-contract-baseline.md` my-day notes;
`spec/fix-qa-1.md`; `results/qa1-01.md`; `logs/qa1-tl-pw.log`.
