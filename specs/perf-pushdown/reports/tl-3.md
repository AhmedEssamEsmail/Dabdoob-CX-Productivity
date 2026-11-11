# TL report — FIX round pm-2 (2026-11-11)

Source: `reports/pm-2.md` — 1 user-approved blocking finding (F3). Dispatched as
one mini-shard; see TRACKER.md for the finding/leaf rows.

## Completed
- **pm2-01** (dev, `spec/fix-pm-2.md#pm2-01`, parent S06): removed the preserved
  `eval('from')` ReferenceError at `src/features/cx-productivity/lib/prod/analytics.ts:290-296`.
  Guard now skips hist rows with `String(r.date) < inp.weeks[0]` (the same lower
  bound `prodAnalyticsFor_` uses); comment rewritten (FIXED, parity waived by user).
  Changed files (diff TL-verified, ~28 lines vs 60 budget):
  - `src/features/cx-productivity/lib/prod/analytics.ts` — eval + eslint-disable gone
  - `tests/golden/prod-validation.test.ts` — `full=true` case now asserts port ok
    with `calibration.idle = {'3':2}`; pre-window row skipped; legacy oracle still errs
  - `tests/perf/prod-analytics.test.ts` — in-window hist fixture + `cal.idle['3']===4`
    assertion on the admin GET (full=true returns 200 + populated calibration)

## Gates (checkpoint)
- `npx vitest run tests/golden/prod-validation.test.ts tests/perf/prod-analytics.test.ts`
  → PASS 29/29 (TL-run; `logs/pm2-vitest.log`); `grep eval` → no hits.
- `npx tsc --noEmit`: worker scoped `tsc -p` over touched files+imports EXIT=0; TL
  full run emitted 0 errors but exceeded the exec window — full-repo typecheck
  deferred to the next PM gate round.

## Blocked / needs-split
None. F3 resolves the OPEN blocked item in TRACKER (endpoint no longer 500s on
`full=true` hist). PM may re-time `GET /api/prod/analytics` expecting 200.

DELTA scope for reviewer: the 3 files above.
