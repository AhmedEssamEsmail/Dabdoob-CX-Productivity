# tl-2 — FIX round for reports/ux-1.md (qa-all-bases-count)

## Scope
UX gate FAIL, 3 MED findings, all copy-only. Fix spec:
`spec/fix-ux-1.md` — 3 mini leaves, preflight PASS (structural + semantic).

## Changed files (DELTA for reviewer)
- `src/features/cx-quality/components/quality-analytics-page.tsx`
  - ux1-01: `:138` `'Not final: these return when decided'` ->
    `'Not final: counted already; the score can still move when decided'`
    ('Final' else-branch kept).
  - ux1-02: `:147` blank-score tail -> `` `${a.length ? ' · not counted: ' :
    'Not counted: '}${t.blankScores} with no score` ``.
- `src/features/cx-quality/components/quality-scores-page.tsx`
  - ux1-03: `:213` title `Sample mix` -> `Beyond the random sample`
    (report option B; `d.others`/`analytics.ts` filter and empty-state
    copy untouched — still accurate).

## Evidence
- results/ux1-01.md, results/ux1-02.md, results/ux1-03.md — all `done`.
- Gates: `npx tsc --noEmit` PASS; `npx eslint` on both touched files PASS;
  `npx vitest run tests/quality tests/golden` PASS 40 files / 930 tests.
  Logs: logs/fix1-{tsc,lint,vitest}.log.

## Notes
- No reviewer/gate shards requested or spawned; PM reruns the UX gate.
- ux1-01/ux1-02 serialised on the same file; ux1-03 ran in parallel.
- No blockers, no RESHARD_NEEDED, no scope creep (3 files -> 2, all diffs
  are one-line string changes).
