# PM findings — perf-5 regression on /api/hub/home (2026-11-11)

## F4 — hub/home +50% over T0 baseline (budget breach)
- Owner: debugger for isolation, dev for the fix (split if needed)
- Symptom: `GET /api/hub/home` median 2.189s vs T0 1.459s on the final build,
  reproducible (perf1-01 measurement, logs under specs/perf-pushdown/logs/).
- Suspects (from this spec's changes on that path): P-04/P-15 pushed predicates
  (`stores.ts` gte/lte, `aggregates.ts` bounds), `configAll()`/`pwDirectory()`
  adoption, `dqCachedLive` TTL invalidation, `readAllPaged` extra roundtrips,
  Promise.all regrouping in `getHomePage`.
- Approach: profile the endpoint on the running :3100 build (or instrument the
  per-read timings in `getHomePage`), identify the regressed read(s), fix within
  the pushdown contract (index-covered predicate, no reversion to whole-table
  reads), re-time 3 warm runs — target <=1.459s median.
- Verify: updated `## After` row in docs/PERF_BASELINE.md; vitest green.
