# ux report - qa-agent-week-grid - round 3 (DELTA)

Verdict: PASS
Open: 0B/0H/0M/2L

States checked (delta on changed region only): sticky corner-header behaviour on horizontal scroll (code-verified vs sibling), semantics (`scope="col"` retained), dark (`--cx-surface` token bg, opaque over scrolled headers), alignment (`min-inline-size:10rem` shared with body `th.qa-cov__name`), keyboard (scroll region `TableScroll` unchanged — `role="region" tabIndex=0 aria-label`; no focusable cells inside table, so sticky cell cannot obscure a focused element, 2.4.11 n/a). Loading/error/empty/page states unchanged since round 1.

## Prior findings

| ID | Sev | Status | Evidence |
|----|-----|--------|----------|
| ux-1 | MED | FIXED ✓ (round 2) | `quality-analytics-page.tsx:483` `<th scope="row" className="qa-cov__name">` — unchanged. |
| ux-2 | LOW | OPEN (deferred, log only) | `title`-only tooltip on non-focusable week-header `th` at :468-475 unchanged; mitigated by section hint. |
| ux-3 | LOW | OPEN (deferred, out of PLAN scope) | Month-grain cosmetic unchanged. |
| ux-4 | MED | FIXED ✓ | `quality-analytics-page.tsx:466` now `<th scope="col" className="qa-cov__name">Agent</th>` — exact fix applied, byte-identical to sibling corner `quality-analytics-charts.tsx:477-479`. `.qa-cov__name` (`src/app/styles/quality.css:163`, scoped `[data-app="quality"]`, not `.qa-cov`-gated) supplies sticky `inset-inline-start:0`, `z-index:1`, opaque `var(--cx-surface)` — corner "Agent" now stays pinned above the sticky name column while `cx-num` week headers (static, z-index auto) scroll beneath it. Misalignment reported in round 2 resolved. |

## New findings

None.

## Consistency pass (delta)

- Corner cell uses the shared class unmodified — no ad-hoc styles; matches sibling corner verbatim (same element, scope, class, label). ✓
- Corner and body row-headers share `min-inline-size:10rem` — column alignment preserved. ✓
- Web Interface Guidelines (changed line): semantic `<th scope="col">` over ARIA ✓; non-interactive header — no aria-label/focus obligations; sticky element overlays no focusable target. ✓

## Not verified / assumptions

- Rendered scroll-overlap at 375px not screenshotted; fix verified by identical class+pattern to the sibling grid whose pinned-corner behaviour was the reference.
- Unrelated uncommitted `active`-toggle edits in the same file (`qa-active-toggle` spec) excluded per tl-2/tl-3 notes.
