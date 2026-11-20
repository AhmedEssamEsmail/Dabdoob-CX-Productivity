# tl-3 — FIX round for reports/ux-2.md (qa-all-bases-count)

## Scope
UX gate round-2 FAIL: 1 MED + 1 LOW. Fix spec: `spec/fix-ux-2.md` — 1 mini
leaf, preflight PASS (structural + semantic). ux-5 (LOW) deferred per FIX
rules; recorded in TRACKER review-findings table.

## Changed files (DELTA for reviewer)
- `src/features/cx-quality/components/quality-scores-page.tsx`
  - ux2-01: explainer (~:672) `The sample-mix panel ...` ->
    `The "Beyond the random sample" panel and the "every audit counted once"
    line are shown for context.` — now names a panel present on the page.
  - No other lines changed this round; panel title (:213) and `analytics.ts`
    untouched.

## Evidence
- results/ux2-01.md — `done`.
- Gates: `npx tsc --noEmit` PASS; `npx eslint quality-scores-page.tsx` PASS;
  `npx vitest run tests/quality tests/golden` PASS 40 files / 930 tests.
  Logs: logs/fix2-{tsc,lint,vitest}.log.

## Notes
- No reviewer/gate shards requested or spawned; PM reruns the UX gate.
- ux-5 (LOW, optional copy polish on the empty "Counted, by basis:" prefix)
  deferred — PM may log it as backlog or include in a future polish shard.
- No blockers, no RESHARD_NEEDED, no scope creep (1 file, copy-only).
