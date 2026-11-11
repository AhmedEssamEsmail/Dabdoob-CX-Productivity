# TL report 1 — Phase 3 regression lock-in

## Leaves: 9/12 done, 0 failed, 3 blocked

| Leaf | Status | Evidence |
|---|---|---|
| P3-C1-01 routes.ts | done | results/P3-C1-01.md — 41 routes, tsc/eslint/--list clean |
| P3-C1-02 page-contract.spec.ts | done | results/P3-C1-02.md — 82 tests enumerated |
| P3-C1-03 baseline+quirks | done | results/page-contract-baseline.md — 68/82 chromium; quirks exact-match only; FINDINGs kept failing (h-scroll /admin /checkins /productivity-analytics /quality-analytics @375; toolbar /admin/roster /overview @1024, /agents @375; intermittent / /my-day); 4 ENV rows pending stable tree (perf-WIP churn, NOT allowlisted) |
| P3-C2-01 toc-links (A1) | done | results/P3-C2-01.md — 4/4 pass |
| P3-C2-03 settings-width (A4) | done | results/P3-C2-03.md — 4/4 incl. narrow= scan 0 hits |
| P3-C2-04 legacy-ui-absence (A5) | done | results/P3-C2-04.md — 4/4; 1 allowlist |
| P3-C2-05 input-sizing (A3/A6) | done | results/P3-C2-05.md — 4/4 |
| P3-C34-01 4 warn rules | done | results/P3-C34-01.md — warn-only per PM; burn-in 75 warns |
| P3-C5-01 AGENTS.md DoD | done | results/P3-C5-01.md — append-only |

## Blocked (awaiting Phase-1/PM)
- P3-C2-02 (A2 toolbar): S01-02 still pending in Phase-1 TRACKER.
- P3-C34-02 warn->error: burn-in = 75 warnings (70 raw-controls, 5 style-literals) — Phase-1B backlog; PM ordered warn-only regardless.
- P3-C6-01 visual baseline: optional; needs Phase-2 PASSes for stable baselines.

## Gates
- Preflight: check_shards.py PASS x12 (after spec-metadata fixes: P3-C5 fence `##` indent; P3-C2-01/02/05 budget actions 4->5; P3-C6-01 budget/files format).
- Per-leaf gates all green: tsc --noEmit, eslint on new files, playwright --project=chromium.
- `npx eslint src` exit 0 with new rules at warn (baseline recorded for C34-02).

## For PM
- TRACKER.md was rewritten by a parallel Phase-1 TL mid-flight, dropping the Phase-2 section — I re-added Phase-3 only; Phase-2 TL may need to re-add theirs.
- Files staged only (git add, no commits); unrelated perf WIP untouched.
- C1-03 FINDING lines in page-contract-baseline.md seed Phase-1/2 fix shards.
- No reviewer/gate shards were requested or spawned.
