# tl-1 — qa-build-missing-agents (FIX, reports/debug-1.md)

## Outcome
Both blocking findings fixed in `src/features/cx-quality/lib/engine-live.ts`
(single file, leaves ran serially). No reviewer shards requested/spawned.

## Leaves
| Leaf | Finding | Owner | Status | Evidence |
|---|---|---|---|---|
| dbg1-01 | dbg-1: qeReadTouches_ truncated at max-rows | dev | done | results/dbg1-01.md; `.range()` paging loop (page 1000, `ts_ms`+`id` desc, stops at short page / QE_MAX_TOUCH_ROWS); diff 17+/8- |
| dbg1-02 | dbg-2: qeReadLog_ capped single query | dev | done | results/dbg1-02.md; `limit: 200000` + `as never` dropped -> readAllPaged; diff 1 line |

## Changed files (FIX scope)
- `src/features/cx-quality/lib/engine-live.ts` (qeReadTouches_, qeReadLog_ only)
- Untracked: `tests/quality/qe-touch-scan-cap.test.ts` (pre-existing regression test, unchanged), `specs/qa-build-missing-agents/*`

## Integration gates (logs in specs/qa-build-missing-agents/logs/)
- `npx tsc --noEmit` — PASS
- `npx vitest run` — 1498/1499. Regression test green (touchesInWindow=poolSize=2500). Sole failure: `tests/freeze/sheets-freeze-scan.test.ts` — PRE-EXISTING, flags committed `scripts/ops/qa-*.ts` readers outside its allowlist; unrelated to this diff.
- `npx eslint .` — 1 error (`tests/golden/queue-aggregates.test.ts` no-explicit-any) + 7 warnings, all pre-existing outside the diff; `engine-live.ts` scoped lint clean.

## Notes for reviewer (DELTA scope)
- Review diff = engine-live.ts hunks at ~:178-196 (paging loop) and ~:596 (qeReadLog_).
- Shirin absent-from-outcomes verified legitimate by debug-1 (zero in-window touches); no fix needed. Optional "explicit reason for zero-touch roster agents" left out of scope per PLAN non-goals.
- Blocked: none. needs-split: none.
