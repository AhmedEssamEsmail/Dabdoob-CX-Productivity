# TL report 1: home-quality-cards (BUILD)

## Leaves
| Leaf | Owner | Status | Files changed | Evidence |
|---|---|---|---|---|
| S01-01 | dev | verified | src/features/cx-hub/lib/aggregates.ts (+66/-1) | results/S01-01.md; tsc 0 |
| S01-02 | test-engineer | verified | tests/golden/hub-overview.test.ts (D-QUALITY strip), tests/hub-home-quality.test.ts (new) | results/S01-02.md; 15/15 vitest x2 |
| S01-03 | dev | verified | src/features/cx-hub/components/overview-page.tsx (+31/-16), src/app/styles/hub.css (+1) | results/S01-03.md; eslint+tsc 0 |

Package S01: done (all children + integration).

## Integration gates (log: results/integration-gates.log)
- `npx tsc --noEmit` — PASS.
- `npx eslint` on our 4 files — PASS. Repo-wide `npx eslint .` — 1 error in
  committed `tests/golden/queue-aggregates.test.ts:123` (pre-existing on main,
  file clean in git); 6 warnings in unrelated files.
- `npx vitest run` — 1534/1536 pass. 2 failures, none ours:
  - `tests/freeze/sheets-freeze-scan.test.ts` — committed `scripts/ops/qa-*.ts`
    sheet readers outside allowlist (pre-existing).
  - `tests/css/table-center-align.test.ts` `.qa-whylist` — fails on
    `src/app/styles/quality.css`, dirty baseline of the in-flight
    qa-audit-footer-compact agent (not our file).

## Notes for PM
- No review gates run (QA/Data/UX are PM-run per PLAN risk flags).
- e2e/security/build not run — PM decision.
- Baseline dirty tree (quality.css, cx-quality components, jobs.ts,
  hub-fakes.ts, queue-checkin-auto.test.ts, qa-audit-footer-compact.test.tsx)
  belongs to another agent; untouched.
- No blocked/needs-user items.
