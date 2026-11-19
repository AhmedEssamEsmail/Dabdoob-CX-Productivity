# ux report - overview-single-refresh - round 1 (FULL)

Verdict: PASS
Open: 0B/0H/0M/2L
States checked: loading, empty, error, success, disabled, long text, mobile, dark, keyboard, focus (see Not verified)

Changed UI files reviewed: `src/features/cx-hub/components/overview-page.tsx` (diff), `src/features/cx-hub/components/hub-shared.tsx` (`Eo` signature only, non-visual). Supporting reads: `RefreshButton.tsx`, `use-page-data.ts`, `refresh.css:497-499`, `PageShell.tsx` (`.page-actions` wrapper), `e2e/toolbar-stability.spec.ts`, sibling `Hf` usage (overview is the only `<Hf>` consumer).

## Passes summary

- **Consistency**: header `Hf` under `.page-head .page-actions` matches the `/queue`-`/aging` refresh family; `Queues now` head keeps the same `xg` freshness-hint pattern siblings use; no ad-hoc colors/sizes/copy introduced.
- **States**: removing the second control can't regress loading (skeletons via `LoTiles`/`LoLadder` unchanged), empty (`No queues in this count.`), or error (`sh` + retry still wired to `Eo` `reload`). On refresh the `tick` dep refires `usePageData`'s loader **stale-while-revalidate** (`use-page-data.ts:60-79`): prior `data` is kept, so `Queues now` updates in place — no skeleton flash, no layout shift. Cooldown/`aria-busy`/`role="status"` messaging unchanged (`RefreshButton.tsx:55-64`).
- **Accessibility**: native `<button>` with text label; `role="status"` live region confirms result; cooldown label `Refresh again in N s` is announced text, not color-only. Headings/`aria-labelledby` structure unchanged.
- **Interaction**: `onDone` fires only on `refreshed` (`RefreshButton.tsx:47`), so throttled POSTs don't trigger pointless refetches; `setQTick` bump correctly reloads `/api/queue/health` — parity with the deleted in-section `onDone={t}`.
- **PLAN criteria 1-2**: exactly one `.cx-refresh > button`, located in `.page-actions`; `Queues now` head contains only the hint (unit test `tests/overview-single-refresh.test.ts` enforces both).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | LOW | `overview-page.tsx:279-281` | `<span class="cx-section__hint">` wraps `xg(...)`, which itself returns a `.cx-section__hint` span — now a redundant nested hint pair since the `Hf` sibling is gone (pre-existing pattern, harmless same-class nesting) | Drop the outer wrapper span: render `{xg({ iso: n.dataAsOf })}` directly | dev |
| ux-2 | LOW | `RefreshButton.tsx:57` (shared, unchanged) | Button goes `disabled` while busy/cooldown; in Chrome focus drops to `body` and is not restored on re-enable — keyboard user pressed Enter in header loses position. Pre-existing shared behavior; more visible now that it's the sole control | Keep focus on the wrapper or restore focus to the button after `busy` clears (e.g. `aria-disabled` + guard instead of `disabled`, or refocus in `then`) | dev (shared comp — coordinate with queue/aging) |

## Not verified / assumptions

- Live 375/1024 px render not run (no dev server); judged from code — change is a control **deletion** plus an existing-CSS header button (`min-inline-size:11rem`, `.cx-refresh` wraps, status `flex-basis:100%`). Overflow regression covered by `e2e/toolbar-stability.spec.ts` `/overview` watch list — left to QA per PLAN.
- Actual click→`POST /api/queue/refresh`→health refetch verified by code path + unit test, not live e2e (TL deferred to QA/UX gate; flagged here as code-verified).
- Contrast/focus-ring pixels not measured (no computed styles); all elements reuse existing tokens/components — no new colors.
- Focus-not-obscured (2.4.11), 1.4.10 reflow at 320px: not rendered this round.
