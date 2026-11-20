# FIX leaves: reports/ux-1.md

## ux1-01: Give quality card values their score unit
Kind: mini
ID: ux1-01
Parent: S01
Owner: dev
Depends: none
Criteria: finding ux-1 (MED) — QA score is 0–100; bare `87.4`/`+2.3` is
ambiguous beside Team pulse `87%` on the same screen
Skills: none
Budget: files=1; actions=3; changed_lines=10; minutes=5

### Goal
Every `.stat-v` quality value that is a score must carry a unit, matching
sibling renderings (Team pulse `{r.v}%`, `ScoreChip` `{score}%`, scores page
`{f.score}<small>%</small>` / `+N points`).

### Files
- Edit: `src/features/cx-hub/components/overview-page.tsx` | quality `.page-stats--quality` row ~494-513, `.stat-v` spans ~496/501/506

### Context
- `src/features/cx-hub/components/overview-page.tsx:492-515` | the quality row JSX
- `src/features/cx-hub/components/hub-shared.tsx:323` | `Ql` signed-delta
  formatter (`null -> '–'`)
- `src/features/cx-quality/components/quality-scores-page.tsx:563-576` |
  sibling score/delta renderings to stay consistent with

### Contract
- `q.month`/`q.week` render `–` when null, else the value with a `%` suffix
  (e.g. `{q.month == null ? '–' : `${q.month}%`}`).
- `q.monthDelta` renders `–` when null, else the signed `Ql(...)` value with a
  ` pts` unit (e.g. `+2.3 pts`, `−1 pts`); keep the `Ql` call for the sign.
- Out of scope: `.stat-d` hint copy (ux-3, deferred LOW), the `Hi(q.openCtls)`
  fallback (ux-2, deferred LOW), any other row/file/logic.

### Actions
1. Month `.stat-v`: `{q.month == null ? '–' : `${q.month}%`}`.
2. Delta `.stat-v`: `{q.monthDelta == null ? '–' : `${Ql(q.monthDelta)} pts`}`.
3. Week `.stat-v`: `{q.week == null ? '–' : `${q.week}%`}`.

### Done when
- No bare numeric score renders in the quality row; null still shows `–`.
- No other JSX, labels, logic, or files change.

### Verify
- Run: `npx eslint src/features/cx-hub/components/overview-page.tsx` -> 0 errors.
- Run: `npx vitest run tests/hub-home-quality.test.ts` -> all tests pass.

### Handoff
Reviewer delta-checks only the three `.stat-v` spans in the quality row.
Write results/ux1-01.md (<=10 lines); TL alone updates TRACKER.md.
