# qa-blank-01 — DONE
Status: pass. Route taken: extended `qaRowsWhere_` with an `or?: string` option (signature-compatible) applied via `query.or(f.or)` inside `readAllPaged` build.
Files: src/features/cx-quality/lib/server.ts (:95 helper +or, :2310 backfill read); tests/perf/qa-pushdown.test.ts (fake `or` op + NULL/''/dated parity fixture).
Checks: `npx vitest run tests/perf/qa-pushdown.test.ts` 14/14 pass; `npx tsc --noEmit` clean.
Predicate: `or: 'interaction_at.is.null,interaction_at.eq.'` — NULL + '' superset; JS `blank` filter verbatim; no other call sites touched.
Handoff: chain resumes at S08-10.
