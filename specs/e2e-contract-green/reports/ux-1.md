# ux report - e2e-contract-green - round 1 (FULL)

Scope: S03/S04 toolbar-stability only — `admin-roster-page.tsx`, `my-day-page.tsx`, `agents-page.tsx`, `refresh.css` + `hub.css` page-actions rules. Source: `PLAN.md` S03/S04, `reports/tl-1.md`, `reports/tl-2.md`. Web-design-guidelines applied to the same diffs.

Verdict: FAIL (1 MED open)
Open: 0B / 0H / 1M / 2L

States checked: loading (agents skeleton→data transition drives the pin), disabled (my-day `disabled={!w||!openGaps.length||bb}` unchanged), long text/overflow (`page-actions` flex-wrap + `[role=status]` basis:100% unaffected), mobile 375 (target case, contract-green per tl-1), keyboard (partial — see ux-1), dark mode (no color changes — n/a), focus (edge under ux-1), error/empty (unchanged paths).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | agents-page.tsx:509-521 | The 800ms rAF pin calls `window.scrollTo(0,0)` every frame after first `data` load, on every viewport. For that window all user scroll input (wheel/touch/PgDn/Space/scrollbar drag) is overridden per-frame, and it re-fires on remount so it can defeat back-nav scroll restoration. Tab-focus during the window can also be yanked offscreen (2.4.11-adjacent). Once-per-mount, brief — but it arms exactly when the new table appears and a user first reaches to scroll. | Abort the pin on user intent: inside the effect add one-time `wheel`/`touchmove`/`keydown`/`pointerdown` listeners (`{once:true}` or remove on fire) that cancel the rAF loop. (Cleaner root fix — Tabs.tsx:58 `scrollIntoView` skipping window scroll on mount — is shared code, out of shard scope; note only.) | dev |
| ux-2 | LOW | hub.css:13, refresh.css:29 | `min-inline-size` reserves (9rem "Book focus block", 5.5rem "Add user") are sized to English labels; `D()` translations longer than English reintroduce the shift (`min-inline-size` grows, box re-wraps). | Acceptable as-is for the English UI; if locales land, re-measure per-locale or switch to `inline-size` + `text-align:center` on both label states. | dev |
| ux-3 | LOW | refresh.css:29 vs hub.css:13 | Scoping/naming split: roster button rule lives at `:root` in refresh.css while the equivalent my-day rule is `[data-app="hub"]`-scoped (`md-book-btn`); admin-roster is also a hub page. Both work; inconsistent with each other. | Optional: move `.roster-add-btn` under `[data-app="hub"]` in hub.css beside `md-book-btn`, or rename to a shared convention (`*-actions__primary`). | dev |

## Verified good
- Approach matches established convention: `refresh.css:489` already reserves `min-inline-size:11rem` on `.cx-refresh` buttons; logical properties (`min-inline-size`) match both files' RTL-aware style.
- No CLS/overflow risk: reserves widen buttons only; `flex-wrap` on `.page-actions` keeps 320/375px reflow intact; no horizontal scroll introduced.
- Buttons stay native `<button type="button">` (Button.tsx:15 default) with visible text labels; `D('Booking…')` uses proper ellipsis; no `transition:all`, no focus suppression, no aria regressions in the diffs.
- Agents pin guards correctly: `didPinTop` fires once per mount (not on every `apply()` reload), cleanup cancels rAF on unmount, `performance.now()` is client-only.
- TL gate confirms contract GREEN for /admin/roster and /agents at both widths.

## Not verified / assumptions
- /my-day toolbar click now skipped in the contract (qa-1: real mutating POST) — `md-book-btn` reserve is code-verified only, not runtime-verified; 9rem assumed ≥ "Book focus block" + `.cx-btn` padding (144px is comfortable for ~16 chars).
- Exact rendered rem fit (5.5rem vs "Add user" + padding) not measured live; contract green implies sufficient.
- 1.4.4 (200% text), 1.4.10 (320px rendered), 2.4.7/2.4.11 (focus screenshots) — no visual changes to measure; code-level pass only.
