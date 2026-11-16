# ux report - qa-agent-week-grid - round 2 (DELTA)

Verdict: FAIL
Open: 0B/0H/1M/2L

States checked (delta on changed region only): row-header semantics, sticky-name behaviour on horizontal scroll, dark (token bg `var(--cx-surface)`), empty (`td colSpan={13}` unchanged — re-verified by new test), keyboard (scroll region unchanged). Loading/error/page states unchanged since round 1.

## Prior findings

| ID | Sev | Status | Evidence |
|----|-----|--------|----------|
| ux-1 | MED | FIXED ✓ | `quality-analytics-page.tsx:483` now `<th scope="row" className="qa-cov__name">` — exact fix applied. `qa-cov__name` (`src/app/styles/quality.css:163`) supplies sticky `inset-inline-start:0`, opaque `--cx-surface` bg (dark-safe token), strong weight; identical to siblings `audit-queue-coverage.tsx:67`, `quality-analytics-charts.tsx:502`. Descriptor-tree test `tests/quality/qa-agent-weeks-rowhead.test.tsx` pins all three assertions. |
| ux-2 | LOW | OPEN (deferred, log only) | `title`-only tooltip on non-focusable `th` at :468-475 unchanged; acceptable per round-1 note. |
| ux-3 | LOW | OPEN (deferred, out of PLAN scope) | Month-grain cosmetic unchanged. |

## New findings

| ID | Sev | file:line or route+element | Evidence | Exact fix | Owner(dev) |
|----|-----|----------------------------|----------|-----------|------------|
| ux-4 | MED | quality-analytics-page.tsx:466 | Corner `<th scope="col">Agent</th>` lacks `qa-cov__name`, breaking the scrolling-grid pattern it just adopted: in the sibling (`quality-analytics-charts.tsx:477`) the corner cell is sticky so "Agent" stays pinned above the sticky name column while week headers scroll beneath it. Here the corner scrolls away — after horizontal scroll a week label ("08-Nov"…) sits directly above the pinned agent-name column, a misleading column/header misalignment exactly at the narrow widths the sticky fix was for. | `<th scope="col" className="qa-cov__name">Agent</th>` — same class as sibling corner; `min-inline-size:10rem` keeps it aligned with the pinned body column (thead cells are non-sticky/static, so it paints above scrolling headers via z-index:1). | dev |

## Consistency pass (delta)

- Changed cell uses the shared class unmodified — no ad-hoc styles introduced. ✓
- `tbody tr:hover` paints `--cx-surface-2` under non-sticky cells but the sticky `th` keeps `--cx-surface` — same hover behaviour as the two sibling grids; acceptable inherited quirk, not new. ✓
- Test file: stubs only, no source mutation, deterministic (fixed periods, no dates/locale). ✓

## Not verified / assumptions

- Rendered scroll-overlap at 375px not screenshotted; misalignment predicted from CSS (`thead th` static per `cx-kit.css:647-656`, `.qa-cov__name` sticky per `quality.css:163`). Covered conceptually by e2e `page-contract.spec.ts` only if it scrolls the region — assumed not.
- Unrelated uncommitted `active`-toggle edits in the same file (`qa-active-toggle` spec) excluded per tl-2 note.
