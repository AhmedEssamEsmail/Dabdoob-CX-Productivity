# TL report - home-quality-cards - FIX round 3 (source: reports/ux-1.md)

## Findings routed
- ux-1 (MED): quality `.stat-v` scores rendered without a unit -> leaf ux1-01 -> dev -> **verified**.
- ux-2 (LOW): Open CTLs shows `0` when quality is null -> **deferred** (FIX policy).
- ux-3 (LOW): `.stat-d` jargon copy -> **deferred** (FIX policy).

## ux1-01 (spec/fix-ux-1.md#ux1-01) — done
- File: `src/features/cx-hub/components/overview-page.tsx` — only the three
  `.stat-v` spans in the `.page-stats--quality` row (~496/501/506).
- Change: `q.month`/`q.week` render `${value}%` (– when null); `q.monthDelta`
  renders `${Ql(...)} pts` (– when null). Matches ScoreChip/pulse `%` and the
  scores-page `+N points` phrasing.
- Evidence: results/ux1-01.md; git diff scoped to the 3 spans only.

## Gates (round 3 — logs/gates-ux1.log)
- `npx tsc --noEmit` -> exit 0
- `npx eslint src/features/cx-hub/components/overview-page.tsx` -> exit 0
- `npx vitest run tests/hub-home-quality.test.ts` -> 5/5 pass

## Incident (resolved)
Worker wrote its result to repo-root `results/ux1-01.md`, overwriting a
tracked file from an earlier task. TL restored the original from HEAD
(content-identical, git status clean) and moved the result to
`specs/home-quality-cards/results/ux1-01.md` per PLAN conventions.

## Reviewer DELTA scope
`overview-page.tsx` lines ~496/501/506 only (three `.stat-v` spans).
