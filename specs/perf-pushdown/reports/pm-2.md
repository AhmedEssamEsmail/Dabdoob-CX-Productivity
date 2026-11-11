# PM findings — user-directed fix #2 (2026-11-11)

## F3 — remove preserved `eval('from')` bug in prod analytics admin hist path
- Owner: dev
- File: `src/features/cx-productivity/lib/prod/analytics.ts:290-296` (admin `full=true` branch)
- Context: `eval('from')` deliberately reproduces a legacy ReferenceError (ProdValidation.js:541);
  user approved FIXING it — the `full=true` hist path should populate `out.hist` instead of 500ing.
- Change: remove `eval`/`eval('from')` entirely; filter `inp.hist` rows against the resolved
  lower date bound the function already uses for the window (the `from`/start bound in scope —
  if no such bound exists for hist, keep all rows). Update the comment: no longer "BUG PRESERVED".
- Verify: `npx tsc --noEmit`; targeted vitest for prod analytics; a `full=true` request returns
  200 with populated `hist` (record evidence in the leaf result).
- Keep the rest of the function byte-parity; only the ReferenceError reproduction goes away.
