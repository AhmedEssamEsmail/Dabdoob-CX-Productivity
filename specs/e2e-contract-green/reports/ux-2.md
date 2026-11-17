# ux report - e2e-contract-green - round 2 (DELTA)

Scope: verify prior open findings; re-review newly changed UI only — `agents-page.tsx` pin `useEffect` (diff: +28 lines at :506-530, per `reports/tl-3.md` and `git diff`; nothing else changed). Web-design-guidelines (fetched fresh) applied to the same diff.

Verdict: PASS
Open: 0B / 0H / 0M / 3L

States checked: keyboard (keydown now aborts pin — wheel/touch/Tab/PgDn covered), loading (skeleton→data pin path unchanged), focus (2.4.11-adjacent yank resolved: any keydown kills the loop), mobile 375 (tl-3 gate: agents contract 2 passed @375+@1024), dark mode (n/a — no color changes), long text/empty/error/disabled (unchanged paths).

| ID | Sev | file:line | Evidence | Exact fix | Owner(dev) |
|---|---|---|---|---|---|
| ux-1 | MED | agents-page.tsx:509-530 | **RESOLVED.** `stop` cancels the rAF loop on `wheel`/`touchmove`/`keydown`/`pointerdown` (`{once:true}`, passive where applicable — correct since `stop` never calls `preventDefault`); cleanup removes all four + cancels rAF on unmount. Wheel, touch-scroll, all keyboard scrolling (Space/PgDn/arrows) and Tab-press (pre-focus-yank) now abort the pin within one frame; WIG "animations interruptible" satisfied. | — | dev |
| ux-4 | LOW | agents-page.tsx:520-524 | Residual gaps of ux-1, narrower than original: (a) native scrollbar drag fires no DOM `pointerdown`/`mousedown` (UA chrome) — a drag during the ≤800ms window still fights the pin per-frame; (b) back-nav scroll restoration still loses on remount — restoration emits no intent event. | Add a `scroll` listener aborting on user/restoration movement: `const onScroll=()=>{if(window.scrollY!==0)stop()}` registered `{passive:true}` (not `{once}` — pin's own scroll-to-0 events must not consume it); remove in cleanup and inside `stop`. Pin holds scrollY at 0, so any nonzero read is external movement. | dev |
| ux-2 | LOW | hub.css:13, refresh.css:29 | Carried from round 1, DEFERRED per FIX rules (tl-3, TRACKER): `min-inline-size` reserves sized to English labels. | Per round 1. | dev |
| ux-3 | LOW | refresh.css:29 vs hub.css:13 | Carried from round 1, DEFERRED: `.roster-add-btn` `:root`-scoped while sibling `md-book-btn` is `[data-app="hub"]`-scoped. | Per round 1. | dev |

## Verified good
- Listener hygiene correct: same `stop` reference for add/remove; `{once:true}` auto-removes on fire; stale-id `cancelAnimationFrame` after abort is harmless; non-once leftover intents can't resurrect the loop.
- `opts`/`AddEventListenerOptions` types fine (tsc clean per tl-3 logs/ux1-tsc.log).
- `keydown` listener is passive-by-default semantics-wise — `stop` doesn't `preventDefault`/`stopPropagation`, so typing in the `sc-from`/`sc-to` date inputs is unaffected.
- No WIG violations in the diff: no layout reads in render (`scrollTo`/`performance.now` live in an effect), no `transition:all`, no focus/outline suppression, no new controls needing labels.

## Not verified / assumptions
- Scrollbar-drag residual is code-reasoned (UA chrome fires no window events on Win/macOS Chrome/Firefox); not reproduced live — low-cost fix proposed anyway.
- Runtime re-verification relies on tl-3's `logs/ux1-pw.log` (2 passed); I did not re-run Playwright — behaviour was judgeable from code.
- ux-1's side note stands: cleaner shared root fix is `Tabs.tsx:58` `scrollIntoView` skipping window scroll on mount — still out of shard scope; future-shard candidate.
