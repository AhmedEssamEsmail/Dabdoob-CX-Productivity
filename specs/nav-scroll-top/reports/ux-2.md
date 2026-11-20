# ux report - nav-scroll-top - round 2 (DELTA)

Verdict: PASS
Open: 0/0/0/0

Scope: verify round-1 findings ux-1/ux-2/ux-3 against this round's changed UI
file `src/features/shared/components/ui/Tabs.tsx` (+ import line 5) and its
test `tests/ui/tabs.test.tsx`. No other UI files changed (tl-2).

States checked: RTL scroll model (math verified against negative-scrollLeft
spec), reduced motion (in-app toggle + media query), keyboard/focus (unchanged
this round), mobile/dark/loading/empty/error/disabled — n/a, no rendered UI
delta.

| ID | Sev | file:line | Evidence | Resolution | Owner |
|----|-----|-----------|----------|------------|-------|
| ux-1 | MED -> CLOSED | Tabs.tsx:42-52 | Fix matches the recommended normalization exactly: `physLeft = max + scrollLeft` under RTL, nearest-edge compare in physical space, convert back `targetPhys - max`. Hand-check of the stub case: scrollLeft=-350, max=400 -> physLeft=50, viewport 50-150, tab 300-350 off-screen -> targetPhys=250 -> scrollTo left=-150 -> viewport 250-350, tab revealed. LTR path unchanged. Unit tests assert left:250 (LTR) and left:-150 (RTL). | Fixed as recommended. | dev (done) |
| ux-2 | LOW -> CLOSED | Tabs.tsx:5,50 | `prefersReducedMotion()` from `@/features/shared/shell/i18n` now used; i18n.ts:59-65 honors both `matchMedia` and the in-app `data-reduce-motion` attribute. `typeof document === 'undefined'` guard covers the node vitest env; helper only runs in effects so browser behavior is identical. | Fixed as recommended. | dev (done) |
| ux-3 | LOW (deferred, out of scope) | AppShell.tsx:221-226 | Path-keyed scroll-to-top also fires on popstate; Back lands at top rather than restoring position. PLAN lists back/forward semantics as a non-goal; PM-scoped out per tl-2. | Accepted; no action this round. | — |

## New findings this round

None. Diff-level WIG checks pass: layout reads (`scrollWidth`, `offsetLeft`,
`getComputedStyle`) stay inside the effect helper, not render; `scrollTo`
targets the overflow container only; smooth behavior correctly downgraded to
`auto` under reduced motion; no new controls, labels, colors, or states.

## Passes confirmed

- Both consumers (`.cx-tabs` Tabs, `.tph-tabs` tph-grid `Ya`) share the fixed
  helper — one fix covers both strips.
- `max <= 0` (no overflow) degenerates to `scrollTo(left:0/-0)`, harmless.
- Nearest-edge reveal is preserved in both directions; tab aligns to the
  viewport edge it approached from, in RTL as well as LTR.

## Not verified / assumptions

- RTL still assumes the negative-scrollLeft model (true for current
  Chrome/Edge/Firefox/Safari). Verified via stubs, not a live Arabic session —
  a cheap manual spot-check (`lang=ar`, overflow tab strip, select an
  off-screen tab) would close the residual risk.
- Live e2e not re-run this round per tl-2; layout judged from code.
