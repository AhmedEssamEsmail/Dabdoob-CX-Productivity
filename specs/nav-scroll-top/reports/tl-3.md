# tl report - nav-scroll-top - FIX round 3 (reports/qa-2.md)

## Findings routed
- qa-2 MED (blocking) -> leaf `qa2-01` (dev) in `spec/fix-qa-2.md`. DONE.
- qa-1 LOW -> same leaf (trivial): QA's recommended rect-delta rewrite removes
  `offsetLeft`/`offsetWidth` entirely, closing it as a side effect. DONE.

## Changed files (DELTA scope for re-review)
- `src/features/shared/components/ui/Tabs.tsx` — `scrollSelectedTabIntoView`
  (~L37-56): now measures via `getBoundingClientRect()` deltas between tab and
  list and scrolls with `list.scrollBy({left: delta, behavior})`. `scrollLeft`
  is no longer read or written, so the function is immune to all RTL scrollLeft
  models (negative AND positive-reverse/WebKit) — scrollBy deltas are
  direction-consistent across models (increasing scrollLeft scrolls rightward
  in both).
- `tests/ui/tabs.test.tsx` — 3 reveal cases (LTR, RTL negative, RTL
  positive-reverse); all assert `scrollBy left: 250`.

## Attempts
- Attempt 1 incorrectly added a `positiveReverse ? -delta : delta` sign flip —
  deltas need no per-model sign; corrected by fresh dev (attempt 2/2).

## Gates (round 3)
- `npx tsc --noEmit` -> exit 0 (logs/r3-tsc.log)
- `npx eslint` changed files -> exit 0 (logs/r3-eslint.log)
- `npx vitest run tests/ui/tabs.test.tsx` -> 8/8 (logs/r3-vitest-tabs.log)
- `npx playwright test e2e/nav-scroll-top.spec.ts --project=chromium --workers=1`
  -> 2/2 (logs/r3-e2e.log); no nav-landing regression.
- Full vitest + `next build` not re-run: same round-1/2 rationale (known foreign
  baseline failure; live dev-server `.next`).

## Notes for reviewer
- Safari/positive-reverse correctness is argued from the documented model
  (scrollBy deltas are model-agnostic); not live-WebKit-verified — flag for QA.
- No shards requested reviewer profiles.
