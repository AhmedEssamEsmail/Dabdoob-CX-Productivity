# TRACKER: qa-all-bases-count
Status vocabulary: `pending -> ready -> in-progress -> done -> verified`;
exceptions: `needs-split`, `superseded`, `blocked`, `deferred`.
Single writer: tech-lead. Owners write only their own `results/<leaf-id>.md`.

Baseline dirty tree at start (do not revert): `?? .probe.mjs`,
`?? specs/agent-audit-count-gap/`, `?? specs/qa-all-bases-count/` (all
untracked; spec dir includes this plan/tracker).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| S01 | package/- | - | - | n/a | not dispatchable | verified | all children + gates green |
| S01-01 | mini/S01 | dev | none | 1/2/12/5 | PASS | verified | results/S01-01.md; core.ts +3/-2; vitest -t qaRollupAudits_ pass, tsc clean |
| S01-02 | mini/S01 | dev | S01-01 | 1/6/90/10 | PASS | verified | results/S01-02.md; analytics.ts 55 lines; no isRandom/excludedDisputed left; tsc clean, 923 tests pass |
| S01-03 | mini/S01 | dev | S01-02 | 1/4/50/8 | PASS | verified | results/S01-03.md; qaScoresRange_ clean of random*/isRandom; tsc clean, qa-pushdown 18/18 |
| S02 | package/- | - | S01 | n/a | not dispatchable | verified | all children + gates green |
| S02-01 | mini/S02 | dev | S01-02 | 1/8/40/8 | PASS | verified | results/S02-01.md; page copy all-bases; grep random=0; tsc clean, 12f/39t pass |
| S02-02 | mini/S02 | dev | S01-02 | 1/2/6/5 | PASS | verified | results/S02-02.md; charts.tsx 4 lines; grep random clean; tsc clean |
| S02-03 | mini/S02 | dev | S01-03 | 1/9/45/10 | PASS | verified | results/S02-03.md; scores-page 43 lines; only data-driven 'random-sample' text left; tsc clean |
| S03 | package/- | - | S01 | n/a | not dispatchable | verified | all children + gates green |
| S03-01 | mini/S03 | test-engineer | S01-01 | 1/2/35/8 | PASS | verified | results/S03-01.md; pin +11 lines, oracle untouched; 2/2 pass |
| S03-02 | mini/S03 | test-engineer | S01-02 | 1/3/110/10 | PASS | verified | results/S03-02.md; new qa-all-bases.test.ts 6 tests ~83 lines; 6/6 pass |

Waves (index notes, max 3 workers): w1 S01-01 -> w2 S01-02 ->
w3 {S01-03, S02-01, S02-02} -> w4 {S02-03, S03-01, S03-02}.

## Re-sharding
| Original ID/path | Violated limit / checkpoint | Children replacing remaining scope | Status |
|---|---|---|---|

## Gate log
| Round | Gate | Command | Result |
|---|---|---|---|
| final | typecheck | `npx tsc --noEmit` | PASS (empty log, logs/int-tsc.log) |
| final | lint | `npm run lint` | PASS vs scope: 1 error + 6 warnings all in UNTOUCHED files (queue-aggregates.test.ts etc.); zero in task paths (logs/int-lint.log) |
| final | unit/golden | `npx vitest run tests/quality tests/golden` | PASS 40 files / 930 tests (logs/int-vitest.log) |
| fix-ux-1 | typecheck | `npx tsc --noEmit` | PASS (logs/fix1-tsc.log) |
| fix-ux-1 | lint (2 touched files) | `npx eslint quality-analytics-page.tsx quality-scores-page.tsx` | PASS (logs/fix1-lint.log) |
| fix-ux-1 | unit/golden | `npx vitest run tests/quality tests/golden` | PASS 40 files / 930 tests (logs/fix1-vitest.log) |
| fix-ux-2 | typecheck | `npx tsc --noEmit` | PASS (logs/fix2-tsc.log) |
| fix-ux-2 | lint (touched file) | `npx eslint quality-scores-page.tsx` | PASS (logs/fix2-lint.log) |
| fix-ux-2 | unit/golden | `npx vitest run tests/quality tests/golden` | PASS 40 files / 930 tests (logs/fix2-vitest.log) |

## Review findings (FIX mode)
| Finding | Source report | Assigned | Status | Evidence |
|---|---|---|---|---|
| ux-1 (MED, analytics-page:138 stale disputes copy) | reports/ux-1.md | ux1-01 | verified | results/ux1-01.md; tsc clean |
| ux-2 (MED, analytics-page:142-149 blanks under "Counted") | reports/ux-1.md | ux1-02 | verified | results/ux1-02.md; tsc clean |
| ux-3 (MED, scores-page:213 "Sample mix" title) | reports/ux-1.md | ux1-03 | verified | results/ux1-03.md; tsc clean |
| ux-4 (MED, scores-page:672 dangling "sample-mix panel" ref) | reports/ux-2.md | ux2-01 | verified | results/ux2-01.md; tsc clean |
| ux-5 (LOW, analytics-page:143-148 awkward empty "Counted" prefix) | reports/ux-2.md | - | deferred | LOW -> deferred per FIX rules |

Fix spec: `spec/fix-ux-1.md` — preflight PASS all 3 leaves (structural +
semantic, all copy-only single-file edits).

| ID | Kind/Parent | Owner | Depends | Budget f/a/lines/min | Size gate | Status | Result / evidence |
|---|---|---|---|---|---|---|---|
| ux1-01 | mini/fix-ux-1 | dev | none | 1/1/2/5 | PASS | verified | results/ux1-01.md; 1-line copy fix |
| ux1-02 | mini/fix-ux-1 | dev | ux1-01 | 1/1/4/5 | PASS | verified | results/ux1-02.md; 1-line copy fix |
| ux1-03 | mini/fix-ux-1 | dev | none | 1/1/2/5 | PASS | verified | results/ux1-03.md; 1-line copy fix (retitle option) |
| ux2-01 | mini/fix-ux-2 | dev | none | 1/1/2/5 | PASS | verified | results/ux2-01.md; 1-sentence copy fix |

## Blocked / needs user
- (none)

## Notes for PM
- Stray `.probe2.mjs` (repo root, Supabase read probe) appeared during S01-01 —
  not in leaf scope; left in place, likely scratch from earlier debug work.
- Owner wrote results to repo-root `results/`; TL moved it into
  `specs/qa-all-bases-count/results/`.
- Wrap-up flag from index: quota/coverage (`doneBy`, queue detail copy) still
  counts queue slots only — ask user whether it should move to all bases too.
- Data gate (PM): reconcile Kareem Salah 2026-11 count 43 vs sheet `qa_audits`.
- A shard asking for a reviewer/UX gate = ignored; PM runs gates.
