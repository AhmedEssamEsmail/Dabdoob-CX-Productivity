# tl report — perf-pushdown — FIX round qa-1 (reports/qa-1.md)

Verdict: all 5 blocking findings fixed and TL-verified; integration gates green.
One NEW residual surfaced for PM triage (below) — not a spec regression.

## Leaves dispatched (spec/fix-qa-1.md; all preflight PASS struct+sem)

| Leaf | Owner | Status | Changed files |
|---|---|---|---|
| qa1-01 | dev | done | `src/features/cx-people/lib/scorecard-server.ts` (or-string +`date.eq.` branch, :210), `tests/perf/scorecard-range.test.ts` (or-double + `date:''` seed/assertions) |
| qa1-02 | data-engineer | done | `docs/PERF_BASELINE.md` (:226 row + verdict), `specs/perf-pushdown/logs/after-timings-qa1.log` |
| qa1-03 | dev | done | deleted `nul`, `specsperf-pushdownlogsfakes-01-{tsc,vitest}.log` |
| qa1-04 | dev | done | `src/features/shared/platform/identity.ts` (`by` roster-only + `lookup()` synthesized fallback), `src/features/cx-people/lib/one-on-ones-page.ts` (:1086 admin list unions `dir.admins`), `tests/perf/identity-roster.test.ts` (new invariant case :139) |
| qa1-05 | test-engineer | done | `tests/perf/stores-filter.test.ts`, `tests/perf/tph-store.test.ts` (`_table` param now used in guard) |

Waves: qa1-01/02/03/04 parallel (disjoint files), qa1-05 after qa1-03 freed a slot. No re-shards, no retries, no reviewer shards requested.

## Integration gates (round 6, logs/qa1-gate-*)

- `npx tsc --noEmit` -> PASS 0 errors (empty log)
- `npx eslint` touched src + tests/perf -> PASS 0 errors / 8 warnings (all in baseline files counted in QA's 439; the 2 flagged files now clean)
- `npx vitest run` -> PASS 1292/1292, 86 files (+1 vs qa-1 = new qa1-04 case)

## New residual for PM triage (not blocking this FIX round)

`GET /api/prod/analytics` still 500s post-layers-fix-01, but the error changed:
schema drift gone; residual is `{"error":"from is not defined"}` — the
deliberately preserved verbatim legacy bug `eval('from')` at
`src/features/cx-productivity/lib/prod/analytics.ts:293-295` (admin
`full=true` hist path; in-code comment cites ProdValidation.js:541). The
endpoint 500'd pre-spec too, so parity holds; PM decides whether to file a
fix leaf or keep the preserved bug. Evidence:
`specs/perf-pushdown/logs/after-timings-qa1.log`.

## Notes for reviewer DELTA scope

- qa-1 evidence: `date.is.null,date.eq.,and(...)` or-form + `date:''` fixture parity test vs `legacyFilter`.
- qa-4 evidence: `Object.keys(dir.by)` == roster emails; `person`/`name`/`managerOf` still synthesize absent admins; :1086 escalation union recorded.
